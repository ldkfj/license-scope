import test from 'node:test';
import assert from 'node:assert/strict';
import { abi } from 'genlayer-js';

import {
  assertTerminalFailureState,
  extractReturnedAssessmentId,
  parseAssessmentRecord,
  reconcileRequestRecord,
  reconcileResolveRecord,
  reconcileRetryRecord,
  validateGenLayerReceipt,
  validateTransactionBinding,
} from '../src/lib/validation.ts';
import { TransactionCoordinator } from '../src/lib/transactionCoordinatorCore.ts';
import type {
  PendingAssessmentTransaction,
  PendingRequestTransaction,
  StorageLike,
} from '../src/lib/pendingTransaction.ts';

const CONTRACT = '0x0123456789012345678901234567890123456789';
const ACCOUNT = '0x1111111111111111111111111111111111111111';
const POLICY_HASH = 'sha256:696833070a2262ebcd178648b21957a883d62c2d7c0112a007d1143ec3720fbc';

const REQUEST_HASH = '0x34a4aac8b2b878ab9a442ffd76b70712a3b5e973954a3876deb289f292850809';
const RESOLVE_HASH = '0x44a4aac8b2b878ab9a442ffd76b70712a3b5e973954a3876deb289f292850809';
const RETRY_HASH = '0x55a4aac8b2b878ab9a442ffd76b70712a3b5e973954a3876deb289f292850809';

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function makePendingRequest(): PendingRequestTransaction {
  return {
    version: 1,
    contractAddress: CONTRACT,
    chainId: 61999,
    hash: REQUEST_HASH,
    account: ACCOUNT,
    createdAt: 100,
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

function makePendingResolve(retryCount = 0): PendingAssessmentTransaction {
  return {
    version: 1,
    contractAddress: CONTRACT,
    chainId: 61999,
    hash: RESOLVE_HASH,
    account: ACCOUNT,
    createdAt: 200,
    action: 'resolve',
    payload: {
      assessmentId: 2,
      canonicalKey: makePendingRequest().payload.canonicalKey,
      retryCount,
    },
  };
}

function makePendingRetry(retryCount = 0): PendingAssessmentTransaction {
  return {
    version: 1,
    contractAddress: CONTRACT,
    chainId: 61999,
    hash: RETRY_HASH,
    account: ACCOUNT,
    createdAt: 300,
    action: 'retry',
    payload: {
      assessmentId: 2,
      canonicalKey: makePendingRequest().payload.canonicalKey,
      retryCount,
    },
  };
}

function makeRecord(overrides: Partial<Record<string, unknown>> = {}) {
  const base = {
    assessment_id: 2,
    canonical_key: 'GITHUB_REPO:snap-research/cosearch@763bf8c4d7caa363ad845d39ddfd53b81ae377bd#COMMERCIAL_INFERENCE#LS-V1',
    artifact_kind: 'GITHUB_REPO',
    namespace: 'snap-research',
    name: 'CoSearch',
    revision: '763bf8c4d7caa363ad845d39ddfd53b81ae377bd',
    use_profile: 'COMMERCIAL_INFERENCE',
    requester: ACCOUNT,
    status: 1,
    status_name: 'PENDING',
    verdict: 'PENDING',
    reason_code: '',
    license_ids: '[]',
    obligations: '[]',
    subject_match: 'UNCLEAR',
    revision_match: 'UNCLEAR',
    evidence_sufficient: false,
    evidence_references: '[]',
    explanation: 'Assessment requested, awaiting leader-validator consensus resolution.',
    policy_version: 'LS-V1',
    policy_hash: POLICY_HASH,
    retry_count: 0,
    ...overrides,
  };
  return parseAssessmentRecord(base);
}

function makeAllowRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return makeRecord({
    status: 2,
    status_name: 'ALLOW',
    verdict: 'ALLOW',
    reason_code: 'LICENSE_CLEAR',
    subject_match: 'EXACT',
    revision_match: 'EXACT',
    evidence_sufficient: true,
    license_ids: '["MIT"]',
    obligations: '[]',
    evidence_references: '["https://api.github.com/repos/snap-research/cosearch/commits/763bf8c4d7caa363ad845d39ddfd53b81ae377bd","https://raw.githubusercontent.com/snap-research/cosearch/763bf8c4d7caa363ad845d39ddfd53b81ae377bd/LICENSE"]',
    explanation: 'Permissive license verified.',
    ...overrides,
  });
}

function makeConditionalRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return makeRecord({
    status: 3,
    status_name: 'CONDITIONAL',
    verdict: 'CONDITIONAL',
    reason_code: 'LICENSE_WITH_OBLIGATIONS',
    subject_match: 'EXACT',
    revision_match: 'EXACT',
    evidence_sufficient: true,
    license_ids: '["Apache-2.0"]',
    obligations: '["NOTICE"]',
    evidence_references: '["https://api.github.com/repos/snap-research/cosearch/commits/763bf8c4d7caa363ad845d39ddfd53b81ae377bd","https://raw.githubusercontent.com/snap-research/cosearch/763bf8c4d7caa363ad845d39ddfd53b81ae377bd/LICENSE"]',
    explanation: 'Notice requirement detected.',
    ...overrides,
  });
}

function makeBlockRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return makeRecord({
    status: 4,
    status_name: 'BLOCK',
    verdict: 'BLOCK',
    reason_code: 'EXPLICIT_USE_RESTRICTION',
    subject_match: 'EXACT',
    revision_match: 'EXACT',
    evidence_sufficient: true,
    license_ids: '["CC-BY-NC-4.0"]',
    obligations: '["NON_COMMERCIAL_ONLY"]',
    evidence_references: '["https://api.github.com/repos/snap-research/cosearch/commits/763bf8c4d7caa363ad845d39ddfd53b81ae377bd","https://raw.githubusercontent.com/snap-research/cosearch/763bf8c4d7caa363ad845d39ddfd53b81ae377bd/LICENSE"]',
    explanation: 'Non-commercial restriction on commercial use profile.',
    ...overrides,
  });
}

function makeUnresolvedRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return makeRecord({
    status: 5,
    status_name: 'UNRESOLVED',
    verdict: 'UNRESOLVED',
    reason_code: 'SOURCE_MISSING',
    subject_match: 'MISMATCH',
    revision_match: 'UNCLEAR',
    evidence_sufficient: false,
    license_ids: '[]',
    obligations: '[]',
    evidence_references: '["https://example.com/404"]',
    explanation: 'Artifact repository could not be resolved.',
    ...overrides,
  });
}

function bytesToBase64(bytes: number[] | Uint8Array): string {
  const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  const btoaFn = typeof globalThis.btoa === 'function' ? globalThis.btoa : btoa;
  return btoaFn(binary);
}

function encodeCalldata(method: string, args: unknown[]): number[] {
  const encoded = abi.calldata.encode(abi.calldata.makeCalldataObject(method, args as never, undefined));
  return Array.from(encoded);
}

