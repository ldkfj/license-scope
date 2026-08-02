# Verification

## Reviewed source

| Field | Value |
|---|---|
| Project | LicenseScope |
| Submission category | `PROJECT` |
| Checkpoint | PRE_DEPLOY upgrade re-review after live web-response incompatibility |
| Upgrade-candidate implementation commit | `d0577dbde2e9d4b93f128173607434ecc7aa6149` |
| Frontend receipt/finality implementation commit | `d0577dbde2e9d4b93f128173607434ecc7aa6149` |
| Contract source | `contracts/license_scope.py` |
| Upgrade-candidate contract SHA-256 | `8afec2c2ce17e5542c3c5ca2343c8d454de48e27980273b1382fc621e1282890` |
| Currently deployed contract SHA-256 | `32e9a4b9f9d2e095e1a4504e0beec90ae46fabda1b2bdf9980921a922ee6b3a8` |
| Policy version | `LS-V1` |
| Policy manifest hash | `sha256:1105b19ea7786bbd5ace24445845997e914e726cd2f80ddf83d8a6f8f8769532` |
| Network target | GenLayer Studionet, chain ID `61999` |
| Selected deployment wallet | `0x7885536194bbd6e1d0a6ab991ab215cfa9542339` |
| Selected external upgrader | `0x7885536194bbd6e1d0a6ab991ab215cfa9542339` |
| Accepted contract address | `0x8f1e48e52241E1B8b3320b953901ec7eeE481Ac7` |
| Accepted deployment transaction | `0xd28ff503fa44f073ed4f741427a809fa6c1717bb1f05b64901828cb0b71705d5` |
| Failed deployment transaction | `0x1ad0db6cb3c6e3258a86d9ced30a1b244d1aaf5ffb4218ac2aaef479b990e1a3` |
| Disposable rehearsal contract | `0xF1FF7a9Faa9A9800237e945F97b69Ac837D30193` |
| Disposable rehearsal V1 deployment | `0xda26ea0dc925a6b7c740ae2c503b5b6a869ad285ad2840a095e624b79225273a` |
| Disposable rehearsal V2 upgrade | `0xca98a65e73c5c377924fc526dd76b7b35388b07e9eb88486f7b4c1d5674505e3` |
| Explorer |  |
| Live web |  |

Anonymous `PRE_DEPLOY` approval was granted for package `0b9b61200b5e2cb88d0e6747d055a34cdedd7a13`, and its contract source was deployed successfully. Live lifecycle testing then found that the deployed source used `gl.nondet.web.get()` while requiring `response.status_code`; two finalized resolution attempts safely returned `UNRESOLVED / SOURCE_MISSING` because Studionet supplied no such attribute and the fail-closed default became `0`. A first repair at `a70dd74e395e71a5e165b085ebb3714125473030` remained incompatible because the exact pinned `py-lib-genlayer-std` response exposes `status`, not `status_code`. Candidate implementation `d0577dbde2e9d4b93f128173607434ecc7aa6149` closes that issue with strict dual-shape status normalization, bounded user-cancellable same-hash recovery, and one page-level transaction coordinator shared by every write surface. Exact package `184cf86a651f92aa3bbec9f2a687e1b1b74bd08a` subsequently received fresh anonymous `PRE_DEPLOY` approval. The evidence-only changes that record the completed rehearsal create a new exact revision and therefore require another exact-hash review. No main-contract upgrade authorization has been granted.

## Successful redeployment core evidence

- Transaction `0xd28ff503fa44f073ed4f741427a809fa6c1717bb1f05b64901828cb0b71705d5` reached `FINALIZED`.
- The production frontend validator normalized the real response as `FINISHED_WITH_RETURN` and `MAJORITY_AGREE`.
- All five recorded validator votes were `AGREE`; leader and validator execution receipts reported success.
- Sender/origin matched the selected wallet and transaction calldata contained its integer address representation.
- Transaction-generated address matched `0x8f1e48e52241E1B8b3320b953901ec7eeE481Ac7`.
- Embedded source and live `gen_getContractCode` output were byte-for-byte equal to the reviewed contract and SHA-256 `32e9a4b9f9d2e095e1a4504e0beec90ae46fabda1b2bdf9980921a922ee6b3a8`.
- Initial state readback returned assessment count `0` and the reviewed `LS-V1` policy profile/hash.
- This is core deployment acceptance only; successful main-contract lifecycle, multi-account application evidence, and Explorer verification remain pending. The disposable safe-upgrade rehearsal is recorded below and grants no authority over the main contract.

## Live lifecycle finding and retained transactions

All four transactions below reached `FINALIZED`; the frontend receipt validator accepted successful execution and `MAJORITY_AGREE`, and each state transition was confirmed by contract readback:

