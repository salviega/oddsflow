import type { Metadata } from 'next'
import { Positions } from '@/components/Positions'
import { walletPageRobots } from '../metadata'

export const metadata: Metadata = { title: 'Positions', robots: walletPageRobots }

export default function PositionsPage() {
	return <Positions />
}
