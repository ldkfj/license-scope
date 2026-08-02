import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearPendingTransaction,
  loadPendingTransaction,
  savePendingTransaction,
  type PendingTransaction,
} from '../src/lib/pendingTransaction.ts';

const CONTRACT = `0x${'1'.repeat(40)}`;
const HASH = `0x${'a'.repeat(64)}`;

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function pending(): PendingTransaction {
  return {
    version: 1,
    contractAddress: CONTRACT,
    chainId: 61999,
    hash: HASH,
    account: `0x${'2'.repeat(40)}`,
    createdAt: 1,
    action: 'request',
    payload: {
      artifactKind: 'GITHUB_REPO',
      namespace: 'snap-research',
      name: 'CoSearch',
      revision: '763bf8c4d7caa363ad845d39ddfd53b81ae377bd',
      useProfile: 'COMMERCIAL_INFERENCE',
      canonicalKey: 'GITHUB_REPO:snap-research/cosearch@763bf8c4d7caa363ad845d39ddfd53b81ae377bd#COMMERCIAL_INFERENCE#LS-V1',
    },
  };
}

test('persists and restores an exact same-hash request', () => {
  const storage = new MemoryStorage();
  savePendingTransaction(storage, pending());
  assert.deepEqual(loadPendingTransaction(storage, CONTRACT), pending());
});

test('clears only when contract and hash match', () => {
  const storage = new MemoryStorage();
  savePendingTransaction(storage, pending());
  assert.equal(clearPendingTransaction(storage, CONTRACT, `0x${'b'.repeat(64)}`), false);
  assert.ok(loadPendingTransaction(storage, CONTRACT));
  assert.equal(clearPendingTransaction(storage, CONTRACT, HASH), true);
  assert.equal(loadPendingTransaction(storage, CONTRACT), null);
});

test('rejects malformed persisted data instead of silently unlocking writes', () => {
  const storage = new MemoryStorage();
  storage.setItem(`licensescope.pending-transaction.v1:${CONTRACT.toLowerCase()}`, JSON.stringify({
    ...pending(),
    hash: 'not-a-hash',
  }));
  assert.throws(() => loadPendingTransaction(storage, CONTRACT), /malformed/i);
});
