import { defineChain, type Address } from 'viem';
import { CHAINMMO_CHAIN_ID, CHAINMMO_GAME_WORLD } from './chainmmo';

export { CHAINMMO_GAME_WORLD } from './chainmmo';

export type Mode = 'LOCAL' | 'FORK' | 'MONAD_MAINNET';
export type AppConfig = {
  mode: Mode;
  rpcUrl: string;
  chainId: number;
  factory?: Address;
  gameWorld?: Address;
  factoryStartBlock: bigint;
  writable: boolean;
  label: string;
};

export const MAINNET_PENDING = 'Arovaq Mainnet deployment is not configured in this build.';
const address = (value?: string): Address | undefined =>
  value && /^0x[a-fA-F0-9]{40}$/.test(value) ? value as Address : undefined;

export function resolveConfig(env: Record<string, string | undefined>): AppConfig {
  const mode = env.VITE_AROVAQ_ENV || 'MONAD_MAINNET';
  if (mode === 'MONAD_MAINNET') {
    // Deliberately no mainnet factory fallback. ChainMMO and Arovaq have separate lifecycles.
    return {
      mode, rpcUrl: env.VITE_RPC_URL || 'https://rpc.monad.xyz', chainId: CHAINMMO_CHAIN_ID,
      factory: address(env.VITE_FACTORY_ADDRESS), gameWorld: CHAINMMO_GAME_WORLD,
      factoryStartBlock: BigInt(env.VITE_FACTORY_START_BLOCK || '0'),
      writable: Boolean(address(env.VITE_FACTORY_ADDRESS)) && env.VITE_ENABLE_MAINNET_WRITES === 'true', label: 'MONAD MAINNET',
    };
  }
  if (mode !== 'LOCAL' && mode !== 'FORK') throw new Error(`Unsupported Arovaq environment: ${mode}`);
  const expectedChain = mode === 'LOCAL' ? 31337 : 31338;
  const rpcUrl = env.VITE_RPC_URL || `http://127.0.0.1:${mode === 'LOCAL' ? '8545' : '8546'}`;
  const url = new URL(rpcUrl);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error(`${mode} mode only permits loopback RPC; refusing remote write environment.`);
  }
  return {
    mode, rpcUrl, chainId: expectedChain, factory: address(env.VITE_FACTORY_ADDRESS),
    gameWorld: mode === 'FORK' ? CHAINMMO_GAME_WORLD : address(env.VITE_GAME_WORLD_ADDRESS),
    factoryStartBlock: BigInt(env.VITE_FACTORY_START_BLOCK || '0'),
    writable: Boolean(address(env.VITE_FACTORY_ADDRESS)), label: mode === 'FORK' ? 'FORK / SIMULATION' : 'LOCAL / DEMO',
  };
}

export const config = resolveConfig(import.meta.env as Record<string, string | undefined>);
export const chain = defineChain({
  id: config.chainId,
  name: config.label,
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [config.rpcUrl] } },
});
