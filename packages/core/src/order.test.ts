import { type Address, concat, type Hex, numberToHex } from 'viem'
import { describe, expect, it } from 'vitest'
import fixture from './fixtures/order.json'
import {
	AQUA_ORDER_TRAITS,
	buildOrder,
	buildProgram,
	decodeStrategy,
	encodeStrategy,
	OPCODES,
	type OrderParams,
	ordersToken,
	parseOrder,
	priceFromCents,
	priceToNumber,
	strategyHash,
} from './order'

const params: OrderParams = {
	conditionalTokens: fixture.inputs.conditionalTokens as Address,
	conditionId: fixture.inputs.conditionId as Hex,
	deadline: fixture.inputs.deadline,
	tokenIn: fixture.inputs.tokenIn as Address,
	tokenOut: fixture.inputs.tokenOut as Address,
	price: BigInt(fixture.inputs.price),
	salt: BigInt(fixture.inputs.salt),
}
const maker = fixture.inputs.maker as Address

describe('parity with Solidity (fixtures/order.json, written by forge)', () => {
	it('uses the router opcode indices', () => {
		expect(OPCODES).toEqual(fixture.opcodes)
	})

	it('builds the same program', () => {
		expect(buildProgram(params)).toBe(fixture.program)
	})

	it('builds the same traits', () => {
		expect(AQUA_ORDER_TRAITS.toString()).toBe(fixture.traits)
	})

	it('encodes the same strategy and hash', () => {
		const order = buildOrder(maker, params)
		expect(encodeStrategy(order)).toBe(fixture.strategy)
		expect(strategyHash(order)).toBe(fixture.strategyHash)
	})
})

describe('parseOrder', () => {
	const order = buildOrder(maker, params)

	it('reads back what was built', () => {
		expect(parseOrder(decodeStrategy(encodeStrategy(order)))).toEqual({
			...params,
			conditionalTokens: params.conditionalTokens.toLowerCase(),
			tokenIn: params.tokenIn.toLowerCase(),
			tokenOut: params.tokenOut.toLowerCase(),
		})
	})

	it('rejects other traits (hooks, signatures)', () => {
		expect(parseOrder({ ...order, traits: AQUA_ORDER_TRAITS | 1n })).toBeNull()
	})

	it('rejects a different opcode', () => {
		const data = `0x22${order.data.slice(4)}` as Hex
		expect(parseOrder({ ...order, data })).toBeNull()
	})

	it('rejects a different argument length', () => {
		const data = `0x2333${order.data.slice(6)}` as Hex
		expect(parseOrder({ ...order, data })).toBeNull()
	})

	it('rejects a truncated program', () => {
		expect(parseOrder({ ...order, data: order.data.slice(0, 60) as Hex })).toBeNull()
	})

	it('rejects trailing instructions', () => {
		expect(parseOrder({ ...order, data: concat([order.data, '0x1400']) })).toBeNull()
	})

	it('rejects a zero price', () => {
		const zero = buildProgram({ ...params, price: 1n }).replace(
			numberToHex(1n, { size: 32 }).slice(2),
			numberToHex(0n, { size: 32 }).slice(2),
		) as Hex
		expect(parseOrder({ ...order, data: zero })).toBeNull()
	})
})

describe('helpers', () => {
	it('refuses to build a zero price', () => {
		expect(() => buildProgram({ ...params, price: 0n })).toThrow(RangeError)
	})

	it('matches the token and collateral of an order', () => {
		expect(ordersToken(params, params.tokenIn, params.tokenOut)).toBe(true)
		expect(ordersToken(params, params.tokenOut, params.tokenOut)).toBe(false)
	})

	it('converts prices', () => {
		expect(priceToNumber(200000000000000000n)).toBe(0.2)
		expect(priceFromCents(20)).toBe(200000000000000000n)
		expect(() => priceFromCents(0)).toThrow(RangeError)
		expect(() => priceFromCents(100)).toThrow(RangeError)
		expect(() => priceFromCents(20.5)).toThrow(RangeError)
	})
})
