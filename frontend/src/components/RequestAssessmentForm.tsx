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
  validateGenLayerReceipt,
  parseAssessmentRecord,
  POLICY_HASH,
} from '@/lib/genlayer';
import { waitForFinalizedTransaction } from '@/lib/finality';
import {
  browserStorage,
  clearPendingTransaction,
  loadPendingTransaction,
  pendingTransactionTimestamp,
  savePendingTransaction,
  type PendingRequestTransaction,
  type PendingTransaction,
} from '@/lib/pendingTransaction';

interface RequestAssessmentFormProps {
  onTransactionSuccess: () => Promise<void>;
}

function loadInitialPending(): { pending: PendingTransaction | null; error: string | null } {
  const storage = browserStorage();
  if (!storage || !isContractConfigured()) return { pending: null, error: null };
  try {
    return { pending: loadPendingTransaction(storage, CONTRACT_ADDRESS), error: null };
  } catch (error: unknown) {
    return { pending: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export const RequestAssessmentForm: React.FC<RequestAssessmentFormProps> = ({
  onTransactionSuccess,
}) => {
  const [initialPending] = useState(loadInitialPending);
  const [artifactKind, setArtifactKind] = useState<ArtifactKind>('GITHUB_REPO');
  const [namespace, setNamespace] = useState('');
  const [name, setName] = useState('');
  const [revision, setRevision] = useState('');
  const [useProfile, setUseProfile] = useState<UseProfile>('COMMERCIAL_INFERENCE');

  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(initialPending.pending?.action === 'request' ? initialPending.pending.hash : null);
  const [statusMsg, setStatusMsg] = useState<string | null>(initialPending.pending?.action === 'request' ? 'A previously broadcast request is pending. Resume this exact hash; a new broadcast is locked.' : null);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialPending.error);
  const [pendingTx, setPendingTx] = useState<PendingTransaction | null>(initialPending.pending);
  const reconciliationController = useRef<AbortController | null>(null);

  const isConfigured = isContractConfigured();

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
    const controller = new AbortController();
    reconciliationController.current = controller;
    try {
      await waitForFinalizedTransaction(client, hash, ({ round, maxRounds }) => {
        setStatusMsg(`Studionet is still processing this same hash (bounded reconciliation ${round}/${maxRounds})...`);
      }, { signal: controller.signal });
    } finally {
      if (reconciliationController.current === controller) reconciliationController.current = null;
    }
    const receipt = await client.getTransaction({
      hash: pending.hash as Parameters<typeof client.getTransaction>[0]['hash'],
    });

    const { status: receiptStatus, executionResult, consensusResult } = validateGenLayerReceipt(receipt);
    setStatusMsg(`Receipt ${receiptStatus}; consensus ${consensusResult}; execution ${executionResult}. Verifying exact contract record readback...`);
    const rawRecord = await client.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      functionName: 'get_assessment_by_key',
      args: [payload.canonicalKey],
    });
    const rec = parseAssessmentRecord(rawRecord);

    if (rec.canonical_key !== payload.canonicalKey) throw new Error(`Readback canonical key mismatch: expected ${payload.canonicalKey}, got ${rec.canonical_key}.`);
    if (rec.artifact_kind !== payload.artifactKind || rec.use_profile !== payload.useProfile) throw new Error('Readback artifact kind or use profile mismatch.');
    if (rec.namespace.toLowerCase() !== payload.namespace.toLowerCase() || rec.name.toLowerCase() !== payload.name.toLowerCase()) throw new Error('Readback namespace or repository name mismatch.');
    if (rec.revision.toLowerCase() !== payload.revision) throw new Error('Readback commit SHA revision mismatch.');
    if (rec.requester.toLowerCase() !== pending.account.toLowerCase()) throw new Error(`Readback requester address mismatch: expected ${pending.account}, got ${rec.requester}.`);
    if (rec.status !== 1 || rec.status_name !== 'PENDING' || rec.verdict !== 'PENDING' || rec.reason_code !== '') throw new Error('Readback status or reason code mismatch for initial PENDING state.');
    if (rec.subject_match !== 'UNCLEAR' || rec.revision_match !== 'UNCLEAR' || rec.evidence_sufficient !== false) throw new Error('Readback tri-state or evidence sufficiency mismatch for initial PENDING state.');
    if (rec.license_ids.length !== 0 || rec.obligations.length !== 0 || rec.evidence_references.length !== 0) throw new Error('Readback license, obligation, or evidence references not empty for PENDING state.');
    if (rec.policy_version !== 'LS-V1' || rec.policy_hash !== POLICY_HASH) throw new Error('Readback policy version or manifest hash mismatch.');

    const storage = browserStorage();
    if (storage) clearPendingTransaction(storage, CONTRACT_ADDRESS, pending.hash);
    setPendingTx(null);
    setStatusMsg('Attestation request successfully registered and verified on Studionet!');
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

    if (pendingTx || initialPending.error) {
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
      setPendingTx(pending);
      const storage = browserStorage();
      if (!storage) throw new Error('Browser storage unavailable; refusing to continue without same-hash recovery protection.');
      savePendingTransaction(storage, pending);
      setStatusMsg('Transaction broadcasted. Waiting for block receipt...');
      await reconcileRequest(pending);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transaction failed.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const explorerLink = getExplorerTxLink(txHash);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800/50 flex items-center justify-center text-cyan-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Submit License Attestation Request</h2>
            <p className="text-xs text-slate-400">
              Register a code repository or artifact for Intelligent Contract consensus rights evaluation.
            </p>
          </div>
        </div>
      </div>

      {!isConfigured && (
        <div className="p-4 bg-amber-950/40 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center gap-3 font-mono">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
          <div>
            <div className="font-bold">Deployment not configured</div>
            <div className="text-[11px] text-amber-400/80 mt-0.5">
              Designed for GenLayer Studionet; set NEXT_PUBLIC_CONTRACT_ADDRESS in .env.local to enable interactive Attestation requests.
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-950/50 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-3 font-mono">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <div className="flex-1">{errorMsg}</div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {statusMsg && !errorMsg && (
        <div className="p-4 bg-cyan-950/40 border border-cyan-500/30 rounded-xl text-cyan-300 text-xs flex items-center gap-3 font-mono">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-cyan-400 animate-pulse" />
          <div>
            <div className="font-bold">{statusMsg}</div>
            {txHash && (
              <div className="text-[10px] text-slate-400 mt-1 break-all flex items-center gap-2">
                <span>Tx Hash: {txHash}</span>
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
        </div>
      )}

      {pendingTx && (
        <div className="p-4 bg-amber-950/40 border border-amber-500/30 rounded-xl text-amber-200 text-xs font-mono flex items-center justify-between gap-3">
          <span>
            Pending {pendingTx.action} transaction: {pendingTx.hash}. New writes are locked until this hash is reconciled.
          </span>
          {pendingTx.action === 'request' && (
            <div className="shrink-0 flex gap-2">
              {loading && (
                <button type="button" onClick={() => reconciliationController.current?.abort()} className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white">
                  Stop tracking
                </button>
              )}
              <button type="button" disabled={loading} onClick={handleResume} className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40">
                Resume existing Tx
              </button>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Artifact Kind */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block uppercase tracking-wider">
              Artifact Kind
            </label>
            <select
              disabled={!isConfigured || loading}
              value={artifactKind}
              onChange={(e) => setArtifactKind(e.target.value as ArtifactKind)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none disabled:opacity-40"
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

          {/* Namespace */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block uppercase tracking-wider">
              Namespace / Owner
            </label>
            <input
              type="text"
              disabled={!isConfigured || loading}
              placeholder="e.g. facebookresearch"
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:ring-2 focus:ring-cyan-500 focus:outline-none disabled:opacity-40"
            />
          </div>

          {/* Repository / Artifact Name */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block uppercase tracking-wider">
              Repository / Name
            </label>
            <input
              type="text"
              disabled={!isConfigured || loading}
              placeholder="e.g. llama"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:ring-2 focus:ring-cyan-500 focus:outline-none disabled:opacity-40"
            />
          </div>
        </div>

        {/* Revision SHA */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 block uppercase tracking-wider">
            Git Commit SHA (40 Hex Chars)
          </label>
          <input
            type="text"
            disabled={!isConfigured || loading}
            placeholder="e.g. a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-600 focus:ring-2 focus:ring-cyan-500 focus:outline-none disabled:opacity-40"
          />
        </div>

        {/* Intended Use Profile */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 block uppercase tracking-wider">
            Intended Use Profile
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {USE_PROFILES.map((prof) => (
              <label
                key={prof.id}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  useProfile === prof.id
                    ? 'bg-cyan-950/50 border-cyan-500/80 text-white'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                } ${!isConfigured || loading ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name="useProfile"
                  disabled={!isConfigured || loading}
                  checked={useProfile === prof.id}
                  onChange={() => setUseProfile(prof.id)}
                  className="mt-0.5 text-cyan-500 focus:ring-cyan-500"
                />
                <div>
                  <div className="text-xs font-semibold text-slate-200">{prof.label}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{prof.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={!isConfigured || loading || pendingTx !== null || initialPending.error !== null}
          className="w-full bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white py-3 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing Transaction...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Submit Attestation Request on Studionet
            </span>
          )}
        </button>
      </form>
    </div>
  );
};
