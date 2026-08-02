'use client';

import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { browserStorage, pendingTransactionStorageKey } from './pendingTransaction';
import { TransactionCoordinator, type TransactionCoordinatorState } from './transactionCoordinatorCore';

const TransactionCoordinatorContext = createContext<TransactionCoordinator | null>(null);

export function TransactionCoordinatorProvider({
  contractAddress,
  children,
}: {
  contractAddress: string;
  children: React.ReactNode;
}) {
  const [coordinator] = useState(() => new TransactionCoordinator(contractAddress));

  useEffect(() => {
    coordinator.syncFromStorage(browserStorage());
    const expectedKey = pendingTransactionStorageKey(contractAddress);
    const onStorage = (event: StorageEvent) => {
      if (event.key === expectedKey) coordinator.syncFromStorage(browserStorage());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [contractAddress, coordinator]);

  return <TransactionCoordinatorContext.Provider value={coordinator}>{children}</TransactionCoordinatorContext.Provider>;
}

export function useTransactionCoordinator(): {
  coordinator: TransactionCoordinator;
  state: TransactionCoordinatorState;
} {
  const coordinator = useContext(TransactionCoordinatorContext);
  if (!coordinator) throw new Error('TransactionCoordinatorProvider is missing from the page tree.');
  const state = useSyncExternalStore(coordinator.subscribe, coordinator.getSnapshot, coordinator.getServerSnapshot);
  return { coordinator, state };
}
