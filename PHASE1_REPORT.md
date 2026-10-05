# Arovaq Phase 1 Evidence Report

## Verdict

**PASS — Phase 1 contract proof only.** This is not approval to deploy or build the frontend. The live fork test proved direct integration with the deployed ChainMMO GameWorld; local tests proved participant-time baselines, current ownership binding, fixed reward custody, and deterministic claims. Race remains unavailable.

## Repo baseline

- `/home/web-ghost/arovaq` did not exist before this task and was empty/absent at the pre-creation check.
- No Arovaq repository, contracts, frontend, package manager project, or prior tests existed.
- Foundry `1.6.0-nightly` and Solidity `0.8.34` are used. The new Git repository is local and has no remote configured.
- Branch: `feat/arovaq-phase-1-contract-proof`.

## Architecture implemented

- `ArovaqFactory`: deploys one immutable ChainMMO progression profile and creates independently funded challenge contracts.
- `ChainMMOProgressionProfile`: reads ChainMMO ownership/best-level/epoch using exact-size ABI checked, gas-bounded `staticcall`.
- `ArovaqProgressionChallenge`: fixed sponsor-funded reward, participant-time baseline and `baseline + delta` target, repeated ownership check, O(1) claim and unused-fund reclaim.
- No owner/admin outcome methods, backend, indexer, upgrade proxy, or game integration.

Each challenge has separate custody. Registration and claim are mapping-based and constant-work; no participant enumeration is required. Claims are first-valid-claim, not first-achieved.

## Files changed

- `.gitignore`, `.env.example`, `foundry.toml`, `README.md`, `PHASE1_REPORT.md`
- `src/ArovaqFactory.sol`
- `src/ArovaqProgressionChallenge.sol`
- `src/interfaces/IChainMMOGameWorld.sol`
- `src/interfaces/ICompetitionProfile.sol`
- `src/profiles/ChainMMOProgressionProfile.sol`
- `src/mocks/MockMonotonicGame.sol`
- `src/mocks/MockRevertingGame.sol`
- `src/mocks/MockMalformedReturnGame.sol`
- `src/mocks/MockReentrantGame.sol`
- `test/ArovaqPhase1.t.sol`
- `test/ArovaqInvariants.t.sol`
- `test/ChainMMOFork.t.sol`

`.env` is local, ignored, and contains only the public credential-free RPC URL used for fork reads. No secret or credential is committed.

## Commands executed

- `forge fmt --check` — PASS.
- `forge build` — PASS, Solidity `0.8.34`, Paris/Prague-compatible Foundry EVM setting `prague`, optimizer 200, via-IR.
- `forge test -vvv` — PASS, final total below.
- `forge test --gas-report` — PASS, final total below.
- Direct read-only `cast` calls to the official public endpoint — PASS.

Foundry emits timestamp comparison and explicit narrowing-cast lint warnings. Inputs are range checked before narrowing conversions; timestamps intentionally define challenge boundaries. No compiler errors remain.

## Test results

| Category | Result |
|---|---|
| Unit/adversarial test functions | 14 passed |
| Fuzz test functions | 1 passed; 256 generated cases |
| Invariant properties | 3 passed; 256 runs each; 128,000 handler calls per invariant; 0 handler reverts |
| Real Monad fork integration | 1 passed |
| Total Foundry tests | 19 passed, 0 failed |

Unit/fuzz coverage includes canonical baseline/target, lower and exact threshold, high historical baseline, non-owner and duplicate-character rejection, ownership transfer before claim, duplicate claim, fixed funding and terms, max-claim and challenge isolation, deadline/expiry/reclaim, malformed/reverting/EOA targets, static-call reentrancy attempt, and failed payout redirection.

Invariant properties check funding conservation, escrow balance versus remaining funding, registered/bound claimants and claim caps, target not below baseline, immutable terms, and deadline-gated reclaim.

## ChainMMO evidence

