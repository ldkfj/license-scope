import type { ArtifactKind, UseProfile } from './validation';

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
  };
}

export type PendingTransaction = PendingRequestTransaction | PendingAssessmentTransaction;

function storageKey(contractAddress: string): string {
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
    if (typeof payload.assessmentId !== 'number' || !Number.isSafeInteger(payload.assessmentId) || payload.assessmentId < 1
        || typeof payload.retryCount !== 'number' || !Number.isSafeInteger(payload.retryCount) || payload.retryCount < 0
        || typeof payload.canonicalKey !== 'string' || payload.canonicalKey.length === 0) {
      throw new Error('Pending assessment payload is invalid.');
    }
    return value as unknown as PendingAssessmentTransaction;
  }

  throw new Error('Pending transaction action is invalid.');
}

export function savePendingTransaction(storage: StorageLike, pending: PendingTransaction): void {
  const validated = parsePendingTransaction(pending, pending.contractAddress);
  storage.setItem(storageKey(validated.contractAddress), JSON.stringify(validated));
}

export function loadPendingTransaction(storage: StorageLike, contractAddress: string): PendingTransaction | null {
  if (!ADDRESS_RE.test(contractAddress)) return null;
  const raw = storage.getItem(storageKey(contractAddress));
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
  storage.removeItem(storageKey(contractAddress));
  return true;
}

export function browserStorage(): StorageLike | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

export function pendingTransactionTimestamp(): number {
  return Date.now();
}
