import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, encodeDeployData, http } from 'viem';

const webDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repoDir = resolve(webDir, '..');
const rpcUrl = 'http://127.0.0.1:8546';
const upstream = 'https://rpc.monad.xyz';
const gameWorld = '0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77';
const anvil = spawn('anvil', ['--host', '127.0.0.1', '--port', '8546', '--chain-id', '31338', '--fork-url', upstream, '--silent'], { stdio: 'ignore' });
let stopped = false;
const stop = () => { if (!stopped) { stopped = true; anvil.kill('SIGTERM'); } };
process.on('SIGINT', () => { stop(); process.exit(130); });
process.on('SIGTERM', () => { stop(); process.exit(143); });

async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const result = await response.json();
  if (result.error) throw new Error(`${method}: ${result.error.message}`);
  return result.result;
}
async function ready() {
  for (let i = 0; i < 200; i++) {
    if (anvil.exitCode !== null) throw new Error('Forked Anvil exited before startup.');
    try { if (BigInt(await rpc('eth_chainId')) === 31338n) return; } catch { /* wait for upstream fork state */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for Monad fork.');
}
async function send(from, data) {
  const hash = await rpc('eth_sendTransaction', [{ from, data, gas: '0x1c9c380' }]);
  for (let i = 0; i < 100; i++) {
    const receipt = await rpc('eth_getTransactionReceipt', [hash]);
    if (receipt) {
      if (receipt.status !== '0x1') throw new Error(`Fork deployment reverted: ${hash}`);
      return receipt;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for fork transaction ${hash}`);
}

try {
  await ready();
  const forkBaseBlock = BigInt(await rpc('eth_blockNumber'));
  const [account] = await rpc('eth_accounts');
  const artifact = JSON.parse(await readFile(resolve(repoDir, 'out/ArovaqFactory.sol/ArovaqFactory.json'), 'utf8'));
  const gameAbi = JSON.parse(await readFile(resolve(repoDir, 'out/IChainMMOGameWorld.sol/IChainMMOGameWorld.json'), 'utf8')).abi;
  const client = createPublicClient({ transport: http(rpcUrl) });
  const data = encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode.object, args: [gameWorld] });
  const receipt = await send(account, data);
  const factory = receipt.contractAddress;
  const profile = await client.readContract({ address: factory, abi: artifact.abi, functionName: 'profile' });
  const profileArtifact = JSON.parse(await readFile(resolve(repoDir, 'out/ChainMMOProgressionProfile.sol/ChainMMOProgressionProfile.json'), 'utf8'));
  const [total, character] = await Promise.all([
    client.readContract({ address: gameWorld, abi: gameAbi, functionName: 'totalCharacters' }),
    client.readContract({ address: profile, abi: profileArtifact.abi, functionName: 'readCharacter', args: [42n] }),
  ]);
  const block = await rpc('eth_blockNumber');
  await writeFile(resolve(webDir, '.env.local'), [
    'VITE_AROVAQ_ENV=FORK', `VITE_RPC_URL=${rpcUrl}`,
    `VITE_FACTORY_ADDRESS=${factory}`, `VITE_FACTORY_START_BLOCK=${BigInt(receipt.blockNumber)}`, '',
  ].join('\n'));
  console.log('FORK / SIMULATION READY');
  console.log(`Local chain ID: 31338; fork state block: ${BigInt(block).toString()}`);
  console.log(`Fork snapshot base block: ${forkBaseBlock.toString()}`);
  console.log(`Local ArovaqFactory: ${factory}`);
  console.log(`Foreign ChainMMO GameWorld: ${gameWorld}`);
  console.log(`Arovaq profile read totalCharacters: ${total.toString()}`);
  console.log(`Arovaq profile read character #42: owner ${character[0]}, best level ${character[1]}, last-level-up epoch ${character[2]}`);
  console.log('Arovaq writes are local fork simulations. No Monad Mainnet transaction was sent.');
  console.log('Keep this process running; start the frontend in another terminal with npm run dev.');
  await new Promise(resolve => anvil.once('exit', resolve));
} catch (error) {
  stop();
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
