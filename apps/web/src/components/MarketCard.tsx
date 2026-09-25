import Link from 'next/link'
import type { Market } from '@/lib/seer-api'
import { BestPrices } from './BestPrices'
import { OddsRing } from './OddsRing'

function usd(value: number): string {
	return value >= 1000 ? `$${(value / 1000).toFixed(2)}k` : `$${value.toFixed(0)}`
}

export function MarketCard({ market, page }: { market: Market; page: readonly Market[] }) {
	return (
		<li className="flex">
			<Link
				href={`/markets/${market.address}`}
				className="flex w-full flex-col justify-between gap-4 border border-silt/50 p-4 hover:border-mist focus-visible:border-gauge"
			>
				<div className="flex gap-3">
					{market.image ? (
						// biome-ignore lint/performance/noImgElement: remote IPFS image from Seer's CDN, shown as-is
						<img src={market.image} alt="" width={40} height={40} className="h-10 w-10 shrink-0 object-cover" />
					) : (
						<div className="h-10 w-10 shrink-0 bg-spillway/10" aria-hidden="true" />
					)}
					<h3 className="line-clamp-3 font-medium leading-snug">{market.name}</h3>
				</div>
				{market.odds ? (
					<div className="flex items-center gap-4">
						<OddsRing yes={market.odds.yes} no={market.odds.no} />
						<dl className="grid flex-1 grid-cols-[1fr_auto] gap-y-1 text-sm tabular-nums">
							<dt className="text-yes">Yes</dt>
							<dd>{market.odds.yes.toFixed(1)}%</dd>
							<dt className="text-no">No</dt>
							<dd>{market.odds.no.toFixed(1)}%</dd>
						</dl>
					</div>
				) : (
					<p className="text-sm text-mist">No Seer odds yet</p>
				)}
				<div className="flex flex-wrap items-center justify-between gap-2 border-t border-silt/40 pt-3 text-sm">
					<span className="text-mist">
						Seer odds{market.liquidityUSD ? ` · ${usd(market.liquidityUSD)} liquidity` : ''}
					</span>
					<BestPrices markets={page} market={market.address} compact />
				</div>
			</Link>
		</li>
	)
}
