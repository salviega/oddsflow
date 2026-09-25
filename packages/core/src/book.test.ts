import { describe, expect, it } from 'vitest'
import { coverableToday, type OrderReads, orderStatus } from './book'

const active: OrderReads = {
	docked: false,
	capLeft: 1000n,
	makerBalance: 300n,
	makerAllowance: 500n,
	deadline: 2000,
	now: 1000,
	resolved: false,
}

describe('orderStatus', () => {
	it('is active before the deadline with cap left', () => {
		expect(orderStatus(active)).toBe('active')
	})
	it('is cancelled once docked, whatever else', () => {
		expect(orderStatus({ ...active, docked: true, capLeft: 0n })).toBe('cancelled')
	})
	it('is filled at zero cap', () => {
		expect(orderStatus({ ...active, capLeft: 0n })).toBe('filled')
	})
	it('is expired past the deadline or once resolved', () => {
		expect(orderStatus({ ...active, now: 2001 })).toBe('expired')
		expect(orderStatus({ ...active, resolved: true })).toBe('expired')
	})
})

describe('coverableToday', () => {
	it('is the least of cap, balance and approval', () => {
		expect(coverableToday(active)).toBe(300n)
		expect(coverableToday({ ...active, makerBalance: 900n })).toBe(500n)
		expect(coverableToday({ ...active, makerBalance: 5000n, makerAllowance: 5000n })).toBe(1000n)
	})
	it('is zero for an order that is not active', () => {
		expect(coverableToday({ ...active, docked: true })).toBe(0n)
	})
})
