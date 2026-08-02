# Verification

## Reviewed source

| Field | Value |
|---|---|
| Project | LicenseScope |
| Submission category | `PROJECT` |
| Checkpoint | PRE_DEPLOY preparation |
| Source-code commit | `dc5f4c3673e14427f563a843ef5f33cef3b225f5` |
| Contract source | `contracts/license_scope.py` |
| Contract source SHA-256 | `8a9e10aed946d2860145451a898a726dd8c726689be7e2fff1e557afa5cc43ed` |
| Policy version | `LS-V1` |
| Policy manifest hash | `sha256:1105b19ea7786bbd5ace24445845997e914e726cd2f80ddf83d8a6f8f8769532` |
| Network target | GenLayer Studionet, chain ID `61999` |
| Selected deployment wallet | `0x7885536194bbd6e1d0a6ab991ab215cfa9542339` |
| Selected external upgrader | `0x7885536194bbd6e1d0a6ab991ab215cfa9542339` |
| Contract address |  |
| Deployment transaction |  |
| Explorer |  |
| Live web |  |

The canonical anonymous handoff supplies the exact final evidence-package commit. The source-code commit above fixes the contract, frontend, tests, dependency locks, and correction code before the metadata-only evidence commit. Deployment/live fields belong to later checkpoints and are intentionally blank.

## Offline command evidence

All Python commands were run from the project root with external `PYTHONPATH` unset and project-local Python 3.13. The same Python gates were also reproduced from a clean Git-tree archive with a newly created `.venv` and no importable `genlayer` package before the repository test bootstrap ran.

### Locked dependency sync

```bash
env -u PYTHONPATH uv lock
env -u PYTHONPATH uv sync --locked
env -u PYTHONPATH uv pip check
```

Result:

```text
Resolved 58 packages
Checked 57 installed packages
All installed packages are compatible
```

`cloudpickle==3.1.2` is explicitly locked because the installed `genlayer-py` runtime imports it for `run_nondet_unsafe` without declaring it in package metadata.

### GenVM lint and schema validation

```bash
env -u PYTHONPATH uv run genvm-lint check contracts/license_scope.py
```

Result:

```text
PASS — 3 lint checks
PASS — contract validation
Contract: LicenseScope
Methods: 8 (4 view, 4 write)
```

The linter reported that a newer py-genlayer runner exists. The exact dependency header validated here remains pinned in the reviewed contract; upgrading it is a separate version-sensitive change requiring a complete re-review.

### Direct contract behavior

```bash
env -u PYTHONPATH uv run pytest tests/direct -v
```

Result:

```text
45 passed
```

Coverage includes:

- intended Root upgrader registration;
- authorized code replacement;
- unauthorized upgrade rejection with no code mutation;
- empty upgrade payload rejection with no code mutation;
- canonical policy manifest hash reproduction;
- contract-pinned official SDK provenance, 43-file canonical tree digest, and rejection of hidden `.venv` SDK state;
- exact GitHub identity and revision binding;
- prompt-injection and GPL/CC-BY-NC relabel resistance;
- authoritative root-license precedence over README dependency mentions;
- custom terms fail closed;
- compatibility matrix, including `INTERNAL_RESEARCH + RESEARCH_ONLY`;
- strict leader-result wrapper handling and stable consensus comparison, including sorted/deduplicated equivalent list permutations and genuine-difference rejection;
- exact leader/validator callback counts without a third evaluator run;
- malformed source, 404, 500, timeout, and empty-body handling;
- terminal immutability, retry atomic reset, retry limit, and duplicate key rejection;
- end-to-end `CONDITIONAL` and `BLOCK` outcomes in direct mode.

Direct mode verifies the explicit contract upgrader membership guard and Root code-byte replacement. Native locked Root Slot enforcement and post-upgrade redispatch remain live `VERIFY-AT-STUDIO` items.

### Integration selection

```bash
env -u PYTHONPATH uv run pytest tests/integration -v
env -u PYTHONPATH uv run gltest tests/integration -v \
  --network studionet \
  --rpc-url https://studio.genlayer.com/api
```

Results:

```text
Default selection: 3 skipped
Explicit Studionet selection: 3 skipped
```

These are truthful skipped selections, not live integration evidence. Live execution requires explicit authorization, selected wallet/upgrader identities, and a deployment governed by `docs/DEPLOYMENT_RECOVERY.md`.

The authorized-live fixture now uses the real immutable `snap-research/CoSearch@763bf8c4d7caa363ad845d39ddfd53b81ae377bd` revision. Its exact root `LICENSE` blob is CC-BY-NC-4.0, and the advertised commercial-use branch asserts the source-derived `BLOCK` outcome instead of accepting any terminal verdict. This fixture has not been run live.

### Frontend behavior and build

