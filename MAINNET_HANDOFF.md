# Arovaq Mainnet Handoff

Arovaq Mainnet deployment is pending MON funding for the authorized deployer. This checklist contains no architecture changes. Phase 4 has not broadcast Monad Mainnet writes.

## Current deployment-only estimate

At read/estimate block `113150278`, `eth_estimateGas` returned `1,295,877` for the exact accepted factory initcode. It includes the constructor-created profile. At the observed `102 gwei`, the estimate is `0.132179454 MON`; fund **0.20 MON** for a 50% gas margin. The deployer currently has `0 MON`. This excludes challenge rewards and all challenge transactions. Recheck gas price and gas estimate immediately before deployment.

The configured deployer public address is `0x6CeD8D6Bad8Dfd2e60BCEA116fE74548f959f1F2`. The deployment key is not present in this workspace environment. After funding and separate deployment approval, provide `AROVAQ_DEPLOY_KEY` through a secure shell environment; never commit or paste it into command history.

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
