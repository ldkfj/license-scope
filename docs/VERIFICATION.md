# Verification

## Reviewed source

| Field | Value |
|---|---|
| Project | LicenseScope |
| Submission category | `PROJECT` |
| Checkpoint | `POST_DEPLOY_TEST` evidence collection for the judge-requested complete-source correction |
| Correction implementation commit | `febf6a1b1e3e89b8b05f939cb6b9f7c0df41d089` |
| Correction implementation tree | `460f5f58d2faf1ea6e42ee9fedd6d112327ce399` |
| Correction implementation parent | `a56471620482f6e1e3c1d829d003fc95c80c5239` |
| Prior upgrade-candidate implementation commit | `d0577dbde2e9d4b93f128173607434ecc7aa6149` |
| Frontend receipt/finality implementation commit | `d0577dbde2e9d4b93f128173607434ecc7aa6149` |
| Contract source | `contracts/license_scope.py` |
| Correction-candidate contract SHA-256 | `c3a51d4cb13f63433a3aaae4f3600deb4292e8cffad1a65d6261378b8984bbff` |
| Currently deployed contract SHA-256 | `c3a51d4cb13f63433a3aaae4f3600deb4292e8cffad1a65d6261378b8984bbff` |
| Policy version | `LS-V1` |
| Correction-candidate policy manifest hash | `sha256:696833070a2262ebcd178648b21957a883d62c2d7c0112a007d1143ec3720fbc` |
| Correction upgrade transaction | `0x93187fa0858d8089a7708c38d81a2d78e2e6bdc30e366f2d14dff8abc78e54d1` |
| Currently deployed policy manifest hash | `sha256:696833070a2262ebcd178648b21957a883d62c2d7c0112a007d1143ec3720fbc` |
| Network target | GenLayer Studionet, chain ID `61999` |
| Selected deployment wallet | `0x7885536194bbd6e1d0a6ab991ab215cfa9542339` |
| Selected external upgrader | `0x7885536194bbd6e1d0a6ab991ab215cfa9542339` |
| Accepted contract address | `0x8f1e48e52241E1B8b3320b953901ec7eeE481Ac7` |
| Accepted deployment transaction | `0xd28ff503fa44f073ed4f741427a809fa6c1717bb1f05b64901828cb0b71705d5` |
| Accepted main-contract upgrade transaction | `0x002f06c175fc2ea35e4f8b99f2c2562105b952073d8460baed786c925ce3dbd6` |
| Failed deployment transaction | `0x1ad0db6cb3c6e3258a86d9ced30a1b244d1aaf5ffb4218ac2aaef479b990e1a3` |
| Disposable rehearsal contract | `0xF1FF7a9Faa9A9800237e945F97b69Ac837D30193` |
| Disposable rehearsal V1 deployment | `0xda26ea0dc925a6b7c740ae2c503b5b6a869ad285ad2840a095e624b79225273a` |
| Disposable rehearsal V2 upgrade | `0xca98a65e73c5c377924fc526dd76b7b35388b07e9eb88486f7b4c1d5674505e3` |
| Public repository | `https://github.com/ldkfj/license-scope` |
| Explorer | `https://explorer-studio.genlayer.com/` |
| Live web | `https://license-scope.vercel.app` |

The correction source is installed on the main contract with exact source parity and preserved state. Correction-specific assessment `#2` successfully exercised the installed full-source path. The consumed upgrade authorization permits no additional upgrade or wallet action.

## Judge-requested complete-source correction

Judge request: prevent terminal assessments whenever decision-relevant license text was not evaluated; evaluate the full bounded source or fail closed, and add a regression with a permissive prefix followed by a restrictive clause after the previous cutoff.

