'use client'

import {
	AQUA,
	aquaAbi,
	buildOrder,
	COLLATERAL,
	CONDITIONAL_TOKENS,
	encodeStrategy,
	formatAmount,
	formatProbability,
	priceFromCents,
} from '@oddsflow/core'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { encodeFunctionData, erc20Abi, maxUint256, parseUnits } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { useOpenMarkets } from '@/hooks/useMarkets'
import type { Side } from '@/lib/book'
import { chain, deployment } from '@/lib/chain'
import { formatOpening } from '@/lib/dates'
import type { Market } from '@/lib/markets'
import { type Call, explain, send } from '@/lib/tx'
import { SignSummary } from './SignSummary'
import { TxResult, type TxState } from './TxResult'

type Row = { id: number; market: string; side: Side; cents: string; limit: string }

function randomSalt(): bigint {
	const words = crypto.getRandomValues(new Uint32Array(2))
	return (BigInt(words[0] ?? 0) << 32n) | BigInt(words[1] ?? 0)
}

function parseAmount(text: string): bigint | undefined {
	try {
		const v = parseUnits(text.trim(), 18)
		return v > 0n ? v : undefined
	} catch {
		return undefined
	}
}

function rowProblem(row: Row, market: Market | undefined): string | undefined {
	if (!market) {
		return 'Choose a market.'
	}
	const cents = Number(row.cents)
	if (!Number.isInteger(cents) || cents < 1 || cents > 99) {
		return 'Price must be between 0.01 and 0.99.'
	}
	if (!parseAmount(row.limit)) {
		return 'Enter the most this order may spend.'
	}
	return undefined
}

