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

### Changed

- Orders no longer expire when a Seer question opens to answers: that date is
  usually long before the event, so the rule excluded every tradable market.
  The maker picks the expiry (1–365 days, 7 by default) and the new
  `OnlyUnansweredQuestion` opcode stops fills at the first answer on
  Reality.eth. Router
  [`0xfA92…7deC`](https://gnosisscan.io/tx/0xfc51637ca8814482552cb9d2c009e8fd80ceae41a9bfe592ec241094bfad506f)
  and taker
  [`0xbB9A…a678`](https://gnosisscan.io/tx/0xb7c3370d9deb4a61bd2f7dbe618298a0e8c189521082fd9c321bb637b2ed0e1a)
  redeployed on Gnosis, ownership renounced in tx
  [`0xa6af…0029`](https://gnosisscan.io/tx/0xa6af6d64e9c9d5a9098b80f7e0d865856dd3b4251d718381d46e2de76d390029).
  Evidence: `test_rule_nothingOnceAnswered` on a Gnosis fork.
- The market list comes from Seer's public API, the one app.seer.pm uses:
  208 plain YES/NO markets on sDAI, with Seer's odds, liquidity and images,
  search and pagination, read by the server every five minutes. Paged by
  creation date and deduplicated, because paging over tied liquidity
  repeated some markets and skipped others.

- OddsFlow moved from Base to Gnosis Chain, where Seer's markets are live:
  on Base no Seer market besides our own was still tradable (146 of 146
  binary markets had opened to answers, 142 of them over 90 days ago), while
  Gnosis has 12 plain YES/NO markets open on sDAI. Router
  [`0xB874…7140`](https://gnosisscan.io/tx/0x5398b9de2cf357d29dc52ec550856110db3471110f1d6ba9178a12c2667a62b3)
  and taker
  [`0xdD02…04Cd`](https://gnosisscan.io/tx/0xeeee4dc328c37110c477f7dce21e9e40316f7ee444bec27896007591d7b85d3d)
  on Gnosis, verified on Gnosisscan, router ownership renounced in tx
  [`0x4e0c…d887`](https://gnosisscan.io/tx/0x4e0c7dd79063032bd18861a14d30c66168e8fc8889892546d420688582b3d887).
  The contracts did not change; the collateral (sDAI) and Seer's GnosisRouter
  were already parameters. Evidence: the 51 fork tests pass on Gnosis against
  a real Seer market.
- The web lists only plain YES/NO Seer markets on sDAI: categorical, no
  parent market, outcomes exactly Yes and No. On Gnosis, 119 of the 131 open
  binary markets are scalar or conditional and cannot back OddsFlow orders.

### Added

- OddsFlow on Base mainnet. `OddsFlowRouter` at
  [`0xB874…7140`](https://basescan.org/address/0xB8747B3e2F90154420165FB2fc4707D638797140)
  (tx [`0xdd1a…eeda`](https://basescan.org/tx/0xdd1affa2fe922dda56f32086db78b191c2008d3113371f7cf15d04034901eeda)),
  ownership renounced in tx [`0x8612…5603`](https://basescan.org/tx/0x8612648c851048c1778215dec02e3385a63b13c6f4358571b28c76c9adfc5603);
  `OddsFlowTaker` at
  [`0xdD02…04Cd`](https://basescan.org/address/0xdD026eA05C9256A1162dC3d41102579458A804Cd)
  (tx [`0xd184…1c95`](https://basescan.org/tx/0xd18480fa7b18c9c2ca1fd586c80699a3bc8f98d271d053efd3784e08e2051c95)).
  Both verified on Basescan. Demo markets on Seer:
  [`0xf2Bf…08Da`](https://basescan.org/tx/0x855fdfbb3e657cb94c3076f47b719a9129ecd8f054460936af6d4b63298a268b)
  ("Will OddsFlow win a prize at ETHGlobal Tokyo 2026?") and
  [`0x2f15…B57E`](https://basescan.org/tx/0x1ee0c66867ce3df6e802b73d28de9634a3967e6dc254aa9058da1e39e5f71631)
  ("Will ETH trade above $2,500 at 00:00 JST on 28 September 2026?"), both
  opening to answers on Monday 28 September, 00:00 JST.

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
