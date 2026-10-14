# Monad Metropolis 2026

**Track:** Social, Attention & Culture  
**Submission status:** Submitted manually by the project owner  
**Live app:** https://arovaq.vercel.app/  
**Source:** https://github.com/Webghost01-NG/arovaq

## Project summary

Arovaq is a permissionless competition layer for onchain games. A community sponsor can fund a progression challenge around a supported observable in an independently deployed game. The game remains unchanged; Arovaq reads canonical state to bind a participant, capture a baseline, check progress, and settle a fixed reward.

## Mainnet evidence

- Network: Monad Mainnet, chain ID 143.
- Factory: `0x8cd2DA9E45D18c47A803f065a3625AE68bF37B17`.
- Constructor-created ChainMMO profile: `0x447047cC695ceb920D7BD2D7e19F569855Ba4D7C`.
- Independent ChainMMO GameWorld: `0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77`.
- Funded +1 challenge: `0xfd0bc253189f58fb441b135ed4b608bc3a435b84`; funded with 0.001 MON for one claim.
- Character #65 is registered with canonical baseline 1 and target 2.
- Latest documented RPC snapshot: block 113188338. Character #65 remained at best level 1, and no reward claim had occurred.

Deployment transaction, challenge creation, registration, other confirmed transactions, and RPC verification details are in [DEPLOYMENT.md](DEPLOYMENT.md) and [MAINNET_TX_LEDGER.csv](MAINNET_TX_LEDGER.csv).

## Technical work demonstrated

- Arovaq contracts compose with a separately deployed ChainMMO GameWorld without game-side hooks, imports, callbacks, or developer integration.
- Registration binds a wallet to a canonically owned character and captures its best-level baseline in the same transaction.
- Claim rechecks ownership and best-level progression; challenge rules and reward cap are immutable.
- Challenge reward funds are isolated, claims are O(1), and expired unused funding can be reclaimed only under the contract's fixed rules.
- Foundry unit, adversarial, fuzz, invariant, scale, and real ChainMMO fork-read tests are included.
- The frontend reads deployed Mainnet challenge and game state and is published at the live app URL above.

## Demo disclosure

The submitted demo showed the real Mainnet deployment, funded challenge, and character registration. Character #65 did not progress to level 2 on Mainnet, and the Mainnet reward was not claimed. The complete game progression and Arovaq claim path ran on a local Anvil fork of real contract state; it is simulation evidence only.

An equipment transaction invocation associated with nonce 8 has no recorded transaction hash or receipt, while the wallet nonce advanced. This prevented safe follow-up Mainnet writes. The transaction-history discrepancy is documented in [MAINNET_TX_LEDGER_NOTES.md](MAINNET_TX_LEDGER_NOTES.md); no retry should be sent before reconciliation.

The project owner reports that pitch and demo videos were recorded and uploaded. Their URLs are not present in the repository, so this document does not invent or publish them. The submission was completed manually; this repository does not modify or resubmit the application.

ChainMMO is an independent game. Arovaq's compatibility with its public contract state does not imply an official partnership or endorsement.
