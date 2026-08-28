import { abi } from 'genlayer-js';
import type {
  PendingAssessmentTransaction,
  PendingRequestTransaction,
  PendingTransaction,
} from './pendingTransaction.ts';

export type ArtifactKind = 'GITHUB_REPO' | 'HF_MODEL' | 'HF_DATASET';
export type UseProfile =
  | 'INTERNAL_RESEARCH'
  | 'COMMERCIAL_INFERENCE'
  | 'COMMERCIAL_REDISTRIBUTION'
  | 'COMMERCIAL_MODEL_TRAINING';
export type AssessmentStatus = 'PENDING' | 'ALLOW' | 'CONDITIONAL' | 'BLOCK' | 'UNRESOLVED';
export type MatchTriState = 'EXACT' | 'MISMATCH' | 'UNCLEAR';

export const POLICY_VERSION = 'LS-V1';
export const POLICY_HASH = 'sha256:696833070a2262ebcd178648b21957a883d62c2d7c0112a007d1143ec3720fbc';

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

export const formatRegistryReadError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  if (/rate limit|429|500 requests per hour/i.test(message)) {
    return 'Studionet RPC rate limit reached. Wait, then retry this read; no transaction was sent.';
  }
  return 'Unable to load assessment records from Studionet RPC. Retry this read; do not submit a duplicate transaction.';
};

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

const TRANSACTION_STATUS_BY_CODE: Record<number, string> = {
  0: 'UNINITIALIZED',
  1: 'PENDING',
  2: 'PROPOSING',
  3: 'COMMITTING',
  4: 'REVEALING',
  5: 'ACCEPTED',
  6: 'UNDETERMINED',
  7: 'FINALIZED',
  8: 'CANCELED',
  9: 'APPEAL_REVEALING',
  10: 'APPEAL_COMMITTING',
  11: 'READY_TO_FINALIZE',
  12: 'VALIDATORS_TIMEOUT',
  13: 'LEADER_TIMEOUT',
};

const TRANSACTION_RESULT_BY_CODE: Record<number, string> = {
  0: 'IDLE',
  1: 'AGREE',
  2: 'DISAGREE',
  3: 'TIMEOUT',
  4: 'DETERMINISTIC_VIOLATION',
  5: 'NO_MAJORITY',
  6: 'MAJORITY_AGREE',
  7: 'MAJORITY_DISAGREE',
};

const EXECUTION_RESULT_BY_CODE: Record<number, string> = {
  0: 'NOT_VOTED',
  1: 'FINISHED_WITH_RETURN',
  2: 'FINISHED_WITH_ERROR',
};

function requireConsistentRepresentations(values: string[], field: string): string {
  if (values.length === 0) {
    throw new Error(`${field} is missing.`);
  }
  if (new Set(values).size !== 1) {
    throw new Error(`${field} representations disagree.`);
  }
  return values[0];
}

function collectNamedRepresentation(
  record: Record<string, unknown>,
  keys: string[],
  field: string,
): string[] {
  const values: string[] = [];
  for (const key of keys) {
    if (record[key] !== undefined) {
      values.push(requireString(record[key], `${field} (${key})`));
    }
  }
  return values;
}

