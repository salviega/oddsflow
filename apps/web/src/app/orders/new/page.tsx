import type { Metadata } from 'next'
import { NewOrders } from '@/components/NewOrders'
import { walletPageRobots } from '../../metadata'

export const metadata: Metadata = { title: 'New orders', robots: walletPageRobots }

export default function NewOrdersPage() {
	return <NewOrders />
}