| Closure item | Exact correction |
|---|---|
| Root cause | Each non-empty source was silently reduced to its first 4,000 characters and the assembled prompt was silently reduced to 20,000 UTF-8 bytes. Source fetch errors other than absence could also be ignored when another source succeeded. |
| Contract behavior | The 4,000-character and prompt-prefix truncation paths are removed. A `200` source must contain a valid bounded UTF-8 byte body, every non-empty body is included in full, and the complete assembled prompt must fit `MAX_PROMPT_BYTES`. Only `404` means an optional derived file is absent. Any other status, response-shape error, request exception, oversized body, or oversized complete prompt returns `UNRESOLVED` before LLM evaluation. |
| Receipt binding | A terminal decision can now reference only immutable commit-derived URLs whose complete accepted response bodies were evaluated. No terminal decision is produced from a byte or character range, so no partial-range receipt exists. |
| Policy binding | The executable manifest adds `terminal_verdict_requires_full_source_evaluation: true`; its reproducible hash is `sha256:696833070a2262ebcd178648b21957a883d62c2d7c0112a007d1143ec3720fbc`. |
| Required adversarial regression | A source longer than the former 4,000-character cutoff contains an MIT-style permissive prefix and a later `NO COMMERCIAL USE` clause. The mock evaluator asserts that the suffix is present in the actual prompt, and the assessment resolves `BLOCK / EXPLICIT_USE_RESTRICTION`. |
| Additional fail-closed regressions | A complete source set exceeding the prompt bound never calls the evaluator and returns `UNRESOLVED / INSUFFICIENT_EVIDENCE`; oversized, `500`, and exception-producing decision-relevant sources return `UNRESOLVED` even when a valid MIT license was already fetched. |
| Storage/upgrade compatibility | `AssessmentRecord`, storage declarations, public methods, and method count are unchanged. Only evaluation logic and the policy manifest hash change. |
| Live evidence | Upgrade `0x93187fa0...e54d1` reached `FINALIZED / MAJORITY_AGREE`, both leader receipts succeeded, live source and active policy hashes matched, and assessment `#1` was preserved. Request `0x34a4aac8...0809` created assessment `#2`; resolve `0x06942fe5...e075` safely left it unchanged after `UNDETERMINED / MAJORITY_DISAGREE`; resolve `0x2340d9a2...a430` reached `FINALIZED / MAJORITY_AGREE` and read back `BLOCK / EXPLICIT_USE_RESTRICTION`, exact subject/revision, and sufficient evidence under the new policy hash. |

Anonymous `PRE_DEPLOY` approval was granted for package `0b9b61200b5e2cb88d0e6747d055a34cdedd7a13`, and its contract source was deployed successfully. Live lifecycle testing then found that the deployed source used `gl.nondet.web.get()` while requiring `response.status_code`; two finalized resolution attempts safely returned `UNRESOLVED / SOURCE_MISSING` because Studionet supplied no such attribute and the fail-closed default became `0`. A first repair at `a70dd74e395e71a5e165b085ebb3714125473030` remained incompatible because the exact pinned `py-lib-genlayer-std` response exposes `status`, not `status_code`. Candidate implementation `d0577dbde2e9d4b93f128173607434ecc7aa6149` closes that issue with strict dual-shape status normalization, bounded user-cancellable same-hash recovery, and one page-level transaction coordinator shared by every write surface. Exact package `184cf86a651f92aa3bbec9f2a687e1b1b74bd08a` and the later rehearsal evidence revision `fd5ad56934856706ac1798e77fe194f214aadd43` received anonymous `PRE_DEPLOY` approval. The user then separately authorized and submitted the main-contract upgrade recorded below.

## Historical prior release: successful redeployment core evidence

