'use client';

import React, { useRef, useState } from 'react';
import { Layers, RefreshCw, Eye, Play, RotateCcw, Search, CheckCircle2, XCircle, HelpCircle, ExternalLink } from 'lucide-react';
import {
  AssessmentRecord,
  isContractConfigured,
  getClient,
  CONTRACT_ADDRESS,
  connectWalletAndVerifyChain,
  getExplorerTxLink,
  validateGenLayerReceipt,
  parseAssessmentRecord,
  assertSameAssessmentIdentity,
  assertTerminalRecord,
  MatchTriState,
} from '@/lib/genlayer';
import { waitForFinalizedTransaction } from '@/lib/finality';
import {
  browserStorage,
  pendingTransactionTimestamp,
  type PendingAssessmentTransaction,
} from '@/lib/pendingTransaction';
import { useTransactionCoordinator } from '@/lib/transactionCoordinator';

interface AssessmentListProps {
  assessments: AssessmentRecord[];
  onSelectRecord: (record: AssessmentRecord) => void;
  onRefresh: () => Promise<void>;
  isLoading: boolean;
  loadError: string | null;
}

export const AssessmentList: React.FC<AssessmentListProps> = ({
  assessments,
  onSelectRecord,
  onRefresh,
  isLoading,
  loadError,
}) => {
  const { coordinator, state: coordinatorState } = useTransactionCoordinator();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [activeTxHash, setActiveTxHash] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const reconciliationController = useRef<AbortController | null>(null);

  const isConfigured = isContractConfigured();
  const pendingTx = coordinatorState.phase === 'pending' ? coordinatorState.transaction : null;
  const coordinatorError = coordinatorState.phase === 'blocked' ? coordinatorState.error : null;

  const reconcileAssessment = async (pending: PendingAssessmentTransaction, record: AssessmentRecord) => {
    const accountAddr = await connectWalletAndVerifyChain();
    if (accountAddr.toLowerCase() !== pending.account.toLowerCase()) {
      throw new Error(`Connect the original submitting wallet ${pending.account} to resume this transaction.`);
    }
    if (record.assessment_id !== pending.payload.assessmentId || record.canonical_key !== pending.payload.canonicalKey) {
      throw new Error('Pending transaction does not match this assessment record.');
    }
    const client = getClient(accountAddr);
    setActiveTxHash(pending.hash);
    setStatusMsg(`Reconciling existing ${pending.action} hash for #${record.assessment_id}. No new transaction will be broadcast...`);
    const controller = new AbortController();
    reconciliationController.current = controller;
    try {
      await waitForFinalizedTransaction(
        client,
        pending.hash as Parameters<typeof client.waitForTransactionReceipt>[0]['hash'],
        ({ round, maxRounds }) => setStatusMsg(`Studionet is still processing this same hash (bounded reconciliation ${round}/${maxRounds})...`),
        { signal: controller.signal },
      );
    } finally {
      if (reconciliationController.current === controller) reconciliationController.current = null;
    }
    const receipt = await client.getTransaction({
      hash: pending.hash as Parameters<typeof client.getTransaction>[0]['hash'],
    });
    const { status: receiptStatus, executionResult, consensusResult } = validateGenLayerReceipt(receipt);
    setStatusMsg(`Receipt ${receiptStatus}; consensus ${consensusResult}; execution ${executionResult}. Verifying contract readback...`);
    const rawReadback = await client.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      functionName: 'get_assessment',
      args: [BigInt(record.assessment_id)],
    });
    const rec = parseAssessmentRecord(rawReadback);
    assertSameAssessmentIdentity(record, rec);

    if (pending.action === 'resolve') {
      if (rec.retry_count !== pending.payload.retryCount) throw new Error(`Resolve unexpectedly changed retry_count from ${pending.payload.retryCount} to ${rec.retry_count}.`);
      assertTerminalRecord(rec);
      setStatusMsg(`Resolution finalized! Verdict: ${rec.status_name} (${rec.reason_code})`);
    } else {
      if (rec.status !== 1 || rec.status_name !== 'PENDING' || rec.verdict !== 'PENDING' || rec.reason_code !== '') throw new Error('Retry atomic reset failed: status expected PENDING (1) with empty reason code.');
      if (rec.subject_match !== 'UNCLEAR' || rec.revision_match !== 'UNCLEAR' || rec.evidence_sufficient !== false) throw new Error('Retry atomic reset failed: match or evidence fields retained terminal values.');
      if (rec.license_ids.length !== 0 || rec.obligations.length !== 0 || rec.evidence_references.length !== 0) throw new Error('Retry atomic reset failed: license, obligation, or evidence arrays retained terminal values.');
      if (rec.retry_count !== pending.payload.retryCount + 1) throw new Error(`Retry count verification failed: expected ${pending.payload.retryCount + 1}, got ${rec.retry_count}.`);
      if (rec.explanation !== 'Assessment retry queued, awaiting leader-validator consensus resolution.') throw new Error('Retry readback explanation did not match the contract PENDING reset message.');
      setStatusMsg('Retry finalized! Assessment reset to PENDING.');
    }

    const storage = browserStorage();
    if (!storage || !coordinator.complete(pending.hash, storage)) {
      throw new Error('Validated transaction could not be cleared from the shared coordinator.');
    }
    await onRefresh();
  };

  const resumePendingAssessment = async (e: React.MouseEvent, record: AssessmentRecord) => {
    e.stopPropagation();
    if (!pendingTx || pendingTx.action === 'request') return;
    setErrorMsg(null);
    try {
      setActionLoadingId(record.assessment_id);
      await reconcileAssessment(pendingTx, record);
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : String(error));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResolve = async (e: React.MouseEvent, record: AssessmentRecord) => {
    e.stopPropagation();
    setErrorMsg(null);
    setStatusMsg(null);
    setActiveTxHash(null);

    if (!isConfigured) {
      setErrorMsg('Deployment not configured. Contract calls are disabled.');
      return;
    }
    if (coordinatorState.phase !== 'idle') {
      setErrorMsg('A broadcast transaction is already pending. Resume its existing hash before initiating another write.');
      return;
    }

    const storage = browserStorage();
    const coordinatorToken = coordinator.acquire('resolve', storage);
    if (!coordinatorToken || !storage) {
      const lockState = coordinator.getSnapshot();
      setErrorMsg(lockState.phase === 'blocked' ? lockState.error : 'Another state-changing transaction already owns the shared write lock.');
      return;
    }
    let hashReturned = false;

    try {
      setActionLoadingId(record.assessment_id);
      setStatusMsg(`Connecting wallet and verifying chain 61999 for assessment #${record.assessment_id}...`);

      const accountAddr = await connectWalletAndVerifyChain();
      const client = getClient(accountAddr);

      setStatusMsg(`Broadcasting resolve_assessment transaction for #${record.assessment_id}...`);

      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: 'resolve_assessment',
        args: [BigInt(record.assessment_id)],
        value: BigInt(0),
      });
      hashReturned = true;

      const hashStr = String(hash);
      const pending: PendingAssessmentTransaction = {
        version: 1,
        contractAddress: CONTRACT_ADDRESS,
        chainId: 61999,
        hash: hashStr,
        account: accountAddr,
        createdAt: pendingTransactionTimestamp(),
        action: 'resolve',
        payload: { assessmentId: record.assessment_id, canonicalKey: record.canonical_key, retryCount: record.retry_count },
      };
      setActiveTxHash(hashStr);
      coordinator.promote(coordinatorToken, pending, storage);
      setStatusMsg(`Transaction broadcasted. Waiting for block receipt...`);
      await reconcileAssessment(pending, record);
    } catch (err: unknown) {
      if (!hashReturned) coordinator.release(coordinatorToken);
      const msg = err instanceof Error ? err.message : 'Resolve execution failed.';
      setErrorMsg(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRetry = async (e: React.MouseEvent, record: AssessmentRecord) => {
    e.stopPropagation();
    setErrorMsg(null);
    setStatusMsg(null);
    setActiveTxHash(null);

    if (!isConfigured) {
      setErrorMsg('Deployment not configured. Contract calls are disabled.');
      return;
    }
    if (coordinatorState.phase !== 'idle') {
      setErrorMsg('A broadcast transaction is already pending. Resume its existing hash before initiating another write.');
      return;
    }

    const storage = browserStorage();
    const coordinatorToken = coordinator.acquire('retry', storage);
    if (!coordinatorToken || !storage) {
      const lockState = coordinator.getSnapshot();
      setErrorMsg(lockState.phase === 'blocked' ? lockState.error : 'Another state-changing transaction already owns the shared write lock.');
      return;
    }
    let hashReturned = false;

    try {
      setActionLoadingId(record.assessment_id);
      setStatusMsg(`Connecting wallet and verifying chain 61999 for retry #${record.assessment_id}...`);

      const accountAddr = await connectWalletAndVerifyChain();
      const client = getClient(accountAddr);

      setStatusMsg(`Broadcasting retry_assessment transaction for #${record.assessment_id}...`);

      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: 'retry_assessment',
        args: [BigInt(record.assessment_id)],
        value: BigInt(0),
      });
      hashReturned = true;

      const hashStr = String(hash);
      const pending: PendingAssessmentTransaction = {
        version: 1,
        contractAddress: CONTRACT_ADDRESS,
        chainId: 61999,
        hash: hashStr,
        account: accountAddr,
        createdAt: pendingTransactionTimestamp(),
        action: 'retry',
        payload: { assessmentId: record.assessment_id, canonicalKey: record.canonical_key, retryCount: record.retry_count },
      };
      setActiveTxHash(hashStr);
      coordinator.promote(coordinatorToken, pending, storage);
      setStatusMsg(`Transaction broadcasted. Waiting for block receipt...`);
      await reconcileAssessment(pending, record);
    } catch (err: unknown) {
      if (!hashReturned) coordinator.release(coordinatorToken);
      const msg = err instanceof Error ? err.message : 'Retry execution failed.';
      setErrorMsg(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredAssessments = assessments.filter((rec) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const normalizedIdTerm = term.startsWith('#') ? term.slice(1).trim() : term;
    const matchesAssessmentId = /^\d+$/.test(normalizedIdTerm)
      && String(rec.assessment_id) === normalizedIdTerm;
    return (
      matchesAssessmentId ||
      rec.canonical_key.toLowerCase().includes(term) ||
      rec.namespace.toLowerCase().includes(term) ||
      rec.name.toLowerCase().includes(term) ||
      rec.revision.toLowerCase().includes(term) ||
      rec.reason_code.toLowerCase().includes(term)
    );
  });

  const renderMatchBadge = (state: MatchTriState) => {
    if (state === 'EXACT') {
      return (
        <span className="ls-status ls-status--ok">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          EXACT
        </span>
      );
    } else if (state === 'MISMATCH') {
      return (
        <span className="ls-status ls-status--err">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          MISMATCH
        </span>
      );
    }
    return (
      <span className="ls-status ls-status--warn">
        <HelpCircle className="w-3.5 h-3.5 shrink-0" />
        NOT EVALUATED
      </span>
    );
  };

  const statusTone = (status: number) => {
    if (status === 2) return 'ok';
    if (status === 4) return 'err';
    if (status === 1) return 'pending';
    return 'warn';
  };

  const renderActions = (rec: AssessmentRecord) => {
    const actionIsLoading = actionLoadingId === rec.assessment_id;
    const isMatchingPending = pendingTx !== null
      && pendingTx.action !== 'request'
      && pendingTx.payload.assessmentId === rec.assessment_id;

    return (
      <>
        {isMatchingPending && (
          <button
            disabled={!isConfigured || actionIsLoading}
            onClick={(e) => void resumePendingAssessment(e, rec)}
            className="ls-btn ls-btn--warn ls-btn--sm"
          >
            <RotateCcw className="w-3 h-3" /> Resume Tx
          </button>
        )}
        {!isMatchingPending && rec.status === 1 && (
          <button
            disabled={!isConfigured || actionIsLoading || coordinatorState.phase !== 'idle'}
            onClick={(e) => void handleResolve(e, rec)}
            className="ls-btn ls-btn--primary ls-btn--sm"
          >
            <Play className="w-3 h-3" /> Resolve
          </button>
        )}
        {!isMatchingPending && rec.status === 5 && rec.retry_count < 2 && (
          <button
            disabled={!isConfigured || actionIsLoading || coordinatorState.phase !== 'idle'}
            onClick={(e) => void handleRetry(e, rec)}
            className="ls-btn ls-btn--secondary ls-btn--sm"
          >
            <RotateCcw className="w-3 h-3" /> Retry ({rec.retry_count}/2)
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectRecord(rec);
          }}
          className="ls-btn ls-btn--ghost ls-btn--sm"
        >
          <Eye className="w-3 h-3" /> Detail
        </button>
      </>
    );
  };

  const explorerLink = getExplorerTxLink(activeTxHash);

  return (
    <section className="ls-panel">
      <div className="ls-panel__head">
        <div>
          <h2 className="ls-panel__title">
            <Layers className="ls-panel__title-icon w-5 h-5" />
            Rights Assessment Registry
          </h2>
          <p className="ls-panel__desc">
            Registered Intelligent Contract assessment records and consensus verdicts.
          </p>
        </div>

        <div className="ls-toolbar">
          <div className="ls-search">
            <Search className="ls-search__icon w-4 h-4" />
            <input
              type="text"
              placeholder="Search by repo, SHA, or key..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ls-search__input"
            />
          </div>

          <button
            onClick={() => void onRefresh()}
            disabled={!isConfigured || isLoading}
            className="ls-icon-btn"
            title="Refresh Registry"
            aria-label="Refresh assessment registry"
          >
            {isLoading ? <span className="ls-spinner ls-spinner--accent" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {statusMsg && !errorMsg && (
        <div className="ls-alert ls-alert--info">
          <div className="ls-alert__body">
          <div>{statusMsg}</div>
          {activeTxHash && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span>Tx Hash: {activeTxHash}</span>
              {explorerLink && (
                <a
                  href={explorerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ls-link"
                >
                  Explorer <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="ls-alert ls-alert--err">
          <span className="ls-alert__body">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ls-btn ls-btn--danger-text">
            Dismiss
          </button>
        </div>
      )}

      {coordinatorError && !errorMsg && (
        <div className="ls-alert ls-alert--err">
          Shared transaction coordinator blocked: {coordinatorError}
        </div>
      )}

      {loadError && (
        <div role="alert" className="ls-alert ls-alert--err">
          <span className="ls-alert__body">{loadError}</span>
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={isLoading}
            className="ls-btn ls-btn--secondary ls-btn--sm"
          >
            Retry read
          </button>
        </div>
      )}

      {pendingTx && (
        <div className="ls-alert ls-alert--warn">
          <span className="ls-alert__body">Pending {pendingTx.action} transaction: {pendingTx.hash}. All new writes are locked; resume the same hash from its matching action.</span>
          {actionLoadingId !== null && pendingTx.action !== 'request' && (
            <button type="button" onClick={() => reconciliationController.current?.abort()} className="ls-btn ls-btn--secondary ls-btn--sm">
              Stop tracking
            </button>
          )}
        </div>
      )}

      {loadError && assessments.length === 0 ? null : isLoading && assessments.length === 0 ? (
        <div className="ls-empty" role="status">
          <span className="ls-spinner ls-spinner--accent mx-auto" />
          <h3 className="ls-empty__title">Loading Assessment Records</h3>
        </div>
      ) : filteredAssessments.length === 0 ? (
        <div className="ls-empty">
          <Layers className="w-8 h-8 mx-auto" />
          <h3 className="ls-empty__title">No Assessment Records Found</h3>
          <p className="ls-empty__desc">
            {!isConfigured
              ? 'Contract is not configured. Configure NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local.'
              : assessments.length > 0
                ? `No records match "${searchTerm.trim()}". Clear the search or try an assessment ID such as #1.`
                : 'Submit a new rights attestation request to register an assessment record on Studionet.'}
          </p>
        </div>
      ) : (
        <>
        <div className="ls-table-wrap">
          <table className="ls-table">
            <thead>
              <tr>
                <th>ID</th><th>Artifact / Repo</th><th>Revision SHA</th><th>Profile</th>
                <th>Subject Match</th><th>Verdict Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssessments.map((rec) => {
                return (
                  <tr
                    key={rec.assessment_id}
                    onClick={() => onSelectRecord(rec)}
                  >
                    <td className="ls-table__mono">#{rec.assessment_id}</td>
                    <td>
                      <div>
                        {rec.namespace}/{rec.name}
                      </div>
                      <div className="text-[10px] text-[var(--color-muted)]">{rec.artifact_kind}</div>
                    </td>
                    <td className="ls-table__mono">
                      {rec.revision.substring(0, 10)}...
                    </td>
                    <td>{rec.use_profile}</td>
                    <td>{renderMatchBadge(rec.subject_match)}</td>
                    <td>
                      <span className={`ls-badge ls-badge--${statusTone(rec.status)}`}>
                        {rec.status_name}
                      </span>
                    </td>
                    <td>
                      <div className="ls-table__actions" onClick={(e) => e.stopPropagation()}>
                        {renderActions(rec)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="ls-records">
          {filteredAssessments.map((rec) => (
            <article key={rec.assessment_id} className="ls-record" onClick={() => onSelectRecord(rec)}>
              <div className="ls-record__top">
                <span className="ls-record__id">#{rec.assessment_id}</span>
                <span className={`ls-badge ls-badge--${statusTone(rec.status)}`}>{rec.status_name}</span>
              </div>
              <div className="ls-record__grid">
                <div className="ls-record__row"><span className="ls-record__k">Artifact / repo</span><span className="ls-record__v">{rec.namespace}/{rec.name} · {rec.artifact_kind}</span></div>
                <div className="ls-record__row"><span className="ls-record__k">Revision</span><span className="ls-record__v ls-table__mono">{rec.revision}</span></div>
                <div className="ls-record__row"><span className="ls-record__k">Profile</span><span className="ls-record__v">{rec.use_profile}</span></div>
                <div className="ls-record__row"><span className="ls-record__k">Subject match</span><span className="ls-record__v">{renderMatchBadge(rec.subject_match)}</span></div>
              </div>
              <div className="ls-record__actions" onClick={(e) => e.stopPropagation()}>{renderActions(rec)}</div>
            </article>
          ))}
        </div>
        </>
      )}
    </section>
  );
};
