import test from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';

import {
  connectWalletAndVerifyChain,
  discoverBrowserWallets,
  disconnectBrowserWallet,
  getBrowserWalletProvider,
  invalidateBrowserWalletConnectionSignature,
  isBrowserWalletConnectionSigned,
  reconnectWalletAndVerifyChain,
  signBrowserWalletConnection,
  selectBrowserWalletProvider,
  suppressBrowserWalletConnection,
  subscribeBrowserWallets,
  type EthereumProvider,
} from '../src/lib/genlayer.ts';
import { cycleModalFocus, handleModalKeyDown, type FocusTarget } from '../src/lib/modalFocus.ts';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const accountA = privateKeyToAccount(`0x${'11'.repeat(32)}`);
const accountB = privateKeyToAccount(`0x${'22'.repeat(32)}`);

async function withWalletWindow(provider: EthereumProvider, run: () => Promise<void>): Promise<void> {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { ethereum: provider, location: { origin: 'https://licensescope.test' }, sessionStorage: new MemoryStorage() },
  });
  selectBrowserWalletProvider({ id: 'test-wallet', name: 'Test Wallet', provider });
  try {
    await run();
  } finally {
    await disconnectBrowserWallet();
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete (globalThis as { window?: unknown }).window;
  }
}

function signingProvider(activeAddress: string, signer = accountA): EthereumProvider {
  return {
    async request({ method, params }) {
      if (method === 'personal_sign') {
        const message = params?.[0];
        assert.equal(typeof message, 'string');
        return signer.signMessage({ message: { raw: message as Hex } });
      }
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [activeAddress];
      if (method === 'eth_chainId') return '0xf22f';
      throw new Error(`Unexpected method: ${method}`);
    },
  };
}

test('wallet session stores authorization only for a cryptographically matching signer', async () => {
  await withWalletWindow(signingProvider(accountA.address), async () => {
    await signBrowserWalletConnection(accountA.address);
    assert.equal(isBrowserWalletConnectionSigned(accountA.address), true);
  });
});

test('well-formed wrong-signer signature is rejected and not authorized', async () => {
  await withWalletWindow(signingProvider(accountA.address, accountB), async () => {
    await assert.rejects(signBrowserWalletConnection(accountA.address), /does not match the active account/i);
    assert.equal(isBrowserWalletConnectionSigned(accountA.address), false);
  });
});

test('account change during signing is rejected before authorization is stored', async () => {
  const provider: EthereumProvider = {
    async request({ method, params }) {
      if (method === 'personal_sign') {
        return accountA.signMessage({ message: { raw: params?.[0] as Hex } });
      }
      if (method === 'eth_accounts') return [accountB.address];
      throw new Error(`Unexpected method: ${method}`);
    },
  };
  await withWalletWindow(provider, async () => {
    await assert.rejects(signBrowserWalletConnection(accountA.address), /changed while signing/i);
    assert.equal(isBrowserWalletConnectionSigned(accountA.address), false);
  });
});

test('refused signature leaves the wallet session unsigned', async () => {
  const provider: EthereumProvider = {
    async request({ method }) {
      if (method === 'personal_sign') throw new Error('User rejected the request.');
      if (method === 'eth_accounts') return [accountA.address];
      throw new Error(`Unexpected method: ${method}`);
    },
  };
  await withWalletWindow(provider, async () => {
    await assert.rejects(signBrowserWalletConnection(accountA.address), /rejected/i);
    assert.equal(isBrowserWalletConnectionSigned(accountA.address), false);
  });
});

test('account A to B to A cannot restore the previous signed marker', async () => {
  await withWalletWindow(signingProvider(accountA.address), async () => {
    await signBrowserWalletConnection(accountA.address);
    invalidateBrowserWalletConnectionSignature();
    assert.equal(isBrowserWalletConnectionSigned(accountB.address), false);
    assert.equal(isBrowserWalletConnectionSigned(accountA.address), false);
  });
});

test('soft disconnect blocks wallet authorization before provider access', async () => {
  let calls = 0;
  const provider: EthereumProvider = { request: async () => { calls += 1; return []; } };
  await withWalletWindow(provider, async () => {
    suppressBrowserWalletConnection();
    await assert.rejects(connectWalletAndVerifyChain(), /disconnected in LicenseScope/i);
    assert.equal(calls, 0);
  });
});

test('modal focus cycles at both keyboard boundaries', () => {
  const focused: string[] = [];
  const first: FocusTarget = { focus: () => focused.push('first') };
  const middle: FocusTarget = { focus: () => focused.push('middle') };
  const last: FocusTarget = { focus: () => focused.push('last') };
  const targets = [first, middle, last];

  assert.equal(cycleModalFocus(targets, last, false), true);
  assert.equal(cycleModalFocus(targets, first, true), true);
  assert.equal(cycleModalFocus(targets, middle, false), false);
  assert.deepEqual(focused, ['first', 'last']);
});