- Transaction `0xd28ff503fa44f073ed4f741427a809fa6c1717bb1f05b64901828cb0b71705d5` reached `FINALIZED`.
- The production frontend validator normalized the real response as `FINISHED_WITH_RETURN` and `MAJORITY_AGREE`.
- All five recorded validator votes were `AGREE`; leader and validator execution receipts reported success.
- Sender/origin matched the selected wallet and transaction calldata contained its integer address representation.
- Transaction-generated address matched `0x8f1e48e52241E1B8b3320b953901ec7eeE481Ac7`.
- Embedded source and live `gen_getContractCode` output were byte-for-byte equal to the reviewed contract and SHA-256 `32e9a4b9f9d2e095e1a4504e0beec90ae46fabda1b2bdf9980921a922ee6b3a8`.
- Initial state readback returned assessment count `0` and the reviewed `LS-V1` policy profile/hash.
- This subsection records historical core deployment acceptance only. The later successful main-contract lifecycle is recorded below; multi-account application evidence and complete Explorer verification remain pending.

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
- The navbar exposes an explicit top-right wallet control, accessible full-screen `Select a wallet` dialog, live account/network state, change-wallet, change-account, and disconnect actions. The dialog shows every installed EIP-6963 provider with its announced icon, falling back to bundled branded icons for recognized providers whose announcement omits or fails icon validation. It enumerates legacy `window.ethereum.providers` only when no EIP-6963 wallet is available and offers official acquisition links plus bundled branded icons for common wallets that are not detected. WalletConnect QR is truthfully marked unavailable because no WalletConnect project ID is configured. The EIP-6963 announcement listener remains active for the page lifetime, and delayed announcements update the open dialog. `Connect & Sign` discovers providers without requesting an account; only the provider explicitly selected by the user receives later account, chain, signature, client, and transaction requests. A legacy injected provider is merely offered as a dialog option and is never used before selection. Provider UUIDs are not persisted because EIP-6963 does not guarantee stable UUIDs across reloads; a reload intentionally reopens the explicit selection flow. A wallet is treated as connected only after `personal_sign` confirms control for the current tab session: the recovered signer and a post-recovery `eth_accounts` readback must both match the requested account before authorization is stored. The message states that signing is gasless and submits no transaction. First connection, reconnection after disconnect, every provider selection, and every account change invalidate the previous marker and require a fresh signature. Disconnect first attempts wallet permission revocation and verifies `eth_accounts` readback. Providers that cannot revoke authorization still enter a tab-scoped disconnected state that suppresses automatic account restoration and blocks contract writes until the user explicitly selects `Connect & Sign`, chooses a provider, and signs again.
- User-observed manual browser evidence confirmed that `Connect & Sign` requested a wallet signature as intended. This observation was not independently automated or reproduced by the reviewer.
- Submit, resolve, and retry use one coordinator mounted above both Request and Registry surfaces. It takes a synchronous page-wide mutex before wallet connection and before any `writeContract` invocation, then replaces the broadcasting state with one versioned, contract/account/action-bound persisted hash immediately after broadcast. Same-tab subscribers update together; saved and cleared records synchronize to other browser contexts through the contract-specific `storage` event. Reconciliation is limited to three SDK rounds of 20 polls, retries only classified transient failures, supports cancellation, and stops on permanent errors. On exhaustion or reload the UI exposes `Resume existing Tx`; every page write remains locked until the same hash reaches validated finality and exact readback.
- Registry search accepts `1` and `#1`, and filtered-empty state is distinguished from an empty registry.
- The main contract was upgraded in place to the prior public revision; exact deployed-source parity and preserved-state readback for that historical revision are recorded below.

## Main-contract upgrade evidence

- Upgrade transaction `0x002f06c175fc2ea35e4f8b99f2c2562105b952073d8460baed786c925ce3dbd6` reached `FINALIZED` with `MAJORITY_AGREE`, five `AGREE` votes, and leader execution `SUCCESS`.
- Caller was authorized wallet `0x7885536194bbd6e1d0a6ab991ab215cfa9542339`; target was main contract `0x8f1e48e52241E1B8b3320b953901ec7eeE481Ac7`.
- Live source readback matched reviewed candidate SHA-256 `8afec2c2ce17e5542c3c5ca2343c8d454de48e27980273b1382fc621e1282890`.
- Assessment count remained `1`. Assessment `#1` preserved its immutable CoSearch subject/revision, requester, `LS-V1` policy binding, `UNRESOLVED / SOURCE_MISSING` state, endpoint-status explanation `0`, and retry count `1`.
- The user authorized the final retry allowance for post-upgrade testing. The retry and following resolution completed successfully as recorded below.

