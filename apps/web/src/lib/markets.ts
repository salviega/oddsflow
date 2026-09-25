// Seer markets as OddsFlow shows them: binary, still open to trading.
// Everything is read from chain (spec 05 §4); nothing is cached server-side
// beyond Next's revalidation.

import {
	CONDITIONAL_TOKENS,
	conditionalTokensAbi,
	REALITY_ETH,
	realityAbi,
	SEER_MARKET_FACTORY,
	seerMarketAbi,
} from '@oddsflow/core'
import { type Address, getAddress, type Hex, isAddress } from 'viem'
import { featuredMarkets, publicClient } from './chain'

export type Market = {
	address: Address
	name: string
	conditionId: Hex
	/** When Reality.eth starts accepting answers; every order must expire by then. */
	openingTs: number
	resolved: boolean
	yes: Address
	no: Address
	invalid: Address
}

const factoryAbi = [
	{ type: 'function', name: 'allMarkets', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] },
] as const

async function readMarkets(addresses: readonly Address[]): Promise<Market[]> {
	const calls = addresses.flatMap((address) => [
		{ address, abi: seerMarketAbi, functionName: 'marketName' } as const,
		{ address, abi: seerMarketAbi, functionName: 'conditionId' } as const,
		{ address, abi: seerMarketAbi, functionName: 'questionsIds' } as const,
		{ address, abi: seerMarketAbi, functionName: 'wrappedOutcome', args: [0n] } as const,
		{ address, abi: seerMarketAbi, functionName: 'wrappedOutcome', args: [1n] } as const,
		{ address, abi: seerMarketAbi, functionName: 'wrappedOutcome', args: [2n] } as const,
	])
	const r = await publicClient.multicall({ contracts: calls, allowFailure: false })
	const partial = addresses.map((address, i) => {
		const o = i * 6
		return {
			address,
			name: r[o] as string,
			conditionId: r[o + 1] as Hex,
			questionId: (r[o + 2] as readonly Hex[])[0] as Hex,
			yes: (r[o + 3] as readonly [Address, Hex])[0],
			no: (r[o + 4] as readonly [Address, Hex])[0],
			invalid: (r[o + 5] as readonly [Address, Hex])[0],
		}
	})
	const r2 = await publicClient.multicall({
		allowFailure: false,
		contracts: partial.flatMap((m) => [
			{ address: REALITY_ETH, abi: realityAbi, functionName: 'getOpeningTS', args: [m.questionId] } as const,
			{
				address: CONDITIONAL_TOKENS,
				abi: conditionalTokensAbi,
				functionName: 'payoutDenominator',
				args: [m.conditionId],
			} as const,
		]),
	})
	return partial.map(({ questionId: _, ...m }, i) => ({
		...m,
		openingTs: Number(r2[i * 2]),
		resolved: (r2[i * 2 + 1] as bigint) > 0n,
	}))
}

/** One market by address, or null if it is not a binary Seer market. */
export async function getMarket(address: string): Promise<Market | null> {
	if (!isAddress(address)) {
		return null
	}
	try {
		const outcomes = await publicClient.readContract({
			address: getAddress(address),
			abi: seerMarketAbi,
			functionName: 'numOutcomes',
		})
		if (outcomes !== 2n) {
			return null
		}
		const [market] = await readMarkets([getAddress(address)])
		return market ?? null
	} catch {
		return null
	}
}

/** Binary Seer markets still open to trading, featured ones first, then by closing time. */
export async function getOpenMarkets(): Promise<Market[]> {
	const all = await publicClient.readContract({
		address: SEER_MARKET_FACTORY,
		abi: factoryAbi,
		functionName: 'allMarkets',
	})
	const counts = await publicClient.multicall({
		allowFailure: true,
		contracts: all.map((address) => ({ address, abi: seerMarketAbi, functionName: 'numOutcomes' }) as const),
	})
	const binary = all.filter((_, i) => counts[i]?.status === 'success' && counts[i]?.result === 2n)
	const now = Math.floor(Date.now() / 1000)
	const markets = (await readMarkets(binary)).filter((m) => !m.resolved && m.openingTs > now)
	const rank = (m: Market) => {
		const i = featuredMarkets.findIndex((f) => f.toLowerCase() === m.address.toLowerCase())
		return i === -1 ? featuredMarkets.length : i
	}
	return markets.sort((a, b) => rank(a) - rank(b) || a.openingTs - b.openingTs)
}
