// What a buy or a sell will do, computed exactly as OddsFlowTaker does it on
// chain, so the numbers shown before signing are the numbers that happen.

import type { Hex } from 'viem'
import { PRICE_SCALE } from './order'

/** OddsFlowTaker sweeps at most this many orders in one transaction (spec 05 §6). */
export const MAX_ORDERS_PER_TRADE = 10

export type Quote = {
	strategyHash: Hex
	/** sUSDS per outcome token, 1e18 scale. */
	price: bigint
	/** What the order can pay today: min(cap left, maker balance, maker approval to Aqua). */
	available: bigint
}

export type Fill = {
	strategyHash: Hex
	/** Outcome tokens that change hands on this order. */
	tokens: bigint
	/** sUSDS the order's maker pays. */
	makerPays: bigint
}

export type TradePlan = {
	fills: Fill[]
	tokens: bigint
	/** Buy: sUSDS the buyer pays. Sell: sUSDS the seller receives. */
	amount: bigint
}

/** Orders sorted best first for whoever fills them: the highest maker price. */
export function bestFirst<T extends Quote>(orders: readonly T[]): T[] {
	return [...orders]
		.filter((o) => o.available > 0n)
		.sort((a, b) => (a.price === b.price ? 0 : a.price > b.price ? -1 : 1))
}

/** One order's fill for up to `wanted` tokens: OddsFlowTaker._fill. */
function fill(order: Quote, wanted: bigint): Fill {
	const quotedOut = (wanted * order.price) / PRICE_SCALE
	let tokens = wanted
	if (quotedOut > order.available) {
		tokens = (wanted * order.available) / quotedOut
	}
	return { strategyHash: order.strategyHash, tokens, makerPays: (tokens * order.price) / PRICE_SCALE }
}

function plan(orders: readonly Quote[], wanted: bigint, amountOf: (f: Fill) => bigint): TradePlan {
	const fills: Fill[] = []
	let tokens = 0n
	let amount = 0n
	for (const order of bestFirst(orders).slice(0, MAX_ORDERS_PER_TRADE)) {
		if (tokens >= wanted) {
			break
		}
		const f = fill(order, wanted - tokens)
		// The router rejects a fill where the maker pays nothing
		// (TakerTraitsAmountOutMustBeGreaterThanZero), and OddsFlowTaker skips it.
		if (f.makerPays === 0n) {
			continue
		}
		fills.push(f)
		tokens += f.tokens
		amount += amountOf(f)
	}
	return { fills, tokens, amount }
}

/**
 * Buying `wanted` tokens of one side from orders buying the other side: each
 * fill mints `tokens`, the maker pays `makerPays`, the buyer pays the rest.
 */
export function planBuy(ordersForOtherSide: readonly Quote[], wanted: bigint): TradePlan {
	return plan(ordersForOtherSide, wanted, (f) => f.tokens - f.makerPays)
}

/** Selling `wanted` tokens to orders buying that side: the seller receives `makerPays`. */
export function planSell(ordersForSide: readonly Quote[], wanted: bigint): TradePlan {
	return plan(ordersForSide, wanted, (f) => f.makerPays)
}

/** Average price per token of a plan, 1e18 scale; 0 for an empty plan. */
export function averagePrice(p: TradePlan): bigint {
	return p.tokens === 0n ? 0n : (p.amount * PRICE_SCALE) / p.tokens
}