## Post-upgrade main-contract lifecycle evidence

| Action | Transaction | Finality and exact readback |
|---|---|---|
| Final retry of assessment `#1` | `0x1e245e426b4fe9e3242fb27351eddcece7b7a2680f8cc9c49858799a9fc41fdd` | `FINALIZED`, `MAJORITY_AGREE`, `FINISHED_WITH_RETURN`; votes `AGREE, IDLE, AGREE, AGREE, AGREE`; record reset to `PENDING`, retry count `2` |
| Resolve after source upgrade | `0x98a4739d8c7c02e271587c432d8d0419a68819a6cf51bd6522cedc522259c562` | `FINALIZED`, `MAJORITY_AGREE`, `FINISHED_WITH_RETURN`; three `AGREE`, two `DISAGREE`; `BLOCK / EXPLICIT_USE_RESTRICTION`, subject and revision `EXACT`, `CC-BY-NC-4.0`, evidence sufficient, retry count `2` |

The terminal record cites the immutable GitHub commit, root `LICENSE`, and root `README.md`. Its explanation binds the non-commercial license restriction to the requested `COMMERCIAL_INFERENCE` profile. This is successful main-contract verdict evidence and closes the former deployed web-response mismatch for the tested subject.

## Safe upgrade rehearsal evidence

This rehearsal preceded the separately authorized main-contract upgrade. Disposable contract `0xF1FF7a9Faa9A9800237e945F97b69Ac837D30193` remains prohibited from release use.

| Action | Transaction | Finalized execution/readback |
|---|---|---|
| Deploy reviewed V1 | `0xda26ea0dc925a6b7c740ae2c503b5b6a869ad285ad2840a095e624b79225273a` | `MAJORITY_AGREE`; leader `SUCCESS`; sender and constructor upgrader matched `0x7885536194bbd6e1d0a6ab991ab215cfa9542339` |
| Create V1 preservation record | `0x522c0b28308c29d9ea6a60cb45908ea80cbd79dc5c996cfadbd2a0838d049bb2` | Leader `SUCCESS`; assessment `#1` read back as exact `PENDING` CoSearch record |
| Empty-payload negative test | `0x9a4c15706d50f983c6bc0429c257f25b5d42cfc218ba0e2114453052cefba2e2` | Leader `ERROR`, rollback `ERR_EMPTY_UPGRADE_CODE`; no code/state mutation |
| Unauthorized pre-upgrade test | `0xd3f0099dcc5c1aa8974c9f2f93ff826449b1b45a8891d9c582bc0d6b4cfa61bd` | Caller `0xcB6CDbeBa2230b7eE87ae52aD0eF2933a3A0eeca`; rollback `ERR_NOT_UPGRADER`; no mutation |
| Authorized V2 replacement | `0xca98a65e73c5c377924fc526dd76b7b35388b07e9eb88486f7b4c1d5674505e3` | Leader `SUCCESS`; live source SHA-256 exactly `b67f24ad29d60b748a0043bf69da0b0cb5d2eda643b5484a73acdace88769281` |
| Unauthorized post-upgrade test | `0x39e6dfeca276469f3373c10078c9fc821740c87c9d105fd0f6e195f60411e904` | Same unauthorized caller; rollback `ERR_NOT_UPGRADER`; V2 code/state unchanged |

