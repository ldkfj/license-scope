'use client';

import React, { useRef, useState } from 'react';
import { Send, Shield, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import {
  ArtifactKind,
  UseProfile,
  USE_PROFILES,
  isContractConfigured,
  getClient,
  CONTRACT_ADDRESS,
  connectWalletAndVerifyChain,
  getExplorerTxLink,
  getGenLayerReceiptStatus,
  validateGenLayerReceipt,
  parseAssessmentRecord,
  validateTransactionBinding,
  reconcileRequestRecord,
} from '@/lib/genlayer';
import { waitForFinalizedTransaction } from '@/lib/finality';
import {
  browserStorage,
  pendingTransactionTimestamp,
  type PendingRequestTransaction,
} from '@/lib/pendingTransaction';
import { useTransactionCoordinator } from '@/lib/transactionCoordinator';

interface RequestAssessmentFormProps {
  onTransactionSuccess: () => Promise<void>;
}

export const RequestAssessmentForm: React.FC<RequestAssessmentFormProps> = ({
  onTransactionSuccess,
}) => {
  const { coordinator, state: coordinatorState } = useTransactionCoordinator();
  const [artifactKind, setArtifactKind] = useState<ArtifactKind>('GITHUB_REPO');
  const [namespace, setNamespace] = useState('');
  const [name, setName] = useState('');
  const [revision, setRevision] = useState('');
  const [useProfile, setUseProfile] = useState<UseProfile>('COMMERCIAL_INFERENCE');

  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const reconciliationController = useRef<AbortController | null>(null);

  const isConfigured = isContractConfigured();
  const pendingTx = coordinatorState.phase === 'pending' ? coordinatorState.transaction : null;
  const coordinatorError = coordinatorState.phase === 'blocked' ? coordinatorState.error : null;

  const reconcileRequest = async (pending: PendingRequestTransaction) => {
    const accountAddr = await connectWalletAndVerifyChain();
    if (accountAddr.toLowerCase() !== pending.account.toLowerCase()) {
      throw new Error(`Connect the original submitting wallet ${pending.account} to resume this transaction.`);
    }
    const client = getClient(accountAddr);
    const hash = pending.hash as Parameters<typeof client.waitForTransactionReceipt>[0]['hash'];
    const { payload } = pending;

    setTxHash(pending.hash);
    setStatusMsg('Reconciling the existing transaction hash. No new transaction will be broadcast...');
    let receipt = await client.getTransaction({
      hash: pending.hash as Parameters<typeof client.getTransaction>[0]['hash'],
    });
    let receiptStatus = getGenLayerReceiptStatus(receipt);
    const unsuccessfulTerminalStatuses = new Set(['UNDETERMINED', 'CANCELED', 'VALIDATORS_TIMEOUT', 'LEADER_TIMEOUT']);
    if (unsuccessfulTerminalStatuses.has(receiptStatus)) {
      validateTransactionBinding(receipt, pending);
      const storage = browserStorage();
      if (!storage || !coordinator.complete(pending.hash, storage)) {
        throw new Error('Verified terminal failure could not be cleared from the shared coordinator.');
      }
      setErrorMsg(`Transaction ended ${receiptStatus}; contract state was not created by this transaction.`);
      setStatusMsg(null);
      return;
    }

    if (receiptStatus !== 'FINALIZED') {
      const controller = new AbortController();
      reconciliationController.current = controller;
      try {
        await waitForFinalizedTransaction(client, hash, ({ round, maxRounds }) => {
          setStatusMsg(`Studionet is still processing this same hash (bounded reconciliation ${round}/${maxRounds})...`);
        }, { signal: controller.signal });
      } finally {
        if (reconciliationController.current === controller) reconciliationController.current = null;
      }
      receipt = await client.getTransaction({
        hash: pending.hash as Parameters<typeof client.getTransaction>[0]['hash'],
      });
      receiptStatus = getGenLayerReceiptStatus(receipt);
    }

    let executionResult: string;
    let consensusResult: string;
    try {
      ({ executionResult, consensusResult } = validateGenLayerReceipt(receipt));
    } catch (error: unknown) {
      const failure = error instanceof Error ? error.message : String(error);
      if (receiptStatus === 'FINALIZED' || unsuccessfulTerminalStatuses.has(receiptStatus)) {
        validateTransactionBinding(receipt, pending);
        const storage = browserStorage();
        if (!storage || !coordinator.complete(pending.hash, storage)) {
          throw new Error('Verified terminal failure could not be cleared from the shared coordinator.');
        }
        setErrorMsg(`Request transaction failed: ${failure}`);
        setStatusMsg(null);
        return;
      }
      throw error;
    }

    const { returnedAssessmentId } = validateTransactionBinding(receipt, pending);

    setStatusMsg(`Receipt ${receiptStatus}; consensus ${consensusResult}; execution ${executionResult}. Verifying exact contract record readback...`);
    const rawRecord = await client.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      functionName: 'get_assessment_by_key',
      args: [payload.canonicalKey],
    });
    const rec = parseAssessmentRecord(rawRecord);

    const { statusMessage } = reconcileRequestRecord(pending, rec, returnedAssessmentId);

    const storage = browserStorage();
    if (!storage || !coordinator.complete(pending.hash, storage)) {
      throw new Error('Validated transaction could not be cleared from the shared coordinator.');
    }
    setStatusMsg(statusMessage);
    await onTransactionSuccess();
    setNamespace('');
    setName('');
    setRevision('');
  };

  const handleResume = async () => {
    if (!pendingTx || pendingTx.action !== 'request') return;
    setErrorMsg(null);
    try {
      setLoading(true);
      await reconcileRequest(pendingTx);
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxHash(null);
    setStatusMsg(null);
    setErrorMsg(null);

    if (!isConfigured) {
      setErrorMsg('Deployment not configured. Contract calls are disabled.');
      return;
    }

    if (coordinatorState.phase !== 'idle') {
      setErrorMsg('A broadcast transaction is already pending. Resume its existing hash before initiating another write.');
      return;
    }

    if (artifactKind === 'HF_MODEL' || artifactKind === 'HF_DATASET') {
      setErrorMsg('Hugging Face model and dataset adapters are locked as UNSUPPORTED_V1 in LicenseScope V1.');
      return;
    }

    const trimmedNs = namespace.trim();
    const trimmedName = name.trim();
    const trimmedRev = revision.trim().toLowerCase();

    if (!trimmedNs || !trimmedName || !trimmedRev) {
      setErrorMsg('All fields (Namespace, Name, Revision SHA) are required.');
      return;
    }

    if (trimmedRev.length !== 40 || !/^[0-9a-f]{40}$/.test(trimmedRev)) {
      setErrorMsg('Revision must be a valid 40-character hex commit SHA.');
      return;
    }

    const storage = browserStorage();
    const coordinatorToken = coordinator.acquire('request', storage);
    if (!coordinatorToken || !storage) {
      const lockState = coordinator.getSnapshot();
      setErrorMsg(lockState.phase === 'blocked' ? lockState.error : 'Another state-changing transaction already owns the shared write lock.');
      return;
    }
    let hashReturned = false;

    try {
      setLoading(true);
      setStatusMsg('Connecting Web3 wallet and verifying GenLayer Studionet chain (ID 61999)...');

      const accountAddr = await connectWalletAndVerifyChain();
      const client = getClient(accountAddr);

      setStatusMsg('Broadcasting request_assessment transaction to Studionet...');

      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: 'request_assessment',
        args: [artifactKind, trimmedNs, trimmedName, trimmedRev, useProfile],
        value: BigInt(0),
      });
      hashReturned = true;

      const hashStr = String(hash);
      const canonicalKey = `${artifactKind}:${trimmedNs.toLowerCase()}/${trimmedName.toLowerCase()}@${trimmedRev}#${useProfile}#LS-V1`;
      const pending: PendingRequestTransaction = {
        version: 1,
        contractAddress: CONTRACT_ADDRESS,
        chainId: 61999,
        hash: hashStr,
        account: accountAddr,
        createdAt: pendingTransactionTimestamp(),
        action: 'request',
        payload: { artifactKind, namespace: trimmedNs, name: trimmedName, revision: trimmedRev, useProfile, canonicalKey },
      };
      setTxHash(hashStr);
      coordinator.promote(coordinatorToken, pending, storage);
      setStatusMsg('Transaction broadcasted. Waiting for block receipt...');
      await reconcileRequest(pending);
    } catch (err: unknown) {
      if (!hashReturned) coordinator.release(coordinatorToken);
      const msg = err instanceof Error ? err.message : 'Transaction failed.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const explorerLink = getExplorerTxLink(txHash);

  return (
    <section className="ls-panel" aria-labelledby="request-attestation-heading">
      <div className="ls-panel__head">
        <div className="min-w-0">
          <h2 id="request-attestation-heading" className="ls-panel__title">
            <Shield className="w-5 h-5 ls-panel__title-icon" aria-hidden="true" />
            Submit License Attestation Request
          </h2>
          <p className="ls-panel__desc">
            Register a code repository or artifact for Intelligent Contract consensus rights evaluation.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-[var(--space-sm)]">
        {!isConfigured && (
          <div className="ls-alert ls-alert--warn" role="status">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <div className="ls-alert__body">
              <div className="font-semibold">Deployment not configured</div>
              <div className="mt-0.5 opacity-90">
                Designed for GenLayer Studionet; set NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local to enable interactive Attestation requests.
              </div>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="ls-alert ls-alert--err" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <div className="ls-alert__body">{errorMsg}</div>
            <button type="button" onClick={() => setErrorMsg(null)} className="ls-btn ls-btn--danger-text">
              Dismiss
            </button>
          </div>
        )}

        {coordinatorError && !errorMsg && (
          <div className="ls-alert ls-alert--err" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <div className="ls-alert__body">Shared transaction coordinator blocked: {coordinatorError}</div>
          </div>
        )}

        {statusMsg && !errorMsg && (
          <div className="ls-alert ls-alert--info" role="status" aria-live="polite">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <div className="ls-alert__body">
              <div className="font-semibold">{statusMsg}</div>
              {txHash && (
                <div className="mt-1 text-[0.6875rem] opacity-90 break-all flex flex-wrap items-center gap-2">
                  <span>Tx Hash: {txHash}</span>
                  {explorerLink && (
                    <a
                      href={explorerLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ls-link"
                    >
                      Explorer <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {pendingTx && (
          <div className="ls-alert ls-alert--warn" role="status">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <div className="ls-alert__body min-w-0">
              Pending {pendingTx.action} transaction: {pendingTx.hash}. New writes are locked until this hash is reconciled.
            </div>
            {pendingTx.action === 'request' && (
              <div className="ls-alert__actions">
                {loading && (
                  <button
                    type="button"
                    onClick={() => reconciliationController.current?.abort()}
                    className="ls-btn ls-btn--secondary ls-btn--sm"
                  >
                    Stop tracking
                  </button>
                )}
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleResume}
                  className="ls-btn ls-btn--warn ls-btn--sm"
                >
                  Resume existing Tx
                </button>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="ls-form">
          <div className="ls-field-grid">
            <div className="ls-field">
              <label htmlFor="artifact-kind" className="ls-label">Artifact kind</label>
              <select
                id="artifact-kind"
                disabled={!isConfigured || loading}
                value={artifactKind}
                onChange={(e) => setArtifactKind(e.target.value as ArtifactKind)}
                className="ls-select"
              >
                <option value="GITHUB_REPO">GITHUB_REPO (Supported)</option>
                <option value="HF_MODEL" disabled>
                  HF_MODEL (Unsupported in V1)
                </option>
                <option value="HF_DATASET" disabled>
                  HF_DATASET (Unsupported in V1)
                </option>
              </select>
            </div>

            <div className="ls-field">
              <label htmlFor="namespace" className="ls-label">Namespace / owner</label>
              <input
                id="namespace"
                type="text"
                disabled={!isConfigured || loading}
                placeholder="e.g. facebookresearch"
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
                className="ls-input"
                autoComplete="off"
              />
            </div>

            <div className="ls-field">
              <label htmlFor="repo-name" className="ls-label">Repository / name</label>
              <input
                id="repo-name"
                type="text"
                disabled={!isConfigured || loading}
                placeholder="e.g. llama"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="ls-input"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="ls-field">
            <label htmlFor="revision-sha" className="ls-label">Git commit SHA (40 hex chars)</label>
            <input
              id="revision-sha"
              type="text"
              disabled={!isConfigured || loading}
              placeholder="e.g. a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"
              value={revision}
              onChange={(e) => setRevision(e.target.value)}
              className="ls-input ls-input--mono"
              spellCheck={false}
              autoComplete="off"
              inputMode="text"
            />
          </div>

          <fieldset className="ls-field border-0 p-0 m-0">
            <legend className="ls-label mb-[var(--space-2xs)]">Intended use profile</legend>
            <div className="ls-radio-grid">
              {USE_PROFILES.map((prof) => (
                <label
                  key={prof.id}
                  className={`ls-radio${useProfile === prof.id ? ' is-selected' : ''}${!isConfigured || loading ? ' is-disabled' : ''}`}
                >
                  <input
                    type="radio"
                    name="useProfile"
                    disabled={!isConfigured || loading}
                    checked={useProfile === prof.id}
                    onChange={() => setUseProfile(prof.id)}
                  />
                  <div className="min-w-0">
                    <div className="ls-radio__label">{prof.label}</div>
                    <div className="ls-radio__desc">{prof.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={!isConfigured || loading || coordinatorState.phase !== 'idle'}
            className="ls-btn ls-btn--primary ls-btn--block"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="ls-spinner" aria-hidden="true" />
                Processing transaction…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="w-4 h-4" aria-hidden="true" />
                Submit Attestation Request on Studionet
              </span>
            )}
          </button>
        </form>
      </div>
    </section>
  );
};
