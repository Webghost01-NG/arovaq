import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assertNetwork: vi.fn(async () => {}),
  claimReward: vi.fn(),
  connectWallet: vi.fn(async () => ({ address: '0x0000000000000000000000000000000000000001', provider: { request: vi.fn() } })),
  createChallenge: vi.fn(async () => `0x${'1'.repeat(64)}`),
  demoProgress: vi.fn(),
  discoverChallenges: vi.fn(),
  getCanonicalTimestamp: vi.fn(async () => 1_000_000n),
  getChallenge: vi.fn(async () => ({
    address: '0x0000000000000000000000000000000000000002',
    creator: '0x0000000000000000000000000000000000000001',
    profile: '0x0000000000000000000000000000000000000003',
    delta: 3,
    reward: 1_000_000_000_000_000_000n,
    cap: 10,
    deadline: 1_604_800n,
    claimed: 0,
    remainingFunding: 10_000_000_000_000_000_000n,
    fundsReclaimed: false,
  })),
  getCharacter: vi.fn(),
  getRegistration: vi.fn(),
  getTotalCharacters: vi.fn(async () => 65n),
  reclaimExpired: vi.fn(),
  registerCharacter: vi.fn(),
  switchNetwork: vi.fn(),
  waitForConfirmation: vi.fn(async () => ({ status: 'success' })),
}));

vi.mock('../config/environment', () => ({
  config: {
    mode: 'LOCAL', rpcUrl: 'http://127.0.0.1:8545', chainId: 31337,
    factory: '0x0000000000000000000000000000000000000004',
    gameWorld: '0x0000000000000000000000000000000000000005',
    factoryStartBlock: 0n, writable: true, label: 'LOCAL / DEMO',
  },
  MAINNET_PENDING: 'Arovaq Mainnet deployment is not configured in this build.',
}));

vi.mock('../lib/clients', () => ({
  ...mocks,
  publicClient: { getChainId: vi.fn(async () => 31337), getBlockNumber: vi.fn(async () => 1n) },
}));

import App from './App';

afterEach(() => { vi.clearAllMocks(); });

describe('competition discovery refresh ordering', () => {
  it('does not let an older initial scan erase a newly created challenge', async () => {
    let finishInitialScan!: (addresses: `0x${string}`[]) => void;
    mocks.discoverChallenges
      .mockImplementationOnce(() => new Promise(resolve => { finishInitialScan = resolve; }))
      .mockResolvedValueOnce(['0x0000000000000000000000000000000000000002']);

    render(<App />);
    await waitFor(() => expect(mocks.discoverChallenges).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'CONNECT WALLET' }));
    await screen.findByRole('button', { name: /Disconnect wallet/ });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    fireEvent.click(await screen.findByRole('button', { name: /CREATE & FUND CHALLENGE/ }));

    const event = await screen.findByRole('button', { name: /EVENT \/ 01/ });
    expect(mocks.discoverChallenges).toHaveBeenCalledTimes(2);

    await act(async () => { finishInitialScan([]); });
    expect(event).toBeInTheDocument();
  }, 15_000);
});