export function NewOrders() {
	const markets = useOpenMarkets()
	const { address, chainId } = useAccount()
	const queryClient = useQueryClient()
	const d = deployment()
	const [nextId, setNextId] = useState(2)
	const [rows, setRows] = useState<Row[]>([{ id: 1, market: '', side: 'YES', cents: '20', limit: '' }])
	const [tx, setTx] = useState<TxState>({ kind: 'idle' })

	const { data: balance } = useReadContract({
		address: COLLATERAL,
		abi: erc20Abi,
		functionName: 'balanceOf',
		args: address ? [address] : undefined,
		query: { enabled: Boolean(address) },
	})
	const { data: allowance } = useReadContract({
		address: COLLATERAL,
		abi: erc20Abi,
		functionName: 'allowance',
		args: address ? [address, AQUA] : undefined,
		query: { enabled: Boolean(address) },
	})

	const list = markets.data ?? []
	const find = (a: string) => list.find((m) => m.address === a)
	const withDefaults = rows.map((r) => ({
		...r,
		market: r.market || list[0]?.address || '',
		limit: r.limit || (balance ? (Number(balance / 10n ** 16n) / 100).toFixed(2) : ''),
	}))
	const problems = withDefaults.map((r) => rowProblem(r, find(r.market)))
	const needsApproval = (allowance ?? 0n) < maxUint256 / 2n

	const blocked = !d
		? 'OddsFlow is not deployed on this network yet.'
		: !address
			? 'Connect a wallet to place orders.'
			: chainId !== chain.id
				? `Switch your wallet to ${chain.name}.`
				: balance === 0n
					? 'Your wallet has no sDAI. Orders need sDAI in the wallet to fill.'
					: problems.find((p) => p !== undefined)

	function update(id: number, patch: Partial<Row>) {
		setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
	}

	async function place() {
		if (!d || !address) {
			return
		}
		const calls: Call[] = []
		if (needsApproval) {
			calls.push({
				to: COLLATERAL,
				data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [AQUA, maxUint256] }),
			})
		}
		for (const r of withDefaults) {
			const market = find(r.market) as Market
			const tokenIn = r.side === 'YES' ? market.yes : market.no
			const order = buildOrder(address, {
				conditionalTokens: CONDITIONAL_TOKENS,
				conditionId: market.conditionId,
				deadline: market.openingTs,
				tokenIn,
				tokenOut: COLLATERAL,
				price: priceFromCents(Number(r.cents)),
				salt: randomSalt(),
			})
			calls.push({
				to: AQUA,
				data: encodeFunctionData({
					abi: aquaAbi,
					functionName: 'ship',
					args: [d.router, encodeStrategy(order), [tokenIn, COLLATERAL], [0n, parseAmount(r.limit) as bigint]],
				}),
			})
		}
		const n = withDefaults.length
		setTx({ kind: 'pending', label: `Confirm in your wallet (${n} order${n > 1 ? 's' : ''})…` })
		try {
			const hashes = await send(calls)
			setTx({
				kind: 'done',
				hashes,
				message: `${n} order${n > 1 ? 's are' : ' is'} live. Your sDAI stays in your wallet until one fills.`,
			})
			await queryClient.invalidateQueries()
		} catch (e) {
			setTx({ kind: 'error', message: explain(e) })
		}
	}

	return (
		<main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
			<header className="space-y-2">
				<h1 className="text-3xl font-semibold tracking-tight">New orders</h1>
				<p className="max-w-2xl text-mist">
					Each order buys one side of one market at your price or better. Every order can use your whole balance: the
					money leaves your wallet only when someone takes the other side.
				</p>
			</header>

			<p className="tabular-nums">
				<span className="text-mist">Available balance </span>
				<span className="text-lg font-semibold">{balance === undefined ? '—' : formatAmount(balance)}</span>
			</p>

			{markets.isPending ? (
				<div role="status" className="h-40 animate-pulse bg-spillway/5">
					<span className="sr-only">Loading markets</span>
				</div>
			) : markets.isError ? (
				<p role="alert" className="border border-silt px-3 py-2">
					Could not read the markets from the network. Reload to try again.
				</p>
			) : list.length === 0 ? (
				<p className="text-mist">There are no open binary markets on {chain.name} right now.</p>
			) : (
				<ol className="space-y-4">
					{withDefaults.map((r, i) => {
						const market = find(r.market)
						const cents = Number(r.cents)
						return (
							<li key={r.id} className="space-y-3 border border-silt/60 p-4">
								<div className="flex items-center justify-between">
									<span className="text-sm text-mist">Order {i + 1}</span>
									{rows.length > 1 && (
										<button
											type="button"
											className="min-h-11 px-2 text-sm text-mist hover:text-spillway"
											onClick={() => setRows(rows.filter((x) => x.id !== r.id))}
										>
											Remove
										</button>
									)}
								</div>
								<label className="block space-y-1">
									<span className="text-sm text-mist">Market</span>
									<select className="field" value={r.market} onChange={(e) => update(r.id, { market: e.target.value })}>
										{list.map((m) => (
											<option key={m.address} value={m.address} className="bg-lock">
												{m.name}
											</option>
										))}
									</select>
								</label>
								<div className="grid gap-3 sm:grid-cols-3">
									<label className="block space-y-1">
										<span className="text-sm text-mist">Buy</span>
										<select
											className="field"
											value={r.side}
											onChange={(e) => update(r.id, { side: e.target.value as Side })}
										>
											<option value="YES" className="bg-lock">
												YES
											</option>
											<option value="NO" className="bg-lock">
												NO
											</option>
										</select>
									</label>
									<label className="block space-y-1">
										<span className="text-sm text-mist">At most (0.01–0.99)</span>
										<div className="flex items-center gap-2">
											<span className="text-mist">0.</span>
											<input
												className="field"
												inputMode="numeric"
												maxLength={2}
												value={r.cents}
												onChange={(e) => update(r.id, { cents: e.target.value.replace(/\D/g, '') })}
											/>
										</div>
									</label>
									<label className="block space-y-1">
										<span className="text-sm text-mist">Spend up to (sDAI)</span>
										<input
											className="field"
											inputMode="decimal"
											value={r.limit}
											onChange={(e) => update(r.id, { limit: e.target.value })}
										/>
									</label>
								</div>
								<p className="text-sm text-mist">
									{Number.isInteger(cents) && cents >= 1 && cents <= 99
										? `${r.side} at 0.${r.cents.padStart(2, '0')} is a ${formatProbability(cents / 100)} chance. `
										: ''}
									{market ? `Expires ${formatOpening(market.openingTs)}, when the market opens to answers.` : ''}
								</p>
								{problems[i] && <p className="text-sm text-spillway">{problems[i]}</p>}
							</li>
						)
					})}
				</ol>
			)}
			<button
				type="button"
				className="btn-secondary"
				onClick={() => {
					setRows([...rows, { id: nextId, market: '', side: 'YES', cents: '20', limit: '' }])
					setNextId(nextId + 1)
				}}
			>
				Add another market
			</button>

			<div className="space-y-3 text-sm text-mist">
				<p>
					If several orders fill at once for more than you hold, the later ones fail without taking anything. You lose
					nothing, but you do not get into those markets.
				</p>
				<p>
					An order is a fixed price that does not follow the news. If the outcome becomes obvious before the market
					closes, someone can fill an order at its old price. Cancel it or pick a price you still want.
				</p>
			</div>

			<SignSummary
				moves={
					needsApproval
						? 'Nothing. You pay network fees, and allow OddsFlow orders to use your sDAI once.'
						: 'Nothing. You pay network fees.'
				}
				happens={`${withDefaults.length} order${withDefaults.length > 1 ? 's wait' : ' waits'} at your price until filled, cancelled or expired.`}
				doesNot="Your sDAI does not leave your wallet. OddsFlow itself never gets permission over it; only the orders you sign can use it, and only when they fill."
				undo="Cancel any order at any time, from My orders. The approval can be revoked from your wallet."
			/>

			<button
				type="button"
				className="btn-primary w-full sm:w-auto"
				disabled={Boolean(blocked) || tx.kind === 'pending'}
				onClick={place}
			>
				Place {withDefaults.length} order{withDefaults.length > 1 ? 's' : ''}
			</button>
			{blocked && <p className="text-sm text-mist">{blocked}</p>}
			<TxResult state={tx} />
		</main>
	)
}
