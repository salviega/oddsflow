# OddsFlow

**Bet on many prediction markets with the same money, committing it only when a counterparty shows up.**

Built for **ETHGlobal Tokyo 2026** — 1inch *Build an Aqua App* track.

**Live:** [oddsflow-teal.vercel.app](https://oddsflow-teal.vercel.app) · **Network:** Gnosis Chain · **Markets:** [Seer](https://app.seer.pm) · **Collateral:** sDAI

---

## The problem

On-chain prediction markets make you lock capital in each market separately, until it resolves. Being in 10 markets costs 10 times as much as being in one, and you have to guess in advance where the demand will be: where you put too much, money sits idle for months; where you put too little, trades don't happen. Liquidity piles up in the big markets and new or niche ones go without a counterparty.

## What OddsFlow does

Every bet is a **fixed-price limit order that doesn't lock capital**. You pick markets, sides and prices, and publish your orders. **Your sDAI never leaves your wallet** until someone takes the other side: then, in a single transaction, only that order fills, only for what it needs. The other orders keep going with what's left.

- **One balance backs every order.** Each order is a [1inch Aqua](https://github.com/1inch/aqua) strategy with its own virtual balance; all of them draw on the same real balance. 1,000 sDAI can back ten orders of 1,000 sDAI each.
- **The counterparty signs once.** Buying NO mints the tokens on the spot: the maker's sDAI and the buyer's go into one Seer split, each gets their side, and invalid-result tokens are shared by contribution. Holders of outcome tokens can also sell them straight to an order.
- **Orders stop by themselves.** At the expiry the maker picks, when the market resolves, and — the one that matters — **the moment anyone posts an answer on Reality.eth**, days before it is final.
- **Anyone can create a market** on Seer from OddsFlow and start placing orders on it right away.

## Why it needs its own SwapVM opcodes

The official Aqua router (`AquaSwapVMRouter` v1.0.2) runs only Aqua's instruction subset: AMM curves, `Deadline`, jumps, fees, `Extruction`. **There is no fixed-price instruction**, and `LimitSwap` would not work on Aqua anyway: it derives its price from the balance registers (`balanceOut / balanceIn`), so on live virtual balances a fresh order reverts (`LimitSwapRequiresBothBalancesNonZero`) and every fill moves the price. OddsFlow redeploys `AquaSwapVMRouter` over the **official Aqua** with three instructions appended after the official ones (no official index moves):

| Opcode | Index | What it does |
| --- | --- | --- |
| `FixedPriceSwap` | 34 | The price is an argument of the instruction, not a ratio of balances. `amountOut = amountIn × price`, rounding in the maker's favour, in one declared direction only. Generic: any limit order on Aqua can use it |
| `OnlyUnresolvedCondition` | 35 | Reverts once the market's condition has payouts reported (Conditional Tokens) |
| `OnlyUnansweredQuestion` | 36 | Reverts once the market's question has any answer on Reality.eth (`getFinalizeTS != 0`) |

An order's program: `OnlyUnresolvedCondition → OnlyUnansweredQuestion → Deadline → FixedPriceSwap → Salt`.

**The rule that cannot fail:** a maker's sDAI never leaves their wallet without their outcome tokens arriving in the same transaction, at the price they signed. It rests on Aqua (only the strategy's router can `pull`, never past the cap), on SwapVM v1.0.2 (after pulling the maker's tokens it reverts with `AquaBalanceInsufficientAfterTakerPush` unless the taker delivered), and on the opcodes above — not on the web. See [spec 05 §5](./spec/definicion/05_stack-y-arquitectura.md).

---

## Contracts on Gnosis Chain

| Contract | Address | Deployment |
| --- | --- | --- |
| `OddsFlowRouter` (SwapVM + 3 opcodes) | [`0xfA92A297eC2cCC8Ec010ACa475F07240e2D47deC`](https://gnosisscan.io/address/0xfA92A297eC2cCC8Ec010ACa475F07240e2D47deC) | tx [`0xfc51…506f`](https://gnosisscan.io/tx/0xfc51637ca8814482552cb9d2c009e8fd80ceae41a9bfe592ec241094bfad506f) |
| `OddsFlowTaker` (one-transaction buy and sell) | [`0xbB9Aa4e736B49E490C774dd674da88A38e89a678`](https://gnosisscan.io/address/0xbB9Aa4e736B49E490C774dd674da88A38e89a678) | tx [`0xb7c3…0e1a`](https://gnosisscan.io/tx/0xb7c3370d9deb4a61bd2f7dbe618298a0e8c189521082fd9c321bb637b2ed0e1a) |
| 1inch Aqua (official) | [`0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a`](https://gnosisscan.io/address/0x1111113CCf1426A8E30e2bfF5E005d929bF6a90a) | — |

Both OddsFlow contracts are verified on Gnosisscan. **The router has no owner:** ownership was renounced in the deployment run (tx [`0xa6af…0029`](https://gnosisscan.io/tx/0xa6af6d64e9c9d5a9098b80f7e0d865856dd3b4251d718381d46e2de76d390029)), so nobody can call `rescueFunds`. `OddsFlowTaker` has no owner, holds nothing between transactions, and makers never approve it.

## Evidence

**On chain (Gnosis):**

- Deployment and verification of both contracts, and the router's renounced ownership — transactions above; the full record is in [`packages/contracts/broadcast/Deploy.s.sol/100/`](./packages/contracts/broadcast/Deploy.s.sol/100/) and [`deployments/100.json`](./packages/contracts/deployments/100.json).
- **Pending:** the first real fill on Gnosis mainnet (two orders from one balance, one filled from the web). It goes here with its transaction hashes as soon as it happens.

**Tests on a Gnosis mainnet fork**, against the official Aqua and a real Seer market (`Will the price of Bitcoin be above 100,000 USD on 31-12-2026?`) — 55 contract tests:

- `GateForkTest` — an order shipped on the official Aqua for our router fills at exactly 0.20 in `quote` and `swap`, exact-in and exact-out.
- `RulesForkTest` — every forbidden path reverts: opposite direction, the other side's token, over the cap, a taker that keeps the maker's sDAI without delivering (`AquaBalanceInsufficientAfterTakerPush`, maker keeps everything), after the deadline, resolved market, **answered question**, a cancelled order; nobody but the maker can cancel.
- `OddsFlowTakerForkTest` — 20 tests: mint path, best-first sweep, shared balance capping the second order, caps by balance and by approval, skipped orders, min/max bounds, sell path, reentrancy, callback guards; the taker ends every transaction holding nothing.
- `InvariantsForkTest` — SwapVM's own `CoreInvariants` (symmetry, strict additivity, quote/swap consistency, rounding in the maker's favour) at prices 0.20, 0.37 and 0.99.
- `testFuzz_makerNeverPaysMoreThanPrice` — `FixedPriceSwap` never makes the maker pay more than the price.
- **Coverage of `packages/contracts/src`:** 97.2% lines · 98.0% statements · 92.6% branches · 95.5% functions (floor 90%, enforced by `pnpm coverage:contracts`).
- **Gas of a buy** (Gnosis fork, `GasForkTest`): 930k for one order, ~610k per extra order, 6.6M for ten. OddsFlow sweeps up to 10.

**TypeScript (`packages/core`):** 55 tests, 100% coverage. A forge test writes [`fixtures/order.json`](./packages/core/src/fixtures/order.json) and Vitest rebuilds the same program, strategy and hash byte for byte — it caught a real divergence (a fill where the maker pays nothing, which the router rejects) before the UI existed.

**End to end in the browser** (local Gnosis fork, `scripts/dev-fork.sh`): bought 100 NO on the Bitcoin market from the market page — filling a YES 0.25 order through Seer's GnosisRouter, balances checked on chain to the cent; placed two orders of 10,000 sDAI each from a 10,000 balance; cancelled one; created a market from the Create market page.

**History:** OddsFlow first shipped on Base (same addresses: router `0xB874…7140`, taker `0xdD02…04Cd`, verified on Basescan). It moved to Gnosis on the same day because Seer on Base had no tradable market besides our own; Gnosis has 208 plain YES/NO markets on sDAI. The contracts did not change. See [spec 03](./spec/definicion/03_bounties.md#marco).

---

## How to run

Requirements: Node 22, pnpm 12, Foundry 1.3.2.

```sh
git clone --recursive https://github.com/salviega/oddsflow
cd oddsflow
git config core.hooksPath .githooks
pnpm install
cp .env.example .env   # set GNOSIS_RPC_URL (an Alchemy Gnosis URL works)
```

```sh
pnpm test                # packages/core, with the 90% coverage floor
pnpm test:contracts      # contracts on a Gnosis fork
pnpm coverage:contracts  # contracts coverage, fails under 90%
pnpm check && pnpm typecheck
```

**Everything end to end, locally**, with no browser wallet: a Gnosis fork with OddsFlow deployed, funded test accounts and sample orders on a real market.

```sh
scripts/dev-fork.sh      # terminal 1: Anvil fork on :8545, writes .env.local
pnpm dev                 # terminal 2: http://localhost:3000, test accounts in "Connect wallet"
```

Delete `.env.local` to point the web at Gnosis mainnet.

## Repository

```
apps/web/            Next.js web: markets, market page (the gauge), new orders, my orders, positions, create market
packages/core/       order encoding (parity-tested against Solidity), order state, trade planning
packages/contracts/  OddsFlowRouter, the three opcodes, OddsFlowTaker, fork tests, deploy scripts
spec/                the definition, in Spanish: problem → solution → bounty → design → architecture → plan
spec/feedback/       what we found building on 1inch Aqua and SwapVM
```

## Documentation

- [`spec/README.md`](./spec/README.md) — start here (Spanish)
- [`spec/feedback/01_1inch.md`](./spec/feedback/01_1inch.md) — feedback to 1inch: no official testnet, the deployed router has no fixed-price instruction, `LimitSwap` cannot price Aqua strategies, `main` differs from the deployed ABI
- [`AGENTS.md`](./AGENTS.md) — repository rules
- [`CHANGELOG.md`](./CHANGELOG.md) — every change with its evidence

## License

[MIT](./LICENSE)
