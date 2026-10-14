# Arovaq Mainnet Demo Handoff

## Current state

Arovaq is deployed. Factory: `0x8cd2DA9E45D18c47A803f065a3625AE68bF37B17`. Profile: `0x447047cC695ceb920D7BD2D7e19F569855Ba4D7C`. ChainMMO GameWorld: `0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77`. The +1 challenge at `0xfd0bc253189f58fb441b135ed4b608bc3a435b84` has 0.001 MON escrow; character #65 is registered with baseline 1 / target 2.

Read-only verification at Monad block `113188338` confirmed the factory/profile/GameWorld wiring, challenge funding and registration. Character #65 remained at best level 1; the challenge had zero claims and the full 0.001 MON remained escrowed. Its deadline is `1792019112` (2026-10-14 23:05:12 UTC). See `DEPLOYMENT.md` for the full snapshot and receipts.

## Safety hold

A prior `equipItem(65, 6488)` invocation used account nonce 8, but its broadcast artifact has no hash/receipt and the nonce later advanced to 9. The complete transaction history has not been reconciled. Do not sign or broadcast another Mainnet transaction until a reliable source identifies what consumed nonce 8. The fork demo completed the equip, game progression to level 2, and Arovaq claim locally, using forked contract state. It is not a Mainnet claim.

Confirmed gross wallet outflow is `0.460406886 MON` (includes the challenge escrow). The original 2 MON cap has `1.539593114 MON` remaining before reserving for the unresolved nonce exposure. The ledger notes estimate `0.019587366 MON` maximum gas exposure at the recorded 102 gwei rate; reserve it rather than netting any possible refund. The last recorded wallet balance was `20.539593114 MON`; re-read it before any future transaction.

## Remaining steps

- [ ] Reconcile signer nonce 8 against a reliable Monad transaction history/receipt source; do not infer status from the empty equipment slot alone.
- [ ] If and only if the nonce is resolved and budget permits, inspect character #65's equipped item and current level directly onchain.
- [ ] Estimate gas and worst-case cap before each authorized transaction.
- [ ] Complete legitimate Mainnet gameplay to level 2 and claim the challenge only if the current deadline remains valid and the transaction fits the remaining 2 MON gross cap.
- [ ] Otherwise present the live deployment/registration plus clearly labeled fork completion; do not claim Mainnet gameplay or payout.
- [ ] Verify production frontend reads the deployed factory/challenge and does not send transactions during QA.
- [ ] Record final evidence and transaction hashes.

No architecture changes or extra demo features are required.
