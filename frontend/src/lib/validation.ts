export type ArtifactKind = 'GITHUB_REPO' | 'HF_MODEL' | 'HF_DATASET';
export type UseProfile =
  | 'INTERNAL_RESEARCH'
  | 'COMMERCIAL_INFERENCE'
  | 'COMMERCIAL_REDISTRIBUTION'
  | 'COMMERCIAL_MODEL_TRAINING';
export type AssessmentStatus = 'PENDING' | 'ALLOW' | 'CONDITIONAL' | 'BLOCK' | 'UNRESOLVED';
export type MatchTriState = 'EXACT' | 'MISMATCH' | 'UNCLEAR';

export interface AssessmentRecord {
  assessment_id: number;
  canonical_key: string;
  artifact_kind: ArtifactKind;
  namespace: string;
  name: string;
  revision: string;
  use_profile: UseProfile;
  requester: string;
  status: number;
  status_name: AssessmentStatus;
  verdict: AssessmentStatus;
  reason_code: string;
  license_ids: string[];
  obligations: string[];
  subject_match: MatchTriState;
  revision_match: MatchTriState;
  evidence_sufficient: boolean;
  evidence_references: string[];
  explanation: string;
  policy_version: string;
  policy_hash: string;
  retry_count: number;
}

const ARTIFACT_KINDS = new Set<ArtifactKind>(['GITHUB_REPO', 'HF_MODEL', 'HF_DATASET']);
const USE_PROFILES = new Set<UseProfile>([
  'INTERNAL_RESEARCH',
  'COMMERCIAL_INFERENCE',
  'COMMERCIAL_REDISTRIBUTION',
  'COMMERCIAL_MODEL_TRAINING',
]);
const MATCH_STATES = new Set<MatchTriState>(['EXACT', 'MISMATCH', 'UNCLEAR']);
const STATUS_BY_CODE: Record<number, AssessmentStatus> = {
  1: 'PENDING',
  2: 'ALLOW',
  3: 'CONDITIONAL',
  4: 'BLOCK',
  5: 'UNRESOLVED',
};

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, field: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    throw new Error(`${field} must be ${allowEmpty ? 'a string' : 'a non-empty string'}.`);
  }
  return value;
}

function requireInteger(value: unknown, field: string, minimum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${field} must be a safe integer >= ${minimum}.`);
  }
  return value;
}

function parseStringArray(value: unknown, field: string): string[] {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a JSON string.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${field} must contain valid JSON.`);
  }

  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new Error(`${field} must contain an array of strings.`);
  }
  return parsed;
}

export function validateGenLayerReceipt(
  receipt: unknown,
): { status: string; executionResult: string; consensusResult: string } {
  const rec = requireRecord(receipt, 'Transaction receipt');

  if ('error' in rec && rec.error !== null && rec.error !== '') {
    throw new Error(`Transaction receipt error: ${String(rec.error ?? 'MISSING')}.`);
  }

  const statusName = typeof rec.statusName === 'string' ? rec.statusName : rec.status;
  if (statusName !== 'FINALIZED') {
    throw new Error(`Transaction receipt status must be FINALIZED; received ${String(statusName ?? 'MISSING')}.`);
  }
  if (typeof rec.statusName === 'string' && typeof rec.status === 'string' && rec.status !== rec.statusName) {
    throw new Error('Transaction receipt status and statusName disagree.');
  }

  let executionResult: string;
  if (
    rec.txExecutionResultName === 'FINISHED_WITH_RETURN' &&
    (rec.txExecutionResult === undefined || rec.txExecutionResult === 1)
  ) {
    executionResult = rec.txExecutionResultName;
  } else if (rec.txExecutionResultName === undefined && rec.txExecutionResult === 1) {
    executionResult = 'FINISHED_WITH_RETURN';
  } else {
    throw new Error(`Transaction execution result rejected: ${String(rec.txExecutionResultName ?? rec.txExecutionResult ?? 'MISSING')}.`);
  }

  const consensusResult = requireString(rec.resultName, 'Transaction consensus result');
  if (!['AGREE', 'MAJORITY_AGREE', 'SUCCESS'].includes(consensusResult)) {
    throw new Error(`Transaction consensus result rejected: ${consensusResult}.`);
  }

  const consensus = requireRecord(rec.consensus_data, 'consensus_data');
  if (consensus.final !== true) {
    throw new Error('Transaction consensus_data.final must be true.');
  }
  if (!Array.isArray(consensus.leader_receipt) || consensus.leader_receipt.length === 0) {
    throw new Error('Transaction leader receipt must be a non-empty array.');
  }

  for (const rawLeader of consensus.leader_receipt) {
    const leader = requireRecord(rawLeader, 'Leader receipt');
    if (leader.error !== null && leader.error !== '') {
      throw new Error(`Leader receipt error: ${String(leader.error ?? 'MISSING')}.`);
    }
    if (leader.execution_result !== 'SUCCESS' && leader.execution_result !== 'FINISHED_WITH_RETURN') {
      throw new Error(`Leader execution result rejected: ${String(leader.execution_result ?? 'MISSING')}.`);
    }
  }

  return { status: statusName, executionResult, consensusResult };
}