| Action | Transaction | Readback |
|---|---|---|
| Request assessment #1 | `0x9df0882dab7aab26310072ed97951ce931a1b7020ed7653a06939b79f8393b73` | Exactly one record; `PENDING`; requester matched `0x7885536194bbd6e1d0a6ab991ab215cfa9542339` |
| Resolve attempt 1 | `0x1695cea9c7179c579358325e2609597ff82426593049d5df7f74e0832a7e54b5` | `UNRESOLVED / SOURCE_MISSING`; explanation reported commit endpoint status `0`; retry count `0` |
| Atomic retry | `0xa67eb7c46774d6c6b3289d2263dbf0db2bdb0fbfe0bf3a3e0568375e051edf2f` | Reset to `PENDING`; retry count incremented to `1` |
| Resolve attempt 2 | `0x15fb12a796a8a04f1a8a5cf8da23f08d2ab1630472ad818bbb7f0039253d4cbf` | Again `UNRESOLVED / SOURCE_MISSING` with endpoint status `0`; retry count remained `1` |

The public GitHub commit endpoint independently returned HTTP `200`, so the repeated fail-closed result is bound to the deployed response/API mismatch rather than a missing repository or revision. The final retry allowance remains intentionally unused. These transactions are defect-reproduction and safe-state evidence, not successful license-verdict evidence.

## Upgrade candidate closure

- Both GitHub commit and immutable raw-file fetches use `gl.nondet.web.request(url, method="GET")`. The exact pinned runtime exposes integer `status`; current documentation describes integer `status_code`. The contract accepts either representation, requires them to agree if both exist, enforces HTTP range `100..599`, and fails closed on missing, boolean, invalid, or contradictory values.
- Persistent storage declarations and `AssessmentRecord` layout are unchanged.
- Existing assessment IDs, canonical keys, policy bindings, statuses, evidence fields, and retry counts require preservation during any authorized upgrade.
- The navbar exposes an explicit top-right wallet control and live account/network state.
- Submit, resolve, and retry use one coordinator mounted above both Request and Registry surfaces. It takes a synchronous page-wide mutex before wallet connection and before any `writeContract` invocation, then replaces the broadcasting state with one versioned, contract/account/action-bound persisted hash immediately after broadcast. Same-tab subscribers update together; saved and cleared records synchronize to other browser contexts through the contract-specific `storage` event. Reconciliation is limited to three SDK rounds of 20 polls, retries only classified transient failures, supports cancellation, and stops on permanent errors. On exhaustion or reload the UI exposes `Resume existing Tx`; every page write remains locked until the same hash reaches validated finality and exact readback.
- Registry search accepts `1` and `#1`, and filtered-empty state is distinguished from an empty registry.
- The currently deployed contract has not been upgraded; deployed-source parity therefore remains bound to the older hash until a separately authorized upgrade succeeds.

## Safe upgrade rehearsal evidence

The user authorized a rehearsal only; main contract `0x8f1e48e52241E1B8b3320b953901ec7eeE481Ac7` was not upgraded. Disposable contract `0xF1FF7a9Faa9A9800237e945F97b69Ac837D30193` is prohibited from release use.

| Action | Transaction | Finalized execution/readback |
|---|---|---|
| Deploy reviewed V1 | `0xda26ea0dc925a6b7c740ae2c503b5b6a869ad285ad2840a095e624b79225273a` | `MAJORITY_AGREE`; leader `SUCCESS`; sender and constructor upgrader matched `0x7885536194bbd6e1d0a6ab991ab215cfa9542339` |
| Create V1 preservation record | `0x522c0b28308c29d9ea6a60cb45908ea80cbd79dc5c996cfadbd2a0838d049bb2` | Leader `SUCCESS`; assessment `#1` read back as exact `PENDING` CoSearch record |
| Empty-payload negative test | `0x9a4c15706d50f983c6bc0429c257f25b5d42cfc218ba0e2114453052cefba2e2` | Leader `ERROR`, rollback `ERR_EMPTY_UPGRADE_CODE`; no code/state mutation |
| Unauthorized pre-upgrade test | `0xd3f0099dcc5c1aa8974c9f2f93ff826449b1b45a8891d9c582bc0d6b4cfa61bd` | Caller `0xcB6CDbeBa2230b7eE87ae52aD0eF2933a3A0eeca`; rollback `ERR_NOT_UPGRADER`; no mutation |
| Authorized V2 replacement | `0xca98a65e73c5c377924fc526dd76b7b35388b07e9eb88486f7b4c1d5674505e3` | Leader `SUCCESS`; live source SHA-256 exactly `b67f24ad29d60b748a0043bf69da0b0cb5d2eda643b5484a73acdace88769281` |
| Unauthorized post-upgrade test | `0x39e6dfeca276469f3373c10078c9fc821740c87c9d105fd0f6e195f60411e904` | Same unauthorized caller; rollback `ERR_NOT_UPGRADER`; V2 code/state unchanged |