```bash
npm --prefix frontend test
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend audit --audit-level=high
```

Results:

```text
Frontend unit behavior: 17 passed
TypeScript: PASS
ESLint: PASS
Next.js production build: PASS
Static route: /
npm audit: 0 vulnerabilities
```

The frontend tests cover fail-closed receipt parsing, top-level and leader errors, contradictory execution fields, unknown status, explicit rejection of non-final `ACCEPTED`, strict record parsing, immutable identity readback, and terminal-state invariants.

The build detects a protected local `frontend/.env.local`; its content is not part of this evidence and must never be committed or disclosed.

## PRE_DEPLOY correction closure

1. **Clean-checkout SDK reproducibility — CLOSED.** Python is locked to `>=3.13,<3.14`. `tests/conftest.py` calls the official `genlayer-test` loader using the contract's `py-genlayer:1jb45...` dependency header before collection. A clean staged-tree archive created a fresh `.venv`, installed 57 compatible packages, proved `genlayer_before_bootstrap=None`, passed semantic lint/schema extraction, and passed all 45 direct tests. The provenance regression verifies transitive std hash `11rhn...`, 43 official SDK files, and canonical SDK tree SHA-256 `bc2979c4b22cd8ef1363db7031c9d1d2c27184ab950900c731f3e29c261254b2`.
2. **Consensus list canonicalization — CLOSED.** License IDs, obligations, and evidence references are validated, deduplicated, and sorted before stable comparison and before storage. Regression tests prove permutation/duplicate equivalence while different obligations and evidence still disagree.
3. **PRE_DEPLOY documentation consistency — CLOSED.** README, scorecard, verification document, and recovery manifest now agree: wallet/upgrader selected, Codex technical verdict `APPROVED`, anonymous re-review pending, and deployment not authorized.
4. **Dependency audit observation — CLOSED.** Lockfile overrides resolve `postcss` to `8.5.18` and `sharp` to `0.35.0`; `npm audit` reports zero vulnerabilities and unit/typecheck/lint/build gates pass.
5. **Receipt observation — CLOSED.** The standalone validator rejects `ACCEPTED`; only `FINALIZED` may proceed to execution/consensus/leader validation.
6. **Integration-fixture observation — CLOSED FOR PRE_DEPLOY PLAN.** The fabricated happy-path SHA was replaced by a verified real immutable CC-BY-NC-4.0 repository revision with exact `BLOCK` assertions. Live execution remains deferred to `POST_DEPLOY_TEST`.

## Proof matrix

| Actor/action | UI/operational path | Contract method | Offline evidence | Live transaction/readback |
|---|---|---|---|---|
| Requester creates assessment | Request form + browser wallet | `request_assessment` | Direct pending/duplicate tests; frontend finality/readback tests |  |
| Resolver evaluates pending assessment | Registry resolve action | `resolve_assessment` | Direct evidence/consensus/adversarial tests; frontend terminal readback tests |  |
| Retry caller resets unresolved record | Registry retry action | `retry_assessment` | Direct atomic-reset/limit tests; frontend PENDING invariant tests |  |
| External upgrader replaces code | Documented operational path | `upgrade` | Direct registration/authorization/no-mutation/empty-code tests |  |
| Reader inspects records/policy | Registry/detail views | contract view methods | Direct view tests; strict frontend parser tests |  |

Live proof cells are intentionally blank until POST_DEPLOY_TEST.

## Source-of-truth and security findings

- Contract is the sole verdict authority; frontend does not compute verdicts.
- Browser writes require provider/account propagation and immediate Studionet chain verification.
- Success requires `FINALIZED`, explicit successful transaction/consensus/leader execution, and exact contract readback.
- The runtime address examples remain blank and the UI fails closed with `Deployment not configured`.
- Root license files outrank README fallback evidence.
- Fetched web content is treated as untrusted data, not instructions.
- HF model/dataset adapters are explicitly unavailable in V1 rather than simulated.
- No fake GenLayer SDK/stub directory is present; Direct tests bootstrap the contract-pinned official runner through `genlayer-test` and verify its canonical tree digest.
- Internal AI/governance/specification files and generated artifacts are excluded by the root `.gitignore`.

## Known limitations and pending gates

- No Studionet contract has been deployed.
- No live transaction/readback evidence exists.
- No GitHub repository or Vercel deployment exists.
- V1 supports only public GitHub repositories at immutable commit SHAs.
- LicenseScope is not legal advice.
- Root Slot native locking, deployed-code readback, and upgrade redispatch require authorized live rehearsal.
- Codex issued `APPROVED` for the corrected PRE_DEPLOY package; fresh anonymous re-review approval remains required for the exact final evidence-package commit.

No deployment, push, Vercel release, or live lifecycle claim is made by this document.