function collectNumericRepresentation(
  record: Record<string, unknown>,
  keys: string[],
  namesByCode: Record<number, string>,
  field: string,
): string[] {
  const values: string[] = [];
  for (const key of keys) {
    if (record[key] === undefined) {
      continue;
    }
    const code = requireInteger(record[key], `${field} (${key})`, 0);
    const name = namesByCode[code];
    if (!name) {
      throw new Error(`${field} (${key}) has an unknown code.`);
    }
    values.push(name);
  }
  return values;
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

export function getGenLayerReceiptStatus(receipt: unknown): string {
  const rec = requireRecord(receipt, 'Transaction receipt');

  return requireConsistentRepresentations(
    [
      ...collectNamedRepresentation(rec, ['statusName', 'status_name'], 'Transaction receipt status'),
      ...(typeof rec.status === 'string'
        ? [requireString(rec.status, 'Transaction receipt status (status)')]
        : collectNumericRepresentation(rec, ['status'], TRANSACTION_STATUS_BY_CODE, 'Transaction receipt status')),
    ],
    'Transaction receipt status',
  );
}

export function validateGenLayerReceipt(
  receipt: unknown,
): { status: string; executionResult: string; consensusResult: string } {
  const rec = requireRecord(receipt, 'Transaction receipt');

  if ('error' in rec && rec.error !== null && rec.error !== '') {
    throw new Error(`Transaction receipt error: ${String(rec.error ?? 'MISSING')}.`);
  }

  const statusName = getGenLayerReceiptStatus(receipt);
  if (statusName !== 'FINALIZED') {
    throw new Error(`Transaction receipt status must be FINALIZED; received ${statusName}.`);
  }

  const topLevelExecutionRepresentations = [
    ...collectNamedRepresentation(
      rec,
      ['txExecutionResultName', 'tx_execution_result_name'],
      'Transaction execution result',
    ),
    ...collectNumericRepresentation(
      rec,
      ['txExecutionResult', 'tx_execution_result'],
      EXECUTION_RESULT_BY_CODE,
      'Transaction execution result',
    ),
  ];
  if (topLevelExecutionRepresentations.length > 0) {
    const topLevelExecution = requireConsistentRepresentations(
      topLevelExecutionRepresentations,
      'Transaction execution result',
    );
    if (topLevelExecution !== 'FINISHED_WITH_RETURN') {
      throw new Error(`Transaction execution result rejected: ${topLevelExecution}.`);
    }
  }

  const consensusResult = requireConsistentRepresentations(
    [
      ...collectNamedRepresentation(
        rec,
        ['resultName', 'result_name'],
        'Transaction consensus result',
      ),
      ...collectNumericRepresentation(
        rec,
        ['result'],
        TRANSACTION_RESULT_BY_CODE,
        'Transaction consensus result',
      ),
    ],
    'Transaction consensus result',
  );
  if (!['AGREE', 'MAJORITY_AGREE'].includes(consensusResult)) {
    throw new Error(`Transaction consensus result rejected: ${consensusResult}.`);
  }

  const consensus = requireRecord(rec.consensus_data, 'consensus_data');
  if (consensus.final !== undefined && consensus.final !== true) {
    throw new Error('Transaction consensus_data.final must not contradict finalized status.');
  }
  if (!Array.isArray(consensus.leader_receipt) || consensus.leader_receipt.length === 0) {
    throw new Error('Transaction leader receipt must be a non-empty array.');
  }

  for (const rawLeader of consensus.leader_receipt) {
    const leader = requireRecord(rawLeader, 'Leader receipt');
    if ('error' in leader && leader.error !== null && leader.error !== '') {
      throw new Error(`Leader receipt error: ${String(leader.error)}.`);
    }
    if (leader.execution_result !== 'SUCCESS' && leader.execution_result !== 'FINISHED_WITH_RETURN') {
      throw new Error(`Leader execution result rejected: ${String(leader.execution_result ?? 'MISSING')}.`);
    }

    if (leader.result !== undefined) {
      const result = requireRecord(leader.result, 'Leader result');
      const resultStatus = requireString(result.status, 'Leader result status');
      if (resultStatus !== 'return') {
        throw new Error(`Leader result status rejected: ${resultStatus}.`);
      }
    }

    if (leader.genvm_result !== undefined) {
      const genvmResult = requireRecord(leader.genvm_result, 'Leader GenVM result');
      for (const field of ['raw_error', 'error_code', 'error_description', 'stderr']) {
        if (genvmResult[field] !== undefined && genvmResult[field] !== null && genvmResult[field] !== '') {
          throw new Error(`Leader GenVM ${field} rejected: ${String(genvmResult[field])}.`);
        }
      }
    }
  }

  return {
    status: statusName,
    executionResult: 'FINISHED_WITH_RETURN',
    consensusResult,
  };
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

export function assertAssessmentUnchanged(before: AssessmentRecord, after: AssessmentRecord): void {
  assertSameAssessmentIdentity(before, after);
  const scalarFields: (keyof AssessmentRecord)[] = [
    'status',
    'status_name',
    'verdict',
    'reason_code',
    'retry_count',
    'subject_match',
    'revision_match',
    'evidence_sufficient',
    'explanation',
  ];
  for (const field of scalarFields) {
    if (before[field] !== after[field]) {
      throw new Error(`Terminal failure readback changed assessment field ${field}.`);
    }
  }
  for (const field of ['license_ids', 'obligations', 'evidence_references'] as const) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
      throw new Error(`Terminal failure readback changed assessment field ${field}.`);
    }
  }
}