export function parseAssessmentRecord(raw: unknown): AssessmentRecord {
  const record = requireRecord(raw, 'Assessment record');
  const assessmentId = requireInteger(record.assessment_id, 'assessment_id', 1);
  const status = requireInteger(record.status, 'status', 1);
  const expectedStatus = STATUS_BY_CODE[status];
  if (!expectedStatus) {
    throw new Error('status must be an integer from 1 through 5.');
  }

  const statusName = requireString(record.status_name, 'status_name') as AssessmentStatus;
  const verdict = requireString(record.verdict, 'verdict') as AssessmentStatus;
  if (statusName !== expectedStatus) {
    throw new Error(`status_name does not match status ${status}.`);
  }
  if (verdict !== expectedStatus) {
    throw new Error(`verdict does not match status ${status}.`);
  }

  const artifactKind = requireString(record.artifact_kind, 'artifact_kind') as ArtifactKind;
  if (!ARTIFACT_KINDS.has(artifactKind)) {
    throw new Error('artifact_kind is not recognized.');
  }
  const useProfile = requireString(record.use_profile, 'use_profile') as UseProfile;
  if (!USE_PROFILES.has(useProfile)) {
    throw new Error('use_profile is not recognized.');
  }

  const requester = requireString(record.requester, 'requester');
  if (!/^0x[0-9a-fA-F]{40}$/.test(requester)) {
    throw new Error('requester must be a 20-byte hexadecimal address.');
  }
  const revision = requireString(record.revision, 'revision');
  if (!/^[0-9a-f]{40}$/.test(revision)) {
    throw new Error('revision must be a normalized full commit SHA.');
  }

  const subjectMatch = requireString(record.subject_match, 'subject_match') as MatchTriState;
  const revisionMatch = requireString(record.revision_match, 'revision_match') as MatchTriState;
  if (!MATCH_STATES.has(subjectMatch) || !MATCH_STATES.has(revisionMatch)) {
    throw new Error('subject_match and revision_match must be recognized tri-state values.');
  }
  if (typeof record.evidence_sufficient !== 'boolean') {
    throw new Error('evidence_sufficient must be a boolean.');
  }

  return {
    assessment_id: assessmentId,
    canonical_key: requireString(record.canonical_key, 'canonical_key'),
    artifact_kind: artifactKind,
    namespace: requireString(record.namespace, 'namespace'),
    name: requireString(record.name, 'name'),
    revision,
    use_profile: useProfile,
    requester,
    status,
    status_name: statusName,
    verdict,
    reason_code: requireString(record.reason_code, 'reason_code', status === 1),
    license_ids: parseStringArray(record.license_ids, 'license_ids'),
    obligations: parseStringArray(record.obligations, 'obligations'),
    subject_match: subjectMatch,
    revision_match: revisionMatch,
    evidence_sufficient: record.evidence_sufficient,
    evidence_references: parseStringArray(record.evidence_references, 'evidence_references'),
    explanation: requireString(record.explanation, 'explanation'),
    policy_version: requireString(record.policy_version, 'policy_version'),
    policy_hash: requireString(record.policy_hash, 'policy_hash'),
    retry_count: requireInteger(record.retry_count, 'retry_count', 0),
  };
}

export function assertSameAssessmentIdentity(
  before: AssessmentRecord,
  after: AssessmentRecord,
): void {
  const immutableFields: (keyof AssessmentRecord)[] = [
    'assessment_id',
    'canonical_key',
    'artifact_kind',
    'namespace',
    'name',
    'revision',
    'use_profile',
    'requester',
    'policy_version',
    'policy_hash',
  ];

  for (const field of immutableFields) {
    if (before[field] !== after[field]) {
      throw new Error(`Assessment readback changed immutable field ${field}.`);
    }
  }
}

export function assertTerminalRecord(record: AssessmentRecord): void {
  if (record.status < 2 || record.status > 5 || record.status_name === 'PENDING') {
    throw new Error('Assessment readback is not terminal.');
  }
  if (record.reason_code.length === 0) {
    throw new Error(`${record.status_name} requires a reason code.`);
  }

  if (record.status_name === 'UNRESOLVED') {
    if (record.evidence_sufficient) {
      throw new Error('UNRESOLVED cannot claim sufficient evidence.');
    }
    return;
  }

  if (
    record.subject_match !== 'EXACT' ||
    record.revision_match !== 'EXACT' ||
    !record.evidence_sufficient ||
    record.license_ids.length === 0 ||
    record.evidence_references.length < 2
  ) {
    throw new Error(`${record.status_name} terminal evidence invariants failed.`);
  }

  if (
    record.status_name === 'ALLOW' &&
    (record.reason_code !== 'LICENSE_CLEAR' || record.obligations.length !== 0)
  ) {
    throw new Error('ALLOW verdict invariants failed.');
  }
  if (
    record.status_name === 'CONDITIONAL' &&
    (record.reason_code !== 'LICENSE_WITH_OBLIGATIONS' || record.obligations.length === 0)
  ) {
    throw new Error('CONDITIONAL verdict invariants failed.');
  }
  if (record.status_name === 'BLOCK' && record.reason_code !== 'EXPLICIT_USE_RESTRICTION') {
    throw new Error('BLOCK verdict invariants failed.');
  }
}
