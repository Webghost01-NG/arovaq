# Arovaq final demo recording guide

This guide preserves the difference between deployed Mainnet evidence and simulated gameplay. Do not describe the local fork claim as a Mainnet payout.

## Before recording

- Open the public app: <https://arovaq.vercel.app/>.
- Use a clean browser profile with the wallet disconnected. No wallet signature is needed for this walkthrough.
- Close wallet, terminal-history, file-manager, and environment-variable windows. Do not run `env`, `printenv`, `cat .env*`, or display `.env.deploy.local` during capture.
- Use a terminal with a large font and a clean scrollback. The fork command does not load a private key; it impersonates the recorded participant only inside local Anvil.
- Confirm current live records in the app immediately before recording. The challenge is time-bounded and these values can change.
- In OBS, use a full-display capture at 1920×1080 / 30 fps with microphone narration. Record to MKV and remux to MP4 after capture; keep desktop notifications hidden.

Latest read-only snapshot captured for this guide: Monad block `113195561` (2026-10-14 UTC). Chain ID was `143`; the factory/profile/GameWorld/challenge all had code; the factory pointed to the listed profile and the profile to the listed GameWorld. Character #65 was owned by the recorded participant at best level `1`; registration was `baseline=1`, `target=2`, `registered=true`, `claimed=false`. The challenge held and reported `0.001 MON` remaining, with zero successful claims. Refresh these facts before recording rather than treating this snapshot as live forever.

## 2–3 minute sequence

### 0:00–0:25 — Product and foreign game

Show the Arovaq landing/discovery page at <https://arovaq.vercel.app/>. Explain that the game remains independent and Arovaq reads its canonical state. The connected ChainMMO GameWorld is `0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77` on Monad Mainnet (chain 143).

### 0:25–0:55 — Real Mainnet challenge and registration

Open the live `+1 best level` challenge at `0xfd0bc253189f58fb441b135ed4b608bc3a435b84`. Challenge discovery scans factory events in RPC-allowed 100-block chunks; allow roughly 20 seconds for the current history scan to finish. Open `EVENT / 01`, then show its actual funding and deadline. If using the controlled owner's wallet, connect only to read the existing registration; do not sign or send a write. The participant record is:

- character `#65`;
- canonical baseline `1`;
- target `2`;
- latest verified Mainnet best level `1`;
- no Mainnet reward claim.

The live page may show current state only; refresh if it reports an RPC error. Do not present the target as achieved on Mainnet.

### 0:55–1:05 — State the limitation

Say plainly: “The Mainnet challenge and registration are real, but the character is still level 1 and the reward has not been claimed. An unresolved nonce-8 transaction prevents further safe Mainnet gameplay.”

### 1:05–2:25 — Local fork proof

In a separate terminal window run:

```sh
cd /home/web-ghost/arovaq/web
npm run demo:fork-live
```

Keep the prominent `LOCAL FORK SIMULATION — NOT MAINNET` labels visible. The runner forks real Mainnet state, then performs local-only item equipment, dungeon commit/reveal/room resolution, progression to level 2, and the Arovaq claim. Expected evidence includes baseline `1`, target `2`, fork best level `2`, a fork-only claim transaction, claimed registration, one successful claim, and zero remaining challenge balance/funding.

The Anvil fork runs on local chain ID `31338`; its transaction hashes are not Mainnet evidence. Expected final lines show fork best level `2`, the local claim receipt and `RewardClaimed` payout of `0.001 MON`, one successful claim, and zero remaining challenge balance/funding. No Mainnet state is changed.

### 2:25–2:45 — Close accurately

Reiterate: “Canonical Mainnet state supplies the real character and registered baseline. The level-up and reward claim shown in the labeled fork are simulation only. The Mainnet reward remains unclaimed.”

## Recording notes

- Keep the Mainnet browser segment and fork terminal segment visibly distinct; do not crossfade in a way that implies the local claim happened on Mainnet.
- Do not display a wallet prompt, `.env` file, private key, RPC credential, terminal command history, or deployment signer material.
- Do not overlay simulated transaction hashes on the Mainnet screen.
- Optional captures: live challenge detail with `1 → 2` registration; fork banner/start state; fork level-2 result; fork claim/accounting result.
- Suggested output name: `arovaq-metropolis-demo.mp4`. No video file is checked in by this guide.

## Evidence references

- Live contract and transaction evidence: [`DEPLOYMENT.md`](DEPLOYMENT.md) and [`MAINNET_TX_LEDGER.csv`](MAINNET_TX_LEDGER.csv).
- Current unresolved transaction status: [`MAINNET_TX_LEDGER_NOTES.md`](MAINNET_TX_LEDGER_NOTES.md).
- Local fork implementation: [`web/scripts/fork-live-acceptance.mjs`](web/scripts/fork-live-acceptance.mjs).
