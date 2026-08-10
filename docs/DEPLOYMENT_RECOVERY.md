# Deployment and Recovery Manifest

## Gate status

- Classification: `UPGRADABLE`
- Checkpoint: `PRE_DEPLOY` for the judge-requested complete-source correction
- Redeployment authorization: **CONSUMED** for transaction `0xd28ff503fa44f073ed4f741427a809fa6c1717bb1f05b64901828cb0b71705d5`
- Current deployment: **PRIOR PUBLIC REVISION REMAINS INSTALLED**; judge-correction candidate is local only
- Safe upgrade rehearsal: **COMPLETED** on disposable contract `0xF1FF7a9Faa9A9800237e945F97b69Ac837D30193`
- Prior main-contract upgrade authorization: **CONSUMED** for transaction `0x002f06c175fc2ea35e4f8b99f2c2562105b952073d8460baed786c925ce3dbd6`
- Judge-correction main-contract upgrade authorization: **NOT GRANTED**

The user selected one public wallet for both deployment and upgrade authority. No private key, seed phrase, token, credential, or wallet export belongs in this document.

## Judge-correction candidate

| Field | Value |
|---|---|
| Implementation commit | `febf6a1b1e3e89b8b05f939cb6b9f7c0df41d089` |
| Implementation tree | `460f5f58d2faf1ea6e42ee9fedd6d112327ce399` |
| Candidate contract SHA-256 | `c3a51d4cb13f63433a3aaae4f3600deb4292e8cffad1a65d6261378b8984bbff` |
| Candidate policy manifest hash | `sha256:696833070a2262ebcd178648b21957a883d62c2d7c0112a007d1143ec3720fbc` |
| Target contract | `0x8f1e48e52241E1B8b3320b953901ec7eeE481Ac7` |
| Persistent storage layout change | None |
| Main-contract authorization | Not granted |
| Candidate installed | No |

The candidate removes all partial-source terminal evaluation: complete accepted source bodies are evaluated or the result fails closed to `UNRESOLVED`. A fresh exact-revision `PRE_DEPLOY` approval and separate user authorization are required before any main-contract upgrade.

## Intended deployment

| Field | Value |
|---|---|
| Network | GenLayer Studionet |
| Chain ID | `61999` |
| RPC | `https://studio.genlayer.com/api` |
| Explorer | `https://explorer-studio.genlayer.com/` |
| Contract source | `contracts/license_scope.py` |
| Contract source SHA-256 | `8afec2c2ce17e5542c3c5ca2343c8d454de48e27980273b1382fc621e1282890` |
| Policy version | `LS-V1` |
| Policy manifest hash | `sha256:1105b19ea7786bbd5ace24445845997e914e726cd2f80ddf83d8a6f8f8769532` |
| Reviewed evidence commit | `fd5ad56934856706ac1798e77fe194f214aadd43` |
| Deployment wallet public address | `0x7885536194bbd6e1d0a6ab991ab215cfa9542339` |
| External upgrader public address | `0x7885536194bbd6e1d0a6ab991ab215cfa9542339` |
| Constructor arguments | `upgrader_address = 0x7885536194bbd6e1d0a6ab991ab215cfa9542339` |
| Contract address | `0x8f1e48e52241E1B8b3320b953901ec7eeE481Ac7` |
| Deployment transaction | `0xd28ff503fa44f073ed4f741427a809fa6c1717bb1f05b64901828cb0b71705d5` |
| Explorer contract/transaction URL | `https://explorer-studio.genlayer.com/tx/0xd28ff503fa44f073ed4f741427a809fa6c1717bb1f05b64901828cb0b71705d5` |
| Live web URL | `https://license-scope.vercel.app` |

The same wallet fills both roles. This concentrates deployment identity and code-replacement authority in one key: key loss may make recovery impossible, while key compromise may permit code replacement. The recorded deployment and main upgrade authorizations are consumed; no further deployment or upgrade is authorized.

## Historical prior upgrade candidate

| Field | Value |
|---|---|
| Implementation commit | `d0577dbde2e9d4b93f128173607434ecc7aa6149` |
| Candidate contract SHA-256 | `8afec2c2ce17e5542c3c5ca2343c8d454de48e27980273b1382fc621e1282890` |
| Target contract | `0x8f1e48e52241E1B8b3320b953901ec7eeE481Ac7` |
| Authorized upgrader if approved | `0x7885536194bbd6e1d0a6ab991ab215cfa9542339` |
| Persistent storage layout change | None |
| Root Slot upgrade transaction | `0x002f06c175fc2ea35e4f8b99f2c2562105b952073d8460baed786c925ce3dbd6` |
| Upgrade authorization | **CONSUMED** for the transaction above |
| Disposable rehearsal contract | `0xF1FF7a9Faa9A9800237e945F97b69Ac837D30193` |
| Disposable V1 deployment transaction | `0xda26ea0dc925a6b7c740ae2c503b5b6a869ad285ad2840a095e624b79225273a` |
| Disposable V2 upgrade transaction | `0xca98a65e73c5c377924fc526dd76b7b35388b07e9eb88486f7b4c1d5674505e3` |

