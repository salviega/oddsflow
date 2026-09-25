'use client'

import { formatPrice, priceToNumber } from '@oddsflow/core'
import { useBook } from '@/hooks/useBook'
import type { Market } from '@/lib/markets'

/** Cheapest YES and NO a buyer can get on a market right now. */
export function BestPrices({ markets, market }: { markets: readonly Market[]; market: string }) {
	const book = useBook(markets)
	const live = (book.data ?? []).filter((o) => o.market === market && o.status === 'active' && o.available > 0n)
	// Buying YES fills orders buying NO at q: YES costs 1 - q. And the other way round.
	const best = (makerSide: 'YES' | 'NO') => {
		const prices = live.filter((o) => o.side === makerSide).map((o) => priceToNumber(o.price))
		return prices.length ? 1 - Math.max(...prices) : undefined
	}
	const yes = best('NO')
	const no = best('YES')
	if (book.isPending) {
		return <span className="text-mist">Reading orders…</span>
	}
	return (
		<span className="tabular-nums">
			<span className="text-yes">YES</span>{' '}
			{yes === undefined ? <span className="text-mist">no offer</span> : formatPrice(yes)}
			<span className="mx-3 text-silt">|</span>
			<span className="text-no">NO</span>{' '}
			{no === undefined ? <span className="text-mist">no offer</span> : formatPrice(no)}
		</span>
	)
}
