# Arovaq Monad deployment record

## Status

**STOP — INSUFFICIENT DEPLOYER BALANCE.** No Arovaq transaction was signed or broadcast. This is a deployment configuration/funding stop, not a contract architecture finding.

Preflight date: 2026-10-05 11:43 UTC. Deployment date: not applicable.

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
| `ArovaqFactory` | Constructor pins ChainMMO GameWorld through a new profile | Not deployed | None | None | Not attempted |
| `ChainMMOProgressionProfile` | Created by the factory; `gameWorld()` must equal the frozen address | Not deployed | None | None | Not attempted |

No challenge contract was created or funded. Deployment gas and transaction cost were **zero** because no transaction was sent. No explorer verification was attempted.

## Reproducible tooling

- `script/MonadPreflight.s.sol` verifies chain ID, GameWorld code/getters, and reports only public deployer/balance evidence. It does not broadcast.
- `script/DeployArovaq.s.sol` checks chain ID `143`, GameWorld code/getters, and nonzero deployer balance before broadcasting the accepted factory. It checks that the resulting profile points to the frozen GameWorld.
- Both scripts obtain the signing key only from the process environment variable `AROVAQ_DEPLOY_KEY`, which must contain `0x`-prefixed hex. The session's general `PRIVATE_KEY` value was normalized into this task-specific variable in process memory for preflight. No key material is stored in source control.
- `forge fmt --check` and `forge build` passed. The complete Phase 2 suite was accepted at commit `00306a5fd53f4f3a83b38936f86a30adad5aea6a` (41 tests passed). A new Phase 3 full test run was not started after the zero-balance stop, and no deployment proceeded.

## Live acceptance status

- Direct ChainMMO RPC read: **PASS**.
- Deployed Arovaq profile → ChainMMO read: **BLOCKED; no Arovaq deployment**.
- Live owned-character registration/progression/claim: **BLOCKED; no Arovaq deployment**. Controlled character ownership was not asserted or impersonated.
- Settlement authority: canonical onchain state remains the intended source; no backend, hosted API, or indexer was used to manufacture an acceptance result.

## Required restart condition

Use an explicitly designated Monad deployer with enough native MON for deployment gas, then rerun chain/address/code/getter checks, `forge fmt --check`, `forge build`, the full test suite, address/balance checks, and a fresh fee estimate **before signing**. This record does not authorize a funded challenge or material prize transfer.

## Known limits

Arovaq verifies ownership at registration and settlement and checks current canonical best-level progression. It does not prove continuous ownership, who personally played the character, chronological first achievement, or arbitrary game metric safety. ChainMMO has not been modified.
