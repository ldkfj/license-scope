import test from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';

import {
  connectWalletAndVerifyChain,
  invalidateBrowserWalletConnectionSignature,
  isBrowserWalletConnectionSigned,
  signBrowserWalletConnection,
  suppressBrowserWalletConnection,
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
  try {
    await run();
  } finally {
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
