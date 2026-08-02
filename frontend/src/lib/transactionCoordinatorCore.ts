import {
  clearPendingTransaction,
  loadPendingTransaction,
  savePendingTransaction,
  type PendingTransaction,
  type StorageLike,
} from './pendingTransaction.ts';

export type WriteAction = PendingTransaction['action'];

export type TransactionCoordinatorState =
  | { phase: 'idle' }
  | { phase: 'broadcasting'; action: WriteAction; token: string }
  | { phase: 'pending'; transaction: PendingTransaction }
  | { phase: 'blocked'; error: string };

export const SERVER_COORDINATOR_STATE: TransactionCoordinatorState = { phase: 'idle' };

export class TransactionCoordinator {
  readonly contractAddress: string;
  private state: TransactionCoordinatorState = SERVER_COORDINATOR_STATE;
  private listeners = new Set<() => void>();
  private nextToken = 0;

  constructor(contractAddress: string) {
    this.contractAddress = contractAddress;
  }

  readonly getSnapshot = (): TransactionCoordinatorState => this.state;
  readonly getServerSnapshot = (): TransactionCoordinatorState => SERVER_COORDINATOR_STATE;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(state: TransactionCoordinatorState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }

  syncFromStorage(storage: StorageLike | null): void {
    if (!storage) {
      this.publish({ phase: 'blocked', error: 'Browser storage unavailable; transaction writes are locked.' });
      return;
    }
    try {
      const pending = loadPendingTransaction(storage, this.contractAddress);
      if (pending) {
        this.publish({ phase: 'pending', transaction: pending });
      } else if (this.state.phase !== 'broadcasting') {
        this.publish({ phase: 'idle' });
      }
    } catch (error: unknown) {
      this.publish({ phase: 'blocked', error: error instanceof Error ? error.message : String(error) });
    }
  }

  /** Synchronous same-page mutex. Must succeed before any wallet/write await. */
  acquire(action: WriteAction, storage: StorageLike | null): string | null {
    if (!storage) {
      this.publish({ phase: 'blocked', error: 'Browser storage unavailable; transaction writes are locked.' });
      return null;
    }
    if (this.state.phase !== 'idle') return null;
    try {
      const pending = loadPendingTransaction(storage, this.contractAddress);
      if (pending) {
        this.publish({ phase: 'pending', transaction: pending });
        return null;
      }
    } catch (error: unknown) {
      this.publish({ phase: 'blocked', error: error instanceof Error ? error.message : String(error) });
      return null;
    }

    this.nextToken += 1;
    const token = `${action}:${this.nextToken}`;
    this.publish({ phase: 'broadcasting', action, token });
    return token;
  }

  promote(token: string, transaction: PendingTransaction, storage: StorageLike): void {
    if (this.state.phase !== 'broadcasting' || this.state.token !== token) {
      throw new Error('Transaction coordinator ownership mismatch while persisting the broadcast hash.');
    }
    savePendingTransaction(storage, transaction);
    this.publish({ phase: 'pending', transaction });
  }

  release(token: string): boolean {
    if (this.state.phase !== 'broadcasting' || this.state.token !== token) return false;
    this.publish({ phase: 'idle' });
    return true;
  }

  complete(expectedHash: string, storage: StorageLike): boolean {
    if (this.state.phase !== 'pending') return false;
    if (!clearPendingTransaction(storage, this.contractAddress, expectedHash)) return false;
    this.publish({ phase: 'idle' });
    return true;
  }
}
