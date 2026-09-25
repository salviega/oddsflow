'use client'

import Link from 'next/link'
import { useBook } from '@/hooks/useBook'
import { formatOpening } from '@/lib/dates'
import type { MarketDetail } from '@/lib/markets'
import { BuyPanel } from './BuyPanel'
import { Scale } from './Scale'

export function MarketView({ market }: { market: MarketDetail }) {
	const book = useBook([market])
	const orders = (book.data ?? []).filter((o) => o.market.toLowerCase() === market.address.toLowerCase())
	return (
		<main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
			<header className="space-y-2">
				<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{market.name}</h1>
				{market.answered || market.resolved ? (
					<p role="status" className="border border-silt px-3 py-2">
						This question already has an answer on Reality.eth, so OddsFlow orders on it no longer fill.
					</p>
				) : (
					<p className="text-mist">
						Open on Seer · accepts answers from {formatOpening(market.openingTs)} · OddsFlow orders stop filling the
						moment the question gets its first answer.{' '}
						<Link href={`/orders/new?market=${market.address}`} className="text-spillway underline">
							Place an order on this market
						</Link>
					</p>
				)}
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
