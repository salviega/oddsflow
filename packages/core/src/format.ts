// Number formatting for the interface (spec/definicion/09_marca-y-seo.md §5).
// No number ever shows the 18 on-chain decimals: amounts are cut to cents,
// and anything below one cent reads as a threshold, not as zeros.

import { COLLATERAL_SYMBOL } from './addresses'

const COLLATERAL_DECIMALS = 18

function assertPrice(price: number): void {
	if (!Number.isFinite(price) || price < 0 || price > 1) {
		throw new RangeError(`Price must be between 0.00 and 1.00, got ${price}`)
	}
}

/** A price on the 0.00–1.00 scale, two decimals: `0.2 -> '0.20'`. */
export function formatPrice(price: number): string {
	assertPrice(price)
	return price.toFixed(2)
}

/** The implied probability of a price, whole percent: `0.2 -> '20%'`. */
export function formatProbability(price: number): string {
	assertPrice(price)
	return `${Math.round(price * 100)}%`
}

function groupThousands(whole: bigint): string {
	return whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * A token amount with two decimals, grouped thousands and its unit.
 * Rounds down, so the interface never shows more than there is.
 */
function formatUnits(amount: bigint, decimals: number, unit: string): string {
	if (amount < 0n) {
		throw new RangeError(`Amount must not be negative, got ${amount}`)
	}
	const cents = (amount * 100n) / 10n ** BigInt(decimals)
	if (cents === 0n && amount > 0n) {
		return `< 0.01 ${unit}`
	}
	const whole = cents / 100n
	const fraction = (cents % 100n).toString().padStart(2, '0')
	return `${groupThousands(whole)}.${fraction} ${unit}`
}

/** A collateral amount in base units: `1000n * 10n ** 18n -> '1,000.00 sDAI'`. */
export function formatAmount(amount: bigint, decimals: number = COLLATERAL_DECIMALS): string {
	return formatUnits(amount, decimals, COLLATERAL_SYMBOL)
}

export type Side = 'YES' | 'NO'

/** An outcome-token amount with its side: `100n * 10n ** 18n -> '100.00 YES'`. */
export function formatTokens(amount: bigint, side: Side, decimals = 18): string {
	return formatUnits(amount, decimals, side)
}