All six transactions reached `FINALIZED` with `MAJORITY_AGREE`. V1 deployment `0xda26ea0dc925a6b7c740ae2c503b5b6a869ad285ad2840a095e624b79225273a` recorded four `AGREE` votes and one quorum-cancelled `IDLE`; each of the remaining five transactions recorded five `AGREE` votes. The V1 source retrieved from Studio differed from the reviewed file only by Studio's CRLF conversion: normalized-LF SHA-256 matched candidate `8afec2c2ce17e5542c3c5ca2343c8d454de48e27980273b1382fc621e1282890`. V2 was submitted as the exact LF file bytes, so raw live SHA-256 matched `b67f24ad29d60b748a0043bf69da0b0cb5d2eda643b5484a73acdace88769281`.

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
59 passed
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
- full evaluation beyond the former 4,000-character cutoff, including a restrictive suffix after a permissive prefix;
- no evaluator call for a complete source set that exceeds the prompt bound;
- fail-closed behavior when any decision-relevant source is oversized, unavailable, or throws after another valid source was fetched;
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
Frontend unit behavior: 47 passed
TypeScript: PASS
ESLint: PASS
Next.js production build: PASS
Static route: /
npm audit --audit-level=high: PASS; one PostCSS advisory affects two nested PostCSS instances and propagates into three moderate package entries; zero high or critical findings
```

The lockfile resolves both existing PostCSS dependency paths to `nanoid@3.3.18`, replacing vulnerable `3.3.16` after `GHSA-2v37-7h3g-55p8` entered the audit database. This compatible transitive-only refresh changes no declared dependency or application source; clean `npm ci` installed the corrected lock and the high-threshold audit exits successfully.

The frontend tests cover both legacy camel-case and sanitized current-Studionet response shapes; numeric/name and camel/snake contradiction rejection; optional-but-noncontradictory `consensus_data.final`; mandatory non-empty leader receipts; leader execution, decoded result, and GenVM error rejection; replay of the retained finalized-with-error transaction; explicit rejection of non-final `ACCEPTED`; strict record parsing; immutable identity readback; terminal-state invariants; finite same-hash transient reconciliation; permanent-error stop; pre-flight and in-flight cancellation; exact retry exhaustion; versioned pending-hash persistence; hash-matched clearing; malformed-storage fail-closed behavior; common-provider page wiring; Request blocking Resolve/Retry before the first await; Resolve blocking Submit; single-write concurrency; shared subscriber updates; persisted save/clear synchronization across browser contexts; explicit registry read-error state instead of false empty state; no-provider-before-selection enforcement; page-lifetime EIP-6963 discovery; delayed provider capture; legacy-provider enumeration; non-default provider routing across account, chain, signature, permission, and disconnect operations; wallet-dialog wiring; cryptographically matched wallet signatures; well-formed wrong-signer rejection; account changes during signing; refused signatures; A-to-B-to-A marker invalidation; soft-disconnect write blocking; and modal focus cycling plus Escape, `inert` background, initial-focus, and focus-restoration wiring. A prior read-only live replay of the retained hash reached the intended validator branch and was rejected specifically with `Leader execution result rejected: ERROR.`

For the correction release worktree, the current installed locked environments produced: GenVM lint `3/3` and contract validation `8 methods`; `59 passed` direct tests; `3 skipped` default integration selection; all `57` Python packages compatible; `51 passed` frontend tests; TypeScript, ESLint, Next.js production build, and static `/` generation passed; high-threshold audit exited successfully with three moderate and zero high/critical findings. No fresh dependency installation was needed because dependencies and both lockfiles are unchanged from the reviewed parent.

Historical baseline evidence: a detached clean worktree at implementation commit `d0577dbde2e9d4b93f128173607434ecc7aa6149` reproduced both stacks from lockfiles: a fresh Python 3.13 environment installed and checked all 57 locked packages, passed GenVM lint/validation, 54 direct tests, and the truthful 3-test integration selection skipped; `npm ci` installed 378 frontend packages with zero vulnerabilities, followed by 35 frontend tests, typecheck, lint, production build, and audit all passing.

The build detects a protected local `frontend/.env.local`; its content is not part of this evidence and must never be committed or disclosed.

## Correction closure

1. **Clean-checkout SDK reproducibility — CLOSED.** Python is locked to `>=3.13,<3.14`. A detached clean worktree at repaired source commit `6e9952d0402b9bac6a56806f90717d43c734428f` created a fresh `.venv`, installed and checked all 57 locked packages, passed semantic lint/schema extraction, and passed all 49 direct tests. `tests/conftest.py` calls the official `genlayer-test` loader using the contract's `py-genlayer:1jb45...` dependency header before collection. The provenance regression verifies transitive std hash `11rhn...`, 43 official SDK files, and canonical SDK tree SHA-256 `bc2979c4b22cd8ef1363db7031c9d1d2c27184ab950900c731f3e29c261254b2`.
2. **Consensus list canonicalization — CLOSED.** License IDs, obligations, and evidence references are validated, deduplicated, and sorted before stable comparison and before storage. Regression tests prove permutation/duplicate equivalence while different obligations and evidence still disagree.
3. **Failed deployment reconciliation — CLOSED FOR RE-REVIEW.** The manifest and this verification document retain the failed hash, distinguish finality from execution success, prohibit the invalid generated address, and require fresh approval plus explicit authorization before redeployment.
4. **Dependency audit observation — REOPENED, NON-BLOCKING AT CURRENT GATE.** The compatible transitive lock refresh from vulnerable `nanoid@3.3.16` to patched `3.3.18` closes the newly reported high finding without changing a declared dependency. Current `npm audit` reports one remaining PostCSS advisory affecting two installed nested PostCSS instances and propagating into three moderate package entries (`postcss`, `@tailwindcss/postcss`, and `next`); there are zero high or critical findings, and `npm audit --audit-level=high` exits successfully. The suggested automatic fix requires forcing Next `16.3.0` outside the exact declared version, so no unreviewed dependency mutation was performed. Unit, typecheck, lint, and production-build gates pass.
5. **Current Studionet receipt normalization — CLOSED.** Commit `248e49db1225d589719709d05056d4295740431f` accepts current Studio responses without legacy top-level execution fields or `consensus_data.final`, but only after official finality, consistent status/result representations, allowed consensus, and successful non-empty leader receipts. Optional decoded result and GenVM fields must not contradict success. Sanitized success proceeds to readback; the retained failed transaction is rejected on its actual `execution_result: ERROR` rather than on a missing legacy field.
6. **Integration-fixture observation — CLOSED FOR PRE_DEPLOY PLAN.** The fabricated happy-path SHA was replaced by a verified real immutable CC-BY-NC-4.0 repository revision with exact `BLOCK` assertions. Live execution remains deferred to `POST_DEPLOY_TEST`.

7. **Judge complete-source request — CLOSED OFFLINE AND LIVE.** Commit `febf6a1b1e3e89b8b05f939cb6b9f7c0df41d089` removes both silent cutoffs, fails closed for any incomplete derived source, binds terminal results to fully evaluated immutable responses, and passes the required permissive-prefix/restrictive-suffix regression plus oversized/unavailable/error regressions. Upgrade `0x93187fa0...e54d1` installed the exact reviewed source; finality, leader success, source parity, active-policy readback, and preserved-state readback passed. Assessment `#2` then exercised the corrected evaluator and resolved `BLOCK / EXPLICIT_USE_RESTRICTION` with exact subject/revision matching and sufficient evidence.

