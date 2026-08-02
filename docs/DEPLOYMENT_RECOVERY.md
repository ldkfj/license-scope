# Deployment and Recovery Manifest

## Gate status

- Classification: `UPGRADABLE`
- Checkpoint: `PRE_DEPLOY` preparation
- Deployment authorization: **NOT GRANTED**
- Main deployment transaction: **must not be sent until the user separately confirms it**

The user selected one public wallet for both deployment and upgrade authority. No private key, seed phrase, token, credential, or wallet export belongs in this document.

## Intended deployment

| Field | Value |
|---|---|
| Network | GenLayer Studionet |
| Chain ID | `61999` |
| RPC | `https://studio.genlayer.com/api` |
| Explorer | `https://explorer-studio.genlayer.com/` |
| Contract source | `contracts/license_scope.py` |
| Contract source SHA-256 | `81e533a79e14f8edec04096f871ca7112f2e37a2b9045275e88d530abb42f958` |
| Policy version | `LS-V1` |
| Policy manifest hash | `sha256:1105b19ea7786bbd5ace24445845997e914e726cd2f80ddf83d8a6f8f8769532` |
| Source-code commit | `ac3d68a21c5da0dfa5e5879ff09a2777230057a9` |
| Deployment wallet public address | `0x7885536194bbd6e1d0a6ab991ab215cfa9542339` |
| External upgrader public address | `0x7885536194bbd6e1d0a6ab991ab215cfa9542339` |
| Constructor arguments | `upgrader_address = 0x7885536194bbd6e1d0a6ab991ab215cfa9542339` |
| Contract address |  |
| Deployment transaction |  |
| Explorer contract/transaction URL |  |
| Live web URL |  |

The same wallet fills both roles. This concentrates deployment identity and code-replacement authority in one key: key loss may make recovery impossible, while key compromise may permit code replacement. The user selected this arrangement; it does not authorize deployment.

## Upgradability implementation

- Constructor accepts one external `upgrader_address` and appends it to `gl.storage.Root.get().upgraders`.
- `upgrade(new_code: bytes)` is public and write-only.
- An explicit membership guard rejects callers absent from the Root upgrader list.
- Empty upgrade bytecode is rejected before Root code mutation.
- Direct-mode tests cover intended registration, authorized byte replacement, unauthorized rejection with no mutation, and empty-payload rejection with no mutation.
- Native locked Root Slot enforcement, deployed code replacement, and redispatch are marked `VERIFY-AT-STUDIO` and require a disposable rehearsal after authorization.

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

The frontend may be configured only after post-deployment acceptance proves the exact Studionet address and deployed-source parity. `NEXT_PUBLIC_CONTRACT_ADDRESS` must remain blank before that point.

## Pre-deployment identity procedure

1. **Completed:** User selected the intended deployment wallet and external upgrader public address.
2. **Completed:** Codex format-checked both public addresses for the intended Studionet workflow and recorded that they are the same wallet.
3. **Completed:** The one-wallet concentration risk is recorded above: key loss can prevent recovery and key compromise can permit code replacement.
4. Complete the exact release commit and source hash.
5. Obtain Codex and anonymous co-review AI approval for the same PRE_DEPLOY revision/evidence package.
6. Immediately before deployment, verify the active wallet identity, Studionet target, constructor upgrader, and source revision.
7. Ask the user for a separate explicit confirmation to send the deployment transaction.

Wallet selection and PRE_DEPLOY approval do not themselves authorize deployment.

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

Use a separate disposable Studionet deployment, never the accepted main contract:

1. deploy the exact V1 source with the selected external upgrader;
2. verify Root upgrader registration and locked-slot unauthorized rejection;
3. generate V2 from the exact V1 source with one harmless view-only version method;
4. submit the upgrade from the authorized upgrader;
5. require `FINALIZED`, successful execution, code readback, and preserved V1 records;
6. verify unauthorized and empty-payload attempts do not mutate code;
7. record transaction/readback evidence;
8. do not reuse the disposable address as the release deployment.

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