The installed source uses `gl.nondet.web.request(url, method="GET")` and strictly normalizes the exact pinned runtime's `response.status` together with the documented `response.status_code` representation. Missing, invalid, boolean, out-of-range, or contradictory status values fail closed. It does not alter persistent fields, record layout, policy version/hash, authorization, state machine, retry limit, or upgrade logic. The safe rehearsal and exact-revision review were completed before the user authorized the main-contract transaction.

## Successful main-contract upgrade evidence

- Transaction `0x002f06c175fc2ea35e4f8b99f2c2562105b952073d8460baed786c925ce3dbd6` reached `FINALIZED` with `MAJORITY_AGREE`; all five validator votes were `AGREE` and leader execution was `SUCCESS`.
- Caller was the authorized upgrader `0x7885536194bbd6e1d0a6ab991ab215cfa9542339`; target was main contract `0x8f1e48e52241E1B8b3320b953901ec7eeE481Ac7`.
- Live `gen_getContractCode` readback matched the exact reviewed candidate SHA-256 `8afec2c2ce17e5542c3c5ca2343c8d454de48e27980273b1382fc621e1282890`.
- Post-upgrade readback preserved assessment count `1` and every checked field of assessment `#1`: immutable CoSearch subject/revision, requester, `LS-V1` policy binding, `UNRESOLVED / SOURCE_MISSING` status, endpoint-status explanation `0`, and retry count `1`.
- The authorized final retry and following resolution completed successfully as the post-upgrade lifecycle evidence below.

## Successful post-upgrade lifecycle evidence

| Action | Transaction | Finalized execution/readback |
|---|---|---|
| Final retry for assessment `#1` | `0x1e245e426b4fe9e3242fb27351eddcece7b7a2680f8cc9c49858799a9fc41fdd` | `FINALIZED`, `MAJORITY_AGREE`, frontend validator `FINISHED_WITH_RETURN`; four `AGREE` and one quorum-cancelled `IDLE`; exact readback `PENDING`, retry count `2` |
| Resolve after installed-source upgrade | `0x98a4739d8c7c02e271587c432d8d0419a68819a6cf51bd6522cedc522259c562` | `FINALIZED`, `MAJORITY_AGREE`, frontend validator `FINISHED_WITH_RETURN`; three `AGREE`, two `DISAGREE`; exact readback `BLOCK / EXPLICIT_USE_RESTRICTION`, subject/revision `EXACT`, `CC-BY-NC-4.0`, evidence sufficient, retry count `2` |

The terminal readback references the immutable GitHub commit, root `LICENSE`, and root `README.md`. It identifies the non-commercial restriction as incompatible with `COMMERCIAL_INFERENCE`, demonstrating that the installed dual-shape web-status repair resolves the former false `SOURCE_MISSING` path.

## Successful redeployment core evidence

- Transaction status: `FINALIZED`.
- Normalized execution result: `FINISHED_WITH_RETURN`.
- Consensus result: `MAJORITY_AGREE`; all five validator votes were `AGREE`.
- Sender and origin: selected wallet `0x7885536194bbd6e1d0a6ab991ab215cfa9542339`.
- Constructor integer decoded to the selected external upgrader address.
- Transaction-generated and user-reported contract address both equal `0x8f1e48e52241E1B8b3320b953901ec7eeE481Ac7`.
- Embedded deployment source and live `gen_getContractCode` readback are byte-for-byte equal to the reviewed local contract; SHA-256 is `32e9a4b9f9d2e095e1a4504e0beec90ae46fabda1b2bdf9980921a922ee6b3a8`.
- Initial readback: `get_assessment_count() == 0`; `get_policy_profile("COMMERCIAL_INFERENCE")` returned `LS-V1`, the reviewed policy hash, `allows_commercial: true`, and supported kind `GITHUB_REPO`.
- Multi-account application behavior and complete Explorer evidence remain pending and are not implied by this historical core-deployment acceptance. The later authorized main-contract upgrade and successful lifecycle are recorded above.

## Failed deployment reconciliation