## Proof matrix

| Actor/action | UI/operational path | Contract method | Offline evidence | Live transaction/readback |
|---|---|---|---|---|
| Requester creates assessment | Request form + browser wallet | `request_assessment` | Direct pending/duplicate tests; frontend finality/readback tests | Correction-specific request `0x34a4aac8...0809`: `FINALIZED / MAJORITY_AGREE`, both leaders `SUCCESS`; assessment #2 `PENDING`, current policy hash, exact CoSearch revision, `COMMERCIAL_REDISTRIBUTION`. Historical request: `0x9df088...93b73` |
| Resolver evaluates pending assessment | Registry resolve action | `resolve_assessment` | Direct evidence/consensus/adversarial tests; frontend terminal readback and safe terminal-failure reconciliation tests | Correction attempt `0x06942fe5...e075`: `UNDETERMINED / MAJORITY_DISAGREE`, record unchanged at `PENDING`. Correction success `0x2340d9a2...a430`: `FINALIZED / MAJORITY_AGREE`, both leaders `SUCCESS`; assessment #2 `BLOCK / EXPLICIT_USE_RESTRICTION`, subject/revision `EXACT`, sufficient evidence, current policy hash. Historical evidence: `0x98a473...9c562` |
| Retry caller resets unresolved record | Registry retry action | `retry_assessment` | Direct atomic-reset/limit tests; frontend PENDING invariant tests | `0xa67eb7...edf2f` reached retry count `1`; post-upgrade `0x1e245e...41fdd` atomically reached `PENDING`, retry count `2` |
| External upgrader replaces code | Documented operational path | `upgrade` | Direct registration/authorization/no-mutation/empty-code tests | Correction upgrade `0x93187fa0...e54d1`: `FINALIZED / MAJORITY_AGREE`, both leaders `SUCCESS`, exact `c3a51d4c...bbff` source parity, assessment #1 preserved. Historical main upgrade: `0x002f06...3dbd6`. Disposable rehearsal: `0xca98a65...4505e3`; negative tests `0x9a4c15...fba2e2`, `0xd3f009...fa61bd`, `0x39e6df...11e904` |
| Reader inspects records/policy | Registry/detail views | contract view methods | Direct view tests; strict frontend parser tests | Count `2`; assessment #1 unchanged at `BLOCK / EXACT`, retry `2`; assessment #2 is `BLOCK / EXACT`, retry `0`; current profile reports policy hash `sha256:69683307...0fbc` |

