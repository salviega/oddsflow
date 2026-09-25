import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MarketView } from '@/components/MarketView'
import { getMarket } from '@/lib/markets'

type Props = { params: Promise<{ address: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const market = await getMarket((await params).address)
	if (!market) {
		return { title: 'Market not found' }
	}
	return {
		title: market.name,
		description: `Buy YES or NO on "${market.name}" at the price open orders offer, in one transaction. Orders on OddsFlow share one sUSDS balance across markets.`,
		alternates: { canonical: `/markets/${market.address}` },
	}
}

export default async function MarketPage({ params }: Props) {
	const market = await getMarket((await params).address)
	if (!market) {
		notFound()
	}
	return <MarketView market={market} />
}
