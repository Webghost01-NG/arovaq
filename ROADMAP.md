# Post-submission roadmap

This list separates implemented behavior from possible future work. No item below is represented as shipped.

## P0 — Reconcile the nonce-8 transaction history

The local broadcast artifact describes `equipItem(65, 6488)` at nonce 8 but contains no transaction hash or receipt. The account nonce advanced to 9, and the character's slot-2 equipment read is empty. Establish the transaction's fate from a reliable Monad transaction/receipt source before any further wallet write. If the evidence remains ambiguous, keep Mainnet writes paused.

## P1 — Complete or close out the live challenge

Only after nonce reconciliation, recheck wallet, deadline, budget, character ownership, equipment, progression, and challenge funding. If the existing challenge remains open and every operation fits the previously authorized cap, complete normal ChainMMO gameplay to level 2 and claim. Do not create another challenge to replace this one. If it cannot be completed safely, leave the Mainnet claim explicitly incomplete.

## P1 — Review deployed configuration and transaction recovery

Before accepting larger sponsor rewards, independently review deployed bytecode/configuration and improve operator runbooks for dropped, replaced, and ambiguously broadcast transactions. Do not make recovery depend on blindly resending a write.

## P2 — RPC resilience and discovery

The current frontend reads chain state directly and chunks event queries to respect the observed Monad RPC log-range limit. Measure failure modes across reliable public RPC endpoints and improve read-only retry/error presentation. Any optional event index may aid discovery only; contracts remain the settlement authority.

## P2 — Organizer and player usability

Use feedback from the submitted demo to refine challenge creation, character binding, status refresh, and wallet transaction recovery without changing first-valid-claim semantics or adding unsupported claims.

## P3 — Additional game profiles

Evaluate another independently deployed game only after auditing its canonical identity and progression semantics. Add a profile only when the observable is stable and competition-safe. Do not infer gameplay meaning from an ABI or generic token balance.

## Before increasing reward size

Obtain an independent security review of contracts and operational controls. Existing Foundry fuzz/invariant tests are useful evidence but are not an audit or formal verification.