export function assertTerminalRecord(record: AssessmentRecord): void {
  assertRetryCountInRange(record.retry_count);
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

export function assertPendingRecord(record: AssessmentRecord, expectedRetryCount?: number): void {
  assertRetryCountInRange(record.retry_count);
  if (record.status !== 1 || record.status_name !== 'PENDING' || record.verdict !== 'PENDING' || record.reason_code !== '') {
    throw new Error('Assessment readback is not in valid PENDING state.');
  }
  if (record.subject_match !== 'UNCLEAR' || record.revision_match !== 'UNCLEAR' || record.evidence_sufficient !== false) {
    throw new Error('PENDING state requires UNCLEAR matches and evidence_sufficient false.');
  }
  if (record.license_ids.length !== 0 || record.obligations.length !== 0 || record.evidence_references.length !== 0) {
    throw new Error('PENDING state requires empty license, obligation, and evidence arrays.');
  }
  if (record.policy_version !== 'LS-V1' || record.policy_hash !== POLICY_HASH) {
    throw new Error('Assessment policy version or manifest hash mismatch.');
  }
  if (expectedRetryCount !== undefined && record.retry_count !== expectedRetryCount) {
    throw new Error(`Assessment retry_count expected ${expectedRetryCount}, got ${record.retry_count}.`);
  }
}

function assertRetryCountInRange(retryCount: number): void {
  if (!Number.isSafeInteger(retryCount) || retryCount < 0 || retryCount > 2) {
    throw new Error(`Assessment retry_count ${retryCount} is out of valid bounds [0..2].`);
  }
}

function decodeBase64ToBytes(base64: string): Uint8Array | null {
  try {
    const trimmed = base64.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLength);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(padded)) {
      return null;
    }
    const atobFn = typeof globalThis.atob === 'function'
      ? globalThis.atob
      : (typeof atob === 'function' ? atob : null);
    if (!atobFn) return null;
    const binary = atobFn(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

interface DecodedCalldataInfo {
  method: string;
  args: unknown[];
}

function extractCalldataFromSource(source: unknown): DecodedCalldataInfo | null {
  if (!source) return null;
  if (source instanceof Uint8Array || (Array.isArray(source) && source.every((value) => Number.isInteger(value) && value >= 0 && value <= 255))) {
    try {
      const decoded = abi.calldata.decode(source instanceof Uint8Array ? source : new Uint8Array(source));
      if (decoded instanceof Map) {
        const method = decoded.get('method');
        const args = decoded.get('args');
        if (typeof method === 'string' && Array.isArray(args)) return { method, args };
      }
    } catch {}
  }
  if (source instanceof Map) {
    const method = source.get('method');
    const args = source.get('args');
    if (typeof method === 'string' && Array.isArray(args)) {
      return { method, args };
    }
  }
  if (typeof source === 'string') {
    const trimmed = source.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed.replace(/,\s*]/g, ']').replace(/]\s*"method"/, '],"method"'));
        if (typeof parsed?.method === 'string' && Array.isArray(parsed?.args)) {
          return { method: parsed.method, args: parsed.args };
        }
      } catch {}
    }
    const bytes = decodeBase64ToBytes(trimmed);
    if (bytes) {
      try {
        const decoded = abi.calldata.decode(bytes);
        if (decoded instanceof Map) {
          const method = decoded.get('method');
          const args = decoded.get('args');
          if (typeof method === 'string' && Array.isArray(args)) {
            return { method, args };
          }
        }
      } catch {}
    }
  }
  if (typeof source === 'object' && source !== null) {
    const rec = source as Record<string, unknown>;
    if (typeof rec.method === 'string' && Array.isArray(rec.args)) {
      return { method: rec.method, args: rec.args };
    }
    if (Array.isArray(rec.raw)) {
      try {
        const decoded = abi.calldata.decode(new Uint8Array(rec.raw as number[]));
        if (decoded instanceof Map) {
          const method = decoded.get('method');
          const args = decoded.get('args');
          if (typeof method === 'string' && Array.isArray(args)) {
            return { method, args };
          }
        }
      } catch {}
    }
    if (typeof rec.base64 === 'string') {
      return extractCalldataFromSource(rec.base64);
    }
    if (typeof rec.readable === 'string') {
      return extractCalldataFromSource(rec.readable);
    }
  }
  return null;
}

