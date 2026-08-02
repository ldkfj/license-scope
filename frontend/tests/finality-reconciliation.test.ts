import test from 'node:test';
import assert from 'node:assert/strict';

import {
  waitForFinalizedTransaction,
} from '../src/lib/finality.ts';

test('finality reconciliation retries the same hash instead of broadcasting again', async () => {
  const hash = `0x${'a'.repeat(64)}`;
  const observedHashes: string[] = [];
  const progressRounds: number[] = [];
  const finalizedReceipt = { status: 7 };

  const client = {
    waitForTransactionReceipt: async (args: { hash: string }) => {
      observedHashes.push(args.hash);
      if (observedHashes.length === 1) {
        throw new Error(`Timed out waiting for transaction ${hash}`);
      }
      return finalizedReceipt;
    },
  };

  const result = await waitForFinalizedTransaction(
    client,
    hash,
    ({ round }) => progressRounds.push(round),
  );

  assert.equal(result, finalizedReceipt);
  assert.deepEqual(observedHashes, [hash, hash]);
  assert.deepEqual(progressRounds, [1]);
});
