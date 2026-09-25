'use client'

import { useBook } from '@/hooks/useBook'
import { formatOpening } from '@/lib/dates'
import type { Market } from '@/lib/markets'
import { BuyPanel } from './BuyPanel'
import { Scale } from './Scale'

export function MarketView({ market }: { market: Market }) {
	const book = useBook([market])
	const orders = (book.data ?? []).filter((o) => o.market.toLowerCase() === market.address.toLowerCase())
	return (
		<main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
			<header className="space-y-2">
				<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{market.name}</h1>
				<p className="text-mist">Opens to answers {formatOpening(market.openingTs)} · every order expires by then</p>
			</header>
			<div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
				{book.isPending ? (
					<div role="status" className="h-96 w-full max-w-md animate-pulse bg-spillway/5">
						<span className="sr-only">Loading orders</span>
					</div>
				) : book.isError ? (
					<p role="alert" className="max-w-md border border-silt px-3 py-2">
						Could not read the order book from the network. Showing nothing rather than something stale; it retries
						every 15 seconds.
					</p>
				) : (
					<Scale orders={orders} />
				)}
				<BuyPanel market={market} orders={orders} />
			</div>
		</main>
	)
}