function collectCalldataInfos(tx: Record<string, unknown>): DecodedCalldataInfo[] {
  const infos: DecodedCalldataInfo[] = [];
  const add = (source: unknown, label: string) => {
    if (typeof source === 'object' && source !== null && !Array.isArray(source) && !(source instanceof Map)) {
      const rec = source as Record<string, unknown>;
      if (rec.method !== undefined || rec.args !== undefined) {
        const decoded = extractCalldataFromSource(rec);
        if (!decoded) throw new Error(`${label} is present but malformed or unparseable.`);
        infos.push(decoded);
      }
      let found = false;
      for (const key of ['raw', 'base64', 'readable']) {
        if (rec[key] !== undefined && rec[key] !== null) {
          add(rec[key], `${label}.${key}`);
          found = true;
        }
      }
      if (!found && rec.method === undefined && rec.args === undefined) {
        throw new Error(`${label} is present but has no supported calldata representation.`);
      }
      return;
    }
    const decoded = extractCalldataFromSource(source);
    if (!decoded) throw new Error(`${label} is present but malformed or unparseable.`);
    infos.push(decoded);
  };
  if (tx.data && typeof tx.data === 'object') {
    const dataRec = tx.data as Record<string, unknown>;
    let found = false;
    for (const key of ['calldata', 'raw', 'base64', 'readable']) {
      if (dataRec[key] !== undefined && dataRec[key] !== null) {
        add(dataRec[key], `Transaction data.${key}`);
        found = true;
      }
    }
    if (!found && (dataRec.method !== undefined || dataRec.args !== undefined)) {
      add(dataRec, 'Transaction data');
    }
  }
  if (tx.txDataDecoded && typeof tx.txDataDecoded === 'object') {
    const decodedRec = tx.txDataDecoded as Record<string, unknown>;
    let found = false;
    for (const key of ['callData', 'calldata', 'raw', 'base64', 'readable']) {
      if (decodedRec[key] !== undefined && decodedRec[key] !== null) {
        add(decodedRec[key], `Transaction txDataDecoded.${key}`);
        found = true;
      }
    }
    if (!found && (decodedRec.method !== undefined || decodedRec.args !== undefined)) {
      add(decodedRec, 'Transaction txDataDecoded');
    }
  }
  if (tx.consensus_data && typeof tx.consensus_data === 'object') {
    const consensus = tx.consensus_data as Record<string, unknown>;
    if (Array.isArray(consensus.leader_receipt)) {
      for (const lr of consensus.leader_receipt) {
        if (lr && typeof lr === 'object') {
          const leader = lr as Record<string, unknown>;
          if (leader.calldata !== undefined && leader.calldata !== null) {
            add(leader.calldata, 'Leader receipt calldata');
          }
        }
      }
    }
  }
  return infos;
}

