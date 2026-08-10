# GenLayer Submission Category and Scorecard

## Classification

```text
Category: PROJECT
Validity gate: PASS THROUGH GITHUB AND VERCEL RELEASE EVIDENCE
```

LicenseScope is a `PROJECT`, not a standalone `INTELLIGENT_CONTRACT`: the deliverable includes a Next.js application, browser-wallet workflow, Studionet Intelligent Contract, public repository, and live frontend.

## GenLayer fit: 4/5

**Evidence:** The consensus-critical question—whether public license evidence for an immutable artifact revision supports a specific intended-use profile—cannot be established by a deterministic contract alone. The contract derives bounded evidence, runs independent leader/validator evaluation through GenLayer, compares stable consequences, and stores the final attestation on-chain.

**Historical live proof:** Assessment `#1` resolved on the prior public source to `BLOCK / EXPLICIT_USE_RESTRICTION`, with subject and revision `EXACT`, sufficient immutable evidence, and `CC-BY-NC-4.0` bound against `COMMERCIAL_INFERENCE`. Transaction `0x98a4739d8c7c02e271587c432d8d0419a68819a6cf51bd6522cedc522259c562` reached `FINALIZED / MAJORITY_AGREE` with successful leader execution. This transaction does not prove the pending complete-source correction.

**Remaining weakness:** V1 supports only public GitHub repositories at immutable commit SHAs.

## Contract quality: 4/5

**Evidence:** Canonical identity and full commit SHA are enforced; caller-supplied evidence URLs and verdicts are absent; deterministic license reconciliation outranks evaluator labels; malformed or contradictory evidence fails closed; terminal results require complete source evaluation; consensus disagreement preserves safe state; retry is bounded; and upgrade authorization plus empty-code rejection are explicit.

**Historical live proof:** The main contract was upgraded in place with exact prior-source parity and preserved assessment state. A populated disposable-contract rehearsal verified successful authorized upgrade and state preservation. The rehearsal address is prohibited from release use. The complete-source correction has not been installed.

**Remaining weakness:** Native Root locked-slot enforcement was not independently isolated from the contract's explicit upgrader guard.

## Engineering: 4/5

**Evidence:** Python 3.13 and frontend dependencies are locked. GenVM lint and contract validation pass; 59 direct contract tests pass; the three live integration selections truthfully skip without explicit live authorization; 47 frontend behavior tests, TypeScript, ESLint, and production build pass. High-threshold dependency audit passes with zero high or critical findings; the remaining PostCSS advisory propagates into three moderate package entries and its forced repair would change the exact Next version.

**Release proof:** The public repository is `https://github.com/ldkfj/license-scope`. Forbidden internal files, secrets, local environments, dependencies, caches, `.hallmark`, and working design artifacts are excluded.

## Frontend / UX: 4/5

**Evidence:** The application requires a cryptographically matched `personal_sign` session, invalidates authorization on account changes and soft disconnect, enforces Studionet chain ID `61999`, coordinates all writes through one page-wide pending-transaction owner, retains the same transaction hash across bounded reconciliation, validates finality/execution/readback, and exposes accessible modal focus containment and keyboard handling.

**Live proof:** `https://license-scope.vercel.app` is a production Vercel deployment under scope `gam9`. It returned HTTP `200` and rendered the exact accepted Studionet contract address.

**Remaining weakness:** Provider-specific permission revocation, independent assistive-technology behavior, and multi-account application behavior have not been independently exercised in a controlled live session.

## Overall evidence-based assessment

LicenseScope has historical matching Studionet contract evidence, upgraded-source parity, successful terminal lifecycle evidence, a public GitHub repository, and a live Vercel frontend. The judge-requested complete-source correction is currently a local PRE_DEPLOY candidate and is not covered by that historical live evidence.

```text
Submission recommendation: NOT READY FOR RESUBMISSION; COMPLETE PRE_DEPLOY REVIEW AND AUTHORIZED UPGRADE FIRST
Task status: NOT YET COMPLETE
```

Remaining gates are exact-revision PRE_DEPLOY review, separate user authorization for the main-contract upgrade, upgraded-source parity and live correction evidence, one public GitHub/Vercel release, and final exact-revision review. No further contract deployment, upgrade, or wallet transaction is authorized.
