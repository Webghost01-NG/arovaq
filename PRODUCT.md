# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Community creators and operators create progression challenges around fully onchain games. Players join with a game entity they control and claim a sponsor-funded reward after its canonical progression reaches a personal target.

## Product Purpose

Arovaq lets communities add a supported competition to an independently deployed onchain game without asking the game developer to integrate Arovaq. The current MVP demonstrates a ChainMMO best-level progression challenge.

## Positioning

The target game's canonical state determines eligibility. Arovaq captures a participant-time baseline, derives a target, checks ownership and progression at claim, and settles a fixed sponsor-funded reward. The game never calls Arovaq; there is no backend, indexer, creator approval, or manual winner selection in settlement.

## Operating Context

Creators configure and fund challenges through a browser wallet. Participants bind a ChainMMO character, continue playing the original game, then return to verify and claim. The frontend supports LOCAL and FORK simulations and a Monad Mainnet read-only/deployment-pending mode. Arovaq contracts are not deployed to Monad Mainnet.

## Capabilities and Constraints

- ChainMMO `characterBestLevel` is the supported monotonic progression observable.
- Registration captures the canonical baseline and derives `target = baseline + delta`.
- Claim checks canonical ownership and current best level again.
- Claims are first-valid-claim, not chronological first-achievement. Race mode is unavailable without canonical ordering evidence.
- Rewards are sponsor-funded native MON. There are no entry fees, betting, tokens, or participant-funded pools.
- Arovaq Mainnet addresses are configuration-only and currently unset. Mainnet writes remain disabled.
- The semantic profile is a trusted configuration boundary: ABI reads do not prove arbitrary game semantics.
- Current UI/UX success priority is inferred from the explicit redesign brief as equal emphasis on mechanism clarity and completing the challenge flow; no response to the structured confirmation arrived during the response window.

## Brand Commitments

- Name: Arovaq.
- Primary line: “Permissionless competition for onchain worlds.”
- Black and white with restrained grayscale; premium, editorial, competitive, technically credible.
- No generic Web3/SaaS dashboard, gradients, glassmorphism, card soup, or AI-template aesthetic.

## Evidence on Hand

- Accepted Solidity contracts, adversarial tests, fuzz tests, invariants, and a Monad fork read test are in this repository.
- A read-only browser integration reads the independently deployed ChainMMO GameWorld at `0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77`.
- Local E2E demonstrates create/fund, identity rejection, registration, baseline capture, local fixture progression, and reward claim.
- Mainnet deployment is pending. Do not present local fixtures or example values as live Arovaq activity.
- ChainMMO compatibility does not imply an official partnership.

## Product Principles

- The game owns canonical world state; communities define challenges around supported state.
- Participants use the original game directly.
- The contract, not presentation code, decides eligibility and settlement.
- Describe claim ordering and trust boundaries accurately.
- Keep challenge rules and reward economics fixed before activation.

## Accessibility & Inclusion

The browser experience must support keyboard operation, visible focus, accessible transaction feedback, reduced motion, and a usable 390px mobile layout.
