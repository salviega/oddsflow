'use client'

import {
	CONDITIONAL_TOKENS,
	conditionalTokensAbi,
	formatAmount,
	formatTokens,
	SEER_ROUTER,
	SUSDS,
	seerRouterAbi,
} from '@oddsflow/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { type Address, encodeFunctionData, erc20Abi } from 'viem'
import { useAccount } from 'wagmi'
import { useOpenMarkets } from '@/hooks/useMarkets'
import { publicClient } from '@/lib/chain'
import type { Market } from '@/lib/markets'
import { type Call, explain, send } from '@/lib/tx'
import { TxResult, type TxState } from './TxResult'

type Holding = {
	market: Market
	/** YES, NO, invalid result. */
	amounts: [bigint, bigint, bigint]
	/** Payout numerators once resolved, else undefined. */
	payouts?: [bigint, bigint, bigint]
	denominator: bigint
}

async function readHoldings(account: Address, markets: readonly Market[]): Promise<Holding[]> {
	const r = await publicClient.multicall({
		allowFailure: false,
		contracts: markets.flatMap((m) => [
			...[m.yes, m.no, m.invalid].map(
				(t) => ({ address: t, abi: erc20Abi, functionName: 'balanceOf', args: [account] }) as const,
			),
			{
				address: CONDITIONAL_TOKENS,
				abi: conditionalTokensAbi,
				functionName: 'payoutDenominator',
				args: [m.conditionId],
			} as const,
		]),
	})
	const held = markets
		.map((market, i) => {
			const o = i * 4
			return {
				market,
				amounts: [r[o], r[o + 1], r[o + 2]] as [bigint, bigint, bigint],
				denominator: r[o + 3] as bigint,
			}
		})
		.filter((h) => h.amounts.some((a) => a > 0n))
	return Promise.all(
		held.map(async (h) => {
			if (h.denominator === 0n) {
				return h
			}
			const payouts = await publicClient.multicall({
				allowFailure: false,
				contracts: [0n, 1n, 2n].map(
					(i) =>
						({
							address: CONDITIONAL_TOKENS,
							abi: conditionalTokensAbi,
							functionName: 'payoutNumerators',
							args: [h.market.conditionId, i],
						}) as const,
				),
			})
			return { ...h, payouts: payouts as [bigint, bigint, bigint] }
		}),
	)
}

function claimable(h: Holding): bigint {
	if (!h.payouts || h.denominator === 0n) {
		return 0n
	}
	return h.amounts.reduce((sum, a, i) => sum + (a * (h.payouts?.[i] ?? 0n)) / h.denominator, 0n)
}

export function Positions() {
	const { address } = useAccount()
	const markets = useOpenMarkets()
	const queryClient = useQueryClient()
	const [tx, setTx] = useState<TxState>({ kind: 'idle' })
	const holdings = useQuery({
		queryKey: ['holdings', address, markets.data?.length],
		queryFn: () => readHoldings(address as Address, markets.data ?? []),
		enabled: Boolean(address && markets.data),
	})

	async function claim(h: Holding) {
		const tokens = [h.market.yes, h.market.no, h.market.invalid]
		const indexes = [0n, 1n, 2n].filter((i) => (h.amounts[Number(i)] ?? 0n) > 0n)
		const amounts = indexes.map((i) => h.amounts[Number(i)] as bigint)
		const calls: Call[] = indexes.map((i) => ({
			to: tokens[Number(i)] as Address,
			data: encodeFunctionData({
				abi: erc20Abi,
				functionName: 'approve',
				args: [SEER_ROUTER, h.amounts[Number(i)] as bigint],
			}),
		}))
		calls.push({
			to: SEER_ROUTER,
			data: encodeFunctionData({
				abi: seerRouterAbi,
				functionName: 'redeemPositions',
				args: [SUSDS, h.market.address, indexes, amounts],
			}),
		})
		setTx({ kind: 'pending', label: 'Confirm the claim in your wallet…' })
		try {
			const hashes = await send(calls)
			setTx({ kind: 'done', hashes, message: `Claimed ${formatAmount(claimable(h))}.` })
			await queryClient.invalidateQueries()
		} catch (e) {
			setTx({ kind: 'error', message: explain(e) })
		}
	}

	return (
		<main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
			<h1 className="text-3xl font-semibold tracking-tight">Positions</h1>
			<TxResult state={tx} />
			{!address ? (
				<p className="text-mist">Connect a wallet to see what you hold.</p>
			) : holdings.isPending ? (
				<div role="status" className="h-32 animate-pulse bg-spillway/5">
					<span className="sr-only">Loading positions</span>
				</div>
			) : holdings.isError ? (
				<p role="alert" className="border border-silt px-3 py-2">
					Could not read your positions from the network. Reload to try again.
				</p>
			) : (holdings.data ?? []).length === 0 ? (
				<p className="text-mist">You hold no outcome tokens in open markets yet.</p>
			) : (
				<ul className="space-y-3">
					{(holdings.data ?? []).map((h) => {
						const amount = claimable(h)
						return (
							<li
								key={h.market.address}
								className="grid gap-3 border border-silt/60 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
							>
								<div className="space-y-1">
									<Link href={`/markets/${h.market.address}`} className="font-medium hover:underline">
										{h.market.name}
									</Link>
									<p className="tabular-nums">
										{h.amounts[0] > 0n && <span className="mr-4">{formatTokens(h.amounts[0], 'YES')}</span>}
										{h.amounts[1] > 0n && <span className="mr-4">{formatTokens(h.amounts[1], 'NO')}</span>}
										{h.amounts[2] > 0n && (
											<span className="text-mist">{formatAmount(h.amounts[2]).replace('sUSDS', 'invalid result')}</span>
										)}
									</p>
									<p className="text-sm text-mist">
										{h.payouts
											? `Resolved. You can claim ${formatAmount(amount)}.`
											: 'Not resolved yet. Each winning token pays 1 sUSDS; invalid-result tokens pay back your stake if the market is annulled.'}
									</p>
								</div>
								{h.payouts && amount > 0n && (
									<button
										type="button"
										className="btn-primary"
										disabled={tx.kind === 'pending'}
										onClick={() => claim(h)}
									>
										Claim {formatAmount(amount)}
									</button>
								)}
							</li>
						)
					})}
				</ul>
			)}
		</main>
	)
}
