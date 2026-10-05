# Arovaq Phase 2 Security Hardening Evidence

## Verdict

**PASS — PROCEED TO PHASE 3.** This is an adversarial local and fork-tested contract gate, not an audit or deployment authorization.

## Security review

The review covered every Phase 1 production line in `ArovaqFactory`, `ArovaqProgressionChallenge`, `ChainMMOProgressionProfile`, and the two read-only interfaces. It checked constructor values, all external calls, the `staticcall` boundary, return length and ABI validation, checked arithmetic, casts, timestamps, mappings, claim order, native transfers, expiry, and creator authority.

| Severity | Finding | Root cause and exploit scenario | Affected code | Resolution and regression evidence |
|---|---|---|---|---|
| Critical | None found | — | — | All applicable adversarial, fuzz, and invariant gates passed. |
| High | None found | — | — | No admin or creator outcome authority exists. |
| Low, fixed | Unreachable target accepted | A `uint32` baseline near its maximum plus a positive delta fit `uint64` but exceeded the maximum returnable `characterBestLevel`. A participant could register for an impossible objective. | `ArovaqProgressionChallenge.register` | Reject target above `type(uint32).max` before binding. `testUnreachableTargetIsRejectedBeforeBinding` covers maximum and maximum-minus-one. |
| Low, fixed | Contract sponsor could lose reclaim liveness | `reclaimExpired()` sent native MON only to `creator`; a creator contract with a rejecting receive function could never recover unused funds. | `ArovaqProgressionChallenge.reclaimExpired` | The creator now specifies a recipient. A failed transfer rolls back state and can be retried. `testCreatorContractCanRecoverAfterFailedReclaimRecipient`. |
| Low, residual | Unsolicited native funds have no recovery path | A forced native transfer can raise `address(challenge).balance` above `remainingFunding`. Claim and reclaim allocations remain correct, but the excess remains in the contract. | Challenge accounting / no excess-withdrawal method | `testForcedNativeTransferDoesNotIncreaseClaimEntitlement` proves no allocation inflation. The Phase 2 interface deliberately gives neither creator nor admin a way to seize unallocated funds. This does not strand normal sponsor funding. |
| Informational | Target semantics are a trusted profile decision | A malicious contract can return plausible ABI data that describes fabricated progress. ABI validity cannot prove gameplay truth. | Profile constructor target and semantic flags | `testArbitraryTargetCanLieAboutSemanticsButNotOtherChallenge` shows the boundary. The canonical factory/profile must pin the real GameWorld; malicious target behavior affects only challenges built around that target. |
| Informational | Endpoint ownership does not prove who played | If a game allows character transfers, a registrant can transfer the character away, have another owner advance it, then take it back and claim. The contract proves character progression and ownership at two instants, not continuous custody or personal skill. | `register` and `claim` ownership checks | `testProgressMadeWhileCharacterIsAwayCanCountAfterReturn` demonstrates this exact behavior in a transferable mock. No claim of continuous custody is made for ChainMMO without additional canonical evidence. |
| Informational | Block timestamp has consensus leeway | Boundary time depends on the chain timestamp. A block producer can influence the exact wall-clock cutoff within consensus rules. | Factory/challenge deadline comparisons | The rule is `timestamp < deadline` for registration/claim and `timestamp >= deadline` for reclaim. `testClaimAndReclaimExactDeadlineBoundary` exercises the exact cutoff. No wall-clock precision beyond chain time is claimed. |

### Line-by-line disposition

