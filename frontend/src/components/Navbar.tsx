'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Cpu, Code2, BookOpen, Wallet, LoaderCircle, LogOut, RefreshCw } from 'lucide-react';
import {
  connectWalletAndVerifyChain,
  disconnectBrowserWallet,
  allowBrowserWalletConnection,
  isBrowserWalletDisconnected,
  isBrowserWalletConnectionSigned,
  invalidateBrowserWalletConnectionSignature,
  signBrowserWalletConnection,
  suppressBrowserWalletConnection,
  reconnectWalletAndVerifyChain,
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
  const [isWalletMenuOpen, setIsWalletMenuOpen] = useState(false);

  const refreshWalletState = useCallback(async (): Promise<void> => {
    if (isBrowserWalletDisconnected()) {
      setWalletAccount(null);
      setIsStudionet(false);
      return;
    }
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

      const account = accounts[0] ?? null;
      const signed = account !== null && isBrowserWalletConnectionSigned(account);
      setWalletAccount(signed ? account : null);
      setIsStudionet(signed && chainId === STUDIONET_CHAIN_ID);
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

    const handleAccountsChanged = () => {
      invalidateBrowserWalletConnectionSignature();
      void refreshWalletState();
    };
    const handleChainChanged = () => void refreshWalletState();
    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.clearTimeout(refreshTimer);
      ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
      ethereum.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [refreshWalletState]);

  const handleConnectWallet = async (): Promise<void> => {
    setIsConnecting(true);
    setWalletError(null);
    invalidateBrowserWalletConnectionSignature();
    allowBrowserWalletConnection();
    try {
      const account = await connectWalletAndVerifyChain(false);
      await signBrowserWalletConnection(account);
      setWalletAccount(account);
      setIsStudionet(true);
    } catch (error) {
      suppressBrowserWalletConnection();
      await refreshWalletState();
      setWalletError(error instanceof Error ? error.message : 'Unable to connect wallet.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleChangeAccount = async (): Promise<void> => {
    setIsWalletMenuOpen(false);
    setIsConnecting(true);
    setWalletError(null);
    invalidateBrowserWalletConnectionSignature();
    allowBrowserWalletConnection();
    try {
      const account = await reconnectWalletAndVerifyChain(false);
      await signBrowserWalletConnection(account);
      setWalletAccount(account);
      setIsStudionet(true);
    } catch (error) {
      suppressBrowserWalletConnection();
      await refreshWalletState();
      setWalletError(error instanceof Error ? error.message : 'Unable to change wallet account.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectWallet = async (): Promise<void> => {
    setIsWalletMenuOpen(false);
    setIsConnecting(true);
    setWalletError(null);
    try {
      await disconnectBrowserWallet();
      setWalletAccount(null);
      setIsStudionet(false);
    } catch (error) {
      await refreshWalletState();
      setWalletError(error instanceof Error ? error.message : 'Unable to disconnect wallet.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleWalletButton = (): void => {
    if (!walletAccount) {
      void handleConnectWallet();
      return;
    }
    setWalletError(null);
    setIsWalletMenuOpen((open) => !open);
  };

  const shortAccount = walletAccount
    ? `${walletAccount.slice(0, 6)}…${walletAccount.slice(-4)}`
    : null;

  const walletBtnClass = [
    'ls-wallet__btn',
    walletAccount && isStudionet ? 'is-ok' : walletAccount ? 'is-warn' : 'is-idle',
  ].join(' ');

  return (
    <header className="ls-header">
      <div className="ls-header__inner">
        <div className="ls-brand">
          <div className="ls-brand__mark" aria-hidden="true">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="ls-brand__meta">
            <div className="flex items-center gap-2 min-w-0">
              <span className="ls-brand__name">LicenseScope</span>
              <span className="ls-brand__tag">GenLayer V2</span>
            </div>
            <p className="ls-brand__sub hidden sm:block">
              Operational Rights &amp; License Attestation Engine
            </p>
          </div>
        </div>

        <div className="ls-header__actions">
          <nav className="ls-tabs" aria-label="Primary surfaces">
            <button
              type="button"
              onClick={() => setActiveTab('request')}
              className={`ls-tab${activeTab === 'request' ? ' is-active' : ''}`}
              aria-current={activeTab === 'request' ? 'page' : undefined}
            >
              <Code2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="ls-tab__label">Request Attestation</span>
              <span className="sr-only sm:hidden">Request Attestation</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('registry')}
              className={`ls-tab${activeTab === 'registry' ? ' is-active' : ''}`}
              aria-current={activeTab === 'registry' ? 'page' : undefined}
            >
              <Cpu className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="ls-tab__label">Registry Explorer</span>
              <span className="sr-only sm:hidden">Registry Explorer</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`ls-tab${activeTab === 'security' ? ' is-active' : ''}`}
              aria-current={activeTab === 'security' ? 'page' : undefined}
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="ls-tab__label">Security Architecture</span>
              <span className="sr-only sm:hidden">Security Architecture</span>
            </button>
          </nav>

          <div className="ls-wallet">
            <button
              type="button"
              onClick={handleWalletButton}
              disabled={isConnecting}
              aria-label={walletAccount ? `Open wallet menu for ${walletAccount}` : 'Connect and sign wallet'}
              aria-expanded={walletAccount ? isWalletMenuOpen : undefined}
              aria-haspopup={walletAccount ? 'menu' : undefined}
              title={walletError ?? (walletAccount ? `Wallet options (${walletAccount})` : 'Connect wallet and sign a gasless session message')}
              className={walletBtnClass}
            >
              {isConnecting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Wallet className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span className="truncate">
                {isConnecting
                  ? 'Connecting…'
                  : walletAccount && isStudionet
                    ? shortAccount
                    : walletAccount
                      ? 'Switch to Studionet'
                      : 'Connect & Sign'}
              </span>
              {walletAccount && isStudionet && (
                <span className="ls-wallet__dot" aria-hidden="true" title="Connected on Studionet" />
              )}
            </button>
            {walletAccount && isWalletMenuOpen && (
              <div role="menu" className="ls-wallet__menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleChangeAccount()}
                  className="ls-wallet__menuitem"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Change account
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleDisconnectWallet()}
                  className="ls-wallet__menuitem is-danger"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  Disconnect
                </button>
              </div>
            )}
            {walletError && (
              <p role="alert" className="ls-wallet__error">
                {walletError}
              </p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
