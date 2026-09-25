import type { Metadata } from 'next'
import { MyOrders } from '@/components/MyOrders'
import { walletPageRobots } from '../metadata'

export const metadata: Metadata = { title: 'My orders', robots: walletPageRobots }

export default function MyOrdersPage() {
	return <MyOrders />
}
