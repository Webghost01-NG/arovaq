# Arovaq Monad deployment record

## Status

**DEPLOYED — LIVE RPC VERIFICATION PASSED.** Arovaq factory/profile, a 0.001 MON +1 challenge, and character #65 registration are confirmed on Monad Mainnet. The character remains level 1 against target 2; no Mainnet reward claim has occurred.

Preflight date: 2026-10-13. Deployment date: 2026-10-13.

## Network and target

| Item | Verified value |
|---|---|
| Network | Monad Mainnet |
| RPC | `https://rpc.monad.xyz` (public, credential-free) |
| `eth_chainId` | `143` (`0x8f`) |
| ChainMMO GameWorld | `0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77` |
| GameWorld code | Non-empty at preflight block `110741659` |
| Direct getter block | `110741659` |
| `totalCharacters()` | `64` |
| `ownerOfCharacter(42)` | `0x9f2B43e65856741af08A7b6412747026EC371A0A` |
| `characterBestLevel(42)` | `1` |
| `characterLastLevelUpEpoch(42)` | `492020` |

The read-only Foundry preflight repeated the same getter values at block `110742771`. Its configured deployer address was `0x6CeD8D6Bad8Dfd2e60BCEA116fE74548f959f1F2`, with balance **0 wei**. A separate direct `eth_getBalance` call at that block also returned **0 wei**. The RPC gas-price snapshot was `102000000000` wei per gas; no reliable deployment fee estimate was made or paid.

The configured secret was used only inside the local Foundry preflight to derive its **public** address. The secret value was never printed, passed as a CLI argument, written to the repository, or committed. The repository's `.env` contains only the public RPC endpoint and is Git-ignored. No other project's `.env` was read.

## Deployment artifacts

| Contract | Planned relationship | Address | Transaction hash | Block | Source verification |
|---|---|---|---|---|---|
| `ArovaqFactory` | Constructor pins ChainMMO GameWorld through a new profile | `0x8cd2DA9E45D18c47A803f065a3625AE68bF37B17` | `0x5d3bfd3bd7b983bd5790a826020c472527469c14316becf0cd2c0a677819f502` | `113165735` | Not explorer-verified; live code/config reads passed |
| `ChainMMOProgressionProfile` | Created by the factory; `gameWorld()` equals the frozen address | `0x447047cC695ceb920D7BD2D7e19F569855Ba4D7C` | Same constructor transaction as factory | `113165735` | Not separately submitted; live code/config reads passed |

The deployment was one CREATE transaction. Receipt gas used was `1,943,815` at `102 gwei`, with zero transferred value. Gross outflow was `198269130000000000 wei` (`0.19826913 MON`). The transaction succeeded (`status = 1`). The constructor-created profile points to ChainMMO GameWorld `0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77`. The transaction hash and contract addresses were independently read from Monad RPC. No source-code explorer verification was attempted.

## Reproducible tooling

- `script/MonadPreflight.s.sol` verifies chain ID, GameWorld code/getters, and reports only public deployer/balance evidence. It does not broadcast.
- `script/DeployArovaq.s.sol` checks chain ID `143`, GameWorld code/getters, and nonzero deployer balance before broadcasting the accepted factory. It checks that the resulting profile points to the frozen GameWorld.
- Both scripts obtain the signing key only from the process environment variable `AROVAQ_DEPLOY_KEY`, which must contain `0x`-prefixed hex. The session's general `PRIVATE_KEY` value was normalized into this task-specific variable in process memory for preflight. No key material is stored in source control.
- `forge fmt --check`, `forge build`, and the complete Foundry suite passed immediately before deployment: 41 passed, 0 failed, including fuzz, invariant, scale, security, and pinned ChainMMO fork-read tests.

## Live acceptance status

- Direct ChainMMO RPC read: **PASS**.
- Arovaq deployed profile → ChainMMO reads: **PASS**.
- Character #65 is genuinely owned by the authorized wallet. Registration tx `0xbd9a7ca1252e3bf60038f6b47acaaeb36a9f41e4accbdefec4a071e99565922a` captured baseline 1 and target 2.
- Challenge `0xfd0bc253189f58fb441b135ed4b608bc3a435b84` is funded with 0.001 MON and expires at timestamp `1792019112`.
- Mainnet gameplay progression/claim: **NOT COMPLETE**. Latest known best level remains 1.
- Fork acceptance: `cd web && npm run demo:fork-live` completed actual ChainMMO game calls and Arovaq claim on a local Anvil fork. This is simulation, not Mainnet activity.
- One equip transaction invocation at nonce 8 remains unresolved; do not send further Mainnet writes until reconciled. See `MAINNET_TX_LEDGER_NOTES.md`.
- Settlement authority: canonical onchain state; no backend, hosted API, or indexer was used as authority.

## Historical read-only preflight and gas estimate (before deployment)

Read directly from the public Monad RPC `https://rpc.monad.xyz` on 2026-10-13 before deployment.

| Check | Result |
|---|---|
| Chain ID | `143` (`0x8f`) |
| Read / estimate block | `113150278` |
| ChainMMO GameWorld | `0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77`; bytecode present |
| `totalCharacters()` | `64` |
| Character #42 owner | `0x9f2B43e65856741af08A7b6412747026EC371A0A` |
| Character #42 best level | `1` |
| Character #42 last-level-up epoch | `492020` |
| Authorized deployer balance | `0 wei` at the same block |
| `eth_gasPrice` snapshot | `102000000000 wei/gas` (`102 gwei`) |

