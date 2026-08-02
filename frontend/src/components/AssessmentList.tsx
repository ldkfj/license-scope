'use client';

import React, { useRef, useState } from 'react';
import { Layers, RefreshCw, Eye, Play, RotateCcw, Search, CheckCircle2, XCircle, HelpCircle, ExternalLink } from 'lucide-react';
import {
  AssessmentRecord,
  STATUS_MAP,
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
}

export const AssessmentList: React.FC<AssessmentListProps> = ({
  assessments,
  onSelectRecord,
  onRefresh,
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
        <span className="text-emerald-400 flex items-center gap-1 font-mono text-[11px]">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          EXACT
        </span>
      );
    } else if (state === 'MISMATCH') {
      return (
        <span className="text-rose-400 flex items-center gap-1 font-mono text-[11px]">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          MISMATCH
        </span>
      );
    }
    return (
      <span className="text-amber-400 flex items-center gap-1 font-mono text-[11px]">
        <HelpCircle className="w-3.5 h-3.5 shrink-0" />
        NOT EVALUATED
      </span>
    );
  };

  const explorerLink = getExplorerTxLink(activeTxHash);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-2xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            Rights Assessment Registry
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Registered Intelligent Contract assessment records and consensus verdicts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by repo, SHA, or key..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-white rounded-xl pl-9 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none placeholder-slate-600 w-48 sm:w-64"
            />
          </div>

          <button
            onClick={() => onRefresh()}
            disabled={!isConfigured}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center justify-center transition-colors disabled:opacity-40"
            title="Refresh Registry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {statusMsg && !errorMsg && (
        <div className="p-3 bg-cyan-950/50 border border-cyan-500/30 rounded-xl text-cyan-300 text-xs font-mono space-y-1">
          <div>{statusMsg}</div>
          {activeTxHash && (
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>Tx Hash: {activeTxHash}</span>
              {explorerLink && (
                <a
                  href={explorerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline flex items-center gap-1"
                >
                  Explorer <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-950/50 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center justify-between font-mono">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {coordinatorError && !errorMsg && (
        <div className="p-3 bg-rose-950/50 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono">
          Shared transaction coordinator blocked: {coordinatorError}
        </div>
      )}

      {pendingTx && (
        <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl text-amber-200 text-xs font-mono flex items-center justify-between gap-3">
          <span>Pending {pendingTx.action} transaction: {pendingTx.hash}. All new writes are locked; resume the same hash from its matching action.</span>
          {actionLoadingId !== null && pendingTx.action !== 'request' && (
            <button type="button" onClick={() => reconciliationController.current?.abort()} className="shrink-0 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white">
              Stop tracking
            </button>
          )}
        </div>
      )}

      {filteredAssessments.length === 0 ? (
        <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-slate-800/80 space-y-2">
          <Layers className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-300">No Assessment Records Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {!isConfigured
              ? 'Contract is not configured. Configure NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local.'
              : assessments.length > 0
                ? `No records match "${searchTerm.trim()}". Clear the search or try an assessment ID such as #1.`
                : 'Submit a new rights attestation request to register an assessment record on Studionet.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px] bg-slate-950/40">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Artifact / Repo</th>
                <th className="py-3 px-4">Revision SHA</th>
                <th className="py-3 px-4">Profile</th>
                <th className="py-3 px-4">Subject Match</th>
                <th className="py-3 px-4">Verdict Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredAssessments.map((rec) => {
                const statusMeta = STATUS_MAP[rec.status] || {
                  name: rec.status_name,
                  badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
                };

                const isLoading = actionLoadingId === rec.assessment_id;
                const isMatchingPending = pendingTx !== null
                  && pendingTx.action !== 'request'
                  && pendingTx.payload.assessmentId === rec.assessment_id;

                return (
                  <tr
                    key={rec.assessment_id}
                    onClick={() => onSelectRecord(rec)}
                    className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-300">#{rec.assessment_id}</td>
                    <td className="py-3 px-4 font-semibold text-slate-200">
                      <div>
                        {rec.namespace}/{rec.name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-normal">{rec.artifact_kind}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-cyan-400 text-[11px]">
                      {rec.revision.substring(0, 10)}...
                    </td>
                    <td className="py-3 px-4 text-slate-300 text-[11px]">{rec.use_profile}</td>
                    <td className="py-3 px-4">{renderMatchBadge(rec.subject_match)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusMeta.badgeClass}`}>
                        {rec.status_name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {isMatchingPending && (
                          <button
                            disabled={!isConfigured || isLoading}
                            onClick={(e) => resumePendingAssessment(e, rec)}
                            className="bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all disabled:opacity-40"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Resume Tx
                          </button>
                        )}

                        {!isMatchingPending && rec.status === 1 && (
                          <button
                            disabled={!isConfigured || isLoading || coordinatorState.phase !== 'idle'}
                            onClick={(e) => handleResolve(e, rec)}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all disabled:opacity-40"
                          >
                            <Play className="w-3 h-3" />
                            Resolve
                          </button>
                        )}

                        {!isMatchingPending && rec.status === 5 && rec.retry_count < 2 && (
                          <button
                            disabled={!isConfigured || isLoading || coordinatorState.phase !== 'idle'}
                            onClick={(e) => handleRetry(e, rec)}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all disabled:opacity-40"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Retry ({rec.retry_count}/2)
                          </button>
                        )}

                        <button
                          onClick={() => onSelectRecord(rec)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded-lg text-[11px] flex items-center gap-1 transition-all"
                        >
                          <Eye className="w-3 h-3" />
                          Detail
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
