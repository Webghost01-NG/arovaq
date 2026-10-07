import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const destination = resolve(root, 'web/src/generated/abis.ts');
const contracts = [
  {
    name: 'factoryAbi', artifact: 'ArovaqFactory.sol/ArovaqFactory.json',
    functions: ['createChallenge', 'profile'], events: ['ChallengeCreated'],
  },
  {
    name: 'challengeAbi', artifact: 'ArovaqProgressionChallenge.sol/ArovaqProgressionChallenge.json',
    functions: ['creator', 'profile', 'levelDelta', 'rewardPerSuccess', 'maxSuccessfulClaims',
      'deadline', 'successfulClaims', 'remainingFunding', 'fundsReclaimed', 'registrations',
      'characterParticipant', 'register', 'readCurrent', 'claim', 'reclaimExpired'],
    events: ['Registered', 'RewardClaimed', 'ExpiredFundsReclaimed'],
  },
  {
    name: 'profileAbi', artifact: 'ChainMMOProgressionProfile.sol/ChainMMOProgressionProfile.json',
    functions: ['gameWorld', 'readCharacter', 'readProgression'], events: [],
  },
  {
    name: 'gameWorldAbi', artifact: 'IChainMMOGameWorld.sol/IChainMMOGameWorld.json',
    functions: ['totalCharacters', 'ownerOfCharacter', 'characterBestLevel', 'characterLastLevelUpEpoch'],
    events: [],
  },
  {
    name: 'localGameAbi', artifact: 'MockMonotonicGame.sol/MockMonotonicGame.json',
    functions: ['seed', 'progress', 'ownerOfCharacter', 'characterBestLevel',
      'characterLastLevelUpEpoch', 'totalCharacters'], events: [],
  },
];

const exports = contracts.map(({ name, artifact, functions, events }) => {
  const path = resolve(root, 'out', artifact);
  const abi = JSON.parse(readFileSync(path, 'utf8')).abi;
  for (const fn of functions) {
    if (!abi.some((item) => item.type === 'function' && item.name === fn)) {
      throw new Error(`${artifact}: required function ${fn} missing from compiled ABI`);
    }
  }
  for (const event of events) {
    if (!abi.some((item) => item.type === 'event' && item.name === event)) {
      throw new Error(`${artifact}: required event ${event} missing from compiled ABI`);
    }
  }
  const selected = abi.filter((item) =>
    (item.type === 'function' && functions.includes(item.name)) ||
    (item.type === 'event' && events.includes(item.name)) ||
    item.type === 'error'
  );
  return `export const ${name} = ${JSON.stringify(selected, null, 2)} as const;`;
});

const source = `// Generated from Foundry artifacts by npm run sync:abis. Do not edit.\n\n${exports.join('\n\n')}\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8') !== source) {
    throw new Error('Generated ABI is stale. Run forge build and npm run sync:abis.');
  }
  console.log('Compiled ABI requirements and generated frontend ABI are current.');
} else {
  mkdirSync(resolve(root, 'web/src/generated'), { recursive: true });
  writeFileSync(destination, source);
  console.log('Synchronized required frontend ABIs from accepted Foundry artifacts.');
}
