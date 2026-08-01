'use client';

import React from 'react';
import { ShieldCheck, Lock, Terminal, Cpu, CheckCircle2, AlertTriangle } from 'lucide-react';
import { POLICY_VERSION } from '@/lib/genlayer';

export const SecuritySection: React.FC = () => {
  const CANONICAL_HASH = 'sha256:1105b19ea7786bbd5ace24445845997e914e726cd2f80ddf83d8a6f8f8769532';

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-8 backdrop-blur-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 text-xs font-mono">
            <ShieldCheck className="w-4 h-4" />
            Security & Consensus Architecture ({POLICY_VERSION})
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Deterministic License Scope Attestation Protocol
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Designed for GenLayer Studionet; live deployment is currently not configured. GitHub repository evaluation is the only supported adapter in V1.
          </p>
        </div>
      </div>

      {/* Grid Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* On-Chain Manifest Security */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-800/50 text-cyan-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Immutable Policy Manifest</h3>
              <p className="text-xs text-slate-400">Deterministic Policy Hash</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            All policy rules, reason code allowlists, obligation mappings, and profile compatibility matrices are governed by a canonical policy manifest hash.
          </p>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] space-y-1">
            <div className="text-slate-500 text-[10px]">SOURCE MANIFEST HASH (CANONICAL)</div>
            <div className="text-cyan-300 break-all">{CANONICAL_HASH}</div>
          </div>
        </div>

        {/* Adapter Support State */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-950 border border-indigo-800/50 text-indigo-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Adapter Support Matrix</h3>
              <p className="text-xs text-slate-400">V1 Verification Boundaries</p>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-200 font-mono">GITHUB_REPO</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> ONLY SUPPORTED V1
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 font-mono">HF_MODEL</span>
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> UNSUPPORTED_V1
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 font-mono">HF_DATASET</span>
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> UNSUPPORTED_V1
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Verification Commands */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-950 border border-emerald-800/50 text-emerald-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Verification Pipeline Commands</h3>
            <p className="text-xs text-slate-400">Direct Unit Tests & Official Verification Suite</p>
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs space-y-2 text-slate-300 overflow-x-auto">
          <div><span className="text-slate-500"># Direct unit test suite</span></div>
          <div className="text-cyan-300">env -u PYTHONPATH uv run pytest tests/direct -v</div>
          <div className="pt-2"><span className="text-slate-500"># GenVM contract static check</span></div>
          <div className="text-cyan-300">env -u PYTHONPATH uv run genvm-lint check contracts/license_scope.py</div>
          <div className="pt-2"><span className="text-slate-500"># Official Studionet integration test command</span></div>
          <div className="text-cyan-300">env -u PYTHONPATH uv run pytest tests/integration -v --network studionet --chain-type studionet --rpc-url https://studio.genlayer.com/api</div>
        </div>
      </div>
    </div>
  );
};
