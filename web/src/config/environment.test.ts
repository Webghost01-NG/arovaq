import { describe, expect, it } from 'vitest';
import { CHAINMMO_GAME_WORLD, MAINNET_PENDING, resolveConfig } from './environment';

describe('deployment environment configuration', () => {
  it('keeps Mainnet Arovaq addresses unset until deployment', () => {
    const resolved = resolveConfig({ VITE_AROVAQ_ENV: 'MONAD_MAINNET' });
    expect(resolved.chainId).toBe(143);
    expect(resolved.factory).toBeUndefined();
    expect(resolved.writable).toBe(false);
    expect(resolved.gameWorld).toBe(CHAINMMO_GAME_WORLD);
    expect(MAINNET_PENDING).toBe('Arovaq Mainnet deployment is not configured in this build.');
  });

  it.each([
    ['LOCAL', '31337', '8545'], ['FORK', '31338', '8546'],
  ])('resolves %s only to its loopback development RPC', (mode, chainId, port) => {
    const resolved = resolveConfig({ VITE_AROVAQ_ENV: mode });
    expect(resolved.chainId).toBe(Number(chainId));
    expect(resolved.rpcUrl).toContain(`127.0.0.1:${port}`);
    expect(resolved.writable).toBe(false);
  });

  it('rejects a remote write RPC in local mode', () => {
    expect(() => resolveConfig({ VITE_AROVAQ_ENV: 'LOCAL', VITE_RPC_URL: 'https://rpc.example' }))
      .toThrow(/only permits loopback RPC/);
  });

  it('never substitutes local factory addresses when Mainnet is selected', () => {
    const resolved = resolveConfig({ VITE_AROVAQ_ENV: 'MONAD_MAINNET', VITE_FACTORY_ADDRESS: '0x0000000000000000000000000000000000000001' });
    expect(resolved.factory).toBe('0x0000000000000000000000000000000000000001');
    expect(resolved.chainId).toBe(143);
    expect(resolved.writable).toBe(false);
    expect(resolveConfig({
      VITE_AROVAQ_ENV: 'MONAD_MAINNET',
      VITE_FACTORY_ADDRESS: '0x0000000000000000000000000000000000000001',
      VITE_ENABLE_MAINNET_WRITES: 'true',
    }).writable).toBe(true);
  });
});
