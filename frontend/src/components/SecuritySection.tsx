'use client';

import React from 'react';
import { ShieldCheck, Lock, Terminal, Cpu, CheckCircle2, AlertTriangle } from 'lucide-react';
import { POLICY_HASH, POLICY_VERSION } from '@/lib/genlayer';

export const SecuritySection: React.FC = () => {
  return (
    <section className="ls-panel ls-doc animate-fadeIn">
      <div className="ls-doc__intro">
        <h1 className="ls-doc__title flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[var(--color-accent)] shrink-0" />
          Security &amp; Consensus Architecture
        </h1>
        <p className="ls-doc__lede">
          Deterministic license-scope attestation on GenLayer Studionet. GitHub repository evaluation is the only supported adapter in {POLICY_VERSION}.
        </p>
      </div>

      <div className="ls-doc__section">
        <h2 className="ls-doc__h flex items-center gap-2"><Lock className="w-4 h-4" /> Canonical policy manifest</h2>
        <p className="ls-doc__sub">Policy rules, reason-code allowlists, obligations, and profile compatibility are bound to the on-chain manifest hash.</p>
        <div className="ls-codeblock"><span className="cm">SOURCE MANIFEST HASH</span><br /><span className="cmd break-all">{POLICY_HASH}</span></div>
      </div>

      <div className="ls-doc__section">
        <h2 className="ls-doc__h flex items-center gap-2"><Cpu className="w-4 h-4" /> Adapter support matrix</h2>
        <p className="ls-doc__sub">Unsupported adapters fail closed in V1.</p>
        <div className="ls-spec">
          <div className="ls-spec__row"><span className="ls-spec__key">GITHUB_REPO</span><span className="ls-status ls-status--ok"><CheckCircle2 className="w-3.5 h-3.5" /> ONLY SUPPORTED V1</span></div>
          <div className="ls-spec__row"><span className="ls-spec__key">HF_MODEL</span><span className="ls-status ls-status--warn"><AlertTriangle className="w-3.5 h-3.5" /> UNSUPPORTED_V1</span></div>
          <div className="ls-spec__row"><span className="ls-spec__key">HF_DATASET</span><span className="ls-status ls-status--warn"><AlertTriangle className="w-3.5 h-3.5" /> UNSUPPORTED_V1</span></div>
        </div>
      </div>

      <div className="ls-doc__section">
        <h2 className="ls-doc__h flex items-center gap-2"><Terminal className="w-4 h-4" /> Verification pipeline</h2>
        <p className="ls-doc__sub">Repository commands for direct tests, contract lint, and Studionet integration checks.</p>
        <div className="ls-codeblock">
          <span className="cm"># Direct unit test suite</span><br />
          <span className="cmd">env -u PYTHONPATH uv run pytest tests/direct -v</span><br /><br />
          <span className="cm"># GenVM contract static check</span><br />
          <span className="cmd">env -u PYTHONPATH uv run genvm-lint check contracts/license_scope.py</span><br /><br />
          <span className="cm"># Studionet integration test command</span><br />
          <span className="cmd">env -u PYTHONPATH uv run pytest tests/integration -v --network studionet --chain-type studionet --rpc-url https://studio.genlayer.com/api</span>
        </div>
      </div>
    </section>
  );
};
