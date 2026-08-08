# LicenseScope

LicenseScope is a GenLayer DApp that records operational-rights attestations for an exact public artifact revision and intended-use profile.

> LicenseScope is a policy attestation tool, not legal advice, an ownership certificate, or a substitute for counsel or a license steward.

## Verified links

The accepted Studionet contract, public source repository, and production frontend are live.

- GitHub: [github.com/ldkfj/license-scope](https://github.com/ldkfj/license-scope)
- Live app: [license-scope.vercel.app](https://license-scope.vercel.app)
- Network: GenLayer Studionet
- Chain ID: `61999`
- RPC: `https://studio.genlayer.com/api`
- Explorer: `https://explorer-studio.genlayer.com/`
- Contract: `0x8f1e48e52241E1B8b3320b953901ec7eeE481Ac7`
- Upgrade transaction: `0x002f06c175fc2ea35e4f8b99f2c2562105b952073d8460baed786c925ce3dbd6`
- Policy: `LS-V1`
- Policy manifest hash: `sha256:1105b19ea7786bbd5ace24445845997e914e726cd2f80ddf83d8a6f8f8769532`

## Trust problem

A publisher can expose incomplete or inconsistent license metadata, an artifact user can cite one repository while using another revision, a centralized reviewer can select favorable evidence, and an indexer can lose the connection between artifact, revision, policy, and intended use. LicenseScope binds those facts into one canonical assessment key and makes the Intelligent Contract the sole verdict authority.

## Why GenLayer is essential

A deterministic contract cannot independently fetch bounded public evidence and interpret license terms such as attribution, source-offer, non-commercial, research-only, or redistribution restrictions. LicenseScope uses GenLayer nondeterministic execution to:

1. derive evidence URLs from a canonical GitHub owner, repository, and full commit SHA;
2. fetch bounded public sources inside the nondeterministic execution;
3. treat fetched content as untrusted data rather than instructions;
4. have the validator independently repeat the evidence/evaluation work;
5. compare consequence-critical normalized fields;
6. write `ALLOW`, `CONDITIONAL`, `BLOCK`, or `UNRESOLVED` only after consensus.

Consensus disagreement does not fabricate a terminal result; the transaction fails and the assessment remains `PENDING`.

## How it works

### Requester

1. Connect a browser wallet on Studionet.
2. Select `GITHUB_REPO`, enter owner/repository, a full 40-character commit SHA, and an intended-use profile.
3. Sign `request_assessment`.
4. Wait for `FINALIZED`, explicit successful execution, and exact contract readback.

### Resolver

Any account may call `resolve_assessment` for a `PENDING` assessment. The contract derives evidence, executes leader/validator evaluation, enforces deterministic license and policy invariants, and stores the consensus-approved terminal record.

### Retry caller

Any account may call `retry_assessment` only for `UNRESOLVED` records and only within the bounded retry limit. Retry atomically resets evaluation fields to the canonical `PENDING` state before another resolution attempt.

## Architecture

- **Intelligent Contract:** canonical identity, policy manifest, evidence derivation, consensus evaluation, verdict state machine, retry policy, and upgrade authorization.
- **Frontend:** EIP-6963 browser-wallet selection, gasless signed wallet-session connection, explicit disconnect, Studionet chain enforcement, contract reads/writes, strict receipt validation, exact readback, and display. It never computes or substitutes a verdict.
- **Public evidence:** revision-bound GitHub commit and root files fetched by the contract as untrusted data.
- **Off-chain authority:** none. There is no backend, database, relayer, or cron service that can advance authoritative state.

## Intelligent Contract

Contract source: `contracts/license_scope.py`

### Public writes

- `upgrade(new_code)` — external registered upgrader only; empty code is rejected.
- `request_assessment(artifact_kind, namespace, name, revision, use_profile)`
- `resolve_assessment(assessment_id)`
- `retry_assessment(assessment_id)`

### Public views

- `get_assessment(assessment_id)`
- `get_assessment_by_key(canonical_key)`
- `get_assessment_count()`
- `get_policy_profile(use_profile)`

### State machine

```text
request -> PENDING
PENDING -> ALLOW | CONDITIONAL | BLOCK | UNRESOLVED
UNRESOLVED -> PENDING (bounded retry)
```

`ALLOW`, `CONDITIONAL`, and `BLOCK` are terminal. Callers cannot submit a verdict or arbitrary evidence URL. LicenseScope is non-economic: it has no escrow, stake, bond, payout, or custody claim.

### Upgradability

The contract is classified `UPGRADABLE`. Its constructor registers a user-selected external wallet in the GenLayer Root Slot upgrader list. The public upgrade method applies an explicit membership guard and rejects empty bytecode. A disposable Studionet rehearsal verified exact code replacement, V2 redispatch, state preservation, and pre/post-upgrade authorization rejection. Native locked-slot rejection was not independently isolated from the earlier explicit guard; the exact evidence and limitation are recorded in `docs/DEPLOYMENT_RECOVERY.md`.

## Transaction lifecycle

Every frontend write follows this sequence:

```text
browser wallet/provider
-> selected account propagation
-> immediate chain-ID 61999 verification
-> write submission
-> wait for FINALIZED
-> full transaction lookup
-> consensus/execution/leader-receipt success checks
-> exact contract readback
-> immutable identity and state-transition validation
-> success UI
```

A transaction hash, `ACCEPTED` state, missing execution result, leader error, malformed record, or failed readback never counts as success.

## Run locally

Prerequisites:

- Python `3.13.x`
- `uv`
- Node.js `>=20.9.0` (required by Next.js 16 and the audited `sharp` override)
- npm

Install the locked Python environment:

```bash
uv sync --locked
```

Install the frontend from its lockfile:

```bash
npm --prefix frontend ci
```

For the current accepted Studionet deployment, configure:

```text
NEXT_PUBLIC_CONTRACT_ADDRESS=0x8f1e48e52241E1B8b3320b953901ec7eeE481Ac7
```

Start the frontend:

```bash
npm --prefix frontend run dev
```

With no verified address, the UI displays `Deployment not configured` and disables contract actions.

## Tests and verification

```bash
env -u PYTHONPATH uv pip check
env -u PYTHONPATH uv run genvm-lint check contracts/license_scope.py
env -u PYTHONPATH uv run pytest tests/direct -v
env -u PYTHONPATH uv run pytest tests/integration -v
env -u PYTHONPATH uv run gltest tests/integration -v --network studionet --rpc-url https://studio.genlayer.com/api
npm --prefix frontend test
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run build
```

Current exact results and evidence scope are recorded in `docs/VERIFICATION.md`. Skipped Studionet tests are not live evidence.

## Deployment

Release deployment is Studionet-only. The public deployment-wallet and external-upgrader address are recorded in `docs/DEPLOYMENT_RECOVERY.md`. The main contract was upgraded in place by the authorized wallet with the exact reviewed source; transaction, deployed-source parity, preserved-state readback, and a successful post-upgrade `BLOCK / EXACT` lifecycle are recorded there. The public repository and Vercel frontend are live; multi-account application evidence remains pending, so no Task-completion claim is made.

The secret-free manifest, storage compatibility policy, reset recovery procedures, and completed disposable rehearsal evidence are in `docs/DEPLOYMENT_RECOVERY.md`.

## Security and trust boundaries

- Root license files take precedence over README fallback evidence.
- README dependency mentions cannot relabel an authoritative repository license.
- Source text, prompts, role overrides, and self-declared verdicts are untrusted data.
- Deterministically recognized licenses outrank evaluator-provided labels.
- Custom or unknown terms fail closed to `UNRESOLVED`.
- Evidence references are contract-derived and revision-bound.
- Strict bounded parsing rejects malformed enum, boolean, tuple, receipt, and JSON-array shapes.
- Receipt normalization accepts the current Studionet SDK field variants only when named, snake-case, and numeric representations agree; successful writes still require `FINALIZED`, an allowed consensus result, every leader execution to succeed, and exact contract readback.
- Retry clears stale terminal fields and increments the retry count exactly once.
- The upgrader can replace code but cannot directly overwrite a verdict through a business method.

## Known limitations

- V1 supports only public GitHub repositories at a full commit SHA.
- `HF_MODEL` and `HF_DATASET` are explicitly locked as `UNSUPPORTED_V1`.
- Private/authenticated repositories and caller-supplied evidence URLs are unsupported.
- LicenseScope provides an operational policy decision, not legal advice.
- The installed dual-shape web-response repair passed deployment finality, upgraded-source parity, preserved-state readback, and a successful live `BLOCK / EXACT` resolution. A future unsupported upstream response shape will still fail closed to `UNRESOLVED` until separately reviewed and repaired.
- Disposable deployed-code readback and upgrade redispatch are verified. Native Root locking was not independently isolated from the contract's earlier explicit authorization guard.
- Availability and semantic quality still depend on public evidence and validator consensus; insufficient or custom evidence resolves safely to `UNRESOLVED`.
