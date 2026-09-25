// An order's state as the interface shows it (spec 04 §6), derived only from
// on-chain reads. Nothing here is stored anywhere else.

export type OrderStatus = 'active' | 'filled' | 'expired' | 'cancelled'

export type OrderReads = {
	/** An Aqua `Docked` event exists for the order. */
	docked: boolean
	/** Aqua virtual balance of sUSDS left on the order. */
	capLeft: bigint
	/** sUSDS the maker holds now. */
	makerBalance: bigint
	/** The maker's sUSDS approval to Aqua. */
	makerAllowance: bigint
	/** Unix seconds. */
	deadline: number
	/** Unix seconds, from the latest block. */
	now: number
	/** The market's condition has payouts reported. */
	resolved: boolean
}

export function orderStatus(r: OrderReads): OrderStatus {
	if (r.docked) {
		return 'cancelled'
	}
	if (r.capLeft === 0n) {
		return 'filled'
	}
	if (r.now > r.deadline || r.resolved) {
		return 'expired'
	}
	return 'active'
}

/**
 * What the order can pay today: the least of its cap left, the maker's
 * balance and the maker's approval to Aqua. Zero unless the order is active.
 * "No funds" is not a status: an active order that can cover less than its
 * cap is still active (spec 04 §6).
 */
export function coverableToday(r: OrderReads): bigint {
	if (orderStatus(r) !== 'active') {
		return 0n
	}
	let available = r.capLeft
	if (r.makerBalance < available) {
		available = r.makerBalance
	}
	if (r.makerAllowance < available) {
		available = r.makerAllowance
	}
	return available
}
