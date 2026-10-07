# Arovaq Phase 1 — ChainMMO progression challenge

## What is Arovaq?

Arovaq is a zero-integration competition layer for fully onchain games. The Phase 1 proof is a sponsor-funded ChainMMO progression challenge: a character owner registers, Arovaq captures the current canonical best level as a baseline, and the participant can claim a fixed MON reward after increasing that level by the configured delta.

> The world belongs to the game. The competition belongs to everyone.

## Problem

Communities cannot safely attach a competition to a game if the game must add callbacks, trust an oracle, or let an operator select winners.

## Solution

An isolated Arovaq challenge reads ChainMMO ownership and best-level state directly. It stores immutable rules and sponsor funding, binds one character to one participant, and pays only a registered owner whose canonical best level meets their stored baseline-relative target.

## Why zero-integration matters

**Arovaq does not require the target game to import, call, or integrate Arovaq.** Arovaq reads the deployed GameWorld's public getters using `staticcall`.

## How it works

1. A sponsor creates a challenge and funds `rewardPerSuccess × maxSuccessfulClaims` MON.
2. A character owner registers before the deadline; ownership and best level are read from GameWorld in the same transaction that stores the baseline and target.
3. The player plays ChainMMO normally.
4. The participant claims before the deadline. Arovaq rechecks character ownership and current best level, then pays the fixed reward using O(1) accounting.
5. After the deadline, the creator can reclaim only the unused funded rewards.

Claims are **first valid claims**, not first achievements. The contract does not claim to establish chronological achievement order.

## ChainMMO integration

- Chain: Monad Mainnet, chain ID `143`.
- GameWorld: `0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77`.
- Reads: `totalCharacters()`, `ownerOfCharacter(uint256)`, `characterBestLevel(uint256)`, `characterLastLevelUpEpoch(uint256)`.
- A live read-only fork test checks the real deployed GameWorld. No ChainMMO transaction or modification is used.

## Competition-safe observables

This profile supports ChainMMO `characterBestLevel`, treated as monotonic progression attached to a character. The profile reports `hasCanonicalOrdering() == false`; Race mode is unavailable. Current stats and inventory are not supported as progression; transferable balances and possession-only conditions are explicitly out of scope.

## Challenge vs Race

- **Challenge:** proves a registered owner currently satisfies their baseline-relative target before the claim deadline. Supported.
- **Race:** would prove who achieved the target first. Disabled because the available getters do not establish sufficient canonical total ordering. `characterLastLevelUpEpoch` is exposed and checked by the read integration test, but is not treated as unique ordering evidence.

## Architecture

- `ArovaqFactory` creates separately funded challenge contracts and one immutable ChainMMO profile.
- `ChainMMOProgressionProfile` validates exact ABI return lengths, bounds read gas, and uses `staticcall` for ownership and progression reads.
- `ArovaqProgressionChallenge` stores participant-time baseline/target, immutable objective/economics/deadline, and pull-style claims/reclaim.
- Each challenge holds only its own funding; no participant loop is used.

## Trust model

ChainMMO GameWorld and Monad canonical state determine identity and best level. Participants trust the deployed Arovaq factory/profile/challenge bytecode and the configured GameWorld address. There is no backend, indexer, creator approval, or admin winner function. The creator chooses the objective and deadline before participants join but cannot change them or select winners afterward.

The profile is a **trusted semantic configuration boundary**. Its `staticcall` proves what the configured contract returned during a transaction. ABI checks cannot establish that an arbitrary contract represents legitimate gameplay or that its getter is monotonic, non-transferable, or resistant to manipulation. A malicious target can report fabricated progression and make its own challenge pay; it cannot thereby change another challenge's accounting. The canonical Arovaq deployment must pin the intended ChainMMO GameWorld address. ChainMMO still needs no Arovaq integration.

Ownership is checked at registration and claim. If a foreign game permits character transfer, these checks do not prove continuous custody or that the registered wallet personally performed each gameplay action. The verified condition is progression of the bound character while it is owned by the participant at settlement.

## Why Monad

The primary foreign-game proof target is already deployed on Monad, so the integration reads its canonical state on the same network. This spike makes no claim that Arovaq requires Monad-specific execution features.

## Deployment addresses

- ChainMMO GameWorld: `0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77` (Monad Mainnet).
- Arovaq: no contracts deployed. Local test deployments only.

## Running locally

Install Foundry and provide a public read-only Monad RPC through `MONAD_RPC_URL`. `.env` is ignored by Git; `.env.example` contains no endpoint or credentials.

```sh
forge fmt --check
forge build
forge test -vvv
forge test --gas-report
```

The fork test uses `MONAD_RPC_URL`; the verified public Monad endpoint used for this spike was `https://rpc.monad.xyz`.

## Testing

- Unit/adversarial fixtures: `test/ArovaqPhase1.t.sol`.
- State invariants: `test/ArovaqInvariants.t.sol`.
- Real ChainMMO fork integration: `test/ChainMMOFork.t.sol`.
- Mocks are used only for local adversarial/state-transition tests, not as evidence for the real-chain gate.

## Security assumptions

- The configured GameWorld address is the intended canonical contract on the target chain.
- ChainMMO best-level monotonicity follows the frozen inspected implementation claim; this spike directly verifies the live getters, but does not independently audit all progression code.
- Ownership may change. It is checked at registration and again at claim; the registered character cannot be bound to another participant in that challenge.
- Contract timestamps use the chain clock and have normal block-producer timestamp limitations.
- A failed payout reverts claim effects; a participant can select a different recipient.
- The sponsor can select a recipient for expired-fund reclaim, so a sponsor contract that rejects native transfers can still recover unused funding.
- Registration rejects a baseline and delta whose target exceeds the `uint32` range returned by `characterBestLevel`.