function collectReturnedAssessmentIds(result: unknown, label: string): number[] {
  if (result === undefined || result === null) return [];
  if (typeof result === 'object' && !(result instanceof Uint8Array) && !Array.isArray(result)) {
    const rec = result as Record<string, unknown>;
    const ids: number[] = [];
    let found = false;
    for (const key of ['payload', 'readable', 'raw', 'data']) {
      if (rec[key] !== undefined && rec[key] !== null) {
        found = true;
        const nested = collectReturnedAssessmentIds(rec[key], `${label}.${key}`);
        if (nested.length === 0) throw new Error(`${label}.${key} is present but does not contain a valid assessment ID.`);
        ids.push(...nested);
      }
    }
    if (!found) throw new Error(`${label} is present but has no supported return representation.`);
    return ids;
  }
  const id = extractReturnedAssessmentId(result);
  if (id === null) throw new Error(`${label} is present but malformed or unparseable.`);
  return [id];
}

export function extractReturnedAssessmentId(result: unknown): number | null {
  if (result === undefined || result === null) return null;
  if (typeof result === 'number' || typeof result === 'bigint') {
    const n = Number(result);
    return Number.isSafeInteger(n) && n >= 1 ? n : null;
  }
  if (result instanceof Uint8Array) {
    if (result.length > 1 && result[0] === 0) {
      try {
        const decoded = abi.calldata.decode(result.subarray(1));
        if (typeof decoded === 'bigint' || typeof decoded === 'number') {
          const n = Number(decoded);
          return Number.isSafeInteger(n) && n >= 1 ? n : null;
        }
      } catch {}
    }
    if (result.length > 0) {
      try {
        const decoded = abi.calldata.decode(result);
        if (typeof decoded === 'bigint' || typeof decoded === 'number') {
          const n = Number(decoded);
          return Number.isSafeInteger(n) && n >= 1 ? n : null;
        }
      } catch {}
    }
    return null;
  }
  if (typeof result === 'string') {
    const trimmed = result.trim();
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed);
      return Number.isSafeInteger(n) && n >= 1 ? n : null;
    }
    const bytes = decodeBase64ToBytes(trimmed);
    if (bytes) {
      return extractReturnedAssessmentId(bytes);
    }
    return null;
  }
  if (Array.isArray(result)) {
    try {
      const bytes = new Uint8Array(result as number[]);
      return extractReturnedAssessmentId(bytes);
    } catch {
      return null;
    }
  }
  if (typeof result === 'object') {
    const rec = result as Record<string, unknown>;
    if (rec.payload !== undefined && rec.payload !== null) {
      const id = extractReturnedAssessmentId(rec.payload);
      if (id !== null) return id;
    }
    if (rec.readable !== undefined && rec.readable !== null) {
      const id = extractReturnedAssessmentId(rec.readable);
      if (id !== null) return id;
    }
    if (rec.raw !== undefined && rec.raw !== null) {
      const id = extractReturnedAssessmentId(rec.raw);
      if (id !== null) return id;
    }
    if (rec.data !== undefined && rec.data !== null) {
      const id = extractReturnedAssessmentId(rec.data);
      if (id !== null) return id;
    }
  }
  return null;
}

