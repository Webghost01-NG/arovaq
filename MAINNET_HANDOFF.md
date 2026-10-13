# Arovaq Mainnet Handoff

Arovaq Mainnet deployment is prepared but has **not** been authorized or broadcast. The signer is locally configured and verified, and the current balance is sufficient for the factory deployment and a small demo reserve. This checklist contains no architecture changes.

## Current deployment-only estimate

Read-only preflight at block `113164161` verified chain ID `143`, the accepted ChainMMO GameWorld, and the exact accepted factory initcode. `eth_estimateGas` returned `1,295,877`; this includes the constructor-created `ChainMMOProgressionProfile`. At the observed `102 gwei`, deployment is estimated at `132179454000000000 wei` (`0.132179454 MON`). A 50% gas allowance is `0.198269232 MON`. The deployer balance at block `113164062` was `41 MON`, leaving `40.867820546 MON` after the unbuffered estimate, or `40.801730768 MON` after the 50% allowance. No challenge reward or challenge transaction is included. Recheck balance, gas price and gas estimate immediately before any authorized deployment.

The configured signer was verified locally to derive public address `0x6CeD8D6Bad8Dfd2e60BCEA116fE74548f959f1F2`. Its local key file is ignored by Git and untracked; the key value is not part of this repository or this report. No mainnet transaction was signed or broadcast. Deployment still requires separate explicit approval.

Read-only preflight command:

```sh
forge script script/MonadPreflight.s.sol:MonadPreflight --rpc-url https://rpc.monad.xyz
```

Deployment command, to run only after explicit approval:

```sh
forge script script/DeployArovaq.s.sol:DeployArovaq --rpc-url https://rpc.monad.xyz --broadcast
```

- [ ] Fund authorized deployer with the approved amount.
- [ ] Rerun the Phase 2 Foundry contract suite.
- [ ] Rerun Monad read-only preflight (RPC chain ID 143, ChainMMO bytecode and getters).
- [ ] Re-estimate accepted deployment gas at current gas price.
- [ ] Deploy the accepted Arovaq contracts using the guarded Foundry deployment script.
- [ ] Record deployed Arovaq factory/profile addresses and deployment block/transaction hashes.
- [ ] Verify deployed factory profile points to ChainMMO GameWorld `0x3c6eF6a4272405A0C74cc137Ca7c681A1F58FB77`.
- [ ] Set `VITE_AROVAQ_ENV=MONAD_MAINNET`, `VITE_FACTORY_ADDRESS`, and `VITE_FACTORY_START_BLOCK` in deployment configuration.
- [ ] Keep `VITE_ENABLE_MAINNET_WRITES` unset/false for read-only smoke tests.
- [ ] Rebuild and run `npm run check:abis`, `npm test`, and `npm run build`.
- [ ] Smoke-test factory event discovery and Arovaq → ChainMMO canonical reads.
- [ ] Acquire/use a genuinely controlled ChainMMO character; do not impersonate another owner.
- [ ] Obtain explicit approval for any challenge prize transfer before funding.
- [ ] Only after authorization, set `VITE_ENABLE_MAINNET_WRITES=true` in the intended production build.
- [ ] Run a small live +1 progression challenge only if the controlled character can naturally advance during the demo window.
- [ ] Verify ownership, baseline, current progression, claim, and reward using canonical contract state.
- [ ] Record explorer links and exact live acceptance evidence.
- [ ] Final QA. Do not claim a live challenge flow if only read compatibility was demonstrated.