- RPC: Monad's public Mainnet endpoint `https://rpc.monad.xyz`; documented by the [official Monad network information page](https://docs.monad.xyz/developer-essentials/network-information) and the [verified Monad Developers organization](https://github.com/monad-developers).
- `eth_chainId`: `0x8f` = decimal `143`.
- Read block: `110725882`.
- GameWorld: `0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77`.
- `eth_getCode`: non-empty bytecode returned.
- `totalCharacters()`: `64`.
- Character ID: `42`.
- `ownerOfCharacter(42)`: `0x9f2B43e65856741af08A7b6412747026EC371A0A`.
- `characterBestLevel(42)`: `1`.
- `characterLastLevelUpEpoch(42)`: `492020`.
- Results came directly from JSON-RPC `cast call`s pinned to block `110725882`; the Foundry fork test repeated direct calls and compared them with the Arovaq profile's reads. No ChainMMO API/indexer was used.
- No transaction was sent to ChainMMO and no owner impersonation was used in the live fork test.

The getter ABI matched the frozen interface. `totalCharacters()` is supported. The real fork test uses character 42 for read compatibility only; registration and payout transitions use a labeled local fixture.

## Security findings

- Participant chooses no baseline: profile reads owner and best level inside registration.
- A character can be bound only once per challenge; the same address can register only once.
- Claim caller must be the registered participant; character ownership is checked again at claim. If the character was sold, the old registrant cannot claim and the new owner cannot take over that registration.
- Challenge objective/economics/deadline are immutable. Creator cannot withdraw while active or modify eligibility.
- Rewards are isolated per challenge, funded exactly as `reward × maxClaims`; claim effects precede transfer and a failed transfer rolls back.
- Reverting, malformed, nonexistent, and EOA targets fail closed. Game reads use `staticcall` capped at 100,000 gas per getter; a reentrant view fixture could not mutate challenge state.
- After deadline, claims are closed and only the creator can reclaim remaining reward funds. Reclaim is one-time.
- The profile's target is constructor-configured. An eventual canonical Arovaq deployment must use the supplied ChainMMO address and publish its factory/profile address; no canonical Arovaq deployment exists yet.
- The monotonic semantics of `characterBestLevel` are taken from the frozen inspected implementation research. The fork proves live getter availability/data, not a complete independent audit of all ChainMMO progression code.

## Gas

Foundry local-EVM gas report (Solidity `0.8.34`, optimizer 200, via-IR):

| Operation | Gas evidence |
|---|---:|
| Factory `createChallenge` (includes child deployment) | 678,332 average; 680,754 median; 680,790 max in this suite |
| Challenge `register` | 22,179 average; 21,654 median; 118,944 max (97,193 calls across suites) |
| Challenge `claim` | 27,054 average; 26,735 median; 98,839 max (96,941 calls across suites) |
| Challenge `reclaimExpired` | 51,887 average; 52,326 median; 52,326 max |
| Profile `readProgression` | 7,544 average; 24,530 max |
| Profile deployment | 297,273 |
| Challenge runtime size | 3,745 bytes |

Factory creation cost includes deploying an isolated challenge and varies with constructor calldata/storage. Gas results are local estimates, not Monad fee quotes. Operations remain O(1) per participant.

## Frozen-rule compliance

```text
ChainMMO modified? NO
Trusted backend? NO
Indexer required for settlement? NO
Historical reconstruction? NO
Manual winner? NO
Transferable balance race? NO
AI? NO
Token? NO
Entry fees? NO
Mainnet writes/deployment? NO
Remote push? NO
Frontend started? NO
Race mode enabled? NO — canonical total ordering is not established
```

## Limitations

- No Arovaq deployment, wallet flow, actual sponsor payment, frontend, or real participant registration was performed.
- Character 42 belongs to an existing onchain address; its owner was not impersonated.
- Deadline rules require claims before the timestamp; current monotonic state does not prove when the target was first reached.
- Arovaq has no production factory address yet. App configuration must identify the canonical ChainMMO profile/factory deployment.
- No arbitrary game DSL or non-ChainMMO profile support is claimed.

## Git status

Branch: `feat/arovaq-phase-1-contract-proof`.

The implementation and initial evidence report are committed locally. The final report commit and clean working-tree status are recorded in the final response. No remote is configured and no push was made.

## Recommendation

**PROCEED TO PHASE 2**