The first Studionet deployment attempt is retained as failure evidence and must never be resubmitted or represented as an accepted deployment.

| Field | Value |
|---|---|
| Transaction | `0x1ad0db6cb3c6e3258a86d9ced30a1b244d1aaf5ffb4218ac2aaef479b990e1a3` |
| Generated address | `0x597a4d0080C725059d922305e87Cb3b95fc0c5f0` — invalid/unaccepted; do not configure or use |
| Sender | `0x7885536194bbd6e1d0a6ab991ab215cfa9542339` |
| Transaction status | `FINALIZED` |
| Consensus result | `MAJORITY_AGREE`; 5/5 validators voted `AGREE` |
| Execution result | `ERROR`; leader result `contract_error` / `exit_code 1` |
| Root cause | Studio decoded the constructor address as an integer; `_parse_address` passed it directly to `Address`, causing `OverflowError` |

The repaired constructor converts a valid unsigned 160-bit integer to exactly 20 big-endian bytes. Regression tests exercise the Studio integer representation and reject negative or oversized values without truncation.

## Upgradability implementation

- Constructor accepts one external `upgrader_address` and appends it to `gl.storage.Root.get().upgraders`.
- `upgrade(new_code: bytes)` is public and write-only.
- An explicit membership guard rejects callers absent from the Root upgrader list.
- Empty upgrade bytecode is rejected before Root code mutation.
- Direct-mode tests cover Address and Studio-integer upgrader registration, integer range rejection, authorized byte replacement, unauthorized rejection with no mutation, and empty-payload rejection with no mutation.
- The authorized disposable Studionet rehearsal proved live Root upgrader membership checks, exact deployed code replacement, redispatch to the added V2 view, preserved V1 state, and no mutation after empty or unauthorized calls.
- Native locked-slot rejection was not isolated independently from the contract's explicit `_check_upgrader` guard because that guard rejects an unauthorized caller before Root code mutation. No stronger native-lock claim is made.

## Storage compatibility plan

The V1 contract declares persistent fields in this order:

1. `assessments: DynArray[AssessmentRecord]`
2. `key_to_id: TreeMap[str, u256]`
3. `assessment_count: u256`

`AssessmentRecord` field order and types are part of the persistent schema. An upgrade must not remove, reorder, or change the type of any existing persistent field. New compatible fields may only be considered after a separate specification, migration analysis, generated V2 compatibility fixture, direct regression coverage, Codex review, and authorized live rehearsal.

An upgrade must preserve:

- assessment IDs and count;
- canonical-key index;
- immutable artifact identity and requester;
- policy version/hash on existing records;
- status, reason, licenses, obligations, evidence, and retry count.

## Linked contracts and configuration

LicenseScope V1 has no linked contracts, writer registry, bounty, funding, escrow, or post-deployment cross-contract configuration.

The production frontend is configured to the accepted Studionet address and is live at `https://license-scope.vercel.app`. It must not be switched to a replacement address without a separately reviewed revision and explicit authorization.

## Pre-deployment identity procedure (historical, completed)

1. **Completed:** User selected the intended deployment wallet and external upgrader public address.
2. **Completed:** Codex format-checked both public addresses for the intended Studionet workflow and recorded that they are the same wallet.
3. **Completed:** The one-wallet concentration risk is recorded above: key loss can prevent recovery and key compromise can permit code replacement.
4. **Completed:** Exact source commit and contract source hash are recorded above.
5. **Completed:** The receipt-normalization repair and safe-rehearsal evidence received exact-revision PRE_DEPLOY approval; the later frontend/release package received exact-revision PRE_PUSH approval.
6. **Completed:** Immediately before deployment, the active wallet identity, Studionet target, constructor upgrader, and source revision were verified.
7. **Completed:** The user separately authorized the deployment transaction; that authorization was consumed by the transaction recorded above.

Wallet selection and PRE_DEPLOY approval did not themselves authorize deployment. The separate recorded deployment and main-upgrade authorizations are consumed and grant no authority for another transaction.

## Post-deployment acceptance procedure

Do not configure the frontend or call deployment accepted until all checks pass:

1. deployment transaction reaches `FINALIZED`;
2. transaction execution is explicitly successful;
3. `from_address` and `origin_address` match the selected user-controlled wallet;
4. deployed constructor upgrader matches the selected public address;
5. contract address and transaction open on the Studionet Explorer;
6. deployed code/source hash matches the reviewed commit;
7. contract views return the expected policy version/hash and zero-state count;
8. request, resolve, readback, `UNRESOLVED` retry, and multi-account behavior pass on the exact deployment;
9. failed, pending, accepted-only, or finalized-with-error transactions are excluded from success evidence;
10. final manifest fields and `docs/VERIFICATION.md` are updated with real public evidence.

