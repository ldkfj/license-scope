'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Wallet, X } from 'lucide-react';
import type { BrowserWalletProvider } from '@/lib/genlayer';
import { handleModalKeyDown } from '@/lib/modalFocus';

interface WalletChooserModalProps {
  open: boolean;
  wallets: BrowserWalletProvider[];
  onClose: () => void;
  onSelect: (wallet: BrowserWalletProvider) => void;
}

const GET_WALLET_OPTIONS = [
  { name: 'MetaMask', match: /metamask/i, url: 'https://metamask.io/download/' },
  { name: 'Rabby Wallet', match: /rabby/i, url: 'https://rabby.io/' },
  { name: 'Coinbase Wallet', match: /coinbase/i, url: 'https://www.coinbase.com/wallet/downloads' },
  { name: 'OKX Wallet', match: /okx/i, url: 'https://web3.okx.com/download' },
  { name: 'Phantom', match: /phantom/i, url: 'https://phantom.com/download' },
];

export const WalletChooserModal: React.FC<WalletChooserModalProps> = ({
  open,
  wallets,
  onClose,
  onSelect,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !rootRef.current || !dialogRef.current) return;
    const root = rootRef.current;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const background = Array.from(root.parentElement?.children ?? [])
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== root)
      .map((element) => ({ element, inert: element.inert }));
    background.forEach(({ element }) => { element.inert = true; });

    const handleKeyDown = (event: KeyboardEvent) => {
      const focusable = event.key === 'Tab'
        ? Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href]'))
        : [];
      handleModalKeyDown(event, focusable, document.activeElement as HTMLElement | null, onClose);
    };

    document.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      background.forEach(({ element, inert }) => { element.inert = inert; });
      previousFocus?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  const missingWallets = GET_WALLET_OPTIONS.filter(
    ({ match }) => !wallets.some(({ name }) => match.test(name)),
  );

  return createPortal(
    <div
      ref={rootRef}
      className="ls-modal-root"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        className="ls-modal ls-wallet-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-picker-title"
      >
        <div className="ls-modal__head">
          <div>
            <h2 id="wallet-picker-title" className="ls-modal__title">Select a wallet</h2>
            <p className="ls-wallet-picker__subtitle">Choose the provider LicenseScope may request and sign with.</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="ls-icon-btn"
            aria-label="Close wallet selector"
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="ls-modal__body ls-wallet-picker__body">
          {wallets.length > 0 ? (
            <div className="ls-wallet-picker__list" aria-label="Installed wallets">
              {wallets.map((wallet) => (
                <button
                  type="button"
                  className="ls-wallet-picker__item"
                  key={wallet.id}
                  onClick={() => onSelect(wallet)}
                >
                  <span className="ls-wallet-picker__identity">
                    {wallet.icon ? (
                      <img className="ls-wallet-picker__icon" src={wallet.icon} alt="" />
                    ) : (
                      <span className="ls-wallet-picker__icon is-generic" aria-hidden="true">
                        <Wallet className="h-5 w-5" />
                      </span>
                    )}
                    <span>{wallet.name}</span>
                  </span>
                  <span className="ls-wallet-picker__status">Installed</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="ls-wallet-picker__empty">
              <Wallet className="h-7 w-7" aria-hidden="true" />
              <strong>No compatible browser wallet detected</strong>
              <span>Install a wallet below, then reload this page.</span>
            </div>
          )}

          {missingWallets.length > 0 && (
            <div>
              <p className="ls-wallet-picker__section">Get a wallet</p>
              <div className="ls-wallet-picker__list">
                {missingWallets.map((wallet) => (
                  <a
                    className="ls-wallet-picker__item"
                    href={wallet.url}
                    target="_blank"
                    rel="noreferrer"
                    key={wallet.name}
                  >
                    <span className="ls-wallet-picker__identity">
                      <span className="ls-wallet-picker__icon is-generic" aria-hidden="true">
                        {wallet.name.slice(0, 1)}
                      </span>
                      <span>{wallet.name}</span>
                    </span>
                    <span className="ls-wallet-picker__status">
                      Get wallet <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <p className="ls-wallet-picker__note">
            WalletConnect QR is unavailable until a WalletConnect project ID is configured.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
};
