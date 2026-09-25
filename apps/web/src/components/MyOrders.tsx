'use client'

import { AQUA, aquaAbi, COLLATERAL, formatAmount, formatPrice, formatProbability, priceToNumber } from '@oddsflow/core'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { encodeFunctionData, erc20Abi } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { useBook } from '@/hooks/useBook'
import { useOpenMarkets } from '@/hooks/useMarkets'
import type { BookOrder } from '@/lib/book'
import { deployment } from '@/lib/chain'
import { formatOpening } from '@/lib/dates'
import { explain, send } from '@/lib/tx'
import { TxResult, type TxState } from './TxResult'

const statusLabel = { active: 'Active', filled: 'Filled', expired: 'Expired', cancelled: 'Cancelled' } as const

function OrderRow({
	order,
	marketName,
	onCancel,
	busy,
}: {
	order: BookOrder
	marketName: string
	onCancel: () => void
	busy: boolean
}) {
	const p = priceToNumber(order.price)
	const short = order.status === 'active' && order.available < order.capLeft
	return (
		<li className="grid gap-3 border border-silt/60 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
			<div className="space-y-1">
				<Link href={`/markets/${order.market}`} className="font-medium hover:underline">
					{marketName}
				</Link>
				<p className="tabular-nums">
					<span className={order.side === 'YES' ? 'text-yes' : 'text-no'}>{order.side}</span> at {formatPrice(p)}{' '}
					<span className="text-mist">· {formatProbability(p)}</span>
				</p>
				<p className="text-sm tabular-nums text-mist">
					{statusLabel[order.status]} · filled {formatAmount(order.filled)}
					{order.status !== 'cancelled' && <> of {formatAmount(order.cap)}</>}
					{order.status === 'active' && <> · expires {formatOpening(order.deadline)}</>}
				</p>
				{order.status === 'active' && (
					<p className="text-sm tabular-nums">
						Can cover {formatAmount(order.available)} today
						{short && <span className="text-mist"> — your wallet holds less than this order's limit</span>}
					</p>
				)}
			</div>
			{order.status === 'active' && (
				<button type="button" className="btn-secondary" disabled={busy} onClick={onCancel}>
					Cancel order
				</button>
			)}
		</li>
	)
}

export function MyOrders() {
	const { address } = useAccount()
	const markets = useOpenMarkets()
	const book = useBook(markets.data)
	const queryClient = useQueryClient()
	const d = deployment()
	const [tx, setTx] = useState<TxState>({ kind: 'idle' })
	const { data: balance } = useReadContract({
		address: COLLATERAL,
		abi: erc20Abi,
		functionName: 'balanceOf',
		args: address ? [address] : undefined,
		query: { enabled: Boolean(address) },
	})

	const mine = (book.data ?? []).filter((o) => address && o.maker.toLowerCase() === address.toLowerCase())
	const name = (a: string) => markets.data?.find((m) => m.address === a)?.name ?? a
	const order = { active: 0, filled: 1, expired: 2, cancelled: 3 }
	mine.sort((a, b) => order[a.status] - order[b.status])

	async function cancel(o: BookOrder) {
		if (!d) {
			return
		}
		setTx({ kind: 'pending', label: 'Confirm the cancellation in your wallet…' })
		try {
			const hashes = await send([
				{
					to: AQUA,
					data: encodeFunctionData({
						abi: aquaAbi,
						functionName: 'dock',
						args: [d.router, o.strategyHash, [o.params.tokenIn, COLLATERAL]],
					}),
				},
			])
			setTx({
				kind: 'done',
				hashes,
				message: 'Order cancelled. It can no longer fill; nothing it already filled changes.',
			})
			await queryClient.invalidateQueries()
		} catch (e) {
			setTx({ kind: 'error', message: explain(e) })
		}
	}

	return (
		<main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
			<header className="space-y-2">
				<h1 className="text-3xl font-semibold tracking-tight">My orders</h1>
				<p className="tabular-nums">
					<span className="text-mist">Available balance </span>
					<span className="font-semibold">{balance === undefined ? '—' : formatAmount(balance)}</span>
					<span className="text-mist"> — every active order draws on it</span>
				</p>
			</header>
			<TxResult state={tx} />
			{!address ? (
				<p className="text-mist">Connect a wallet to see your orders.</p>
			) : book.isPending || markets.isPending ? (
				<div role="status" className="h-40 animate-pulse bg-spillway/5">
					<span className="sr-only">Loading your orders</span>
				</div>
			) : book.isError || markets.isError ? (
				<p role="alert" className="border border-silt px-3 py-2">
					Could not read your orders from the network. It retries every 15 seconds.
				</p>
			) : mine.length === 0 ? (
				<p className="text-mist">
					No orders yet.{' '}
					<Link href="/orders/new" className="text-spillway underline">
						Place your first ones
					</Link>{' '}
					— one balance backs all of them.
				</p>
			) : (
				<ul className="space-y-3">
					{mine.map((o) => (
						<OrderRow
							key={o.strategyHash}
							order={o}
							marketName={name(o.market)}
							busy={tx.kind === 'pending'}
							onCancel={() => cancel(o)}
						/>
					))}
				</ul>
			)}
		</main>
	)
}
