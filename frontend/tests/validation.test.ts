import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertSameAssessmentIdentity,
  assertTerminalRecord,
  parseAssessmentRecord,
  validateGenLayerReceipt,
} from '../src/lib/validation.ts';

const POLICY_HASH = 'sha256:1105b19ea7786bbd5ace24445845997e914e726cd2f80ddf83d8a6f8f8769532';

function successfulReceipt(): {
  statusName: string;
  resultName: string;
  txExecutionResultName?: string;
  consensus_data: {
    final: boolean;
    leader_receipt: Array<{ error: string | null; execution_result: string }>;
  };
} {
  return {
    statusName: 'FINALIZED',
    resultName: 'MAJORITY_AGREE',
    txExecutionResultName: 'FINISHED_WITH_RETURN',
    consensus_data: {
      final: true,
      leader_receipt: [
        { error: null, execution_result: 'SUCCESS' },
      ],
    },
  };
}

function pendingRecord() {
  return {
    assessment_id: 1,
    canonical_key: 'GITHUB_REPO:org/repo@a1b2c3d4e5f60718293a4b5c6d7e8f9012345678#INTERNAL_RESEARCH#LS-V1',
    artifact_kind: 'GITHUB_REPO',
    namespace: 'org',
    name: 'repo',
    revision: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
    use_profile: 'INTERNAL_RESEARCH',
    requester: '0x1111111111111111111111111111111111111111',
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
  };
}

test('explicit finalized successful execution receipt passes', () => {
  assert.deepEqual(validateGenLayerReceipt(successfulReceipt()), {
    status: 'FINALIZED',
    executionResult: 'FINISHED_WITH_RETURN',
    consensusResult: 'MAJORITY_AGREE',
  });
});

test('missing execution result fails closed', () => {
  const receipt = successfulReceipt();
  delete (receipt as Partial<typeof receipt>).txExecutionResultName;
  assert.throws(() => validateGenLayerReceipt(receipt), /execution result/i);
});

test('unknown execution result fails closed', () => {
  assert.throws(
    () => validateGenLayerReceipt({ ...successfulReceipt(), txExecutionResultName: 'UNKNOWN' }),
    /execution result/i,
  );
});

test('top-level receipt error fails closed', () => {
  assert.throws(
    () => validateGenLayerReceipt({ ...successfulReceipt(), error: 'execution reverted' }),
    /receipt error/i,
  );
});

test('named and numeric execution results must not disagree', () => {
  assert.throws(
    () => validateGenLayerReceipt({ ...successfulReceipt(), txExecutionResult: 2 }),
    /execution result/i,
  );
});

test('undetermined status fails closed', () => {
  assert.throws(
    () => validateGenLayerReceipt({ ...successfulReceipt(), statusName: 'UNDETERMINED' }),
    /status/i,
  );
});

test('accepted status fails closed before finality', () => {
  assert.throws(
    () => validateGenLayerReceipt({ ...successfulReceipt(), statusName: 'ACCEPTED' }),
    /finalized/i,
  );
});

test('leader receipt must be a non-empty array', () => {
  const receipt = successfulReceipt();
  receipt.consensus_data.leader_receipt = [];
  assert.throws(() => validateGenLayerReceipt(receipt), /leader receipt/i);
  assert.throws(
    () => validateGenLayerReceipt({
      ...successfulReceipt(),
      consensus_data: { final: true, leader_receipt: { error: null, execution_result: 'SUCCESS' } },
    }),
    /leader receipt/i,
  );
});

test('any failed leader execution rejects receipt', () => {
  const receipt = successfulReceipt();
  receipt.consensus_data.leader_receipt.push({ error: null, execution_result: 'FAILURE' });
  assert.throws(() => validateGenLayerReceipt(receipt), /leader execution/i);
});

test('any leader error rejects receipt', () => {
  const receipt = successfulReceipt();
  receipt.consensus_data.leader_receipt[0].error = 'contract reverted';
  assert.throws(() => validateGenLayerReceipt(receipt), /leader.*error/i);
});

test('strict assessment record parses an exact pending record', () => {
  const parsed = parseAssessmentRecord(pendingRecord());
  assert.equal(parsed.status_name, 'PENDING');
  assert.deepEqual(parsed.license_ids, []);
  assert.equal(parsed.evidence_sufficient, false);
});

test('status name and verdict must exactly match numeric status', () => {
  assert.throws(() => parseAssessmentRecord({ ...pendingRecord(), status_name: 'ALLOW' }), /status_name/i);
  assert.throws(() => parseAssessmentRecord({ ...pendingRecord(), verdict: 'BLOCK' }), /verdict/i);
});

test('malformed JSON arrays reject instead of becoming empty', () => {
  assert.throws(() => parseAssessmentRecord({ ...pendingRecord(), license_ids: 'not-json' }), /license_ids/i);
  assert.throws(() => parseAssessmentRecord({ ...pendingRecord(), obligations: '{}' }), /obligations/i);
});

test('non-string array members reject instead of coercing', () => {
  assert.throws(() => parseAssessmentRecord({ ...pendingRecord(), evidence_references: '[123]' }), /evidence_references/i);
});

test('unknown enums and non-boolean evidence reject', () => {
  assert.throws(() => parseAssessmentRecord({ ...pendingRecord(), artifact_kind: 'UNKNOWN' }), /artifact_kind/i);
  assert.throws(() => parseAssessmentRecord({ ...pendingRecord(), use_profile: 'UNKNOWN' }), /use_profile/i);
  assert.throws(() => parseAssessmentRecord({ ...pendingRecord(), evidence_sufficient: 0 }), /evidence_sufficient/i);
});

test('resolve readback rejects any changed canonical identity field', () => {
  const before = parseAssessmentRecord(pendingRecord());
  const after = { ...before, status: 5, status_name: 'UNRESOLVED' as const, verdict: 'UNRESOLVED' as const, reason_code: 'SOURCE_MISSING' };
  assert.doesNotThrow(() => assertSameAssessmentIdentity(before, after));
  assert.throws(() => assertSameAssessmentIdentity(before, { ...after, revision: `b${after.revision.slice(1)}` }), /revision/i);
  assert.throws(() => assertSameAssessmentIdentity(before, { ...after, policy_hash: `sha256:${'0'.repeat(64)}` }), /policy_hash/i);
});

test('terminal readback enforces verdict-specific evidence invariants', () => {
  const base = pendingRecord();
  const allow = parseAssessmentRecord({
    ...base,
    status: 2,
    status_name: 'ALLOW',
    verdict: 'ALLOW',
    reason_code: 'LICENSE_CLEAR',
    subject_match: 'EXACT',
    revision_match: 'EXACT',
    evidence_sufficient: true,
    license_ids: '["MIT"]',
    evidence_references: '["https://api.github.com/commit","https://raw.githubusercontent.com/license"]',
  });
  assert.doesNotThrow(() => assertTerminalRecord(allow));
  assert.throws(() => assertTerminalRecord({ ...allow, evidence_sufficient: false }), /ALLOW/i);
  assert.throws(() => assertTerminalRecord({ ...allow, obligations: ['NOTICE'] }), /ALLOW/i);
});
