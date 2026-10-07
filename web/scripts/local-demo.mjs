import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeDeployData, encodeFunctionData } from 'viem';

const webDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repoDir = resolve(webDir, '..');
const rpcUrl = 'http://127.0.0.1:8545';
const anvil = spawn('anvil', ['--host', '127.0.0.1', '--port', '8545', '--chain-id', '31337', '--silent'], { stdio: 'ignore' });
let stopped = false;
const stop = () => { if (!stopped) { stopped = true; anvil.kill('SIGTERM'); } };
process.on('SIGINT', () => { stop(); process.exit(130); });
process.on('SIGTERM', () => { stop(); process.exit(143); });

async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await response.json();
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}
async function waitForAnvil() {
  for (let i = 0; i < 100; i++) {
    if (anvil.exitCode !== null) throw new Error('Anvil exited before startup.');
    try { if (await rpc('eth_chainId') === '0x7a69') return; } catch { /* wait for RPC */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Timed out waiting for local Anvil.');
}
async function artifact(path) {
  return JSON.parse(await readFile(resolve(repoDir, 'out', path), 'utf8'));
}
async function send(from, data, value = '0x0', to) {
  const hash = await rpc('eth_sendTransaction', [{ from, ...(to ? { to } : {}), data, value, gas: '0x1c9c380' }]);
  for (let i = 0; i < 100; i++) {
    const receipt = await rpc('eth_getTransactionReceipt', [hash]);
    if (receipt) {
      if (receipt.status !== '0x1') {
        const trace = await rpc('debug_traceTransaction', [hash, {}]).catch(() => null);
        throw new Error(`Local transaction reverted: ${hash}${trace?.returnValue ? ` (return ${trace.returnValue})` : ''}`);
      }
      return receipt;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${hash}`);
}

try {
  await waitForAnvil();
  const accounts = await rpc('eth_accounts');
  const gameArtifact = await artifact('MockMonotonicGame.sol/MockMonotonicGame.json');
  const factoryArtifact = await artifact('ArovaqFactory.sol/ArovaqFactory.json');
  console.log('Deploying local ChainMMO fixture…');
  const gameData = encodeDeployData({ abi: gameArtifact.abi, bytecode: gameArtifact.bytecode.object });
  const gameReceipt = await send(accounts[0], gameData);
  const game = gameReceipt.contractAddress;
  console.log('Seeding local character #42…');
  const seedData = encodeFunctionData({ abi: gameArtifact.abi, functionName: 'seed', args: [42n, accounts[1], 17, 0] });
  await send(accounts[0], seedData, '0x0', game);
  console.log('Deploying accepted ArovaqFactory/profile contracts…');
  const factoryData = encodeDeployData({ abi: factoryArtifact.abi, bytecode: factoryArtifact.bytecode.object, args: [game] });
  const factoryReceipt = await send(accounts[0], factoryData);
  const factory = factoryReceipt.contractAddress;
  await writeFile(resolve(webDir, '.env.local'), [
    'VITE_AROVAQ_ENV=LOCAL', 'VITE_RPC_URL=http://127.0.0.1:8545',
    `VITE_FACTORY_ADDRESS=${factory}`, `VITE_GAME_WORLD_ADDRESS=${game}`,
    `VITE_FACTORY_START_BLOCK=${BigInt(factoryReceipt.blockNumber)}`, '',
  ].join('\n'));
  console.log('LOCAL / DEMO CHAIN READY');
  console.log(`RPC: ${rpcUrl} (chain ID 31337)`);
  console.log(`Factory: ${factory}`);
  console.log(`Fixture GameWorld: ${game}`);
  console.log(`Seeded character: #42, owner ${accounts[1]}, canonical baseline 17`);
  console.log('Anvil accounts are local test accounts. No external transactions or funds are used.');
  console.log('Keep this process running; start the frontend in another terminal with npm run dev.');
  await new Promise(resolve => anvil.once('exit', resolve));
} catch (error) {
  stop();
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
