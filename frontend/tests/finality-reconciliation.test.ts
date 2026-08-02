import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FinalityReconciliationCancelledError,
  FinalityReconciliationExhaustedError,
  waitForFinalizedTransaction,
} from '../src/lib/finality.ts';

const HASH = `0x${'a'.repeat(64)}`;

test('retries the same hash and returns its finalized receipt', async () => {
  const observedHashes: string[] = [];
  const progressRounds: number[] = [];
  const finalizedReceipt = { status: 7 };
  const client = {
    waitForTransactionReceipt: async (args: { hash: string }) => {
      observedHashes.push(args.hash);
      if (observedHashes.length === 1) throw new Error(`Timed out waiting for transaction ${HASH}`);
      return finalizedReceipt;
    },
  };

  const result = await waitForFinalizedTransaction(
    client,
    HASH,
    ({ round }) => progressRounds.push(round),
    { maxRounds: 3, retryDelayMs: 0 },
  );

  assert.equal(result, finalizedReceipt);
  assert.deepEqual(observedHashes, [HASH, HASH]);
  assert.deepEqual(progressRounds, [1]);
  assert.equal('writeContract' in client, false);
});

test('stops after the exact transient retry ceiling and preserves the hash', async () => {
  const observedHashes: string[] = [];
  const client = {
    waitForTransactionReceipt: async ({ hash }: { hash: string }) => {
      observedHashes.push(hash);
      throw new Error('RPC connection timed out');
    },
  };

  await assert.rejects(
    waitForFinalizedTransaction(client, HASH, undefined, { maxRounds: 2, retryDelayMs: 0 }),
    (error: unknown) => error instanceof FinalityReconciliationExhaustedError
      && error.hash === HASH
      && error.attempts === 2,
  );
  assert.deepEqual(observedHashes, [HASH, HASH]);
});

test('rethrows permanent errors immediately without another poll', async () => {
  let calls = 0;
  const client = {
    waitForTransactionReceipt: async () => {
      calls += 1;
      throw new Error('Invalid transaction hash encoding');
    },
  };

  await assert.rejects(
    waitForFinalizedTransaction(client, HASH, undefined, { maxRounds: 3, retryDelayMs: 0 }),
    /Invalid transaction hash encoding/,
  );
  assert.equal(calls, 1);
});

test('honors cancellation before polling', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const client = { waitForTransactionReceipt: async () => { calls += 1; return { status: 7 }; } };

  await assert.rejects(
    waitForFinalizedTransaction(client, HASH, undefined, { signal: controller.signal }),
    FinalityReconciliationCancelledError,
  );
  assert.equal(calls, 0);
});

test('honors cancellation while an SDK receipt wait is in flight', async () => {
  const controller = new AbortController();
  const client = { waitForTransactionReceipt: async () => new Promise<object>(() => undefined) };
  const waiting = waitForFinalizedTransaction(client, HASH, undefined, { signal: controller.signal });
  controller.abort();
  await assert.rejects(waiting, FinalityReconciliationCancelledError);
});
