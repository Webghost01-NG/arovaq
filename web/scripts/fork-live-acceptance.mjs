import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

// This runner uses a local Anvil fork and an impersonated account on that fork.
// It never sends a transaction to Monad Mainnet and never loads a private key.
const rpcUrl = 'http://127.0.0.1:8547';
const upstream = 'https://rpc.monad.xyz';
const gameWorld = '0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77';
const items = '0x266ac4b2a21f3bc4a78fc66e6ba43e898a62be8b';
const participant = process.env.AROVAQ_FORK_PARTICIPANT || '0x6CeD8D6Bad8Dfd2e60BCEA116fE74548f959f1F2';
const challenge = process.env.AROVAQ_FORK_CHALLENGE || '0xfd0bc253189f58fb441b135ed4b608bc3a435b84';
const characterId = BigInt(process.env.AROVAQ_FORK_CHARACTER_ID || '65');
const itemId = BigInt(process.env.AROVAQ_FORK_ITEM_ID || '6488');
const anvil = spawn('anvil', [
  '--host', '127.0.0.1', '--port', '8547', '--chain-id', '31338',
  '--fork-url', upstream, '--silent',
], { stdio: 'ignore' });

function cast(args, timeout = 60_000) {
  return execFileSync('cast', [...args, '--rpc-url', rpcUrl], { encoding: 'utf8', timeout }).trim();
}

async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const result = await response.json();
  if (result.error) throw new Error(`${method}: ${result.error.message}`);
  return result.result;
}

async function waitReady() {
  for (let i = 0; i < 160; i++) {
    if (anvil.exitCode !== null) throw new Error('Local Monad fork exited before startup.');
    try {
      if (BigInt(await rpc('eth_chainId')) === 31338n) return;
    } catch { /* Wait for Anvil to finish loading the fork. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for local Monad fork.');
}

function send(to, signature, args = [], value) {
  const tx = ['send', '--unlocked', '--from', participant, to, signature, ...args];
  if (value !== undefined) tx.push('--value', value.toString());
  const output = cast(tx);
  const hash = output.match(/0x[a-fA-F0-9]{64}/)?.[0];
  if (!hash) throw new Error(`Local fork transaction returned no hash: ${signature}`);
  return hash;
}

function read(address, signature, args = []) {
  return cast(['call', address, signature, ...args]);
}

function readBigInt(address, signature, args = []) {
  return BigInt(read(address, signature, args).trim().split(/\s+/)[0]);
}

try {
  await waitReady();
  const baseBlock = BigInt(await rpc('eth_blockNumber'));
  const liveOwner = read(gameWorld, 'ownerOfCharacter(uint256)(address)', [characterId.toString()]);
  const liveLevel = readBigInt(gameWorld, 'characterBestLevel(uint256)(uint32)', [characterId.toString()]);
  const itemOwner = read(items, 'ownerOf(uint256)(address)', [itemId.toString()]);
  const registration = read(challenge, 'registrations(address)(uint256,uint32,uint64,bool,bool)', [participant])
    .split(/\s+/).filter(Boolean);
  const [registeredCharacter, baseline, target, registered, claimed] = registration;

  if (liveOwner.toLowerCase() !== participant.toLowerCase()) throw new Error('Fork character owner does not match the configured participant.');
  if (liveLevel !== 1n || BigInt(registeredCharacter) !== characterId || BigInt(baseline) !== 1n || BigInt(target) !== 2n || registered !== 'true' || claimed !== 'false') {
    throw new Error(`Fork base state does not match the expected registered challenge (character ${characterId}, baseline 1, target 2).`);
  }
  if (itemOwner.toLowerCase() !== participant.toLowerCase()) throw new Error('The fork item is not owned by the configured participant.');

  await rpc('anvil_impersonateAccount', [participant]);
  await rpc('anvil_setBalance', [participant, '0x3635c9adc5dea00000']); // 1,000 local MON; fork only.

  console.log('FORK / SIMULATION — local Anvil writes only; Monad Mainnet remains unchanged.');
  console.log(`Fork base block: ${baseBlock}`);
  console.log(`Real ChainMMO character #${characterId}: owner ${liveOwner}, best level ${liveLevel}`);
  console.log(`Forked Arovaq challenge: ${challenge}; registration baseline ${baseline}, target ${target}`);

  const equipped = BigInt(read(gameWorld, 'equippedItemBySlot(uint256,uint8)(uint256)', [characterId.toString(), '2']));
  if (equipped !== itemId) {
    const tx = send(gameWorld, 'equipItem(uint256,uint256)', [characterId.toString(), itemId.toString()]);
    console.log(`FORK TX equip item #${itemId}: ${tx}`);
  }

  let forkLevel = liveLevel;
  for (let attempt = 1; attempt <= 5 && forkLevel < 2n; attempt++) {
    const secret = `0x${randomBytes(32).toString('hex')}`;
    const nonce = BigInt(attempt);
    const commitId = readBigInt(gameWorld, 'nextCommitId()(uint256)');
    const fee = readBigInt(gameWorld, 'commitFee()(uint256)');
    const hash = read(gameWorld,
      'hashDungeonRun(bytes32,address,uint256,uint64,uint8,uint32,uint8)(bytes32)',
      [secret, participant, characterId.toString(), nonce.toString(), '0', '2', '0']);

    const commitTx = send(gameWorld,
      'commitActionWithVariance(uint256,uint8,bytes32,uint64,uint8)',
      [characterId.toString(), '2', hash, nonce.toString(), '0'], fee,
    );
    await rpc('anvil_mine', ['0x2']);
    const revealTx = send(gameWorld, 'revealStartDungeon(uint256,bytes32,uint8,uint32,uint8)', [
      commitId.toString(), secret, '0', '2', '0',
    ]);
    console.log(`FORK DUNGEON ${attempt}: commit ${commitTx}; reveal ${revealTx}`);

    const potions = `[1,${Array(10).fill(0).join(',')}]`;
    const abilities = `[${Array(11).fill(2).join(',')}]`;
    const resolvedTx = send(gameWorld, 'resolveRooms(uint256,uint8[],uint8[])', [characterId.toString(), potions, abilities]);
    forkLevel = readBigInt(gameWorld, 'characterBestLevel(uint256)(uint32)', [characterId.toString()]);
    console.log(`FORK ROOMS ${attempt}: ${resolvedTx}; best level ${forkLevel}`);
  }

  if (forkLevel < 2n) throw new Error('Local fork gameplay did not reach level 2 within five attempts. No Mainnet state was changed.');
  const claimTx = send(challenge, 'claim(address)', [participant]);
  const successfulClaims = read(challenge, 'successfulClaims()(uint32)');
  const remainingFunding = read(challenge, 'remainingFunding()(uint256)');
  const finalRegistration = read(challenge, 'registrations(address)(uint256,uint32,uint64,bool,bool)', [participant]).split(/\s+/).filter(Boolean);
  if (successfulClaims !== '1' || remainingFunding !== '0' || finalRegistration[4] !== 'true') {
    throw new Error('Local fork claim accounting did not reach the expected terminal state.');
  }
  console.log(`FORK CLAIM: ${claimTx}`);
  console.log(`FORK RESULT: canonical game level ${forkLevel}; Arovaq claim settled; remaining funding ${remainingFunding}.`);
  console.log('This is a fork simulation, not a Monad Mainnet progression or claim.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  anvil.kill('SIGTERM');
}