Every transaction reached `FINALIZED`, returned `MAJORITY_AGREE`, and recorded five `AGREE` votes. The V1 source retrieved from Studio differed from the reviewed file only by Studio's CRLF conversion: normalized-LF SHA-256 matched candidate `8afec2c2ce17e5542c3c5ca2343c8d454de48e27980273b1382fc621e1282890`. V2 was submitted as the exact LF file bytes, so raw live SHA-256 matched `b67f24ad29d60b748a0043bf69da0b0cb5d2eda643b5484a73acdace88769281`.

Post-upgrade live reads returned `get_rehearsal_version() == "LICENSE_SCOPE_REHEARSAL_V2"`, assessment count `1`, and an unchanged V1 record `#1`, including canonical key, requester, policy binding, `PENDING` status, empty evidence arrays, and retry count `0`. This proves code redispatch, storage compatibility, explicit Root-upgrader membership, and persistence of that membership across replacement. Native locked-slot enforcement was not isolated independently because `_check_upgrader` rejects an unauthorized caller before Root code mutation; no claim beyond the observed guard and no-mutation behavior is made.

## Failed deployment evidence

- Generated address: `0x597a4d0080C725059d922305e87Cb3b95fc0c5f0` — invalid/unaccepted and prohibited from frontend configuration.
- Sender matched the selected wallet: `0x7885536194bbd6e1d0a6ab991ab215cfa9542339`.
- Transaction reached `FINALIZED` with `MAJORITY_AGREE`; all five validators voted `AGREE`.
- Leader and validators returned `execution_result: ERROR`, `contract_error`, and `exit_code 1`.
- Traceback terminated at `_parse_address` because Studio supplied the constructor address as an integer and `Address(int)` overflowed.
- Commit `6e9952d0402b9bac6a56806f90717d43c734428f` converts valid unsigned 160-bit integers to exactly 20 big-endian bytes and adds Studio-shaped regression coverage.

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
54 passed
```

Coverage includes:

- intended Root upgrader registration;
- Studio integer-form constructor registration and strict 160-bit bounds;
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
- exact pinned `Response(status=...)`, documented `status_code`, agreeing dual fields, and rejection of missing, boolean, out-of-range, and contradictory status representations;
- malformed source, 404, 500, timeout, and empty-body handling;
- terminal immutability, retry atomic reset, retry limit, and duplicate key rejection;
- end-to-end `CONDITIONAL` and `BLOCK` outcomes in direct mode.

Direct mode verifies the explicit contract upgrader membership guard and Root code-byte replacement. The disposable rehearsal now verifies live code replacement, post-upgrade redispatch, and preserved state. Native locked-slot rejection was not independently isolated from the explicit guard.

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
Frontend unit behavior: 35 passed
TypeScript: PASS
ESLint: PASS
Next.js production build: PASS
Static route: /
npm audit: 0 vulnerabilities
```

The frontend tests cover both legacy camel-case and sanitized current-Studionet response shapes; numeric/name and camel/snake contradiction rejection; optional-but-noncontradictory `consensus_data.final`; mandatory non-empty leader receipts; leader execution, decoded result, and GenVM error rejection; replay of the retained finalized-with-error transaction; explicit rejection of non-final `ACCEPTED`; strict record parsing; immutable identity readback; terminal-state invariants; finite same-hash transient reconciliation; permanent-error stop; pre-flight and in-flight cancellation; exact retry exhaustion; versioned pending-hash persistence; hash-matched clearing; malformed-storage fail-closed behavior; common-provider page wiring; Request blocking Resolve/Retry before the first await; Resolve blocking Submit; single-write concurrency; shared subscriber updates; and persisted save/clear synchronization across browser contexts. A read-only live replay of the retained hash reached the intended validator branch and was rejected specifically with `Leader execution result rejected: ERROR.`

A detached clean worktree at implementation commit `d0577dbde2e9d4b93f128173607434ecc7aa6149` reproduced both stacks from lockfiles: a fresh Python 3.13 environment installed and checked all 57 locked packages, passed GenVM lint/validation, 54 direct tests, and the truthful 3-test integration selection skipped; `npm ci` installed 378 frontend packages with zero vulnerabilities, followed by 35 frontend tests, typecheck, lint, production build, and audit all passing.

The build detects a protected local `frontend/.env.local`; its content is not part of this evidence and must never be committed or disclosed.

## PRE_DEPLOY correction closure

