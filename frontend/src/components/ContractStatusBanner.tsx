'use client';

import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { isContractConfigured, CONTRACT_ADDRESS, STUDIONET_CHAIN_ID } from '@/lib/genlayer';

export const ContractStatusBanner: React.FC = () => {
  const configured = isContractConfigured();

  if (configured) {
    return (
      <div className="bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 px-4 py-3 rounded-xl flex items-center justify-between text-xs backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-semibold tracking-wide">STUDIONET CONTRACT ADDRESS CONFIGURED</span>
          <span className="text-emerald-500/70">|</span>
          <span className="font-mono text-emerald-400">{CONTRACT_ADDRESS}</span>
        </div>
        <span className="bg-emerald-900/60 px-2 py-0.5 rounded text-[10px] font-mono border border-emerald-700/50">
          Target: Studionet (Chain ID {STUDIONET_CHAIN_ID})
        </span>
      </div>
    );
  }

  return (
    <div className="bg-amber-950/40 border border-amber-500/30 text-amber-200 p-4 rounded-xl backdrop-blur-md flex items-start gap-3">
      <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm text-amber-300">Deployment not configured</h4>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-amber-900/60 border border-amber-700/50 text-amber-300 font-mono">
            Fail-Closed Mode Active
          </span>
        </div>
        <p className="text-xs text-amber-200/80 leading-relaxed">
          <code className="bg-amber-900/40 px-1 py-0.5 rounded text-amber-300 font-mono text-[11px]">NEXT_PUBLIC_CONTRACT_ADDRESS</code> is empty or invalid.
          All contract interactions, transactions, and reads are currently disabled. Please configure your valid Studionet contract address in <code className="bg-amber-900/40 px-1 py-0.5 rounded text-amber-300 font-mono text-[11px]">.env.local</code>.
        </p>
      </div>
    </div>
  );
};
