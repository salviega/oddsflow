import Link from 'next/link'
import { MarketCard } from '@/components/MarketCard'
import { getMarketsCached } from '@/lib/markets-cached'
import type { Market } from '@/lib/seer-api'
import { site } from '@/lib/site'

// Rendered per request so the build never depends on Seer or the RPC; the
// market list itself is cached on the server for five minutes.
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12

type Props = { searchParams: Promise<{ q?: string; page?: string }> }

function href(q: string, page: number): string {
	const params = new URLSearchParams()
	if (q) {
		params.set('q', q)
	}
	if (page > 1) {
		params.set('page', String(page))
	}
	const s = params.toString()
	return s ? `/?${s}` : '/'
}

export default async function Home({ searchParams }: Props) {
	const { q: rawQ = '', page: rawPage = '1' } = await searchParams
	const q = rawQ.trim().slice(0, 100)
	let all: Market[] = []
	let failed = false
	try {
		all = await getMarketsCached()
	} catch {
		failed = true
	}
	const matches = q ? all.filter((m) => m.name.toLowerCase().includes(q.toLowerCase())) : all
	const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE))
	const page = Math.min(Math.max(1, Number.parseInt(rawPage, 10) || 1), pages)
	const shown = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

	return (
		<main className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6">
			<section className="max-w-2xl space-y-4">
				<h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{site.tagline}</h1>
				<p className="text-lg text-mist">
					Place limit orders on many Seer prediction markets with the same sDAI. It stays in your wallet and moves only
					when someone takes the other side — on the one market where they do.
				</p>
				<Link href="/orders/new" className="btn-primary">
					Place orders
				</Link>
			</section>

			<section className="space-y-5" aria-labelledby="markets-heading">
				<div className="flex flex-wrap items-end justify-between gap-4">
					<h2 id="markets-heading" className="text-2xl font-semibold">
						Open markets <span className="text-base font-normal text-mist tabular-nums">({matches.length})</span>
					</h2>
					<search className="w-full sm:w-96">
						<form action="/" className="flex gap-2">
							<label htmlFor="market-search" className="sr-only">
								Search markets
							</label>
							<input id="market-search" name="q" defaultValue={q} placeholder="Search markets" className="field" />
							<button type="submit" className="btn-secondary">
								Search
							</button>
						</form>
					</search>
				</div>

				{failed ? (
					<p role="alert" className="border border-silt px-3 py-2">
						Could not read the markets from Seer. Trading still works from a market's page; reload in a moment.
					</p>
				) : shown.length === 0 ? (
					<p className="text-mist">
						{q ? `No open market matches “${q}”.` : 'No plain YES/NO Seer market is open on Gnosis right now.'}
					</p>
				) : (
					<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{shown.map((m) => (
							<MarketCard key={m.address} market={m} page={shown} />
						))}
					</ul>
				)}

				{pages > 1 && (
					<nav className="flex items-center justify-center gap-2 tabular-nums" aria-label="Pages">
						{page > 1 ? (
							<Link href={href(q, page - 1)} className="btn-secondary" rel="prev">
								Previous
							</Link>
						) : (
							<span className="btn-secondary opacity-40" aria-disabled="true">
								Previous
							</span>
						)}
						<span className="px-3 text-mist">
							Page {page} of {pages}
						</span>
						{page < pages ? (
							<Link href={href(q, page + 1)} className="btn-secondary" rel="next">
								Next
							</Link>
						) : (
							<span className="btn-secondary opacity-40" aria-disabled="true">
								Next
							</span>
						)}
					</nav>
				)}
				<p className="text-sm text-mist">
					Plain YES/NO Seer markets on Gnosis, collateral sDAI, not yet answered. Odds and liquidity are Seer's own;
					OddsFlow prices come from open orders.
				</p>
			</section>
		</main>
	)
}