export function validateTransactionBinding(
  tx: unknown,
  pending: PendingTransaction,
): { returnedAssessmentId: number | null } {
  const rec = requireRecord(tx, 'Transaction data');

  const hashRepresentations: string[] = [];
  for (const key of ['hash', 'txId', 'transactionHash']) {
    if (rec[key] !== undefined && rec[key] !== null) {
      hashRepresentations.push(requireString(rec[key], `Transaction hash (${key})`).toLowerCase());
    }
  }
  if (hashRepresentations.length === 0) {
    throw new Error('Transaction hash is missing from transaction data.');
  }
  const txHash = requireConsistentRepresentations(hashRepresentations, 'Transaction hash');
  if (txHash !== pending.hash.toLowerCase()) {
    throw new Error(`Transaction hash mismatch: expected ${pending.hash}, got ${txHash}.`);
  }

  const fromRepresentations: string[] = [];
  for (const key of ['from_address', 'from', 'sender']) {
    if (rec[key] !== undefined && rec[key] !== null) {
      const addr = requireString(rec[key], `Transaction sender (${key})`).toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(addr)) {
        throw new Error(`Transaction sender (${key}) is not a valid 20-byte address.`);
      }
      fromRepresentations.push(addr);
    }
  }
  if (fromRepresentations.length === 0) {
    throw new Error('Transaction sender address is missing from transaction data.');
  }
  const fromAddr = requireConsistentRepresentations(fromRepresentations, 'Transaction sender address');
  if (fromAddr !== pending.account.toLowerCase()) {
    throw new Error(`Transaction sender mismatch: expected ${pending.account}, got ${fromAddr}.`);
  }

  const toRepresentations: string[] = [];
  for (const key of ['to_address', 'to', 'recipient']) {
    if (rec[key] !== undefined && rec[key] !== null) {
      const addr = requireString(rec[key], `Transaction recipient (${key})`).toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(addr)) {
        throw new Error(`Transaction recipient (${key}) is not a valid 20-byte address.`);
      }
      toRepresentations.push(addr);
    }
  }
  if (toRepresentations.length === 0) {
    throw new Error('Transaction recipient address is missing from transaction data.');
  }
  const toAddr = requireConsistentRepresentations(toRepresentations, 'Transaction recipient address');
  if (toAddr !== pending.contractAddress.toLowerCase()) {
    throw new Error(`Transaction recipient mismatch: expected ${pending.contractAddress}, got ${toAddr}.`);
  }

  const calldatas = collectCalldataInfos(rec);
  if (calldatas.length === 0) {
    throw new Error('Transaction calldata is missing or unparseable.');
  }
  const methodNames = calldatas.map((c) => c.method);
  const method = requireConsistentRepresentations(methodNames, 'Transaction method');

  if (pending.action === 'request') {
    if (method !== 'request_assessment') {
      throw new Error(`Transaction method mismatch: expected request_assessment, got ${method}.`);
    }
    for (const cd of calldatas) {
      if (cd.args.length !== 5) {
        throw new Error(`request_assessment arguments length mismatch: expected 5, got ${cd.args.length}.`);
      }
      if (cd.args[0] !== pending.payload.artifactKind) {
        throw new Error(`request_assessment artifact_kind mismatch: expected ${pending.payload.artifactKind}, got ${String(cd.args[0])}.`);
      }
      if (String(cd.args[1]).toLowerCase() !== pending.payload.namespace.toLowerCase()) {
        throw new Error(`request_assessment namespace mismatch: expected ${pending.payload.namespace}, got ${String(cd.args[1])}.`);
      }
      if (String(cd.args[2]).toLowerCase() !== pending.payload.name.toLowerCase()) {
        throw new Error(`request_assessment name mismatch: expected ${pending.payload.name}, got ${String(cd.args[2])}.`);
      }
      if (String(cd.args[3]).toLowerCase() !== pending.payload.revision.toLowerCase()) {
        throw new Error(`request_assessment revision mismatch: expected ${pending.payload.revision}, got ${String(cd.args[3])}.`);
      }
      if (cd.args[4] !== pending.payload.useProfile) {
        throw new Error(`request_assessment use_profile mismatch: expected ${pending.payload.useProfile}, got ${String(cd.args[4])}.`);
      }
    }
  } else {
    const expectedMethod = pending.action === 'resolve' ? 'resolve_assessment' : 'retry_assessment';
    if (method !== expectedMethod) {
      throw new Error(`Transaction method mismatch: expected ${expectedMethod}, got ${method}.`);
    }
    for (const cd of calldatas) {
      if (cd.args.length !== 1) {
        throw new Error(`${expectedMethod} arguments length mismatch: expected 1, got ${cd.args.length}.`);
      }
      const argId = Number(cd.args[0]);
      if (argId !== pending.payload.assessmentId) {
        throw new Error(`${expectedMethod} assessment_id mismatch: expected ${pending.payload.assessmentId}, got ${argId}.`);
      }
    }
  }

  let returnedAssessmentId: number | null = null;
  if (pending.action === 'request' && rec.consensus_data && typeof rec.consensus_data === 'object') {
    const consensus = rec.consensus_data as Record<string, unknown>;
    if (Array.isArray(consensus.leader_receipt)) {
      const returnedIds: number[] = [];
      for (const lr of consensus.leader_receipt) {
        if (lr && typeof lr === 'object') {
          const leaderIds = collectReturnedAssessmentIds((lr as Record<string, unknown>).result, 'Leader receipt result');
          if (leaderIds.length === 0) throw new Error('Every request leader receipt must return an assessment ID.');
          returnedIds.push(...leaderIds);
        }
      }
      if (returnedIds.length === 0) throw new Error('Request leader receipt returned no assessment ID.');
      if (new Set(returnedIds).size !== 1) {
        throw new Error('Leader receipt return values disagree.');
      }
      returnedAssessmentId = returnedIds[0];
    }
  }

  return { returnedAssessmentId };
}