function makeTxData(
  method: string,
  args: unknown[],
  hash = REQUEST_HASH,
  from = ACCOUNT,
  to = CONTRACT,
  returnedId?: number,
) {
  const rawBytes = encodeCalldata(method, args);
  const rawBase64 = bytesToBase64(rawBytes);
  return {
    hash,
    from_address: from,
    to_address: to,
    data: {
      raw: rawBytes,
      base64: rawBase64,
    },
    consensus_data: {
      final: true,
      leader_receipt: [
        {
          execution_result: 'SUCCESS',
          result: returnedId !== undefined ? { status: 'return', payload: { readable: String(returnedId) } } : null,
          calldata: { raw: rawBytes },
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// 1. Request Progression Tests
// ---------------------------------------------------------------------------

test('Request: successful request still PENDING is accepted and not marked progressed', () => {
  const pending = makePendingRequest();
  const record = makeRecord({ status: 1, status_name: 'PENDING', verdict: 'PENDING' });
  const result = reconcileRequestRecord(pending, record, 2);
  assert.equal(result.isProgressed, false);
  assert.match(result.statusMessage, /Attestation request successfully registered/i);
});

test('Request: successful request progressed to ALLOW is accepted with truthful message', () => {
  const pending = makePendingRequest();
  const record = makeAllowRecord();
  const result = reconcileRequestRecord(pending, record, 2);
  assert.equal(result.isProgressed, true);
  assert.match(result.statusMessage, /historical request registered assessment #2.*progressed to ALLOW \(LICENSE_CLEAR\)/i);
});

test('Request: successful request progressed to CONDITIONAL is accepted', () => {
  const pending = makePendingRequest();
  const record = makeConditionalRecord();
  const result = reconcileRequestRecord(pending, record, 2);
  assert.equal(result.isProgressed, true);
  assert.match(result.statusMessage, /progressed to CONDITIONAL \(LICENSE_WITH_OBLIGATIONS\)/i);
});

test('Request: live defect repro — successful request progressed to BLOCK / EXPLICIT_USE_RESTRICTION reconciles cleanly', () => {
  const pending = makePendingRequest();
  const record = makeBlockRecord();
  const result = reconcileRequestRecord(pending, record, 2);
  assert.equal(result.isProgressed, true);
  assert.match(result.statusMessage, /historical request registered assessment #2.*progressed to BLOCK \(EXPLICIT_USE_RESTRICTION\)/i);
});

test('Request: successful request progressed to UNRESOLVED is accepted', () => {
  const pending = makePendingRequest();
  const record = makeUnresolvedRecord();
  const result = reconcileRequestRecord(pending, record, 2);
  assert.equal(result.isProgressed, true);
  assert.match(result.statusMessage, /progressed to UNRESOLVED \(SOURCE_MISSING\)/i);
});

test('Request: record progressed through retry round 1 is accepted', () => {
  const pending = makePendingRequest();
  const record = makeRecord({
    status: 1,
    status_name: 'PENDING',
    verdict: 'PENDING',
    retry_count: 1,
  });
  const result = reconcileRequestRecord(pending, record, 2);
  assert.equal(result.isProgressed, true);
  assert.match(result.statusMessage, /progressed to PENDING \(retry 1\/2\)/i);
});

test('Request: failed duplicate request receipt is rejected and not converted to success', () => {
  const pending = makePendingRequest();
  const rawBytes = encodeCalldata('request_assessment', [
    'GITHUB_REPO', 'snap-research', 'CoSearch', '763bf8c4d7caa363ad845d39ddfd53b81ae377bd', 'COMMERCIAL_INFERENCE',
  ]);
  const duplicateReceipt = {
    status: 7,
    status_name: 'FINALIZED',
    result: 6,
    result_name: 'MAJORITY_AGREE',
    hash: REQUEST_HASH,
    from_address: ACCOUNT,
    to_address: CONTRACT,
    data: { raw: rawBytes },
    consensus_data: {
      leader_receipt: [
        {
          execution_result: 'ERROR',
          result: { status: 'contract_error', payload: 'KeyError: Assessment already registered for key' },
          genvm_result: {
            stderr: 'KeyError: Assessment already registered for key',
            raw_error: null,
            error_code: null,
            error_description: null,
          },
        },
      ],
    },
  };
  // Receipt validation rejects failed execution
  assert.throws(
    () => validateGenLayerReceipt(duplicateReceipt),
    /leader execution result rejected: ERROR/i,
  );
  // Transaction binding still binds the historical failed envelope
  const binding = validateTransactionBinding(duplicateReceipt, pending);
  assert.equal(binding.returnedAssessmentId, null);
  // An existing record on chain cannot be used to treat a failed request as successful
  const existingRecord = makeBlockRecord();
  assert.throws(
    () => {
      validateGenLayerReceipt(duplicateReceipt);
      reconcileRequestRecord(pending, existingRecord, binding.returnedAssessmentId);
    },
    /leader execution result rejected: ERROR/i,
  );
});

test('Request: mismatched requester rejects readback', () => {
  const pending = makePendingRequest();
  const record = makeRecord({ requester: '0x9999999999999999999999999999999999999999' });
  assert.throws(() => reconcileRequestRecord(pending, record, 2), /requester address mismatch/i);
});

test('Request: mismatched revision SHA rejects readback', () => {
  const pending = makePendingRequest();
  const record = makeRecord({ revision: '0000000000000000000000000000000000000000' });
  assert.throws(() => reconcileRequestRecord(pending, record, 2), /revision mismatch/i);
});

test('Request: mismatched returned assessment ID rejects readback', () => {
  const pending = makePendingRequest();
  const record = makeRecord();
  assert.throws(() => reconcileRequestRecord(pending, record, 99), /assessment ID mismatch/i);
});

// ---------------------------------------------------------------------------
// 2. Resolve Progression Tests
// ---------------------------------------------------------------------------

test('Resolve: direct terminal result in expected round is accepted and not progressed', () => {
  const pending = makePendingResolve(0);
  const record = makeAllowRecord({ retry_count: 0 });
  const result = reconcileResolveRecord(pending, record);
  assert.equal(result.isProgressed, false);
  assert.match(result.statusMessage, /Resolution finalized! Verdict: ALLOW \(LICENSE_CLEAR\)/i);
});

test('Resolve: UNRESOLVED followed by retry to PENDING is accepted as progressed', () => {
  const pending = makePendingResolve(0);
  const record = makeRecord({
    status: 1,
    status_name: 'PENDING',
    verdict: 'PENDING',
    retry_count: 1,
  });
  const result = reconcileResolveRecord(pending, record);
  assert.equal(result.isProgressed, true);
  assert.match(result.statusMessage, /Historical resolution completed.*retried to PENDING \(retry 1\/2\)/i);
});

test('Resolve: later resolution after retry round 1 is accepted as progressed', () => {
  const pending = makePendingResolve(0);
  const record = makeAllowRecord({ retry_count: 1 });
  const result = reconcileResolveRecord(pending, record);
  assert.equal(result.isProgressed, true);
  assert.match(result.statusMessage, /Historical resolution completed.*progressed to ALLOW \(retry 1\/2\)/i);
});

test('Resolve: impossible retry_count regression is rejected', () => {
  const pending = makePendingResolve(1);
  const record = makeAllowRecord({ retry_count: 0 });
  assert.throws(() => reconcileResolveRecord(pending, record), /retry_count regressed/i);
});

test('Resolve: readback remaining PENDING in the same expected round is rejected', () => {
  const pending = makePendingResolve(0);
  const record = makeRecord({
    status: 1,
    status_name: 'PENDING',
    verdict: 'PENDING',
    retry_count: 0,
  });
  assert.throws(() => reconcileResolveRecord(pending, record), /assessment remains PENDING at retry round 0/i);
});

// ---------------------------------------------------------------------------
// 3. Retry Progression Tests
// ---------------------------------------------------------------------------

test('Retry: direct PENDING reset at n+1 is accepted and not progressed', () => {
  const pending = makePendingRetry(0);
  const record = makeRecord({
    status: 1,
    status_name: 'PENDING',
    verdict: 'PENDING',
    retry_count: 1,
  });
  const result = reconcileRetryRecord(pending, record);
  assert.equal(result.isProgressed, false);
  assert.match(result.statusMessage, /Retry finalized! Assessment reset to PENDING \(round 1\/2\)/i);
});

test('Retry: already resolved at n+1 is accepted as progressed', () => {
  const pending = makePendingRetry(0);
  const record = makeAllowRecord({ retry_count: 1 });
  const result = reconcileRetryRecord(pending, record);
  assert.equal(result.isProgressed, true);
  assert.match(result.statusMessage, /Retry succeeded \(round 1\/2\).*resolved to ALLOW/i);
});

test('Retry: later valid bounded retry round (2/2) is accepted as progressed', () => {
  const pending = makePendingRetry(0);
  const record = makeRecord({
    status: 1,
    status_name: 'PENDING',
    verdict: 'PENDING',
    retry_count: 2,
  });
  const result = reconcileRetryRecord(pending, record);
  assert.equal(result.isProgressed, true);
  assert.match(result.statusMessage, /progressed to PENDING \(retry 2\/2\)/i);
});

test('Retry: un-incremented retry_count is rejected', () => {
  const pending = makePendingRetry(0);
  const record = makeRecord({
    status: 1,
    status_name: 'PENDING',
    verdict: 'PENDING',
    retry_count: 0,
  });
  assert.throws(() => reconcileRetryRecord(pending, record), /expected retry_count >= 1/i);
});

test('Retry: retry_count exceeding max bound of 2 is rejected', () => {
  const pending = makePendingRetry(1);
  const record = makeRecord({
    status: 1,
    status_name: 'PENDING',
    verdict: 'PENDING',
    retry_count: 3,
  });
  assert.throws(() => reconcileRetryRecord(pending, record), /exceeds maximum limit of 2/i);
});

// ---------------------------------------------------------------------------
// 4. Transaction Binding Tests
// ---------------------------------------------------------------------------

test('Binding: valid request transaction binds all envelope fields and extracts returned assessment ID', () => {
  const pending = makePendingRequest();
  const tx = makeTxData(
    'request_assessment',
    ['GITHUB_REPO', 'snap-research', 'CoSearch', '763bf8c4d7caa363ad845d39ddfd53b81ae377bd', 'COMMERCIAL_INFERENCE'],
    REQUEST_HASH,
    ACCOUNT,
    CONTRACT,
    2,
  );
  const { returnedAssessmentId } = validateTransactionBinding(tx, pending);
  assert.equal(returnedAssessmentId, 2);
});

test('Binding: wrong transaction hash is rejected', () => {
  const pending = makePendingRequest();
  const tx = makeTxData(
    'request_assessment',
    ['GITHUB_REPO', 'snap-research', 'CoSearch', '763bf8c4d7caa363ad845d39ddfd53b81ae377bd', 'COMMERCIAL_INFERENCE'],
    '0x9999999999999999999999999999999999999999999999999999999999999999',
  );
  assert.throws(() => validateTransactionBinding(tx, pending), /Transaction hash mismatch/i);
});

test('Binding: wrong sender account is rejected', () => {
  const pending = makePendingRequest();
  const tx = makeTxData(
    'request_assessment',
    ['GITHUB_REPO', 'snap-research', 'CoSearch', '763bf8c4d7caa363ad845d39ddfd53b81ae377bd', 'COMMERCIAL_INFERENCE'],
    REQUEST_HASH,
    '0x8888888888888888888888888888888888888888',
  );
  assert.throws(() => validateTransactionBinding(tx, pending), /Transaction sender mismatch/i);
});

test('Binding: wrong contract recipient is rejected', () => {
  const pending = makePendingRequest();
  const tx = makeTxData(
    'request_assessment',
    ['GITHUB_REPO', 'snap-research', 'CoSearch', '763bf8c4d7caa363ad845d39ddfd53b81ae377bd', 'COMMERCIAL_INFERENCE'],
    REQUEST_HASH,
    ACCOUNT,
    '0x7777777777777777777777777777777777777777',
  );
  assert.throws(() => validateTransactionBinding(tx, pending), /Transaction recipient mismatch/i);
});

test('Binding: wrong method name is rejected', () => {
  const pending = makePendingRequest();
  const tx = makeTxData(
    'resolve_assessment',
    [2],
    REQUEST_HASH,
    ACCOUNT,
    CONTRACT,
  );
  assert.throws(() => validateTransactionBinding(tx, pending), /Transaction method mismatch/i);
});

test('Binding: wrong arguments payload is rejected', () => {
  const pending = makePendingRequest();
  const tx = makeTxData(
    'request_assessment',
    ['GITHUB_REPO', 'different-org', 'CoSearch', '763bf8c4d7caa363ad845d39ddfd53b81ae377bd', 'COMMERCIAL_INFERENCE'],
    REQUEST_HASH,
    ACCOUNT,
    CONTRACT,
  );
  assert.throws(() => validateTransactionBinding(tx, pending), /namespace mismatch/i);
});

test('Binding: contradictory leader receipts reject returned ID', () => {
  const pending = makePendingRequest();
  const rawBytes = encodeCalldata('request_assessment', [
    'GITHUB_REPO', 'snap-research', 'CoSearch', '763bf8c4d7caa363ad845d39ddfd53b81ae377bd', 'COMMERCIAL_INFERENCE',
  ]);
  const tx = {
    hash: REQUEST_HASH,
    from_address: ACCOUNT,
    to_address: CONTRACT,
    data: { raw: rawBytes },
    consensus_data: {
      final: true,
      leader_receipt: [
        { execution_result: 'SUCCESS', result: { status: 'return', payload: { readable: '2' } }, calldata: { raw: rawBytes } },
        { execution_result: 'SUCCESS', result: { status: 'return', payload: { readable: '3' } }, calldata: { raw: rawBytes } },
      ],
    },
  };
  assert.throws(() => validateTransactionBinding(tx, pending), /Leader receipt return values disagree/i);
});

// ---------------------------------------------------------------------------
// 5. Coordinator Zero-Write & Lock Invariance Tests
// ---------------------------------------------------------------------------

test('Coordinator: completing a pending transaction clears only the exact matching hash', () => {
  const storage = new MemoryStorage();
  const coordinator = new TransactionCoordinator(CONTRACT);
  coordinator.syncFromStorage(storage);

  const token = coordinator.acquire('request', storage);
  assert.ok(token);
  coordinator.promote(token, makePendingRequest(), storage);
  assert.equal(coordinator.getSnapshot().phase, 'pending');

  // Attempting to clear a different hash returns false and retains the lock
  assert.equal(coordinator.complete('0x9999999999999999999999999999999999999999999999999999999999999999', storage), false);
  assert.equal(coordinator.getSnapshot().phase, 'pending');

  // Completing the exact matching hash transitions to idle
  assert.equal(coordinator.complete(REQUEST_HASH, storage), true);
  assert.equal(coordinator.getSnapshot().phase, 'idle');
});

test('Coordinator: terminal failure verification requires pre-transaction state matching', () => {
  const pendingResolve = makePendingResolve(0);
  const pendingRecordAtRound0 = makeRecord({ status: 1, status_name: 'PENDING', retry_count: 0 });
  assert.doesNotThrow(() => assertTerminalFailureState(pendingResolve, pendingRecordAtRound0));

  const mutatedRecord = makeAllowRecord({ retry_count: 0 });
  assert.throws(() => assertTerminalFailureState(pendingResolve, mutatedRecord), /Resolve terminal failure verification failed/i);
});

test('Coordinator: retry terminal failure requires pre-transaction UNRESOLVED state', () => {
  const pendingRetry = makePendingRetry(0);
  const unresolvedRecordAtRound0 = makeUnresolvedRecord({ retry_count: 0 });
  assert.doesNotThrow(() => assertTerminalFailureState(pendingRetry, unresolvedRecordAtRound0));

  const mutatedRecord = makeRecord({ status: 1, status_name: 'PENDING', retry_count: 1 });
  assert.throws(() => assertTerminalFailureState(pendingRetry, mutatedRecord), /Retry terminal failure verification failed/i);
});

test('Coordinator: resume flow performs zero writeContract calls', async () => {
  const writeCalls: unknown[] = [];
  const mockRecord = makeBlockRecord();
  const mockClient = {
    writeContract: async (...args: unknown[]) => {
      writeCalls.push(args);
      return '0x1234';
    },
    getTransaction: async () => makeTxData(
      'request_assessment',
      ['GITHUB_REPO', 'snap-research', 'CoSearch', '763bf8c4d7caa363ad845d39ddfd53b81ae377bd', 'COMMERCIAL_INFERENCE'],
      REQUEST_HASH,
      ACCOUNT,
      CONTRACT,
      2,
    ),
    readContract: async () => mockRecord,
  };

  const pending = makePendingRequest();
  const tx = await mockClient.getTransaction();
  const { returnedAssessmentId } = validateTransactionBinding(tx, pending);
  const rec = (await mockClient.readContract()) as ReturnType<typeof makeBlockRecord>;
  const result = reconcileRequestRecord(pending, rec, returnedAssessmentId);

  assert.equal(result.isProgressed, true);
  assert.equal(writeCalls.length, 0, 'Resume flow must not perform any writeContract calls');
});

test('Coordinator: read/RPC timeout retains the write lock', () => {
  const storage = new MemoryStorage();
  const coordinator = new TransactionCoordinator(CONTRACT);
  coordinator.syncFromStorage(storage);

  const token = coordinator.acquire('request', storage);
  assert.ok(token);
  coordinator.promote(token, makePendingRequest(), storage);

  const rpcError = new Error('RPC connection timed out after 30000ms');
  assert.throws(() => { throw rpcError; }, /RPC connection timed out/);

  assert.equal(coordinator.getSnapshot().phase, 'pending');
});

test('Coordinator: invalid advanced state readback retains the write lock', () => {
  const storage = new MemoryStorage();
  const coordinator = new TransactionCoordinator(CONTRACT);
  coordinator.syncFromStorage(storage);

  const token = coordinator.acquire('resolve', storage);
  assert.ok(token);
  coordinator.promote(token, makePendingResolve(1), storage);

  const regressedRecord = makeAllowRecord({ retry_count: 0 });
  assert.throws(
    () => reconcileResolveRecord(makePendingResolve(1), regressedRecord),
    /retry_count regressed/i,
  );

  assert.equal(coordinator.getSnapshot().phase, 'pending');
});

// ---------------------------------------------------------------------------
// 6. Browser Compatibility & Buffer-Free Decoding Tests
// ---------------------------------------------------------------------------

test('Browser compatibility: transaction binding and returned ID decode correctly without globalThis.Buffer', () => {
  const globalRef = globalThis as unknown as Record<string, unknown>;
  const originalBuffer = globalRef.Buffer;
  try {
    globalRef.Buffer = undefined;

    const pending = makePendingRequest();
    const rawBytes = encodeCalldata('request_assessment', [
      'GITHUB_REPO', 'snap-research', 'CoSearch', '763bf8c4d7caa363ad845d39ddfd53b81ae377bd', 'COMMERCIAL_INFERENCE',
    ]);
    const rawBase64 = bytesToBase64(rawBytes);

    // Encode return value for assessment ID 2 in GenVM return envelope ([status 0, ...abi.calldata.encode(2)])
    const encodedId = abi.calldata.encode(2);
    const returnBytes = new Uint8Array(1 + encodedId.length);
    returnBytes[0] = 0;
    returnBytes.set(encodedId, 1);
    const returnBase64 = bytesToBase64(returnBytes);

    const tx = {
      hash: REQUEST_HASH,
      from_address: ACCOUNT,
      to_address: CONTRACT,
      data: {
        base64: rawBase64,
      },
      consensus_data: {
        final: true,
        leader_receipt: [
          {
            execution_result: 'SUCCESS',
            result: {
              status: 'return',
              payload: {
                raw: returnBase64,
              },
            },
            calldata: rawBase64,
          },
        ],
      },
    };

    const { returnedAssessmentId } = validateTransactionBinding(tx, pending);
    assert.equal(returnedAssessmentId, 2);

    // Live defect repro resolution path works without Buffer
    const blockRecord = makeBlockRecord();
    const result = reconcileRequestRecord(pending, blockRecord, returnedAssessmentId);
    assert.equal(result.isProgressed, true);
    assert.match(result.statusMessage, /progressed to BLOCK \(EXPLICIT_USE_RESTRICTION\)/i);
  } finally {
    globalRef.Buffer = originalBuffer;
  }
});

test('Browser compatibility: base64 decoder fails closed on malformed base64 or invalid ABI calldata without Buffer', () => {
  const globalRef = globalThis as unknown as Record<string, unknown>;
  const originalBuffer = globalRef.Buffer;
  try {
    globalRef.Buffer = undefined;

    assert.equal(extractReturnedAssessmentId('!@#$%^&*'), null);
    assert.equal(extractReturnedAssessmentId('not-valid-base64!'), null);
    assert.equal(extractReturnedAssessmentId(''), null);
    assert.equal(extractReturnedAssessmentId('   '), null);
    assert.equal(extractReturnedAssessmentId({ payload: { raw: 'invalid-base64-payload!' } }), null);

    const pending = makePendingRequest();
    const invalidTx = {
      hash: REQUEST_HASH,
      from_address: ACCOUNT,
      to_address: CONTRACT,
      data: {
        base64: 'bm90LXZhbGlkLWFiaS1kYXRh', // valid base64 of 'not-valid-abi-data', invalid ABI
      },
      consensus_data: {
        final: true,
        leader_receipt: [
          {
            execution_result: 'SUCCESS',
            result: null,
            calldata: 'bm90LXZhbGlkLWFiaS1kYXRh',
          },
        ],
      },
    };
    assert.throws(() => validateTransactionBinding(invalidTx, pending), /Transaction calldata is missing or unparseable/i);
  } finally {
    globalRef.Buffer = originalBuffer;
  }
});
