import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { decodeEventLog, formatEther, parseAbiItem } from 'viem';

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
const simulationLabel = 'LOCAL FORK SIMULATION — NOT MAINNET';
const say = (message) => console.log(`[${simulationLabel}] ${message}`);
const rewardClaimedEvent = parseAbiItem('event RewardClaimed(address indexed participant,address indexed recipient,uint256 amount,uint256 characterId)');
const anvil = spawn('anvil', [
  '--host', '127.0.0.1', '--port', '8547', '--chain-id', '31338',
  '--fork-url', upstream, '--silent',
], { stdio: 'ignore' });

function cast(args, timeout = 60_000) {
  return execFileSync('cast', [...args, '--rpc-url', rpcUrl], {
    encoding: 'utf8', timeout,
    env: { ...process.env, FOUNDRY_DISABLE_NIGHTLY_WARNING: 'true' },
  }).trim();
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

async function waitForReceipt(hash) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const receipt = await rpc('eth_getTransactionReceipt', [hash]);
    if (receipt) return receipt;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return null;
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

async function send(to, signature, args = [], value) {
  const tx = ['send', '--async', '--unlocked', '--from', participant, to, signature, ...args];
  if (value !== undefined) tx.push('--value', value.toString());
  const output = cast(tx);
  const hash = output.match(/0x[a-fA-F0-9]{64}/)?.[0];
  if (!hash) throw new Error(`Local fork transaction returned no hash: ${signature}`);
  const receipt = await waitForReceipt(hash);
  if (!receipt) throw new Error(`Local fork transaction has no receipt: ${signature} (${hash})`);
  if (receipt.status !== '0x1') throw new Error(`Local fork transaction reverted: ${signature} (${hash})`);
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
  const reward = readBigInt(challenge, 'rewardPerSuccess()(uint256)');

  if (liveOwner.toLowerCase() !== participant.toLowerCase()) throw new Error('Fork character owner does not match the configured participant.');
  if (liveLevel !== 1n || BigInt(registeredCharacter) !== characterId || BigInt(baseline) !== 1n || BigInt(target) !== 2n || registered !== 'true' || claimed !== 'false') {
    throw new Error(`Fork base state does not match the expected registered challenge (character ${characterId}, baseline 1, target 2).`);
  }
  if (itemOwner.toLowerCase() !== participant.toLowerCase()) throw new Error('The fork item is not owned by the configured participant.');

  await rpc('anvil_impersonateAccount', [participant]);
  await rpc('anvil_setBalance', [participant, '0x3635c9adc5dea00000']); // 1,000 local MON; fork only.

  say('LOCAL ANVIL WRITES ONLY; MONAD MAINNET REMAINS UNCHANGED.');
  say(`Fork base block: ${baseBlock}`);
  say(`ChainMMO character #${characterId}: owner ${liveOwner}, best level ${liveLevel}`);
  say(`Arovaq challenge: ${challenge}; registered baseline ${baseline}, target ${target}; reward ${formatEther(reward)} MON`);

  const equipped = BigInt(read(gameWorld, 'equippedItemBySlot(uint256,uint8)(uint256)', [characterId.toString(), '2']));
  if (equipped !== itemId) {
    const tx = await send(gameWorld, 'equipItem(uint256,uint256)', [characterId.toString(), itemId.toString()]);
    say(`Equip item #${itemId} (fork transaction): ${tx}`);
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

    const commitTx = await send(gameWorld,
      'commitActionWithVariance(uint256,uint8,bytes32,uint64,uint8)',
      [characterId.toString(), '2', hash, nonce.toString(), '0'], fee,
    );
    await rpc('anvil_mine', ['0x2']);
    const revealTx = await send(gameWorld, 'revealStartDungeon(uint256,bytes32,uint8,uint32,uint8)', [
      commitId.toString(), secret, '0', '2', '0',
    ]);
    say(`Dungeon attempt ${attempt}: commit ${commitTx}; reveal ${revealTx}`);

    const potions = `[1,${Array(10).fill(0).join(',')}]`;
    const abilities = `[${Array(11).fill(2).join(',')}]`;
    const resolvedTx = await send(gameWorld, 'resolveRooms(uint256,uint8[],uint8[])', [characterId.toString(), potions, abilities]);
    forkLevel = readBigInt(gameWorld, 'characterBestLevel(uint256)(uint32)', [characterId.toString()]);
    say(`Dungeon resolved ${attempt}: ${resolvedTx}; canonical fork best level ${forkLevel}`);
  }

  if (forkLevel < 2n) throw new Error('Local fork gameplay did not reach level 2 within five attempts. No Mainnet state was changed.');
  const claimTx = await send(challenge, 'claim(address)', [participant]);
  const receipt = await waitForReceipt(claimTx);
  if (!receipt) throw new Error('Fork claim transaction has no local receipt.');
  const payout = receipt.logs
    .filter(log => log.address.toLowerCase() === challenge.toLowerCase())
    .map(log => {
      try { return decodeEventLog({ abi: [rewardClaimedEvent], data: log.data, topics: log.topics }); }
      catch { return undefined; }
    })
    .find(log => log?.eventName === 'RewardClaimed');
  const successfulClaims = read(challenge, 'successfulClaims()(uint32)');
  const remainingFunding = read(challenge, 'remainingFunding()(uint256)');
  const finalRegistration = read(challenge, 'registrations(address)(uint256,uint32,uint64,bool,bool)', [participant]).split(/\s+/).filter(Boolean);
  const challengeBalance = BigInt(await rpc('eth_getBalance', [challenge, 'latest']));
  if (
    receipt.status !== '0x1' || !payout || payout.args.participant.toLowerCase() !== participant.toLowerCase()
      || payout.args.recipient.toLowerCase() !== participant.toLowerCase() || payout.args.amount !== reward
      || successfulClaims !== '1' || remainingFunding !== '0' || finalRegistration[4] !== 'true'
      || challengeBalance !== 0n
  ) {
    throw new Error('Local fork claim accounting did not reach the expected terminal state.');
  }
  say(`Arovaq claim (fork transaction): ${claimTx}; receipt status ${receipt.status}; gas used ${BigInt(receipt.gasUsed).toString()}`);
  say(`VERIFIED FORK RESULT: canonical best level ${forkLevel}; registration claimed ${finalRegistration[4]}; payout ${formatEther(payout.args.amount)} MON to ${payout.args.recipient}; successful claims ${successfulClaims}; remaining reward funding ${remainingFunding}; challenge balance ${challengeBalance}.`);
} catch (error) {
  console.error(`[${simulationLabel}] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  anvil.kill('SIGTERM');
}
