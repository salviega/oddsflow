import { describe, expect, it } from 'vitest'
import { averagePrice, bestFirst, MAX_ORDERS_PER_TRADE, planBuy, planSell, type Quote } from './trade'

const e18 = 10n ** 18n
const q = (id: number, cents: bigint, available: bigint): Quote => ({
	strategyHash: `0x${id.toString(16).padStart(64, '0')}`,
	price: cents * 10n ** 16n,
	available,
})

// Same numbers as packages/contracts/test/OddsFlowTaker.fork.t.sol
describe('planBuy mirrors OddsFlowTaker', () => {
	it('one order: NO at 0.80 when YES is at 0.20', () => {
		const p = planBuy([q(1, 20n, 1000n * e18)], 100n * e18)
		expect(p.tokens).toBe(100n * e18)
		expect(p.amount).toBe(80n * e18)
		expect(p.fills[0]?.makerPays).toBe(20n * e18)
	})

	it('sweeps best first and caps to what each maker can pay', () => {
		const p = planBuy([q(2, 20n, 1000n * e18), q(1, 25n, 10n * e18)], 100n * e18)
		expect(p.fills.map((f) => f.tokens)).toEqual([40n * e18, 60n * e18])
		expect(p.amount).toBe((40n * e18 * 75n) / 100n + (60n * e18 * 80n) / 100n)
	})

	it('caps to the maker balance', () => {
		const p = planBuy([q(1, 20n, 30n * e18)], 1000n * e18)
		expect(p.tokens).toBe(150n * e18)
		expect(p.amount).toBe(120n * e18)
	})

	it('skips orders that cannot pay anything, and stops when done', () => {
		const p = planBuy([q(1, 30n, 0n), q(2, 20n, 1000n * e18), q(3, 10n, 1000n * e18)], 100n * e18)
		expect(p.fills).toHaveLength(1)
		expect(p.fills[0]?.strategyHash).toBe(q(2, 0n, 0n).strategyHash)
	})

	it('skips a fill where the maker would pay nothing, as the router does', () => {
		// 1 wei at any price under 1.00 pays 0 sDAI: the router would revert.
		const p = planBuy([q(1, 50n, e18), q(2, 20n, e18)], 1n)
		expect(p.fills).toHaveLength(0)
		expect(p.tokens).toBe(0n)
	})

	it(`never sweeps more than ${MAX_ORDERS_PER_TRADE} orders`, () => {
		const orders = Array.from({ length: 15 }, (_, i) => q(i + 1, 20n, e18))
		const p = planBuy(orders, 1000n * e18)
		expect(p.fills).toHaveLength(MAX_ORDERS_PER_TRADE)
		expect(p.tokens).toBe(50n * e18)
	})
})

describe('planSell', () => {
	it('the seller receives what the maker pays', () => {
		const p = planSell([q(1, 20n, 1000n * e18)], 100n * e18)
		expect(p.tokens).toBe(100n * e18)
		expect(p.amount).toBe(20n * e18)
	})
})

describe('helpers', () => {
	it('orders by the highest maker price, dropping empty ones', () => {
		const sorted = bestFirst([q(1, 20n, e18), q(2, 25n, e18), q(3, 25n, e18), q(4, 90n, 0n)])
		expect(sorted.map((o) => o.price)).toEqual([25n, 25n, 20n].map((c) => c * 10n ** 16n))
	})

	it('averages the price of a plan', () => {
		expect(averagePrice(planBuy([q(1, 20n, 1000n * e18)], 100n * e18))).toBe(8n * 10n ** 17n)
		expect(averagePrice({ fills: [], tokens: 0n, amount: 0n })).toBe(0n)
	})
})
