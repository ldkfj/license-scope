'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Cpu, Code2, BookOpen, Wallet, LoaderCircle } from 'lucide-react';
import {
  connectWalletAndVerifyChain,
  EthereumProvider,
  STUDIONET_CHAIN_ID,
} from '@/lib/genlayer';

interface NavbarProps {
  activeTab: 'request' | 'registry' | 'security';
  setActiveTab: (tab: 'request' | 'registry' | 'security') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const [walletAccount, setWalletAccount] = useState<string | null>(null);
  const [isStudionet, setIsStudionet] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const refreshWalletState = useCallback(async (): Promise<void> => {
    const ethereum = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
    if (!ethereum) {
      setWalletAccount(null);
      setIsStudionet(false);
      return;
    }

    try {
      const [accountsRaw, chainIdRaw] = await Promise.all([
        ethereum.request({ method: 'eth_accounts' }),
        ethereum.request({ method: 'eth_chainId' }),
      ]);
      const accounts = Array.isArray(accountsRaw)
        ? accountsRaw.filter((account): account is string => typeof account === 'string')
        : [];
      const chainId = typeof chainIdRaw === 'string' ? parseInt(chainIdRaw, 16) : Number.NaN;

      setWalletAccount(accounts[0] ?? null);
      setIsStudionet(chainId === STUDIONET_CHAIN_ID);
      setWalletError(null);
    } catch {
      setWalletAccount(null);
      setIsStudionet(false);
    }
  }, []);

  useEffect(() => {
    const ethereum = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
    const refreshTimer = window.setTimeout(() => {
      void refreshWalletState();
    }, 0);
    if (!ethereum?.on) {
      return () => window.clearTimeout(refreshTimer);
    }

    const handleProviderChange = () => {
      void refreshWalletState();
    };
    ethereum.on('accountsChanged', handleProviderChange);
    ethereum.on('chainChanged', handleProviderChange);

    return () => {
      window.clearTimeout(refreshTimer);
      ethereum.removeListener?.('accountsChanged', handleProviderChange);
      ethereum.removeListener?.('chainChanged', handleProviderChange);
    };
  }, [refreshWalletState]);

  const handleConnectWallet = async (): Promise<void> => {
    setIsConnecting(true);
    setWalletError(null);
    try {
      const account = await connectWalletAndVerifyChain();
      setWalletAccount(account);
      setIsStudionet(true);
    } catch (error) {
      await refreshWalletState();
      setWalletError(error instanceof Error ? error.message : 'Unable to connect wallet.');
    } finally {
      setIsConnecting(false);
    }
  };

  const shortAccount = walletAccount
    ? `${walletAccount.slice(0, 6)}…${walletAccount.slice(-4)}`
    : null;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                LicenseScope
              </span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                GenLayer V2
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Operational Rights & License Attestation Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('request')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'request'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Request Attestation</span>
            </button>

            <button
              onClick={() => setActiveTab('registry')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'registry'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Registry Explorer</span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'security'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Security Architecture</span>
            </button>
          </nav>

          <div className="relative">
            <button
              type="button"
              onClick={handleConnectWallet}
              disabled={isConnecting}
              aria-label={walletAccount ? `Wallet ${walletAccount}` : 'Connect wallet'}
              title={walletError ?? (walletAccount ? walletAccount : 'Connect a browser wallet')}
              className={`h-10 min-w-36 flex items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-all disabled:cursor-wait disabled:opacity-70 ${
                walletAccount && isStudionet
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
                  : walletAccount
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15'
                    : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-500/20'
              }`}
            >
              {isConnecting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Wallet className="h-4 w-4" />
              )}
              <span>
                {isConnecting
                  ? 'Connecting…'
                  : walletAccount && isStudionet
                    ? shortAccount
                    : walletAccount
                      ? 'Switch to Studionet'
                      : 'Connect Wallet'}
              </span>
              {walletAccount && isStudionet && (
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              )}
            </button>
            {walletError && (
              <p className="absolute right-0 top-12 z-50 w-72 rounded-lg border border-rose-500/30 bg-slate-950 px-3 py-2 text-[11px] leading-4 text-rose-300 shadow-xl">
                {walletError}
              </p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
