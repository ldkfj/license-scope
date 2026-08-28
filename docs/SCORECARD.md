# GenLayer Submission Category and Scorecard

## Classification

```text
Category: PROJECT
Validity gate: PASS THROUGH GITHUB AND VERCEL RELEASE EVIDENCE
```

LicenseScope is a `PROJECT`, not a standalone `INTELLIGENT_CONTRACT`: the deliverable includes a Next.js application, browser-wallet workflow, Studionet Intelligent Contract, public repository, and live frontend.

## GenLayer fit: 4/5

**Evidence:** The consensus-critical question—whether public license evidence for an immutable artifact revision supports a specific intended-use profile—cannot be established by a deterministic contract alone. The contract derives bounded evidence, runs independent leader/validator evaluation through GenLayer, compares stable consequences, and stores the final attestation on-chain.

**Live proof:** Assessment `#2` resolved on the corrected source to `BLOCK / EXPLICIT_USE_RESTRICTION`, with subject and revision `EXACT`, sufficient immutable evidence, and `CC-BY-NC-4.0` bound against `COMMERCIAL_REDISTRIBUTION`. Transaction `0x2340d9a261c9aff0b481b4bb4d8fe404d038bbc900f220fa2a65f130dfdda430` reached `FINALIZED / MAJORITY_AGREE` with successful leader execution. The earlier attempt `0x06942fe5358d40520fefcf9d0431c5a352ee670b2547dc8336eebe6502a4e075` is authoritatively `FINALIZED / MAJORITY_DISAGREE`; its recorded immediate readback remained `PENDING`, although that historical snapshot cannot be reconstructed from current state.

**Remaining weakness:** V1 supports only public GitHub repositories at immutable commit SHAs.

## Contract quality: 4/5

**Evidence:** Canonical identity and full commit SHA are enforced; caller-supplied evidence URLs and verdicts are absent; deterministic license reconciliation outranks evaluator labels; malformed or contradictory evidence fails closed; terminal results require complete source evaluation; consensus disagreement preserves safe state; retry is bounded; and upgrade authorization plus empty-code rejection are explicit.

**Current live proof:** The main contract was upgraded in place by transaction `0x93187fa0858d8089a7708c38d81a2d78e2e6bdc30e366f2d14dff8abc78e54d1`. The transaction reached `FINALIZED / MAJORITY_AGREE`, both leader receipts succeeded without error, live source SHA-256 matched `c3a51d4cb13f63433a3aaae4f3600deb4292e8cffad1a65d6261378b8984bbff`, the active policy hash matched `sha256:696833070a2262ebcd178648b21957a883d62c2d7c0112a007d1143ec3720fbc`, and assessment `#1` remained unchanged. A populated disposable-contract rehearsal separately verified authorized upgrade and state preservation; its address is prohibited from release use.

**Remaining weakness:** Native Root locked-slot enforcement was not independently isolated from the contract's explicit upgrader guard.

## Engineering: 4/5

**Evidence:** Python 3.13 and frontend dependencies are locked. GenVM lint and contract validation pass; 59 direct contract tests pass; the three live integration selections truthfully skip without explicit live authorization; 51 frontend behavior tests, TypeScript, ESLint, and production build pass. High-threshold dependency audit passes with zero high or critical findings; the remaining PostCSS advisory propagates into three moderate package entries and its forced repair would change the exact Next version.

**Release proof:** The public repository is `https://github.com/ldkfj/license-scope`. Forbidden internal files, secrets, local environments, dependencies, caches, `.hallmark`, and working design artifacts are excluded.

## Frontend / UX: 4/5

**Evidence:** The application requires a cryptographically matched `personal_sign` session, invalidates authorization on account changes and soft disconnect, enforces Studionet chain ID `61999`, coordinates all writes through one page-wide pending-transaction owner, retains the same transaction hash across bounded reconciliation, validates finality/execution/readback, and exposes accessible modal focus containment and keyboard handling.

**Live proof:** `https://license-scope.vercel.app` is a production Vercel deployment under scope `gam9`. It returned HTTP `200` and rendered the exact accepted Studionet contract address.

**Remaining weakness:** Provider-specific permission revocation, independent assistive-technology behavior, and multi-account application behavior have not been independently exercised in a controlled live session.

## Overall evidence-based assessment

LicenseScope now has exact Studionet source parity, preserved-state evidence, a safe consensus-disagreement no-mutation result, and a successful correction-specific full-source terminal evaluation, plus a public GitHub repository and a live Vercel frontend.

```text
Submission recommendation: READY FOR EXPLORER PRE-SUBMISSION REVIEW
Task status: NOT YET COMPLETE
```

Contract and application release gates are complete through anonymous `EXPLORER_POST_RELEASE_LIVE` approval for commit `4498815f6899bd632f3ab09037077ea5d4fb342d`. Explorer field review and the user's manual Explorer submission remain; the consumed upgrade authorization grants no authority for another contract transaction.
