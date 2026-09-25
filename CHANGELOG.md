# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versioning cadence, while pre-1.0:

- **Work on a branch adds its entry under `Unreleased`, with no version
  number.** A branch cannot know what number is free: two branches open at
  once both reach for the same one, and only whichever merges first is right.
- **The number is assigned when the branch merges to `main`**: the
  `Unreleased` entries become a released section, and the project's version
  file — `package.json`, `pyproject.toml`, `Cargo.toml`, a `VERSION` file,
  whatever the stack uses — moves to match in the same commit, if the stack
  tracks a version anywhere outside this file.
- **Patch** for ordinary work, **minor** when a phase of
  [the work plan](./spec/definicion/07_plan-de-trabajo.md) closes.

- **Anything that happened on Base carries its transaction hash** (Basescan
  link). Anything verified on a fork carries the name of the test that proves
  it.

## [Unreleased]

### Added

- `FixedPriceSwap` opcode: a limit-order price for Aqua strategies, taken from
  the instruction's arguments instead of the balance registers, with rounding
  in the maker's favour and a single allowed direction. Evidence:
  `GateForkTest` fills an order shipped on the official Aqua at exactly 0.20
  on a Base fork, exact-in and exact-out; `testFuzz_makerNeverPaysMoreThanPrice`.
- `OnlyUnresolvedCondition` opcode: rejects a fill once the Seer market's
  condition has payouts reported. Evidence: `test_revert_resolvedCondition`.
- `OddsFlowRouter`: `AquaSwapVMRouter` from 1inch/swap-vm v1.0.2 with the two
  opcodes appended after the official ones, so every official opcode keeps
  its index.
- `OddsFlowTaker`: the counterparty's side in one transaction. `buy` fills
  orders for the opposite side by minting on Seer — the maker's sUSDS and the
  buyer's go into one split, each gets their side, and invalid-result tokens
  are shared by contribution — sweeping orders best first, capping each fill
  to what the maker can pay today and skipping the ones that cannot. `sell`
  fills orders with outcome tokens the seller already holds. Evidence:
  `OddsFlowTakerForkTest` (20 tests on a Base fork, the taker ends every
  transaction holding nothing) and `RulesForkTest` (the spec 05 §5 rules, each
  one reverting).
- New orders, My orders, Markets and Positions pages. New orders publishes
  several orders in one confirmation when the wallet supports EIP-5792, each
  able to use the whole balance; My orders shows what each can cover today
  and cancels; the gauge groups orders by price without double-counting a
  maker's shared balance. Open markets are read once a minute on the server
  (`/api/markets`) instead of from every browser.
- Market page: the market as a gauge — each open order is a gate at the YES
  price it implies — next to the buy panel, which plans the purchase with the
  contract's own arithmetic, says what the signature moves and what it does
  not, and sends the approval and the buy together. Evidence: on the local
  Base fork, buying 100 NO from the page filled the YES 0.25 order; the buyer
  got 100 NO and 75 invalid for 75 sUSDS, the maker 100 YES and 25 invalid
  for 25 sUSDS, and OddsFlowTaker kept nothing.
- `scripts/dev-fork.sh`: a local Base fork with OddsFlow at fixed addresses,
  the demo market, funded test accounts and sample orders.
- `packages/core`: builds and parses the OddsFlow order program, its Aqua
  strategy and hash; derives an order's status and what it can cover today;
  plans buys and sells with the exact arithmetic of `OddsFlowTaker`, so the
  numbers shown before signing are the ones that happen. ABIs for our
  contracts and Aqua are generated from the Foundry build (`pnpm abis`).
  Evidence: the parity tests against `fixtures/order.json`, written by the
  Solidity `ParityTest`, match byte for byte.
- Deployment scripts: `Deploy.s.sol` deploys the router and `OddsFlowTaker`
  and renounces the router's ownership in the same run; `CreateDemoMarket.s.sol`
  creates the binary demo market on Seer. Both simulated against Base.
- Monorepo scaffold: Next.js web app built around the brand and SEO files,
  `packages/core` with price and amount formatting and the Base addresses,
  Foundry contracts pinned to the 1inch tags, CI on pull requests, and
  pre-commit and commit-msg hooks.
