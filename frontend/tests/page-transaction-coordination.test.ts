import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TransactionCoordinator } from '../src/lib/transactionCoordinatorCore.ts';
import type {
  PendingAssessmentTransaction,
  PendingRequestTransaction,
  StorageLike,
} from '../src/lib/pendingTransaction.ts';

const CONTRACT = `0x${'1'.repeat(40)}`;
const ACCOUNT = `0x${'2'.repeat(40)}`;
const REQUEST_HASH = `0x${'a'.repeat(64)}`;
const RESOLVE_HASH = `0x${'b'.repeat(64)}`;

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function requestPending(): PendingRequestTransaction {
  return {
    version: 1,
    contractAddress: CONTRACT,
    chainId: 61999,
    hash: REQUEST_HASH,
    account: ACCOUNT,
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

function resolvePending(): PendingAssessmentTransaction {
  return {
    version: 1,
    contractAddress: CONTRACT,
    chainId: 61999,
    hash: RESOLVE_HASH,
    account: ACCOUNT,
    createdAt: 2,
    action: 'resolve',
    payload: { assessmentId: 1, canonicalKey: requestPending().payload.canonicalKey, retryCount: 0 },
  };
}

test('page mounts Request and Registry write surfaces under one coordinator provider', () => {
  const page = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  const providerStart = page.indexOf('<TransactionCoordinatorProvider');
  const requestSurface = page.indexOf('<RequestAssessmentForm');
  const registrySurface = page.indexOf('<AssessmentList');
  const providerEnd = page.lastIndexOf('</TransactionCoordinatorProvider>');
  assert.ok(providerStart >= 0 && providerStart < requestSurface);
  assert.ok(requestSurface < providerEnd);
  assert.ok(registrySurface > providerStart && registrySurface < providerEnd);

  const requestComponent = readFileSync(new URL('../src/components/RequestAssessmentForm.tsx', import.meta.url), 'utf8');
  assert.ok(requestComponent.indexOf("coordinator.acquire('request'") < requestComponent.indexOf('client.writeContract'));
  const registryComponent = readFileSync(new URL('../src/components/AssessmentList.tsx', import.meta.url), 'utf8');
  const resolveAcquire = registryComponent.indexOf("coordinator.acquire('resolve'");
  const retryAcquire = registryComponent.indexOf("coordinator.acquire('retry'");
  const firstWrite = registryComponent.indexOf('client.writeContract');
  const secondWrite = registryComponent.indexOf('client.writeContract', firstWrite + 1);
  assert.ok(resolveAcquire >= 0 && resolveAcquire < firstWrite);
  assert.ok(retryAcquire > firstWrite && retryAcquire < secondWrite);
});

test('Request takes the pre-broadcast mutex before an await and blocks Resolve or Retry', async () => {
  const storage = new MemoryStorage();
  const coordinator = new TransactionCoordinator(CONTRACT);
  coordinator.syncFromStorage(storage);
  let releaseWallet!: () => void;
  const walletWait = new Promise<void>((resolve) => { releaseWallet = resolve; });
  let writeCalls = 0;

  const requestFlow = async () => {
    const token = coordinator.acquire('request', storage);
    assert.ok(token);
    await walletWait;
    writeCalls += 1;
    coordinator.promote(token, requestPending(), storage);
  };

  const inFlight = requestFlow();
  assert.equal(coordinator.getSnapshot().phase, 'broadcasting');
  coordinator.syncFromStorage(storage);
  assert.equal(coordinator.getSnapshot().phase, 'broadcasting');
  assert.equal(coordinator.acquire('resolve', storage), null);
  assert.equal(coordinator.acquire('retry', storage), null);
  releaseWallet();
  await inFlight;
  assert.equal(writeCalls, 1);
  assert.equal(coordinator.getSnapshot().phase, 'pending');
});

test('Resolve takes the pre-broadcast mutex and blocks Submit with no concurrent write', async () => {
  const storage = new MemoryStorage();
  const coordinator = new TransactionCoordinator(CONTRACT);
  coordinator.syncFromStorage(storage);
  const resolveToken = coordinator.acquire('resolve', storage);
  assert.ok(resolveToken);
  assert.equal(coordinator.acquire('request', storage), null);

  let writeCalls = 0;
  await Promise.resolve();
  writeCalls += 1;
  coordinator.promote(resolveToken, resolvePending(), storage);
  assert.equal(writeCalls, 1);
  assert.equal(coordinator.acquire('request', storage), null);
});

test('saved and validated-cleared state synchronizes all subscribers and browser contexts', () => {
  const storage = new MemoryStorage();
  const pageCoordinator = new TransactionCoordinator(CONTRACT);
  const otherContext = new TransactionCoordinator(CONTRACT);
  pageCoordinator.syncFromStorage(storage);
  otherContext.syncFromStorage(storage);
  const observed: string[] = [];
  const unsubscribeRequest = pageCoordinator.subscribe(() => observed.push(`request:${pageCoordinator.getSnapshot().phase}`));
  const unsubscribeRegistry = pageCoordinator.subscribe(() => observed.push(`registry:${pageCoordinator.getSnapshot().phase}`));

  const token = pageCoordinator.acquire('request', storage);
  assert.ok(token);
  pageCoordinator.promote(token, requestPending(), storage);
  otherContext.syncFromStorage(storage); // equivalent to the provider's cross-tab storage event
  assert.equal(otherContext.getSnapshot().phase, 'pending');
  assert.equal(pageCoordinator.complete(REQUEST_HASH, storage), true);
  otherContext.syncFromStorage(storage);
  assert.equal(pageCoordinator.getSnapshot().phase, 'idle');
  assert.equal(otherContext.getSnapshot().phase, 'idle');
  assert.deepEqual(observed, [
    'request:broadcasting', 'registry:broadcasting',
    'request:pending', 'registry:pending',
    'request:idle', 'registry:idle',
  ]);
  assert.ok(pageCoordinator.acquire('resolve', storage));
  unsubscribeRequest();
  unsubscribeRegistry();
});
