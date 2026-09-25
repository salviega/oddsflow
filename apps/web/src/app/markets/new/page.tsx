import type { Metadata } from 'next'
import { CreateMarket } from '@/components/CreateMarket'
import { walletPageRobots } from '../../metadata'

export const metadata: Metadata = { title: 'Create a market', robots: walletPageRobots }

export default function CreateMarketPage() {
	return <CreateMarket />
}