The retained lifecycle rows prove writes, finality, safe failure/no-mutation behavior, correction-source installation, preserved state, and the corrected full-source terminal verdict branch. Multi-account behavior remains outside the current live evidence.

## Source-of-truth and security findings

- Contract is the sole verdict authority; frontend does not compute verdicts.
- Browser writes require provider/account propagation and immediate Studionet chain verification.
- Success requires `FINALIZED`, explicit successful transaction/consensus/leader execution, and exact contract readback.
- The local frontend runtime is configured for the accepted main Studionet contract; missing or invalid runtime addresses still fail closed with `Deployment not configured`.
- Root license files outrank README fallback evidence.
- Fetched web content is treated as untrusted data, not instructions.
- HF model/dataset adapters are explicitly unavailable in V1 rather than simulated.
- No fake GenLayer SDK/stub directory is present; Direct tests bootstrap the contract-pinned official runner through `genlayer-test` and verify its canonical tree digest.
- Internal AI/governance/specification files and generated artifacts are excluded by the root `.gitignore`.

## Known limitations and pending gates

- The current Studionet deployment is executable and source-verified at correction SHA-256 `c3a51d4cb13f63433a3aaae4f3600deb4292e8cffad1a65d6261378b8984bbff`; upgrade finality, leader success, active-policy readback, and preserved-state readback passed.
- Multi-account application behavior and independently isolated native Root locked-slot enforcement remain pending. Correction-specific live assessment/resolve evidence and the separate safe-upgrade rehearsal are complete.
- The earlier finalized-with-error transaction remains failure evidence only.
- Public GitHub repository `https://github.com/ldkfj/license-scope` and production frontend `https://license-scope.vercel.app` are live. The deployed page returned HTTP `200` and rendered the configured Studionet contract address.
- V1 supports only public GitHub repositories at immutable commit SHAs.
- LicenseScope is not legal advice.
- Deployed-code readback and upgrade redispatch passed on the disposable rehearsal. Native Root locking was not independently isolated from the contract's earlier explicit authorization guard.
- Anonymous PRE_DEPLOY approval covered exact correction revision `4ca3b93ce78ef3f432eba473ffab59527cc7e7d1` and source SHA-256 `c3a51d4cb13f63433a3aaae4f3600deb4292e8cffad1a65d6261378b8984bbff`. The public GitHub/Vercel surfaces still require a fresh exact-revision release after live correction proof and `POST_DEPLOY_TEST` review.

The initial GitHub push and Vercel production release are complete. No multi-account completion or Task-completion claim is made by this document.
