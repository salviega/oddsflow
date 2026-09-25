import type { Metadata } from 'next'
import { NewOrders } from '@/components/NewOrders'
import { walletPageRobots } from '../../metadata'

export const metadata: Metadata = { title: 'New orders', robots: walletPageRobots }

type Props = { searchParams: Promise<{ market?: string }> }

export default async function NewOrdersPage({ searchParams }: Props) {
	const { market = '' } = await searchParams
	return <NewOrders initialMarket={/^0x[0-9a-fA-F]{40}$/.test(market) ? market : ''} />
}
