import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import type { ArtifactKind, AssessmentStatus, UseProfile } from './validation';

export {
  assertSameAssessmentIdentity,
  assertTerminalRecord,
  parseAssessmentRecord,
  validateGenLayerReceipt,
} from './validation';
export type {
  ArtifactKind,
  AssessmentRecord,
  AssessmentStatus,
  MatchTriState,
  UseProfile,
} from './validation';

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';
export const STUDIONET_RPC_URL = 'https://studio.genlayer.com/api';
export const STUDIONET_CHAIN_ID = 61999; // 0xf22f
export const POLICY_VERSION = 'LS-V1';
export const POLICY_HASH = 'sha256:1105b19ea7786bbd5ace24445845997e914e726cd2f80ddf83d8a6f8f8769532';
export const STUDIONET_EXPLORER_BASE = 'https://explorer-studio.genlayer.com/';

export interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

export const isContractConfigured = (): boolean => {
  return (
    typeof CONTRACT_ADDRESS === 'string' &&
    /^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS.trim())
  );
};

export const getExplorerTxLink = (txHash: string | null): string | null => {
  if (!isContractConfigured() || !txHash) return null;
  const clean = txHash.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(clean)) {
    return `${STUDIONET_EXPLORER_BASE}tx/${clean}`;
  }
  return null;
};

export const getClient = (accountAddress?: string) => {
  const ethereum =
    typeof window !== 'undefined'
      ? (window as unknown as { ethereum?: EthereumProvider }).ethereum
      : undefined;

  return createClient({
    chain: studionet,
    endpoint: STUDIONET_RPC_URL,
    ...(ethereum ? { provider: ethereum } : {}),
    ...(accountAddress ? { account: accountAddress as `0x${string}` } : {}),
  });
};

export const ARTIFACT_KINDS: ArtifactKind[] = ['GITHUB_REPO', 'HF_MODEL', 'HF_DATASET'];

export const USE_PROFILES: { id: UseProfile; label: string; desc: string }[] = [
  { id: 'INTERNAL_RESEARCH', label: 'Internal Research', desc: 'Non-commercial evaluation and benchmarking' },
  { id: 'COMMERCIAL_INFERENCE', label: 'Commercial Inference', desc: 'Deploying model/repo for commercial query serving' },
  { id: 'COMMERCIAL_REDISTRIBUTION', label: 'Commercial Redistribution', desc: 'Selling or re-licensing packaged artifacts' },
  { id: 'COMMERCIAL_MODEL_TRAINING', label: 'Commercial Model Training', desc: 'Fine-tuning or pre-training commercial AI models' },
];

export const STATUS_MAP: Record<number, { name: AssessmentStatus; badgeClass: string }> = {
  1: { name: 'PENDING', badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  2: { name: 'ALLOW', badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  3: { name: 'CONDITIONAL', badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  4: { name: 'BLOCK', badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  5: { name: 'UNRESOLVED', badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
};

export async function connectWalletAndVerifyChain(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('Window environment undefined.');
  }

  const ethereum = (window as unknown as { ethereum?: EthereumProvider }).ethereum;

  if (!ethereum) {
    throw new Error('MetaMask or Compatible Web3 Wallet is not installed in browser.');
  }

  const accounts = (await ethereum.request({
    method: 'eth_requestAccounts',
  })) as string[];

  if (!accounts || accounts.length === 0) {
    throw new Error('No Web3 wallet account authorized.');
  }

  const chainIdHex = (await ethereum.request({
    method: 'eth_chainId',
  })) as string;

  const chainIdNum = parseInt(chainIdHex, 16);

  if (chainIdNum !== STUDIONET_CHAIN_ID) {
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${STUDIONET_CHAIN_ID.toString(16)}` }],
      });
    } catch {
      throw new Error(`Please switch Web3 wallet network to GenLayer Studionet (Chain ID ${STUDIONET_CHAIN_ID}).`);
    }

    const recheckHex = (await ethereum.request({
      method: 'eth_chainId',
    })) as string;

    if (parseInt(recheckHex, 16) !== STUDIONET_CHAIN_ID) {
      throw new Error(`Network switch failed. Connected chain ID remains different from Studionet (${STUDIONET_CHAIN_ID}).`);
    }
  }

  return accounts[0];
}