export function reconcileRequestRecord(
  pending: PendingRequestTransaction,
  record: AssessmentRecord,
  returnedAssessmentId?: number | null,
): { statusMessage: string; isProgressed: boolean } {
  assertRetryCountInRange(record.retry_count);
  const { payload } = pending;
  if (record.canonical_key !== payload.canonicalKey) {
    throw new Error(`Readback canonical key mismatch: expected ${payload.canonicalKey}, got ${record.canonical_key}.`);
  }
  if (record.artifact_kind !== payload.artifactKind || record.use_profile !== payload.useProfile) {
    throw new Error('Readback artifact kind or use profile mismatch.');
  }
  if (
    record.namespace.toLowerCase() !== payload.namespace.toLowerCase() ||
    record.name.toLowerCase() !== payload.name.toLowerCase()
  ) {
    throw new Error('Readback namespace or repository name mismatch.');
  }
  if (record.revision.toLowerCase() !== payload.revision.toLowerCase()) {
    throw new Error('Readback commit SHA revision mismatch.');
  }
  if (record.requester.toLowerCase() !== pending.account.toLowerCase()) {
    throw new Error(`Readback requester address mismatch: expected ${pending.account}, got ${record.requester}.`);
  }
  if (record.policy_version !== 'LS-V1' || record.policy_hash !== POLICY_HASH) {
    throw new Error('Readback policy version or manifest hash mismatch.');
  }
  if (returnedAssessmentId !== undefined && returnedAssessmentId !== null && record.assessment_id !== returnedAssessmentId) {
    throw new Error(`Readback assessment ID mismatch: receipt returned #${returnedAssessmentId}, record is #${record.assessment_id}.`);
  }

  if (record.status === 1) {
    assertPendingRecord(record);
    if (record.retry_count === 0) {
      return {
        statusMessage: 'Attestation request successfully registered and verified on Studionet!',
        isProgressed: false,
      };
    }
    return {
      statusMessage: `Historical request registered assessment #${record.assessment_id}; assessment has since progressed to PENDING (retry ${record.retry_count}/2).`,
      isProgressed: true,
    };
  }

  if (record.status >= 2 && record.status <= 5) {
    assertTerminalRecord(record);
    return {
      statusMessage: `Historical request registered assessment #${record.assessment_id}; assessment has since progressed to ${record.status_name} (${record.reason_code}).`,
      isProgressed: true,
    };
  }

  throw new Error(`Assessment record status ${record.status} is unrecognized.`);
}