The exact deployment initcode was built from the accepted `out/ArovaqFactory.sol/ArovaqFactory.json` artifact with the frozen GameWorld constructor argument. `eth_estimateGas` returned **1,295,877 gas**. This is one transaction: the `ArovaqFactory` constructor creates its `ChainMMOProgressionProfile`; no separate profile deployment or configuration transaction is omitted.

| Funding level | Gas allowance | Estimate at 102 gwei | Rounded amount to fund |
|---|---:|---:|---:|
| Bare estimate | 1,295,877 | `132179454000000000 wei` = `0.132179454 MON` | `0.132179454 MON` |
| Recommended | 1,619,847 (25% margin) | `165224394000000000 wei` = `0.165224394 MON` | `0.17 MON` |
| Comfortable Phase 3 reserve | 1,943,816 (50% margin) | `198269232000000000 wei` = `0.198269232 MON` | `0.20 MON` |

The comfortable amount covers deployment and gas-price/estimate headroom. Post-deployment factory/profile verification and the ChainMMO compatibility checks are read-only. This excludes challenge prize funding, challenge creation, participant registration, claim transactions, any later fee movement, and future gas-price changes. Recheck gas price and estimate immediately before any authorized deployment.

At that historical snapshot, the recorded deployer had **0 MON** and the local deployment key had not yet been configured. A later explicitly authorized preflight verified the configured signer and funded balance; no secret value was logged or committed.

## Known limits

Arovaq verifies ownership at registration and settlement and checks current canonical best-level progression. It does not prove continuous ownership, who personally played the character, chronological first achievement, or arbitrary game metric safety. ChainMMO has not been modified.


## Confirmed live transactions

See [`MAINNET_TX_LEDGER.csv`](MAINNET_TX_LEDGER.csv) for all eight confirmed transactions and cumulative gross outflow. Confirmed cumulative gross spend is `460406886000000000 wei` (`0.460406886 MON`). The challenge prize is included as gross committed value. Current wallet balance and the unresolved nonce are recorded in the accompanying ledger notes; no refund is netted against spend.

### Latest canonical demo reads

At block `113171516`, Monad RPC reported chain ID 143, non-empty code at the factory/profile/ChainMMO/challenge addresses, challenge registration `(characterId=65, baseline=1, target=2, registered=true, claimed=false)`, character owner equal to the authorized wallet, and best level 1. These are direct RPC observations; no hosted game API was used.

The production frontend is configured for Monad Mainnet and the verified factory/start block. The local `.env.example` keeps Mainnet writes disabled. Production has an explicit write-enable setting because the Arovaq deployment is live; **no production browser transaction was used as QA**. A later read-only browser smoke check confirmed that the live app discovers the challenge and displays its detail page, sponsor/profile, reward, remaining slot, and first-valid-claim semantics.

## Post-submission independent RPC verification

Read-only verification was repeated directly against `https://rpc.monad.xyz` at block `113188338` (block timestamp `1791939042`, 2026-10-14 00:50:42 UTC). No transaction was sent.

| Check | Result at block `113188338` |
|---|---|
| Chain ID | `143` (`0x8f`) |
| Factory code | Present, 4,218 bytes |
| Factory `profile()` | `0x447047cC695ceb920D7BD2D7e19F569855Ba4D7C` |
| Profile code | Present, 1,295 bytes |
| Profile `gameWorld()` | `0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77` |
| Profile semantics | Monotonic `true`; transferable `false`; canonical ordering `false` |
| Challenge code | Present, 3,034 bytes |
| Challenge creator/profile | Authorized wallet / listed ChainMMO profile |
| Challenge objective | `+1` best level; `0.001 MON`; one claim |
| Challenge funding | Total and remaining `0.001 MON`; contract balance `0.001 MON` |
| Challenge settlement | 0 successful claims; funds not reclaimed |
| Challenge deadline | Timestamp `1792019112` (2026-10-14 23:05:12 UTC) |
| Character #65 registration | Participant is registered; character 65; baseline 1; target 2; unclaimed |
| Character #65 current state | Owner is the authorized wallet; best level 1; last-level-up epoch 497759 |
| GameWorld total characters | 65 |

The deployment, character creation, free lootbox claim, challenge creation, registration, and lootbox commit/reveal transaction hashes in `MAINNET_TX_LEDGER.csv` were independently fetched with receipts. All eight listed receipts have success status. The deployment receipt used 1,943,815 gas; the challenge creation transaction transferred exactly 0.001 MON; registration emitted one log.

### Nonce 8 safety hold

The Foundry broadcast artifact at `broadcast/LiveDemo.s.sol/143/run-1791933220125.json` describes an intended `equipItem(65, 6488)` call at nonce 8 (gas limit 192,033, value zero), but its recorded hash is null and it has no receipt. The account nonce advanced from 8 to 9. The first observed nonce-9 block, `113168947`, did not include a transaction from the wallet in the returned full transaction list. The current account nonce remains 9, and ChainMMO's slot-2 equipment getter returns 0 for character #65. These observations do not identify what consumed nonce 8 or prove the intended call's transaction status. Treat it as unresolved; do not retry or send another Mainnet write until a reliable transaction/receipt source reconciles it.

### Mainnet versus fork evidence

At the verification block, the registered character was still level 1 against target 2. The reward remained funded and unclaimed. `cd web && npm run demo:fork-live` later ran local Anvil fork transactions that equipped item #6488, completed a dungeon to level 2, and claimed the forked challenge. Those local transaction hashes and effects are not Mainnet transactions and do not count as a Mainnet payout.
