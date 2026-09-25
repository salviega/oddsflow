import { describe, expect, it } from 'vitest'
import { formatAmount, formatPrice, formatProbability, formatTokens } from './format'

const ONE = 10n ** 18n

describe('formatPrice', () => {
	it('shows two decimals', () => {
		expect(formatPrice(0.2)).toBe('0.20')
		expect(formatPrice(0.05)).toBe('0.05')
	})

	it('accepts both ends of the scale', () => {
		expect(formatPrice(0)).toBe('0.00')
		expect(formatPrice(1)).toBe('1.00')
	})

	it('rounds to the nearest cent', () => {
		expect(formatPrice(0.199)).toBe('0.20')
		expect(formatPrice(0.194)).toBe('0.19')
	})

	it('rejects prices outside 0.00–1.00', () => {
		expect(() => formatPrice(-0.01)).toThrow(RangeError)
		expect(() => formatPrice(1.01)).toThrow(RangeError)
		expect(() => formatPrice(Number.NaN)).toThrow(RangeError)
	})
})

describe('formatProbability', () => {
	it('shows the implied probability as a whole percent', () => {
		expect(formatProbability(0.2)).toBe('20%')
		expect(formatProbability(0.333)).toBe('33%')
		expect(formatProbability(0)).toBe('0%')
		expect(formatProbability(1)).toBe('100%')
	})

	it('rejects prices outside 0.00–1.00', () => {
		expect(() => formatProbability(2)).toThrow(RangeError)
	})
})

describe('formatAmount', () => {
	it('groups thousands, shows two decimals and the unit', () => {
		expect(formatAmount(1000n * ONE)).toBe('1,000.00 sUSDS')
		expect(formatAmount(1_234_567n * ONE + ONE / 2n)).toBe('1,234,567.50 sUSDS')
	})

	it('shows zero as zero', () => {
		expect(formatAmount(0n)).toBe('0.00 sUSDS')
	})

	it('shows a threshold instead of zeros for dust', () => {
		expect(formatAmount(1n)).toBe('< 0.01 sUSDS')
		expect(formatAmount(ONE / 100n - 1n)).toBe('< 0.01 sUSDS')
		expect(formatAmount(ONE / 100n)).toBe('0.01 sUSDS')
	})

	it('rounds down, never showing more than there is', () => {
		expect(formatAmount((ONE * 1999n) / 1000n)).toBe('1.99 sUSDS')
	})

	it('respects other decimals', () => {
		expect(formatAmount(1_500_000n, 6)).toBe('1.50 sUSDS')
	})

	it('rejects negative amounts', () => {
		expect(() => formatAmount(-1n)).toThrow(RangeError)
	})
})

describe('formatTokens', () => {
	it('shows two decimals with the side', () => {
		expect(formatTokens(100n * ONE, 'YES')).toBe('100.00 YES')
		expect(formatTokens(1n, 'NO')).toBe('< 0.01 NO')
	})
})
