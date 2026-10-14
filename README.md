# Arovaq

> **Permissionless competition for onchain worlds.**

Arovaq lets communities attach sponsor-funded progression challenges to an independently deployed onchain game. Players keep using the original game; Arovaq reads canonical game state and settles eligible rewards through isolated challenge contracts.

- **Live app:** [arovaq.vercel.app](https://arovaq.vercel.app/)
- **Network:** Monad Mainnet · chain ID `143`
- **Hackathon:** Monad Metropolis 2026 · Social, Attention & Culture

## Current deployment status

Arovaq is deployed to Monad Mainnet. The factory, its constructor-created ChainMMO profile, the funded challenge, and character #65 registration were independently read from Monad RPC at block `113188338`.

| Component | Address | Evidence |
|---|---|---|
| ArovaqFactory | `0x8cd2DA9E45D18c47A803f065a3625AE68bF37B17` | Deployment tx `0x5d3bfd3bd7b983bd5790a826020c472527469c14316becf0cd2c0a677819f502`, block `113165735` |
| ChainMMOProgressionProfile | `0x447047cC695ceb920D7BD2D7e19F569855Ba4D7C` | Created by the factory constructor in the same transaction; `gameWorld()` matches ChainMMO |
| ChainMMO GameWorld | `0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77` | Existing independent Monad deployment |
| +1 progression challenge | `0xfd0bc253189f58fb441b135ed4b608bc3a435b84` | Creation tx `0x117f7ceb411f8b3bf26d3ee6e37eeae285ba35fb83c339bc97c4c95131f79562`, block `113167487` |

The challenge has `0.001 MON` funded for one successful claim. Character #65 is registered to the deployer wallet with baseline `1` and target `2` (registration tx `0xbd9a7ca1252e3bf60038f6b47acaaeb36a9f41e4accbdefec4a071e99565922a`, block `113167682`). At the latest recorded verification, the character's canonical best level is still `1`; the reward remains unclaimed and the challenge has zero successful claims. **A Mainnet progression and payout have not been completed.**

One attempted equipment call at account nonce 8 remains unresolved: the local broadcast record has no transaction hash or receipt, while the account nonce advanced. The character's equipment slot remains empty. Further Mainnet writes are on hold until this discrepancy is reconciled. The complete gameplay and reward-claim path was demonstrated on a local Anvil fork only. Fork activity is simulation, not Mainnet execution. See [deployment and transaction evidence](DEPLOYMENT.md) and the [transaction ledger](MAINNET_TX_LEDGER.csv).

## The problem

Game communities often cannot create a new competition around a live game without asking its developer to add hooks, adopt an SDK, or let an operator decide the result. Arovaq tests whether a community can define a supported challenge around a foreign game's public canonical state, with no integration in the game itself.

## How the ChainMMO challenge works

1. A sponsor creates a challenge with an objective, deadline, reward per completion, and claim cap. The sponsor funds exactly `reward × claim cap`.
2. Before the deadline, a player registers a ChainMMO character they own. The challenge reads ownership and `characterBestLevel` and atomically stores the participant's baseline and derived target.
3. The player continues playing ChainMMO directly. ChainMMO never imports, calls, or knows about Arovaq.
4. Before the deadline, the participant claims. Arovaq rechecks character ownership and canonical best level, then pays the configured reward.
5. After expiry, the creator may reclaim only unused reward funding.

For example, registration at level 17 with a `+3` objective stores baseline 17 and target 20. A current canonical level of at least 20 satisfies the condition. This is a **challenge**, not a chronological race: settlement is first valid claim, not first achievement. The current getters do not prove total ordering, so Race mode is unavailable.

## Architecture

```text
Player wallet ──registers──> isolated Arovaq challenge
                                  │
                                  ├── static read: ownerOfCharacter(id)
                                  └── static read: characterBestLevel(id)
                                                 │
                                          ChainMMO GameWorld

Canonical owner + stored baseline-relative target ──claim──> fixed reward
```

- **ArovaqFactory** creates the immutable ChainMMO profile and independently funded challenge contracts.
- **ChainMMOProgressionProfile** performs bounded-gas, exact-return-length `staticcall` reads against the configured GameWorld.
- **ArovaqProgressionChallenge** captures registration-time baseline/target, checks them at claim, isolates sponsor funds, and supports O(1) registration, claim, and expiry/reclaim operations.
- The frontend uses ABIs generated from the compiled Foundry artifacts. Contract addresses are environment configuration, not UI assumptions.

The profile is a trusted semantic configuration boundary, not an oracle. It can establish what the configured contract returned; ABI shape alone cannot prove that an arbitrary game's getter is honest, monotonic, non-transferable, or meaningful as progression. The supported ChainMMO profile is pinned to the GameWorld above.

## Repository layout

```text
src/                  Solidity factory, challenge, interfaces, profile, hostile fixtures
test/                 unit, adversarial, fuzz, invariant, scale, and fork-read tests
script/               guarded deploy, preflight, and live-demo scripts
web/src/              React/TypeScript app, clients, configuration, generated ABIs
web/scripts/           ABI sync, local demo, fork demos, browser E2E
DEPLOYMENT.md          deployment and live RPC evidence
MAINNET_TX_LEDGER.csv  confirmed Mainnet transaction receipts and gross outflow
HACKATHON.md           submitted project facts and judge walkthrough
ROADMAP.md             prioritized post-submission work
```

## Run locally

Requirements: Foundry, Node.js 22+, npm, and Chrome/Chromium for browser E2E. No root npm package is used; the frontend package lives under `web/`.

```sh
forge fmt --check
forge build
forge test -vvv

cd web
npm ci
npm run check:abis
npm test
npm run typecheck
npm run build
npm run test:e2e
```

For the read-only live ChainMMO fork test, provide a public read-only RPC if the default is unavailable:

```sh
MONAD_RPC_URL=https://rpc.monad.xyz forge test --match-path test/ChainMMOFork.t.sol -vvv
```

The local browser E2E starts Anvil and Vite, then exercises challenge creation/funding, owner rejection, registration/baseline, fixture progression, claim, expiry/reclaim, wrong-network handling, and a 390px layout check. It is local test state, not a live-game result.

### Fork demos

`cd web && npm run demo:fork` deploys Arovaq locally against real forked ChainMMO reads. `cd web && npm run demo:fork-live` forks the existing Mainnet Arovaq and ChainMMO state and performs simulated local equipment, dungeon, progression, and reward-claim calls. The runner uses a local Anvil impersonation and local balance; it does not load a private key or broadcast to Monad. Label its output **FORK / SIMULATION — NOT MAINNET** in any recording.

## Configuration and secrets

`web/.env.example` documents the frontend's public configuration. `VITE_AROVAQ_ENV` selects `LOCAL`, `FORK`, or `MONAD_MAINNET`; LOCAL and FORK require loopback RPC and their respective chain IDs. Monad Mainnet uses chain ID 143 and the ChainMMO GameWorld address. The production factory and start block are public deployment configuration. The example keeps Mainnet writes disabled; the production build's write setting must be treated as security-sensitive public configuration and reviewed before use.

For Foundry scripts, signing keys belong only in an ignored local environment file or secure process environment. Never add keys, mnemonics, authenticated RPC URLs, or wallet files to source control. `.env`, `.env.*`, and local web environment files are ignored; checked-in `.env.example` files are templates.

## Security and trust assumptions

- Monad canonical state and the configured ChainMMO GameWorld determine the observed owner and best level.
- The challenge contract—not the UI, creator, backend, or indexer—checks eligibility and settlement.
- Ownership is checked at registration and claim. This does not prove continuous ownership or who personally performed every game action.
- The system does not prove chronological first achievement. A valid claimant must claim before the deadline and before the reward cap is exhausted.
- The profile does not independently audit arbitrary game semantics. A malicious target can lie about its own state.
- Contract timestamps follow block timestamps and their normal validator-level limitations.
- The Foundry fuzz/invariant and fork-read tests are engineering evidence, not a third-party audit or formal verification.
- Mainnet transaction history contains an unresolved nonce-8 equipment invocation. No replacement or retry should be sent until reconciled.

## Known limitations

- Character #65 is level 1 against target 2; the Mainnet reward is unclaimed.
- The full gameplay-and-claim demonstration is local fork simulation only.
- Available ChainMMO getters do not provide sufficient canonical total ordering for a first-achievement race.
- The semantic profile is game-specific configuration; broad compatibility with arbitrary games is not claimed.
- No independent security audit has been completed.
- The repository currently has no `LICENSE` file. No open-source license is granted by this repository as checked in.

## Hackathon and next steps

Arovaq was submitted to Monad Metropolis 2026 in the Social, Attention & Culture track. See [HACKATHON.md](HACKATHON.md) for the concise project record. Pitch and demo videos were recorded and uploaded by the project owner; their URLs are not maintained in this repository.

See [ROADMAP.md](ROADMAP.md) for the post-submission priority list. The first step is transaction-history reconciliation; until then, no further Mainnet writes are safe.
