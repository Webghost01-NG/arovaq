import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../config/environment';
import App from './App';

afterEach(() => {
  cleanup();
  delete (window as Window & { ethereum?: unknown }).ethereum;
  vi.restoreAllMocks();
});

describe('deployment-pending experience', () => {
  it('makes missing Mainnet deployment explicit and keeps ChainMMO reads discoverable', () => {
    render(<App />);
    if (config.mode === 'MONAD_MAINNET' && !config.factory) {
      expect(screen.getByText(/MAINNET DEPLOYMENT PENDING/)).toBeInTheDocument();
      expect(screen.getByText(/Arovaq Mainnet deployment is not configured in this build\./)).toBeInTheDocument();
    } else {
      expect(screen.getAllByText(config.label).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('button', { name: /CREATE A CHALLENGE/i })).toBeInTheDocument();
    if (config.mode === 'MONAD_MAINNET') expect(screen.getByText(/EXTERNAL WORLD \/ LIVE READ/)).toBeInTheDocument();
  });

  it('shows a wrong-network state after wallet connection', async () => {
    Object.defineProperty(window, 'ethereum', {
      configurable: true,
      value: { request: vi.fn(async ({ method }: { method: string }) => method === 'eth_requestAccounts' ? ['0x0000000000000000000000000000000000000001'] : '0x1') },
    });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'CONNECT WALLET' }));
    await waitFor(() => expect(screen.getByText(`Wallet network does not match ${config.label}.`)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'SWITCH NETWORK' })).toBeInTheDocument();
  });
});