test('modal Escape closes and Tab containment prevents focus escape', () => {
  let closed = false;
  let prevented = 0;
  const first: FocusTarget = { focus: () => undefined };
  const last: FocusTarget = { focus: () => undefined };
  const event = (key: string, shiftKey = false) => ({ key, shiftKey, preventDefault: () => { prevented += 1; } });

  handleModalKeyDown(event('Escape'), [], null, () => { closed = true; });
  handleModalKeyDown(event('Tab'), [first, last], last, () => undefined);
  assert.equal(closed, true);
  assert.equal(prevented, 2);
});

test('wallet discovery never uses a provider before selection and retains delayed EIP-6963 announcements', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const events = new EventTarget();
  let listenerAdds = 0;
  let listenerRemovals = 0;
  let revoked = false;
  let announceOnRequest = false;
  const defaultCalls: string[] = [];
  const selectedCalls: string[] = [];
  const defaultProvider: EthereumProvider = {
    request: async ({ method }) => {
      defaultCalls.push(method);
      return [];
    },
  };
  const selectedProvider: EthereumProvider = {
    request: async ({ method, params }) => {
      selectedCalls.push(method);
      if (method === 'eth_requestAccounts') return [accountB.address];
      if (method === 'eth_accounts') return revoked ? [] : [accountB.address];
      if (method === 'eth_chainId') return '0xf22f';
      if (method === 'personal_sign') {
        return accountB.signMessage({ message: { raw: params?.[0] as Hex } });
      }
      if (method === 'wallet_requestPermissions') return null;
      if (method === 'wallet_revokePermissions') {
        revoked = true;
        return null;
      }
      return [];
    },
  };
  const announcements = [
    { info: { uuid: 'wallet-a', name: 'Default Wallet' }, provider: defaultProvider },
    { info: { uuid: 'wallet-b', name: 'Selected Wallet' }, provider: selectedProvider },
  ];
  const browserWindow = {
    ethereum: defaultProvider,
    location: { origin: 'https://licensescope.test' },
    sessionStorage: new MemoryStorage(),
    setTimeout,
    addEventListener(type: string, listener: EventListener) {
      listenerAdds += 1;
      events.addEventListener(type, listener);
    },
    removeEventListener(type: string, listener: EventListener) {
      listenerRemovals += 1;
      events.removeEventListener(type, listener);
    },
    dispatchEvent(event: Event) {
      const dispatched = events.dispatchEvent(event);
      if (event.type === 'eip6963:requestProvider' && announceOnRequest) {
        for (const detail of announcements) {
          const announcement = new Event('eip6963:announceProvider');
          Object.defineProperty(announcement, 'detail', { value: detail });
          events.dispatchEvent(announcement);
        }
      }
      return dispatched;
    },
  };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browserWindow });

  try {
    const delayedSnapshots: string[][] = [];
    const unsubscribe = subscribeBrowserWallets((wallets) => {
      delayedSnapshots.push(wallets.map((wallet) => wallet.id));
    });
    const legacyWallets = await discoverBrowserWallets(0);
    assert.deepEqual(legacyWallets.map(({ id }) => id), ['legacy-window-ethereum']);
    assert.equal(getBrowserWalletProvider(), undefined);
    await assert.rejects(connectWalletAndVerifyChain(false), /No compatible Web3 wallet/i);
    assert.deepEqual(defaultCalls, []);

    for (const detail of announcements) {
      const announcement = new Event('eip6963:announceProvider');
      Object.defineProperty(announcement, 'detail', { value: detail });
      events.dispatchEvent(announcement);
    }
    assert.deepEqual(delayedSnapshots.at(-1), ['wallet-a', 'wallet-b']);
    unsubscribe();
    announceOnRequest = true;
    const wallets = await discoverBrowserWallets(0);
    assert.deepEqual(wallets.map(({ id, name }) => ({ id, name })), [
      { id: 'wallet-a', name: 'Default Wallet' },
      { id: 'wallet-b', name: 'Selected Wallet' },
    ]);
    assert.equal(listenerAdds, 1);
    assert.equal(listenerRemovals, 0);
    assert.equal(getBrowserWalletProvider(), undefined);
    assert.deepEqual(defaultCalls, []);

    selectBrowserWalletProvider(wallets[1]);
    assert.equal(getBrowserWalletProvider(), selectedProvider);
    assert.equal(await connectWalletAndVerifyChain(false), accountB.address);
    await signBrowserWalletConnection(accountB.address);
    assert.equal(await reconnectWalletAndVerifyChain(false), accountB.address);
    assert.equal(await disconnectBrowserWallet(), true);
    assert.equal(getBrowserWalletProvider(), undefined);
    assert.equal(browserWindow.sessionStorage.getItem('licensescope.walletProvider'), null);
    assert.deepEqual(selectedCalls, [
      'eth_requestAccounts',
      'eth_chainId',
      'personal_sign',
      'eth_accounts',
      'wallet_requestPermissions',
      'eth_requestAccounts',
      'eth_chainId',
      'wallet_revokePermissions',
      'eth_accounts',
    ]);
    assert.deepEqual(defaultCalls, []);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete (globalThis as { window?: unknown }).window;
  }
});
