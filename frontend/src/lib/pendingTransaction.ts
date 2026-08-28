import type { ArtifactKind, AssessmentRecord, UseProfile } from './validation';

const STORAGE_PREFIX = 'licensescope.pending-transaction.v1';
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const SHA_RE = /^[0-9a-f]{40}$/;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface PendingBase {
  version: 1;
  contractAddress: string;
  chainId: 61999;
  hash: string;
  account: string;
  createdAt: number;
}

export interface PendingRequestTransaction extends PendingBase {
  action: 'request';
  payload: {
    artifactKind: ArtifactKind;
    namespace: string;
    name: string;
    revision: string;
    useProfile: UseProfile;
    canonicalKey: string;
  };
}

export interface PendingAssessmentTransaction extends PendingBase {
  action: 'resolve' | 'retry';
  payload: {
    assessmentId: number;
    canonicalKey: string;
    retryCount: number;
    identity: {
      artifactKind: ArtifactKind;
      namespace: string;
      name: string;
      revision: string;
      useProfile: UseProfile;
      requester: string;
      policyVersion: string;
      policyHash: string;
    };
    snapshot: AssessmentRecord;
  };
}

export type PendingTransaction = PendingRequestTransaction | PendingAssessmentTransaction;

export function pendingTransactionStorageKey(contractAddress: string): string {
  return `${STORAGE_PREFIX}:${contractAddress.toLowerCase()}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArtifactKind(value: unknown): value is ArtifactKind {
  return value === 'GITHUB_REPO' || value === 'HF_MODEL' || value === 'HF_DATASET';
}

function isUseProfile(value: unknown): value is UseProfile {
  return value === 'INTERNAL_RESEARCH'
    || value === 'COMMERCIAL_INFERENCE'
    || value === 'COMMERCIAL_REDISTRIBUTION'
    || value === 'COMMERCIAL_MODEL_TRAINING';
}

function isStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isAssessmentSnapshot(value: unknown): value is AssessmentRecord {
  if (!isObject(value)) return false;
  return typeof value.assessment_id === 'number' && Number.isSafeInteger(value.assessment_id) && value.assessment_id >= 1
    && typeof value.canonical_key === 'string' && value.canonical_key.length > 0
    && isArtifactKind(value.artifact_kind)
    && typeof value.namespace === 'string' && value.namespace.length > 0
    && typeof value.name === 'string' && value.name.length > 0
    && typeof value.revision === 'string' && SHA_RE.test(value.revision)
    && isUseProfile(value.use_profile)
    && typeof value.requester === 'string' && ADDRESS_RE.test(value.requester)
    && typeof value.status === 'number' && Number.isSafeInteger(value.status) && value.status >= 1 && value.status <= 5
    && typeof value.status_name === 'string'
    && typeof value.verdict === 'string'
    && typeof value.reason_code === 'string'
    && isStringArray(value.license_ids)
    && isStringArray(value.obligations)
    && typeof value.subject_match === 'string'
    && typeof value.revision_match === 'string'
    && typeof value.evidence_sufficient === 'boolean'
    && isStringArray(value.evidence_references)
    && typeof value.explanation === 'string'
    && typeof value.policy_version === 'string' && value.policy_version.length > 0
    && typeof value.policy_hash === 'string' && value.policy_hash.length > 0
    && typeof value.retry_count === 'number' && Number.isSafeInteger(value.retry_count) && value.retry_count >= 0 && value.retry_count <= 2;
}

export function parsePendingTransaction(value: unknown, expectedContract: string): PendingTransaction {
  if (!isObject(value) || value.version !== 1 || value.chainId !== 61999) {
    throw new Error('Pending transaction envelope is invalid.');
  }
  if (typeof value.contractAddress !== 'string' || !ADDRESS_RE.test(value.contractAddress)
      || value.contractAddress.toLowerCase() !== expectedContract.toLowerCase()) {
    throw new Error('Pending transaction contract address mismatch.');
  }
  if (typeof value.hash !== 'string' || !HASH_RE.test(value.hash)) throw new Error('Pending transaction hash is invalid.');
  if (typeof value.account !== 'string' || !ADDRESS_RE.test(value.account)) throw new Error('Pending transaction account is invalid.');
  if (typeof value.createdAt !== 'number' || !Number.isSafeInteger(value.createdAt) || value.createdAt < 1) {
    throw new Error('Pending transaction timestamp is invalid.');
  }
  if (!isObject(value.payload)) throw new Error('Pending transaction payload is invalid.');

  if (value.action === 'request') {
    const payload = value.payload;
    if (!isArtifactKind(payload.artifactKind)
        || typeof payload.namespace !== 'string' || payload.namespace.length === 0
        || typeof payload.name !== 'string' || payload.name.length === 0
        || typeof payload.revision !== 'string' || !SHA_RE.test(payload.revision)
        || !isUseProfile(payload.useProfile)
        || typeof payload.canonicalKey !== 'string' || payload.canonicalKey.length === 0) {
      throw new Error('Pending request payload is invalid.');
    }
    return value as unknown as PendingRequestTransaction;
  }

  if (value.action === 'resolve' || value.action === 'retry') {
    const payload = value.payload;
    const identity = payload.identity;
    const snapshot = payload.snapshot;
    if (typeof payload.assessmentId !== 'number' || !Number.isSafeInteger(payload.assessmentId) || payload.assessmentId < 1
        || typeof payload.retryCount !== 'number' || !Number.isSafeInteger(payload.retryCount) || payload.retryCount < 0 || payload.retryCount > 2
        || typeof payload.canonicalKey !== 'string' || payload.canonicalKey.length === 0
        || !isObject(identity)
        || !isArtifactKind(identity.artifactKind)
        || typeof identity.namespace !== 'string' || identity.namespace.length === 0
        || typeof identity.name !== 'string' || identity.name.length === 0
        || typeof identity.revision !== 'string' || !SHA_RE.test(identity.revision)
        || !isUseProfile(identity.useProfile)
        || typeof identity.requester !== 'string' || !ADDRESS_RE.test(identity.requester)
        || typeof identity.policyVersion !== 'string' || identity.policyVersion.length === 0
        || typeof identity.policyHash !== 'string' || identity.policyHash.length === 0
        || !isAssessmentSnapshot(snapshot)
        || snapshot.assessment_id !== payload.assessmentId
        || snapshot.canonical_key !== payload.canonicalKey
        || snapshot.retry_count !== payload.retryCount
        || (value.action === 'resolve' && (snapshot.status !== 1 || snapshot.status_name !== 'PENDING' || snapshot.verdict !== 'PENDING'))
        || (value.action === 'retry' && (snapshot.status !== 5 || snapshot.status_name !== 'UNRESOLVED' || snapshot.verdict !== 'UNRESOLVED'))) {
      throw new Error('Pending assessment payload is invalid.');
    }
    return value as unknown as PendingAssessmentTransaction;
  }

  throw new Error('Pending transaction action is invalid.');
}

export function savePendingTransaction(storage: StorageLike, pending: PendingTransaction): void {
  const validated = parsePendingTransaction(pending, pending.contractAddress);
  const key = pendingTransactionStorageKey(validated.contractAddress);
  const serialized = JSON.stringify(validated);
  storage.setItem(key, serialized);
  if (storage.getItem(key) !== serialized) {
    throw new Error('Pending transaction persistence could not be verified; writes remain locked.');
  }
}

export function loadPendingTransaction(storage: StorageLike, contractAddress: string): PendingTransaction | null {
  if (!ADDRESS_RE.test(contractAddress)) return null;
  const raw = storage.getItem(pendingTransactionStorageKey(contractAddress));
  if (raw === null) return null;
  try {
    return parsePendingTransaction(JSON.parse(raw) as unknown, contractAddress);
  } catch {
    // Corrupt data must never unlock a possible duplicate broadcast silently.
    throw new Error('Stored pending transaction is malformed. Clear site data only after reconciling its transaction externally.');
  }
}

export function clearPendingTransaction(storage: StorageLike, contractAddress: string, expectedHash: string): boolean {
  const pending = loadPendingTransaction(storage, contractAddress);
  if (!pending || pending.hash.toLowerCase() !== expectedHash.toLowerCase()) return false;
  const key = pendingTransactionStorageKey(contractAddress);
  storage.removeItem(key);
  if (storage.getItem(key) !== null) return false;
  return true;
}

export function createResilientStorage(storages: StorageLike[]): StorageLike | null {
  if (storages.length === 0) return null;
  return {
    getItem(key) {
      const values: string[] = [];
      for (const storage of storages) {
        try {
          const value = storage.getItem(key);
          if (value !== null) values.push(value);
        } catch {}
      }
      if (new Set(values).size > 1) throw new Error('Browser transaction storage copies disagree; writes are locked.');
      return values[0] ?? null;
    },
    setItem(key, value) {
      let verified = false;
      for (const storage of storages) {
        try {
          storage.setItem(key, value);
          if (storage.getItem(key) === value) verified = true;
        } catch {}
      }
      if (!verified) throw new Error('Browser storage could not persist the broadcast hash; keep this page open and reconcile the displayed hash externally.');
    },
    removeItem(key) {
      for (const storage of storages) {
        try { storage.removeItem(key); } catch {}
      }
    },
  };
}

export function browserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  const storages: StorageLike[] = [];
  try { storages.push(window.localStorage); } catch {}
  try { storages.push(window.sessionStorage); } catch {}
  return createResilientStorage(storages);
}

export function pendingTransactionTimestamp(): number {
  return Date.now();
}
