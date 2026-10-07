# Arovaq Phase 4 Evidence Report

## Verdict

`PASS — DEPLOYMENT-PENDING MVP READY`

## ABI evidence

- `forge build` generated and refreshed the Foundry artifacts.
- Artifact inputs: `out/ArovaqFactory.sol/ArovaqFactory.json`, `out/ArovaqProgressionChallenge.sol/ArovaqProgressionChallenge.json`, `out/ChainMMOProgressionProfile.sol/ChainMMOProgressionProfile.json`, `out/IChainMMOGameWorld.sol/IChainMMOGameWorld.json`, and the local fixture artifact `out/MockMonotonicGame.sol/MockMonotonicGame.json`.
- `web/scripts/sync-abis.mjs` validates the required functions/events and deterministically writes `web/src/generated/abis.ts`; `npm run check:abis` verifies the generated file is current.
- Frontend client operations use the generated ABI constants. The local/fork setup scripts read the same compiled Foundry artifacts. The ChainMMO integration uses the compiled `IChainMMOGameWorld` artifact.
- No production ABI entries were handwritten or guessed. TypeScript/viem simulation checks use the generated ABI types and exact configured contract addresses.

## Frontend architecture

- Framework: React 19, TypeScript, Vite 8.
- Wallet and RPC client: viem with injected EIP-1193 wallet support.
- Contract reads and writes are in `web/src/lib/clients.ts`; UI components call that client layer.
- `web/src/config/environment.ts` resolves `LOCAL`, `FORK`, and `MONAD_MAINNET`. `web/src/config/chainmmo.ts` holds the separate foreign-game network/address configuration.
- Arovaq addresses come only from build configuration. Mainnet write access is disabled by default and requires `VITE_ENABLE_MAINNET_WRITES=true` in addition to an explicit factory address.

## UI completed

- Discover/landing page with factory event discovery, live challenge cards, and the zero-integration explanation.
- Challenge creator with delta, MON reward, claim cap, deadline, review, and exact wei-based total funding calculation.
- Character ownership check, canonical registration, participant-specific baseline/target, current progress, refresh, local-only fixture progression, claim, completion, and creator expiry-reclaim states.
- Wallet connection, wrong-network banner/switch action, pending/confirmed/reverted transaction feedback, reward exhaustion and expiry handling, and RPC/target read errors.
- Mainnet deployment-pending state. A separate read-only ChainMMO panel remains available without any Arovaq Mainnet deployment.
- Responsive 390px viewport checked in the browser E2E without horizontal overflow.

## Local E2E

`npm run test:e2e` passed in Chrome against a new Anvil chain. The test used the compiled production factory/challenge contracts and the compiled local game fixture:

1. Create and fund a challenge from a local account.
2. Reject another wallet's attempt to use character #42.
3. Connect the fixture owner and register character #42.
4. Capture baseline 17 and target 20 from contract state.
5. Progress the character through the fixture's own action.
6. Read updated canonical fixture state and claim the reward.
7. Confirm the UI displays `OBJECTIVE VERIFIED` and `REWARD CLAIMED`.
8. Check the completed page at 390px width for horizontal overflow.

The browser provider in this test forwards requests only to local Anvil. The fixture is development-only and is not evidence of ChainMMO gameplay.

## Fork integration

`npm run demo:fork` passed. It started Anvil with Monad Mainnet state at fork base block `111306897`, deployed the accepted Arovaq factory locally, and read character state through that locally deployed Arovaq profile:

- local chain: 31338 (`FORK / SIMULATION`);
- local Arovaq factory: `0x3c2bafebbb0c8c58f39a976e725cd20d611d01e9`;
- foreign ChainMMO GameWorld: `0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77`;
- `totalCharacters`: 64;
- character #42 owner: `0x9f2B43e65856741af08A7b6412747026EC371A0A`;
- best level: 1;
- last-level-up epoch: 492020.

This is local fork execution against copied Monad state. No owner impersonation, ChainMMO mutation, or Mainnet write was used.

## Real ChainMMO evidence

Read-only RPC: `https://rpc.monad.xyz`.

At pinned Monad Mainnet block `111306715`:

- Chain ID: 143;
- GameWorld bytecode: non-empty (`eth_getCode` returned deployed runtime bytecode; captured response was 74,645 text bytes including `0x` and newline);
- `totalCharacters()`: 64;
- `ownerOfCharacter(42)`: `0x9f2B43e65856741af08A7b6412747026EC371A0A`;
- `characterBestLevel(42)`: 1;
- `characterLastLevelUpEpoch(42)`: 492020.

The values were read directly from Monad RPC, not a hosted ChainMMO API/indexer. A later head-mode browser check also loaded `totalCharacters = 64` and character #42's owner, best level, epoch, and read block (`111307428`) through the Mainnet read-only panel. No transaction was sent to real ChainMMO, and no real owner was impersonated. The local browser E2E registers only its local fixture character.