## Known limitations

- No Arovaq deployment or real participant transaction was made.
- Real ChainMMO character #42 is only used for read compatibility; the test does not impersonate its owner for registration.
- First-to-claim is not first-to-achieve. A qualifying participant must claim before the deadline.
- No Race mode, token rewards, entry fees, or transferable-balance competitions.
- Forced native transfers can make the contract balance exceed its internal reward allocation. They do not increase claim or reclaim entitlements; unsolicited excess is not recoverable through the Phase 2 interface.
- Foundry fuzz and invariant suites are local EVM checks; they do not substitute for external security review.

## Demo flow

Phase 1 demonstrates (1) direct read of the deployed ChainMMO GameWorld, (2) local registration with an owned fixture character, (3) canonical baseline and target capture, (4) progression and reward claim, and (5) expired unused-fund reclaim. A live user-owned character/reward demo requires later explicit deployment approval.

**Arovaq v1 deliberately relies on canonical current state and participant-time baselines. It does not pretend arbitrary historical game state is available.**

**A challenge proves objective satisfaction. It does not claim chronological first-achievement unless the target game exposes sufficient canonical ordering evidence.**

## Phase 4 frontend

The deployment-pending React/TypeScript frontend lives in `web/`. It uses viem for typed reads and writes; all Arovaq and ChainMMO ABIs in `web/src/generated/abis.ts` are synchronized from the compiled Foundry artifacts. The sync script validates required functions and events before writing or checking generated output.

> **The frontend uses ABIs generated from the accepted Solidity contracts. Deployment addresses are environment-specific configuration.**

Install and validate:

```sh
forge build
cd web
npm install
npm run sync:abis
npm run check:abis
npm test
npm run build
```

## Environment modes

`VITE_AROVAQ_ENV` selects `LOCAL`, `FORK`, or `MONAD_MAINNET`.

- `LOCAL` only accepts loopback RPC on chain ID `31337`. `npm run demo:local` starts Anvil, deploys the accepted factory and a clearly labeled test game fixture, seeds local character #42 at level 17, and writes ignored local addresses to `.env.local`. Start the frontend in another terminal with `npm run dev`.
- `FORK` only accepts loopback RPC on chain ID `31338`. `npm run demo:fork` forks Monad Mainnet at the public RPC head, deploys Arovaq locally against the real ChainMMO GameWorld, and prints Arovaq-profile reads of the forked game state. Fork writes are simulations.
- `MONAD_MAINNET` uses Monad chain ID `143` and the separately configured ChainMMO GameWorld. Arovaq addresses remain unset until real deployment. If configured, mainnet writes still remain disabled unless `VITE_ENABLE_MAINNET_WRITES=true` is explicitly set in the build configuration.

LOCAL and FORK reject non-loopback RPC URLs. There is no fallback from a missing Mainnet Arovaq address to a local address. The application reads the real ChainMMO contract in Mainnet mode even while Arovaq deployment is pending.

## Local end-to-end

With Foundry, Node 22+, npm, and Chrome/Chromium available:

```sh
cd web
npm run test:e2e
```

This starts a fresh Anvil chain and Vite server, deploys the compiled Arovaq factory and mock fixture, then uses a local-only injected wallet provider to perform: create and fund → reject another wallet's character → register character #42 → capture baseline 17 / target 20 → progress the fixture → claim the reward. It does not use mainnet writes, mainnet impersonation, or external game mutation. Set `CHROME_PATH` if Chrome is installed outside the default path.

## ChainMMO integration

ChainMMO remains an independently deployed foreign game at `0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77`. The frontend reads `totalCharacters`, `ownerOfCharacter`, `characterBestLevel`, and `characterLastLevelUpEpoch` directly through RPC. No ChainMMO transaction or modification occurs. Local fixture state is only for repeatable development and tests; it is never described as the live integration.

## Challenge semantics

A participant registers a character they control. The accepted contract captures that character's canonical best-level baseline and derives `target = baseline + delta`. At claim time it checks ownership and current best level again. Claims are first-valid-claim while the challenge is open; they do not prove chronological first achievement. Reward funding is sponsor-funded with no participant entry fee. Expired unused funding can be reclaimed by the creator under the immutable contract rules.

## Mainnet deployment status

**Arovaq Mainnet deployment is currently pending MON funding.** Phase 4 does not deploy Arovaq, create/fund a Mainnet challenge, register a Mainnet player, or claim a Mainnet reward. Use [MAINNET_HANDOFF.md](MAINNET_HANDOFF.md) after the authorized deployer is funded.

## Known limitations

- No Arovaq contracts are deployed on Monad Mainnet yet.
- The local gameplay fixture is permissionless by design and is not a real game or integration.
- Fork-mode Arovaq writes are local simulations. A fork identity must not be represented as a live participant transaction.
- The profile is a trusted semantic configuration boundary: generic ABI reads cannot independently prove that arbitrary game state reflects legitimate or non-transferable gameplay.
- The UI displays first-valid-claim semantics. It does not offer Race mode.
- Monad Mainnet writes require both a deployed factory address and the explicit `VITE_ENABLE_MAINNET_WRITES=true` build flag.