## Safe upgrade rehearsal

The authorized rehearsal used separate disposable Studionet contract `0xF1FF7a9Faa9A9800237e945F97b69Ac837D30193`. It must never be reused as the release deployment.

| Step | Transaction/readback | Result |
|---|---|---|
| Deploy reviewed V1 with external upgrader | `0xda26ea0dc925a6b7c740ae2c503b5b6a869ad285ad2840a095e624b79225273a` | `FINALIZED`, `MAJORITY_AGREE`, leader `SUCCESS`; sender and constructor upgrader both `0x7885536194bbd6e1d0a6ab991ab215cfa9542339` |
| V1 deployed-source parity | Live code raw SHA-256 `64597a7803dfde1b65644486642363c3034294370915cfbabf57df4162b485c0` | Studio converted LF to CRLF; normalized-LF SHA-256 exactly matched reviewed V1 `8afec2c2ce17e5542c3c5ca2343c8d454de48e27980273b1382fc621e1282890` with no other difference |
| Create preservation baseline | `0x522c0b28308c29d9ea6a60cb45908ea80cbd79dc5c996cfadbd2a0838d049bb2` | `FINALIZED`, leader `SUCCESS`; assessment `#1` created as `PENDING` for the immutable CoSearch revision |
| Reject empty upgrade bytes | `0x9a4c15706d50f983c6bc0429c257f25b5d42cfc218ba0e2114453052cefba2e2` | `FINALIZED`, rollback `ERR_EMPTY_UPGRADE_CODE`; V1 code and record unchanged |
| Reject unauthorized caller before upgrade | `0xd3f0099dcc5c1aa8974c9f2f93ff826449b1b45a8891d9c582bc0d6b4cfa61bd` | Wallet `0xcB6CDbeBa2230b7eE87ae52aD0eF2933a3A0eeca`; `FINALIZED`, rollback `ERR_NOT_UPGRADER`; V1 code and record unchanged |
| Authorized V2 code replacement | `0xca98a65e73c5c377924fc526dd76b7b35388b07e9eb88486f7b4c1d5674505e3` | `FINALIZED`, `MAJORITY_AGREE`, leader `SUCCESS`; exact LF V2 SHA-256 `b67f24ad29d60b748a0043bf69da0b0cb5d2eda643b5484a73acdace88769281` |
| V2 redispatch and state preservation | Read-only live calls | `get_rehearsal_version() == "LICENSE_SCOPE_REHEARSAL_V2"`; assessment count remained `1`; every field of V1 record `#1` remained unchanged |
| Reject unauthorized caller after upgrade | `0x39e6dfeca276469f3373c10078c9fc821740c87c9d105fd0f6e195f60411e904` | Same unauthorized wallet; `FINALIZED`, rollback `ERR_NOT_UPGRADER`; V2 hash, marker, count, and record remained unchanged |

All six transactions above reached `FINALIZED` with `MAJORITY_AGREE`. V1 deployment `0xda26ea0dc925a6b7c740ae2c503b5b6a869ad285ad2840a095e624b79225273a` recorded four `AGREE` votes and one quorum-cancelled `IDLE`; each of the remaining five transactions recorded five `AGREE` votes. Expected rejection transactions finalized with consensus but had leader execution `ERROR` and rollback, so they are failure/no-mutation evidence rather than successful writes. The rehearsal proves the explicit Root-upgrader membership guard and persistence of the Root upgrader list across code replacement. It does not independently bypass that guard to isolate native locked-slot enforcement.

## Recovery runbook

### Studio/local UI data reset while chain state remains

1. Reconnect the selected external upgrader wallet.
2. Import the contract by its recorded Studionet address.
3. Load the exact source from the recorded Git commit.
4. Verify source hash, policy hash, contract code, and current records.
5. Resume normal use or perform a separately reviewed upgrade.

### Studionet/network state reset

The old address and state cannot be assumed recoverable.

1. Treat the old address and transaction evidence as historical only.
2. Redeploy from the recorded source commit and constructor manifest.
3. Re-run deployment acceptance and all live lifecycle tests.
4. Update frontend address, Explorer links, verification document, and release evidence only after acceptance.
5. Do not claim the previous address survived the reset.

### Upgrader key loss or compromise

- Key loss may make future upgrades impossible if no other registered upgrader exists.
- Key compromise may permit code replacement.
- Never put wallet secrets in the repository or review package.
- Any upgrader-set change requires its own reviewed, authorized upgrade procedure before a compromise occurs.
