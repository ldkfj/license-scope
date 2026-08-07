import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { formatRegistryReadError } from '../src/lib/validation.ts';

test('registry read failures are explicit instead of looking like an empty registry', () => {
  assert.match(formatRegistryReadError(new Error('Rate limit exceeded: 500 requests per hour')), /rate limit reached/i);
  assert.match(formatRegistryReadError(new Error('Failed to fetch')), /Unable to load assessment records/i);

  const page = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  const list = readFileSync(new URL('../src/components/AssessmentList.tsx', import.meta.url), 'utf8');
  assert.match(page, /setAssessmentLoadError\(formatRegistryReadError\(err\)\)/);
  assert.match(list, /loadError && assessments\.length === 0 \? null/);
});

test('connected wallet control exposes explicit change-account and disconnect actions', () => {
  const genlayer = readFileSync(new URL('../src/lib/genlayer.ts', import.meta.url), 'utf8');
  const navbar = readFileSync(new URL('../src/components/Navbar.tsx', import.meta.url), 'utf8');
  const permissionRequest = genlayer.indexOf("method: 'wallet_requestPermissions'");
  const reconnect = genlayer.indexOf('return connectWalletAndVerifyChain(requireSignedSession)', permissionRequest);
  const revoke = genlayer.indexOf("method: 'wallet_revokePermissions'");
  const disconnectReadback = genlayer.indexOf("method: 'eth_accounts'", revoke);
  const signatureRequest = genlayer.indexOf("method: 'personal_sign'");
  assert.ok(permissionRequest >= 0 && reconnect > permissionRequest);
  assert.ok(revoke >= 0 && disconnectReadback > revoke);
  assert.ok(signatureRequest >= 0);
  assert.match(genlayer, /sessionStorage\.setItem\(WALLET_DISCONNECTED_KEY, '1'\)/);
  assert.match(genlayer, /sessionStorage\.setItem\(WALLET_SIGNED_ACCOUNT_KEY, account\.toLowerCase\(\)\)/);
  assert.match(genlayer, /Connect and sign with your wallet from the LicenseScope header first/);
  assert.match(genlayer, /Wallet is disconnected in LicenseScope/);
  assert.match(navbar, /allowBrowserWalletConnection\(\)/);
  assert.match(navbar, /await signBrowserWalletConnection\(account\)/);
  assert.match(navbar, /role="menu"/);
  assert.match(navbar, />\s*Change account\s*</);
  assert.match(navbar, />\s*Disconnect\s*</);
});
