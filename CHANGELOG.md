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
- Monorepo scaffold: Next.js web app built around the brand and SEO files,
  `packages/core` with price and amount formatting and the Base addresses,
  Foundry contracts pinned to the 1inch tags, CI on pull requests, and
  pre-commit and commit-msg hooks.
