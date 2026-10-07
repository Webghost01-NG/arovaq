import {
  createPublicClient, createWalletClient, custom, http, parseEther, type Address,
  type EIP1193Provider, type Hash,
} from 'viem';
import { chain, config, MAINNET_PENDING } from '../config/environment';
import { factoryAbi, challengeAbi, profileAbi, gameWorldAbi, localGameAbi } from '../generated/abis';

export type WalletState = { address: Address; provider: EIP1193Provider };
export type Registration = {
  characterId: bigint; baseline: number; target: bigint; registered: boolean; claimed: boolean;
};
export type Challenge = {
  address: Address; creator: Address; profile: Address; delta: number;
  reward: bigint; cap: number; deadline: bigint; claimed: number; remainingFunding: bigint;
  fundsReclaimed: boolean;
};

export const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });
export const requireFactory = (): Address => {
  if (!config.factory) throw new Error(config.mode === 'MONAD_MAINNET' ? MAINNET_PENDING : 'Local Arovaq deployment is not configured. Run npm run demo:local.');
  return config.factory;
};
export const requireGame = (): Address => {
  if (!config.gameWorld) throw new Error('GameWorld address is not configured.');
  return config.gameWorld;
};

export async function assertNetwork(wallet: WalletState): Promise<void> {
  const actual = Number(await wallet.provider.request({ method: 'eth_chainId' }));
  if (actual !== config.chainId) throw new Error(`Wrong network. Switch wallet to ${config.label} (chain ${config.chainId}).`);
  const rpcChain = await publicClient.getChainId();
  if (rpcChain !== config.chainId) throw new Error(`RPC returned chain ${rpcChain}; expected ${config.chainId}.`);
}
export async function connectWallet(): Promise<WalletState> {
  const provider = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
  if (!provider) throw new Error('No wallet found. Install a browser wallet or use the local demo provider.');
  const accounts = await provider.request({ method: 'eth_requestAccounts' }) as Address[];
  if (!accounts.length) throw new Error('No wallet account available.');
  return { address: accounts[0], provider };
}
export async function switchNetwork(wallet: WalletState): Promise<void> {
  await wallet.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${config.chainId.toString(16)}` }] });
  await assertNetwork(wallet);
}
async function writer(wallet: WalletState) {
  await assertNetwork(wallet);
  if (!config.writable) {
    if (config.mode === 'MONAD_MAINNET' && !config.factory) throw new Error(MAINNET_PENDING);
    if (config.mode === 'MONAD_MAINNET') throw new Error('Mainnet writes are disabled in this build.');
    throw new Error('Local deployment is not configured.');
  }
  return createWalletClient({ account: wallet.address, chain, transport: custom(wallet.provider) });
}
export async function waitForConfirmation(hash: Hash) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('Transaction reverted. No completion was recorded.');
  return receipt;
}
export async function discoverChallenges(): Promise<Address[]> {
  const logs = await publicClient.getContractEvents({
    address: requireFactory(), abi: factoryAbi, eventName: 'ChallengeCreated',
    fromBlock: config.factoryStartBlock, toBlock: 'latest',
  });
  return logs.map((log) => log.args.challenge).filter((x): x is Address => Boolean(x)).reverse();
}
export async function getChallenge(address: Address): Promise<Challenge> {
  const [creator, profile, delta, reward, cap, deadline, claimed, remainingFunding, fundsReclaimed] = await Promise.all([
    publicClient.readContract({ address, abi: challengeAbi, functionName: 'creator' }),
    publicClient.readContract({ address, abi: challengeAbi, functionName: 'profile' }),
    publicClient.readContract({ address, abi: challengeAbi, functionName: 'levelDelta' }),
    publicClient.readContract({ address, abi: challengeAbi, functionName: 'rewardPerSuccess' }),
    publicClient.readContract({ address, abi: challengeAbi, functionName: 'maxSuccessfulClaims' }),
    publicClient.readContract({ address, abi: challengeAbi, functionName: 'deadline' }),
    publicClient.readContract({ address, abi: challengeAbi, functionName: 'successfulClaims' }),
    publicClient.readContract({ address, abi: challengeAbi, functionName: 'remainingFunding' }),
    publicClient.readContract({ address, abi: challengeAbi, functionName: 'fundsReclaimed' }),
  ]);
  const game = await publicClient.readContract({ address: profile, abi: profileAbi, functionName: 'gameWorld' });
  if (game.toLowerCase() !== requireGame().toLowerCase()) throw new Error('Challenge profile targets a different game contract.');
  return { address, creator, profile, delta, reward, cap, deadline, claimed, remainingFunding, fundsReclaimed };
}
export async function getRegistration(challenge: Address, player: Address): Promise<Registration> {
  const [characterId, baseline, target, registered, claimed] = await publicClient.readContract({ address: challenge, abi: challengeAbi, functionName: 'registrations', args: [player] });
  return { characterId, baseline, target, registered, claimed };
}
export async function getCharacter(characterId: bigint) {
  const address = requireGame();
  const [owner, bestLevel, lastLevelUpEpoch] = await Promise.all([
    publicClient.readContract({ address, abi: gameWorldAbi, functionName: 'ownerOfCharacter', args: [characterId] }),
    publicClient.readContract({ address, abi: gameWorldAbi, functionName: 'characterBestLevel', args: [characterId] }),
    publicClient.readContract({ address, abi: gameWorldAbi, functionName: 'characterLastLevelUpEpoch', args: [characterId] }),
  ]);
  return { owner, bestLevel, lastLevelUpEpoch };
}
export async function getTotalCharacters() {
  return publicClient.readContract({ address: requireGame(), abi: gameWorldAbi, functionName: 'totalCharacters' });
}
export async function createChallenge(wallet: WalletState, input: { delta: number; rewardMon: string; cap: number; deadline: bigint }): Promise<Hash> {
  const reward = parseEther(input.rewardMon);
  const client = await writer(wallet);
  const request = await publicClient.simulateContract({ address: requireFactory(), abi: factoryAbi, functionName: 'createChallenge', args: [input.delta, reward, input.cap, input.deadline], account: wallet.address, value: reward * BigInt(input.cap) });
  return client.writeContract(request.request);
}
export async function registerCharacter(wallet: WalletState, challenge: Address, id: bigint): Promise<Hash> {
  const client = await writer(wallet);
  const request = await publicClient.simulateContract({ address: challenge, abi: challengeAbi, functionName: 'register', args: [id], account: wallet.address });
  return client.writeContract(request.request);
}
export async function claimReward(wallet: WalletState, challenge: Address): Promise<Hash> {
  const client = await writer(wallet);
  const request = await publicClient.simulateContract({ address: challenge, abi: challengeAbi, functionName: 'claim', args: [wallet.address], account: wallet.address });
  return client.writeContract(request.request);
}
export async function reclaimExpired(wallet: WalletState, challenge: Address): Promise<Hash> {
  const client = await writer(wallet);
  const request = await publicClient.simulateContract({ address: challenge, abi: challengeAbi, functionName: 'reclaimExpired', args: [wallet.address], account: wallet.address });
  return client.writeContract(request.request);
}
export async function demoProgress(wallet: WalletState, id: bigint, newLevel: number): Promise<Hash> {
  if (config.mode !== 'LOCAL') throw new Error('Fixture progression is available only in LOCAL mode.');
  const client = await writer(wallet);
  const request = await publicClient.simulateContract({ address: requireGame(), abi: localGameAbi, functionName: 'progress', args: [id, newLevel, Math.floor(Date.now() / 1000)], account: wallet.address });
  return client.writeContract(request.request);
}
