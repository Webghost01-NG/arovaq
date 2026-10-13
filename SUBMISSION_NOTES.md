# Metropolis submission notes

## Live product state

- Frontend: https://arovaq.vercel.app/
- Repository: https://github.com/Webghost01-NG/arovaq
- Network: Monad Mainnet, chain ID 143.
- Arovaq status: not deployed. The public build has no Arovaq factory address and `VITE_ENABLE_MAINNET_WRITES=false`.
- Foreign game: ChainMMO GameWorld `0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77`; read-only compatibility has been checked directly against Monad RPC.
- No live Arovaq challenge, reward volume, participant transaction, or ChainMMO partnership is claimed.

## Short judge walkthrough

1. Open the live app. Point out the Mainnet deployment-pending notice and show that competition writes are disabled.
2. In the ChainMMO read panel, read character #42 from the existing GameWorld. Explain that Arovaq reads its canonical getters; ChainMMO does not import, call, or know about Arovaq.
3. Show the contract path: `ArovaqFactory` creates an isolated challenge; registration atomically binds the wallet to a character and captures its canonical best-level baseline; the claim rechecks owner and progression before paying a sponsor-funded reward.
4. Show `cd web && npm run test:e2e` for a reproducible **LOCAL / DEMO** create, fund, owner rejection, register, baseline, canonical fixture progression, claim, expiry, and reclaim. State clearly that the local game fixture is simulation evidence, not the live ChainMMO game.
5. Show `forge test --match-path test/ChainMMOFork.t.sol -vv` for the read-only fork proof against the actual ChainMMO deployment. No owner impersonation or Mainnet write is used.

Suggested closing: “The world belongs to the game. The competition belongs to everyone.”

## Evidence available

- Production UI: https://arovaq.vercel.app/
- Source and accepted history: https://github.com/Webghost01-NG/arovaq
- Contract and security evidence: `PHASE1_REPORT.md`, `PHASE2_REPORT.md`, `PHASE4_REPORT.md`, and `DEPLOYMENT.md`.
- Repeatable commands: `forge fmt --check`, `forge build`, `forge test`, `forge test --gas-report`, and in `web/`: `npm run check:abis`, `npm test`, `npm run build`, `npm run test:e2e`.
- Direct Monad/ChainMMO read evidence and current deployment gas estimate: `DEPLOYMENT.md`.

## Submission materials still needed

- Record and upload the final demo video. No video file is present in this repository.
- Sign in to the [Metropolis submission portal](https://hackathon.monad.xyz/) and confirm its authenticated form fields, required links, and cutoff. The public page currently only exposes sign-in/registration; no submission form was accessed and no submission was made.
- If the submission requires a live Arovaq Mainnet contract or full live player flow, that evidence is unavailable: deployment is pending deployer funding and a genuinely controlled compatible ChainMMO character.