- **Factory:** constructor creates one immutable profile and rejects code-free GameWorld addresses. Creation validates positive terms, future deadline, and exact `reward × maxClaims` funding. Solidity 0.8 checked arithmetic reverts on multiplication overflow. The only external constructor call is challenge deployment; it receives the exact funded amount. The factory has no mutable registry or admin outcome key.
- **Challenge constructor/state:** creator, profile, delta, reward, cap, deadline, and funding are immutable. Profile code presence and exact funding are checked. Each challenge holds its own native balance. Mappings bind one participant to one entity and one entity to one participant per challenge.
- **Registration:** no caller-supplied baseline exists. A view call to the immutable profile reads canonical owner and level before any registration write. `target = baseline + delta` is computed in `uint64` and bounded to the observable's `uint32` range. A failed read or failed ownership check leaves no registration state. `register` needs no reentrancy guard because the profile/game call is static and no value transfer occurs.
- **Claim:** a reentrancy guard is entered before the profile call. The participant, prior claim, cap, current owner, and current level are checked before setting `claimed`, incrementing count, reducing `remainingFunding`, and paying the caller-selected recipient. Native transfer failure reverts every effect. A participant can retry with a recipient that accepts payment.
- **Expiry/reclaim:** registration and claims close at the exact deadline; creator reclaim opens at that same timestamp. Only the creator can trigger reclaim. It clears internal remaining funding before its external native transfer; a failed transfer rolls back. A creator contract can now choose another recipient. Reclaim never touches another challenge.
- **Profile/ABI:** the three ChainMMO selectors are fixed in compiled code. Calls use `staticcall` with a 100,000 gas cap. Success plus exactly 32 return bytes is required. Address high bits and `uint32` bounds are checked before ABI decoding. Reverting, empty, short, oversized, malformed, gas-burning, missing-code, and missing-selector targets fail closed. An arbitrary target's *meaning* remains outside ABI verification.

## Test evidence

| Category | Result |
|---|---:|
| Deterministic unit/adversarial/scale tests | 31 passed |
| Fuzz test functions | 3 passed; 256 cases each; 768 generated cases total |
| Stateful invariant properties | 6 passed; 256 runs and 128,000 handler calls per property; 768,000 handler calls total; 0 handler reverts |
| Pinned real Monad fork tests | 1 passed |
| Total Foundry tests | **41 passed, 0 failed, 0 skipped** |

The two-challenge handler varies registration, progression, ownership transfer, claim attempts, and expiry. It records successful-payment snapshots and checks binding/progression at settlement, baseline immutability, one reward per participant, claim cap, accounting conservation, immutable terms, and cross-challenge state isolation. Its counterpart retains the Phase 1 single-challenge invariant checks.

Command evidence:

- `forge fmt --check` — passed after the final test addition.
- `forge build` — passed; no compiler errors.
- `forge test -vvv` — 40 passed, 0 failed before the final custody-semantic test was added.
- `forge test --match-test testProgressMadeWhileCharacterIsAwayCanCountAfterReturn -vv` — the added test passed.
- `forge test --gas-report` — final full suite: 41 passed, 0 failed, 0 skipped.

## Scale evidence

The scale fixture made and settled 2, 10, and 100 distinct registered participants. It measured one operation after all earlier participants had acted; one reward slot remained for reclaim. Local EVM gas from `gasleft()` deltas:

| Participants | Create | Last register | Last claim | Expiry/reclaim |
|---:|---:|---:|---:|---:|
| 2 | 674,506 | 74,319 | 60,015 | 55,202 |
| 10 | 674,506 | 74,319 | 60,015 | 55,202 |
| 100 | 674,506 | 74,319 | 60,015 | 55,202 |

These operations use fixed numbers of mappings/calls and no participant loop, so individual operation complexity is O(1). The fixture does not measure network fee markets or concurrent Monad execution.

## Gas evidence

The Phase 1 and Phase 2 full-suite `forge test --gas-report` selector medians are:

| Operation | Phase 1 median | Phase 2 median | Phase 2 average |
|---|---:|---:|---:|
| `createChallenge` | 680,754 | 691,368 | 684,837 |
| `register` | 21,654 | 21,654 | 23,352 |
| `claim` | 26,735 | 26,735 | 27,592 |
| `reclaimExpired` | 52,326 | 52,959 | 52,439 |

The suite composition changed substantially, including many invariant-handler calls and failure paths, so these are indicative selector statistics rather than isolated transaction comparisons. The Phase 2 scale measurements above directly show that the last participant's operation cost did not grow between 2 and 100 participants in this fixture. Gas is local EVM gas, not a Monad fee quote.

