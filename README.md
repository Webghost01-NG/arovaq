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
