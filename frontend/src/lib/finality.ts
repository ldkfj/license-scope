import { TransactionStatus } from 'genlayer-js/types';

export interface FinalityRetryProgress {
  round: number;
  lastError: string;
}

interface FinalityWaitArguments<THash> {
  hash: THash;
  status?: TransactionStatus;
  interval?: number;
  retries?: number;
}

interface FinalityWaitClient<THash, TResult> {
  waitForTransactionReceipt: (args: FinalityWaitArguments<THash>) => Promise<TResult>;
}

/** Keep reconciling one broadcast hash until Studionet reaches FINALIZED. */
export async function waitForFinalizedTransaction<THash, TResult>(
  client: FinalityWaitClient<THash, TResult>,
  hash: THash,
  onRetry?: (progress: FinalityRetryProgress) => void,
): Promise<TResult> {
  let round = 0;

  for (;;) {
    try {
      return await client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.FINALIZED,
        interval: 3_000,
        retries: 20,
      });
    } catch (error: unknown) {
      round += 1;
      const lastError = error instanceof Error ? error.message : String(error);
      onRetry?.({ round, lastError });

      // Avoid a tight loop when the RPC itself fails immediately.
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
  }
}
