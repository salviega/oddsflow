// One market read straight from chain: the market page works even when Seer's
// API does not, and it shows markets that left the list (answered, resolved).
// The list of open markets comes from Seer's API (seer-api.ts).

import {
	COLLATERAL,
	CONDITIONAL_TOKENS,
	conditionalTokensAbi,
	REALITY_ETH,
	realityAbi,
	SEER_MARKET_FACTORY,
	seerMarketAbi,
} from '@oddsflow/core'
import { type Address, getAddress, type Hex, isAddress } from 'viem'
import { publicClient } from './chain'
import type { Market } from './seer-api'

export type { Market } from './seer-api'

const ZERO = '0x0000000000000000000000000000000000000000'

const shapeAbi = [
	{ type: 'function', name: 'templateId', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
	{ type: 'function', name: 'parentMarket', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
	{
		type: 'function',
		name: 'outcomes',
		stateMutability: 'view',
		inputs: [{ name: 'index', type: 'uint256' }],
		outputs: [{ type: 'string' }],
	},
] as const

const finalizeAbi = [
	{
		type: 'function',
		name: 'getFinalizeTS',
		stateMutability: 'view',
		inputs: [{ name: 'questionId', type: 'bytes32' }],
		outputs: [{ type: 'uint32' }],
	},
] as const

const collateralAbi = [
	{ type: 'function', name: 'collateralToken', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

export type MarketDetail = Market & {
	/** Reality.eth has an answer: OddsFlow orders on this market no longer fill. */
	answered: boolean
}

/** A plain YES/NO market on sDAI, or null for any other kind of address. */
export async function getMarket(address: string): Promise<MarketDetail | null> {
	if (!isAddress(address)) {
		return null
	}
	const market = getAddress(address)
	try {
		const r = await publicClient.multicall({
			allowFailure: false,
			contracts: [
				{ address: market, abi: seerMarketAbi, functionName: 'numOutcomes' },
				{ address: market, abi: shapeAbi, functionName: 'templateId' },
				{ address: market, abi: shapeAbi, functionName: 'parentMarket' },
				{ address: market, abi: shapeAbi, functionName: 'outcomes', args: [0n] },
				{ address: market, abi: shapeAbi, functionName: 'outcomes', args: [1n] },
				{ address: market, abi: seerMarketAbi, functionName: 'marketName' },
				{ address: market, abi: seerMarketAbi, functionName: 'conditionId' },
				{ address: market, abi: seerMarketAbi, functionName: 'questionsIds' },
				{ address: market, abi: seerMarketAbi, functionName: 'wrappedOutcome', args: [0n] },
				{ address: market, abi: seerMarketAbi, functionName: 'wrappedOutcome', args: [1n] },
				{ address: market, abi: seerMarketAbi, functionName: 'wrappedOutcome', args: [2n] },
			],
		})
		const [count, template, parent, first, second, name, conditionId, questions, yes, no, invalid] = r
		const plain =
			count === 2n &&
			template === 2n &&
			(parent as string).toLowerCase() === ZERO &&
			String(first).toLowerCase() === 'yes' &&
			String(second).toLowerCase() === 'no'
		if (!plain) {
			return null
		}
		const questionId = (questions as readonly Hex[])[0] as Hex
		const [openingTs, finalizeTs, denominator, collateral] = await publicClient.multicall({
			allowFailure: false,
			contracts: [
				{ address: REALITY_ETH, abi: realityAbi, functionName: 'getOpeningTS', args: [questionId] },
				{ address: REALITY_ETH, abi: finalizeAbi, functionName: 'getFinalizeTS', args: [questionId] },
				{
					address: CONDITIONAL_TOKENS,
					abi: conditionalTokensAbi,
					functionName: 'payoutDenominator',
					args: [conditionId as Hex],
				},
				// Every market from Seer's Gnosis MarketFactory uses its collateral.
				{ address: SEER_MARKET_FACTORY, abi: collateralAbi, functionName: 'collateralToken' },
			],
		})
		if ((collateral as string).toLowerCase() !== COLLATERAL.toLowerCase()) {
			return null
		}
		return {
			address: market,
			name: name as string,
			conditionId: conditionId as Hex,
			questionId,
			openingTs: Number(openingTs),
			resolved: (denominator as bigint) > 0n,
			answered: Number(finalizeTs) !== 0,
			yes: (yes as readonly [Address, Hex])[0],
			no: (no as readonly [Address, Hex])[0],
			invalid: (invalid as readonly [Address, Hex])[0],
		}
	} catch {
		return null
	}
}