## Tests

- Frontend unit tests: 13 passed; run in both LOCAL configuration and Mainnet deployment-pending configuration.
- ABI validation: `npm run check:abis` passed.
- Frontend build/typecheck: `npm run build` passed in LOCAL and MONAD_MAINNET configurations.
- Browser test: 1 full local create/register/progress/claim flow passed, including wrong-owner rejection and mobile-width overflow check.
- Node script syntax checks: local, fork, and E2E scripts passed `node --check`.
- Solidity formatting: `forge fmt --check` passed.
- Solidity build: `forge build` passed.
- Solidity suite: 41 passed, 0 failed. This includes 32 ordinary tests, 3 fuzz properties (256 runs each), 6 invariant properties (256 runs each), and the real ChainMMO fork test. The two invariant handler suites reported 128,000 calls each.

## Security and configuration

The accepted Solidity files were not changed. Local and fork modes reject non-loopback RPC URLs, and their chain IDs are separately fixed to 31337 and 31338. Mainnet mode never falls back to a local address. Missing Mainnet factory configuration displays `Arovaq Mainnet deployment is not configured in this build.` Mainnet write operations remain disabled unless both the deployment address and explicit Mainnet write flag are present. No Mainnet write operation was attempted.

The Foundry build still reports the Phase 2 `block.timestamp` comparison lint warning. These checks implement the accepted chain-time deadline semantics, with exact boundary coverage in the security suite; this is not a Phase 4 contract change. Foundry also reports that it is a nightly build. Vite reports a minified client chunk just over 500 kB; the build passes and no external UI framework was added to address it.

## Mainnet readiness

After MON funding, the remaining work is deployment and live acceptance only: rerun preflight and security tests, estimate gas, deploy the accepted contracts, record the factory/profile addresses, configure `VITE_FACTORY_ADDRESS` and `VITE_FACTORY_START_BLOCK`, rebuild, run read-only smoke checks, and perform a real participant flow only if a genuinely controlled ChainMMO character is available. Mainnet writes remain explicitly disabled until the build opts in.

## UI/Mainnet compatibility

**NO — configuration only.** Inserting the real Arovaq factory address and its start block will use the same compiled ABI, typed client, components, and page layout. Enabling actual Mainnet writes is a separate explicit build setting; no frontend code or layout rewrite is required.

## Limitations

- Arovaq has not been deployed to Mainnet; there are no Arovaq deployment addresses or Mainnet transactions to report.
- No live Arovaq challenge or reward claim occurred.
- No controlled ChainMMO character was used for a live registration; the real character read is read-only evidence.
- First valid claim is not chronological first achievement.
- The local fixture is not ChainMMO and only supports repeatable development tests.
- Fork state and fork transactions are simulations, not live user outcomes.
- The UI build currently has a chunk-size warning; production hosting/performance review remains for later.

## Git evidence

- Branch: `feat/arovaq-phase-1-contract-proof`.
- Phase 4 ABI milestone: `08bb654` — `chore: generate frontend ABIs from Foundry artifacts`.
- Phase 4 frontend/local integration milestone: `8d735ad` — `feat: build Arovaq challenge frontend and local demos`.
- Dependency cleanup: `5a49690` — `chore: remove unused frontend test dependency`.
- README, handoff, and this report are recorded in the following documentation commit on this branch.
- No remote push occurred. Final worktree status is expected clean after the documentation commit.

## Files changed

- `web/src/generated/abis.ts`, `web/scripts/sync-abis.mjs` — compiled ABI pipeline.
- `web/src/config/`, `web/src/lib/` — typed environment and contract clients.
- `web/src/ui/`, `web/src/main.tsx`, `web/index.html` — responsive application UI.
- `web/scripts/local-demo.mjs`, `web/scripts/fork-demo.mjs`, `web/scripts/local-e2e.mjs` — local/fork setup and browser E2E.
- `web/package.json`, `web/package-lock.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/.env.example`, `web/.gitignore` — frontend tooling and configuration.
- `README.md`, `MAINNET_HANDOFF.md`, `PHASE4_REPORT.md` — documentation and deployment handoff.

## Frozen-rule compliance

- Monad Mainnet writes: none.
- Fake deployment: none; Arovaq Mainnet addresses remain unset.
- ChainMMO modification: none.
- Trusted backend/indexer settlement: none.
- Historical reconstruction: none.
- Manual winner selection: none.
- Race/first-achievement claim: none; UI states first-valid-claim semantics.
- AI, token, participant entry fees: none.
- Scope expansion: none.

## Recommendation

`READY — WAIT FOR MON THEN RESUME PHASE 3`