function assertPendingAssessmentIdentity(pending: PendingAssessmentTransaction, record: AssessmentRecord): void {
  const { identity } = pending.payload;
  const snapshot = pending.payload.snapshot;
  assertSameAssessmentIdentity(snapshot, record);
  if (snapshot.retry_count !== pending.payload.retryCount) {
    throw new Error('Persisted pre-action retry count mismatch.');
  }
  if (pending.action === 'resolve') {
    assertPendingRecord(snapshot, pending.payload.retryCount);
  } else {
    assertTerminalRecord(snapshot);
    if (snapshot.status !== 5 || snapshot.status_name !== 'UNRESOLVED' || snapshot.verdict !== 'UNRESOLVED') {
      throw new Error('Persisted retry pre-action state is not UNRESOLVED.');
    }
  }
  if (record.assessment_id !== pending.payload.assessmentId || record.canonical_key !== pending.payload.canonicalKey) {
    throw new Error('Assessment ID or canonical key mismatch.');
  }
  if (
    record.artifact_kind !== identity.artifactKind
    || record.namespace !== identity.namespace
    || record.name !== identity.name
    || record.revision !== identity.revision
    || record.use_profile !== identity.useProfile
    || record.requester.toLowerCase() !== identity.requester.toLowerCase()
    || record.policy_version !== identity.policyVersion
    || record.policy_hash !== identity.policyHash
  ) {
    throw new Error('Assessment immutable identity or policy binding mismatch.');
  }
  assertRetryCountInRange(record.retry_count);
}

export function reconcileResolveRecord(
  pending: PendingAssessmentTransaction,
  record: AssessmentRecord,
): { statusMessage: string; isProgressed: boolean } {
  assertPendingAssessmentIdentity(pending, record);

  const expectedRound = pending.payload.retryCount;
  if (record.retry_count < expectedRound) {
    throw new Error(`Assessment retry_count regressed from ${expectedRound} to ${record.retry_count}.`);
  }
  if (record.retry_count > 2) {
    throw new Error(`Assessment retry_count ${record.retry_count} exceeds maximum limit of 2.`);
  }

  if (record.retry_count === expectedRound) {
    if (record.status === 1) {
      throw new Error(`Resolve transaction succeeded, but assessment remains PENDING at retry round ${expectedRound}.`);
    }
    assertTerminalRecord(record);
    return {
      statusMessage: `Resolution finalized! Verdict: ${record.status_name} (${record.reason_code})`,
      isProgressed: false,
    };
  }

  if (record.status === 1) {
    assertPendingRecord(record);
    return {
      statusMessage: `Historical resolution completed; assessment has since been retried to PENDING (retry ${record.retry_count}/2).`,
      isProgressed: true,
    };
  }

  assertTerminalRecord(record);
  return {
    statusMessage: `Historical resolution completed; assessment has since progressed to ${record.status_name} (retry ${record.retry_count}/2).`,
    isProgressed: true,
  };
}

export function reconcileRetryRecord(
  pending: PendingAssessmentTransaction,
  record: AssessmentRecord,
): { statusMessage: string; isProgressed: boolean } {
  assertPendingAssessmentIdentity(pending, record);

  const priorRound = pending.payload.retryCount;
  const minExpectedRound = priorRound + 1;

  if (record.retry_count < minExpectedRound) {
    throw new Error(`Retry transaction expected retry_count >= ${minExpectedRound}, but readback has ${record.retry_count}.`);
  }
  if (record.retry_count > 2) {
    throw new Error(`Assessment retry_count ${record.retry_count} exceeds maximum limit of 2.`);
  }

  if (record.retry_count === minExpectedRound) {
    if (record.status === 1) {
      assertPendingRecord(record, minExpectedRound);
      return {
        statusMessage: `Retry finalized! Assessment reset to PENDING (round ${record.retry_count}/2).`,
        isProgressed: false,
      };
    }
    assertTerminalRecord(record);
    return {
      statusMessage: `Retry succeeded (round ${minExpectedRound}/2); assessment has since resolved to ${record.status_name} (${record.reason_code}).`,
      isProgressed: true,
    };
  }

  if (record.status === 1) {
    assertPendingRecord(record);
    return {
      statusMessage: `Historical retry succeeded; assessment has since progressed to PENDING (retry ${record.retry_count}/2).`,
      isProgressed: true,
    };
  }

  assertTerminalRecord(record);
  return {
    statusMessage: `Historical retry succeeded; assessment has since progressed to ${record.status_name} (retry ${record.retry_count}/2).`,
    isProgressed: true,
  };
}
