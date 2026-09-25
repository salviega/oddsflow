import Link from 'next/link'
import { BestPrices } from '@/components/BestPrices'
import { formatOpening } from '@/lib/dates'
import { getOpenMarkets } from '@/lib/markets'
import { site } from '@/lib/site'

export const revalidate = 60

export default async function Home() {
	let markets: Awaited<ReturnType<typeof getOpenMarkets>> = []
	let failed = false
	try {
		markets = await getOpenMarkets()
	} catch {
		failed = true
	}
	return (
		<main className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6">
			<section className="max-w-2xl space-y-4">
				<h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{site.tagline}</h1>
				<p className="text-lg text-mist">
					Place limit orders on many prediction markets with the same sUSDS. It stays in your wallet and moves only when
					someone takes the other side — on the one market where they do.
				</p>
				<div className="flex flex-wrap gap-3">
					<Link href="/orders/new" className="btn-primary">
						Place orders
					</Link>
				</div>
			</section>

			<section className="space-y-4" aria-labelledby="markets-heading">
				<h2 id="markets-heading" className="text-2xl font-semibold">
					Open markets
				</h2>
				{failed ? (
					<p role="alert" className="border border-silt px-3 py-2">
						Could not read the markets from the network. Reload in a moment.
					</p>
				) : markets.length === 0 ? (
					<p className="text-mist">No binary Seer markets are open on Base right now.</p>
				) : (
					<ul className="divide-y divide-silt/40 border-y border-silt/40">
						{markets.map((m) => (
							<li key={m.address}>
								<Link
									href={`/markets/${m.address}`}
									className="grid gap-2 py-5 hover:bg-spillway/5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-3"
								>
									<span className="space-y-1">
										<span className="block text-lg font-medium">{m.name}</span>
										<span className="block text-sm text-mist">Closes {formatOpening(m.openingTs)}</span>
									</span>
									<BestPrices markets={markets} market={m.address} />
								</Link>
							</li>
						))}
					</ul>
				)}
			</section>
		</main>
	)
}