## ChainMMO regression

Pinned read-only RPC/fork block: `110729013`. Endpoint: public credential-free `https://rpc.monad.xyz`. `eth_chainId` returned `143` (`0x8f`), and `eth_getCode` returned non-empty GameWorld bytecode at `0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77`.

At that block, direct RPC calls returned `totalCharacters() = 64`; character `42` owner `0x9f2B43e65856741af08A7b6412747026EC371A0A`, best level `1`, last-level-up epoch `492020`. The pinned Foundry fork test compared those real getters to the Arovaq profile's reads and passed. No ChainMMO hosted API/indexer or write transaction was used.

## Trust-boundary conclusion

The profile establishes that its configured target returned 32-byte ABI values under EVM static-call semantics, that the owner getter matched the claimant at registration and claim, and that the best-level getter met a stored, participant-time target at claim. It cannot establish gameplay skill, continuous character custody, who performed the progression, economic non-transferability, honest internal game semantics, or competition safety from an arbitrary ABI. Semantic compatibility and the canonical GameWorld address must be reviewed and pinned in the profile/factory deployment. ChainMMO requires zero Arovaq integration.

## Warnings and static analysis

- `slither` was not installed locally; no unrelated analyzer toolchain was added. Foundry build/lint, fuzz, invariant, fork, and gas checks were run.
- The Phase 1 profile's narrowing casts were removed: the owner selector is now passed explicitly; address and `uint32` values are range-checked and ABI-decoded. The Phase 1 fuzz narrowing cast was replaced by bounded `uint32` arithmetic.
- Foundry's timestamp-comparison lint remains on `ArovaqFactory.sol:32`, `ArovaqProgressionChallenge.sol:69,83,98,117`, and invariant tests that assert the same chain-time semantics. It is deliberate use of canonical block time, with exact-boundary regression tests and the wall-clock limitation noted above.
- Solidity warns that `selfdestruct` is deprecated in the **test-only** forced-transfer fixture. No production contract uses it. The fixture tests forced value transfer, not code deletion; a separate `vm.etch` test simulates post-deployment code absence and verifies a closed failure.

## Frozen-rule compliance

```text
Frontend? NO
Arovaq deployment? NO
Remote push? NO
ChainMMO modification? NO
Trusted backend? NO
Settlement indexer? NO
Historical reconstruction? NO
Manual winner? NO
Race-mode misrepresentation? NO
Token? NO
Entry fee? NO
AI? NO
```

## Files changed

- `src/ArovaqProgressionChallenge.sol` — bounded target and recoverable creator reclaim recipient.
- `src/profiles/ChainMMOProgressionProfile.sol` — explicit selectors and checked ABI decode.
- `src/mocks/MockHostileGame.sol` — adversarial foreign target fixture.
- `test/ArovaqPhase1.t.sol`, `test/ArovaqInvariants.t.sol` — updated reclaim call and robust fuzz payout recipient.
- `test/ArovaqSecurity.t.sol` — attack and expanded fuzz coverage.
- `test/ArovaqSecurityInvariants.t.sol` — two-challenge stateful invariants.
- `test/ArovaqScale.t.sol` — 2/10/100 participant gas and liveness fixture.
- `test/ChainMMOFork.t.sol` — pinned real-chain regression.
- `README.md` — semantic trust boundary and Phase 2 limitations.
- `PHASE2_REPORT.md` — this evidence report.

## Git evidence

Branch: `feat/arovaq-phase-1-contract-proof`. Accepted Phase 1 commits: `ef9bad5f8a5522a98e5b0eee8401f247459d865d` and `722f58d11194dfaf538cac7cfc8f51a10f111378`. The Phase 2 commit hash and final working-tree status are recorded in the final response. No remote is configured; nothing was pushed.

## Recommendation

**PROCEED TO PHASE 3** — only after separate deployment approval and configuration review. Phase 2 stops here.
