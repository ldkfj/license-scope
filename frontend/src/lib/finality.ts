import { TransactionStatus } from 'genlayer-js/types';

export interface FinalityRetryProgress {
  round: number;
  maxRounds: number;
  lastError: string;
}

export interface FinalityReconciliationOptions {
  maxRounds?: number;
  intervalMs?: number;
  retriesPerRound?: number;
  retryDelayMs?: number;
  signal?: AbortSignal;
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

export class FinalityReconciliationExhaustedError extends Error {
  readonly hash: unknown;
  readonly attempts: number;

  constructor(hash: unknown, attempts: number) {
    super(`Still awaiting FINALIZED after ${attempts} bounded reconciliation attempts. Resume the existing transaction hash; do not broadcast again.`);
    this.name = 'FinalityReconciliationExhaustedError';
    this.hash = hash;
    this.attempts = attempts;
  }
}

export class FinalityReconciliationCancelledError extends Error {
  constructor() {
    super('Transaction reconciliation was cancelled. Resume the existing transaction hash; do not broadcast again.');
    this.name = 'FinalityReconciliationCancelledError';
  }
}

const TRANSIENT_ERROR = /timed? out|timeout|network|failed to fetch|fetch failed|connection|econn|temporar|transaction[^\n]*not found|not found[^\n]*transaction|rpc[^\n]*(?:unavailable|timeout|rate limit)|\b429\b|\b502\b|\b503\b|\b504\b/i;

export function isRetryableFinalityError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return TRANSIENT_ERROR.test(message);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new FinalityReconciliationCancelledError();
}

async function abortableDelay(delayMs: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  if (delayMs <= 0) return;

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new FinalityReconciliationCancelledError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function abortableWait<TResult>(promise: Promise<TResult>, signal?: AbortSignal): Promise<TResult> {
  throwIfAborted(signal);
  if (!signal) return promise;
  return new Promise<TResult>((resolve, reject) => {
    const onAbort = () => reject(new FinalityReconciliationCancelledError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

/** Reconcile one broadcast hash with a finite retry budget. Never broadcasts. */
export async function waitForFinalizedTransaction<THash, TResult>(
  client: FinalityWaitClient<THash, TResult>,
  hash: THash,
  onRetry?: (progress: FinalityRetryProgress) => void,
  options: FinalityReconciliationOptions = {},
): Promise<TResult> {
  const maxRounds = options.maxRounds ?? 3;
  const intervalMs = options.intervalMs ?? 3_000;
  const retriesPerRound = options.retriesPerRound ?? 20;
  const retryDelayMs = options.retryDelayMs ?? 3_000;

  if (!Number.isSafeInteger(maxRounds) || maxRounds < 1) {
    throw new Error('maxRounds must be a positive safe integer.');
  }
  if (!Number.isSafeInteger(retriesPerRound) || retriesPerRound < 1) {
    throw new Error('retriesPerRound must be a positive safe integer.');
  }

  for (let round = 1; round <= maxRounds; round += 1) {
    throwIfAborted(options.signal);
    try {
      return await abortableWait(client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.FINALIZED,
        interval: intervalMs,
        retries: retriesPerRound,
      }), options.signal);
    } catch (error: unknown) {
      throwIfAborted(options.signal);
      if (!isRetryableFinalityError(error)) throw error;

      const lastError = error instanceof Error ? error.message : String(error);
      onRetry?.({ round, maxRounds, lastError });
      if (round === maxRounds) {
        throw new FinalityReconciliationExhaustedError(hash, maxRounds);
      }
      await abortableDelay(retryDelayMs, options.signal);
    }
  }

  throw new FinalityReconciliationExhaustedError(hash, maxRounds);
}