1. **Clean-checkout SDK reproducibility — CLOSED.** Python is locked to `>=3.13,<3.14`. A detached clean worktree at repaired source commit `6e9952d0402b9bac6a56806f90717d43c734428f` created a fresh `.venv`, installed and checked all 57 locked packages, passed semantic lint/schema extraction, and passed all 49 direct tests. `tests/conftest.py` calls the official `genlayer-test` loader using the contract's `py-genlayer:1jb45...` dependency header before collection. The provenance regression verifies transitive std hash `11rhn...`, 43 official SDK files, and canonical SDK tree SHA-256 `bc2979c4b22cd8ef1363db7031c9d1d2c27184ab950900c731f3e29c261254b2`.
2. **Consensus list canonicalization — CLOSED.** License IDs, obligations, and evidence references are validated, deduplicated, and sorted before stable comparison and before storage. Regression tests prove permutation/duplicate equivalence while different obligations and evidence still disagree.
3. **Failed deployment reconciliation — CLOSED FOR RE-REVIEW.** The manifest and this verification document retain the failed hash, distinguish finality from execution success, prohibit the invalid generated address, and require fresh approval plus explicit authorization before redeployment.
4. **Dependency audit observation — CLOSED.** Lockfile overrides resolve `postcss` to `8.5.18` and `sharp` to `0.35.0`; `npm audit` reports zero vulnerabilities and unit/typecheck/lint/build gates pass.
5. **Current Studionet receipt normalization — CLOSED.** Commit `248e49db1225d589719709d05056d4295740431f` accepts current Studio responses without legacy top-level execution fields or `consensus_data.final`, but only after official finality, consistent status/result representations, allowed consensus, and successful non-empty leader receipts. Optional decoded result and GenVM fields must not contradict success. Sanitized success proceeds to readback; the retained failed transaction is rejected on its actual `execution_result: ERROR` rather than on a missing legacy field.
6. **Integration-fixture observation — CLOSED FOR PRE_DEPLOY PLAN.** The fabricated happy-path SHA was replaced by a verified real immutable CC-BY-NC-4.0 repository revision with exact `BLOCK` assertions. Live execution remains deferred to `POST_DEPLOY_TEST`.

## Proof matrix

| Actor/action | UI/operational path | Contract method | Offline evidence | Live transaction/readback |
|---|---|---|---|---|
| Requester creates assessment | Request form + browser wallet | `request_assessment` | Direct pending/duplicate tests; frontend finality/readback tests | `0x9df088...93b73`; assessment #1 `PENDING` readback |
| Resolver evaluates pending assessment | Registry resolve action | `resolve_assessment` | Direct evidence/consensus/adversarial tests; frontend terminal readback tests | `0x1695ce...e54b5` and `0x15fb12...d4cbf`; both safely `UNRESOLVED / SOURCE_MISSING`, exposing deployed API mismatch |
| Retry caller resets unresolved record | Registry retry action | `retry_assessment` | Direct atomic-reset/limit tests; frontend PENDING invariant tests | `0xa67eb7...edf2f`; atomic `PENDING`, retry count `1` readback |
| External upgrader replaces code | Documented operational path | `upgrade` | Direct registration/authorization/no-mutation/empty-code tests | Disposable rehearsal: `0xca98a65...4505e3`; exact V2 hash, redispatch, preserved state; negative tests `0x9a4c15...fba2e2`, `0xd3f009...fa61bd`, `0x39e6df...11e904` |
| Reader inspects records/policy | Registry/detail views | contract view methods | Direct view tests; strict frontend parser tests |  |

The retained lifecycle rows prove writes, finality, and safe failure/retry behavior. They do not satisfy the successful verdict branch, multi-account requirement, or upgraded-source parity required at `POST_DEPLOY_TEST`.

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

- The current Studionet deployment is executable and source-verified but cannot complete GitHub evidence evaluation because of the deployed web-response API mismatch.
- Upgrade candidate `d0577dbde2e9d4b93f128173607434ecc7aa6149` is not deployed and has no upgrade authorization.
- Successful main-contract verdict, multi-account application behavior, main-contract upgraded-source parity, and independently isolated native Root locked-slot enforcement remain pending. The separate safe-upgrade rehearsal is complete.
- The earlier finalized-with-error transaction remains failure evidence only.
- No GitHub repository or Vercel deployment exists.
- V1 supports only public GitHub repositories at immutable commit SHAs.
- LicenseScope is not legal advice.
- Deployed-code readback and upgrade redispatch passed on the disposable rehearsal. Native Root locking was not independently isolated from the contract's earlier explicit authorization guard.
- Earlier anonymous approval applies only to package `0b9b61200b5e2cb88d0e6747d055a34cdedd7a13` and is invalid for the upgrade candidate; fresh exact-revision approval is required.

No successful main-contract license-verdict lifecycle, push, Vercel release, or Task-completion claim is made by this document.
