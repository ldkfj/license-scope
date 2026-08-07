'use client';

import React from 'react';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';
import { isContractConfigured, CONTRACT_ADDRESS, STUDIONET_CHAIN_ID } from '@/lib/genlayer';

export const ContractStatusBanner: React.FC = () => {
  const configured = isContractConfigured();

  if (configured) {
    return (
      <div className="ls-strip" role="status">
        <div className="ls-strip__row">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-status-ok)' }} aria-hidden="true" />
          <span className="ls-strip__label">Studionet contract configured</span>
          <span className="text-[var(--color-rule-strong)]" aria-hidden="true">·</span>
          <span className="ls-strip__mono" title={CONTRACT_ADDRESS}>{CONTRACT_ADDRESS}</span>
        </div>
        <span className="ls-strip__chip">
          Target: Studionet (Chain ID {STUDIONET_CHAIN_ID})
        </span>
      </div>
    );
  }

  return (
    <div className="ls-strip is-warn" role="alert">
      <div className="ls-strip__row items-start">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--color-status-warn)' }} aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="ls-strip__label text-sm">Deployment not configured</h4>
            <span className="ls-strip__chip">Fail-closed mode active</span>
          </div>
          <p className="text-[var(--color-ink-2)] text-xs leading-relaxed max-w-[65ch]">
            <code className="ls-strip__mono">NEXT_PUBLIC_CONTRACT_ADDRESS</code> is empty or invalid.
            All contract interactions, transactions, and reads are currently disabled. Please configure your valid Studionet contract address in <code className="ls-strip__mono">.env.local</code>.
          </p>
        </div>
      </div>
    </div>
  );
};
