# Mainnet transaction ledger notes

The CSV contains only confirmed transactions with verified hashes/receipts. It records eight confirmed transactions and cumulative gross outflow of `460406886000000000 wei` (`0.460406886 MON`), including `0.001 MON` challenge funding. Refunds do not reset this figure.

## Unresolved nonce 8

A Foundry broadcast manifest was created for an `equipItem(65, 6488)` invocation with nonce 8, gas limit 192,033, value 0, and observed gas price 102 gwei. Its maximum gas exposure at that observed price is `19587366000000000 wei` (`0.019587366 MON`). The invocation did not yield a transaction hash in the captured output. Direct observations did not establish a receipt or equipped state, while the account nonce observation advanced to 9. This is unresolved evidence, not a confirmed ledger transaction. No hash is invented and no retry should occur until the nonce is reconciled.

Confirmed spend remains `0.460406886 MON`; conservatively reserving the possible equip exposure gives maximum known exposure `0.479994252 MON`, leaving at least `1.520005748 MON` under the 2 MON cap. Latest observed wallet balance was `20.539593114 MON`, which exactly matched the initial 21 MON less confirmed recorded outflow at that observation. Re-read all balances/nonces before any future transaction.
