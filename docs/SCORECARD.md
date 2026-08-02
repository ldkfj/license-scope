# GenLayer Submission Category and Scorecard

## Classification

```text
Category: PROJECT
Validity gate: PASS FOR OFFLINE PRE_DEPLOY SCOPE
```

LicenseScope is classified as `PROJECT`, not a standalone `INTELLIGENT_CONTRACT`, because the deliverable includes a complete Next.js user application and claims an end-to-end wallet-to-contract assessment workflow. Final Project validity still requires one matching Studionet deployment, Explorer evidence, live application, repository, and submission package.

## GenLayer fit: 4/5

**Evidence:** The consensus-critical question—whether public license evidence for an immutable artifact revision supports a specific intended-use profile—cannot be established by a deterministic contract alone. The contract derives bounded evidence, runs independent leader/validator evaluation through GenLayer, compares stable consequences, and stores the final attestation on-chain.

**Inspected:** `contracts/license_scope.py`, especially source derivation/evaluation, `resolve_assessment`, stable consensus comparison, and terminal state writes; direct adversarial tests for prompt injection, license relabeling, source precedence, malformed evidence, and disagreement.

**Remaining weakness:** No live Studionet validator/execution evidence exists yet. V1 supports only GitHub repositories.

## Contract quality: 4/5

**Evidence:** Canonical identity and full commit SHA are enforced; caller-supplied evidence URLs/verdicts are absent; deterministic license reconciliation outranks evaluator labels; `CUSTOM_TERMS` fails closed; consensus disagreement preserves `PENDING`; retry is bounded and atomically clears terminal fields; the upgradable path has an explicit membership guard and empty-code rejection.

**Inspected:** `contracts/license_scope.py`, `tests/direct/test_license_scope.py`, canonical policy hash regression, authorized/unauthorized upgrade tests, direct runtime/controlled consensus callback-count tests.

**Remaining weakness:** Native Root Slot locking, code redispatch, deployed-source parity, and safe upgrade rehearsal remain live `VERIFY-AT-STUDIO` requirements.

## Engineering: 4/5

**Evidence:** Python 3.12 toolchain and dependencies are transitively locked with `uv.lock`; frontend dependencies are locked with `package-lock.json`; GenVM lint/validation, direct tests, strict frontend tests, typecheck, lint, and production build are reproducible. Public/internal artifact boundaries are defined in `.gitignore`.

**Inspected:** `pyproject.toml`, `uv.lock`, `frontend/package-lock.json`, tests, build configuration, `README.md`, `docs/VERIFICATION.md`, and `docs/DEPLOYMENT_RECOVERY.md`.

**Remaining weakness:** Exact local release commit and real deployment/live evidence are not yet available. Integration tests are intentionally skipped without explicit live configuration and therefore are not integration proof.

## Frontend / UX: 3/5

**Evidence:** The Next.js application connects a browser wallet, enforces chain ID 61999 before writes, calls the contract, waits for finality, fetches the full transaction, validates consensus/execution/leader receipts, performs exact contract readback, and rejects malformed records. With no valid address it displays `Deployment not configured` and disables actions.

**Inspected:** `frontend/src/lib/genlayer.ts`, `frontend/src/lib/validation.ts`, request/resolve/retry components, `frontend/tests/validation.test.ts`, typecheck/lint/build output.

**Remaining weakness:** The complete journeys have not yet been exercised against a real Studionet deployment or deployed Vercel application.

## Overall evidence-based assessment

LicenseScope is a strong offline PRE_DEPLOY candidate with substantive GenLayer consensus behavior, fail-closed evidence handling, strict transaction/readback authority, and an explicit recovery model.

```text
Submission recommendation: NOT READY FOR DEPLOYMENT
```

Current blockers before PRE_DEPLOY anonymous handoff:

1. Codex PRE_DEPLOY verdict for the final evidence-package commit and completed checkpoint evidence.

Deployment, GitHub push, Vercel release, live proof, and final scorecard are later checkpoints and do not count as current offline evidence.
