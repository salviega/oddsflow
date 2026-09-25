'use client'

import {
	averagePrice,
	COLLATERAL,
	formatAmount,
	formatPrice,
	formatProbability,
	formatTokens,
	oddsFlowTakerAbi,
	planBuy,
	priceToNumber,
} from '@oddsflow/core'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { encodeFunctionData, erc20Abi, parseUnits } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import type { BookOrder, Side } from '@/lib/book'
import { chain, deployment } from '@/lib/chain'
import type { Market } from '@/lib/markets'
import { type Call, explain, send } from '@/lib/tx'
import { SignSummary } from './SignSummary'
import { TxResult, type TxState } from './TxResult'

const known = {
	BelowMinimum:
		'Someone filled these orders first, so you would get less than you asked for. Nothing moved; check the new price and try again.',
	AboveMaximum: 'This would cost more than shown. Nothing moved; check the new price and try again.',
}

function parseTokens(text: string): bigint {
	try {
		return text.trim() === '' ? 0n : parseUnits(text.trim(), 18)
	} catch {
		return 0n
	}
}

export function BuyPanel({ market, orders }: { market: Market; orders: readonly BookOrder[] }) {
	const [side, setSide] = useState<Side>('NO')
	const [text, setText] = useState('100')
	const [tx, setTx] = useState<TxState>({ kind: 'idle' })
	const { address, chainId } = useAccount()
	const queryClient = useQueryClient()
	const d = deployment()
	const wanted = parseTokens(text)

	// Buying one side fills the orders buying the other.
	const counter = useMemo(
		() => orders.filter((o) => o.side !== side && o.status === 'active' && o.available > 0n),
		[orders, side],
	)
	const plan = useMemo(
		() =>
			planBuy(
				counter.map((o) => ({ strategyHash: o.strategyHash, price: o.price, available: o.available })),
				wanted,
			),
		[counter, wanted],
	)
	const avg = priceToNumber(averagePrice(plan))
	const bestPrice = counter.length > 0 ? 1 - Math.max(...counter.map((o) => priceToNumber(o.price))) : undefined

	const { data: allowance } = useReadContract({
		address: COLLATERAL,
		abi: erc20Abi,
		functionName: 'allowance',
		args: address && d ? [address, d.taker] : undefined,
		query: { enabled: Boolean(address && d) },
	})
	const { data: balance } = useReadContract({
		address: COLLATERAL,
		abi: erc20Abi,
		functionName: 'balanceOf',
		args: address ? [address] : undefined,
		query: { enabled: Boolean(address) },
	})

	const blocked = !d
		? 'OddsFlow is not deployed on this network yet.'
		: !address
			? 'Connect a wallet to buy.'
			: chainId !== chain.id
				? `Switch your wallet to ${chain.name}.`
				: wanted === 0n
					? 'Enter how many tokens you want.'
					: plan.tokens === 0n
						? `No orders are buying ${side === 'YES' ? 'NO' : 'YES'} right now, so there is no ${side} to buy.`
						: balance !== undefined && balance < plan.amount
							? `You need ${formatAmount(plan.amount)}; your wallet has ${formatAmount(balance)}.`
							: undefined

	async function buy() {
		if (!d || !address) {
			return
		}
		const byHash = new Map(counter.map((o) => [o.strategyHash, o.order]))
		const fillOrders = plan.fills.map((f) => byHash.get(f.strategyHash)).filter((o) => o !== undefined)
		const calls: Call[] = []
		if ((allowance ?? 0n) < plan.amount) {
			calls.push({
				to: COLLATERAL,
				data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [d.taker, plan.amount] }),
			})
		}
		calls.push({
			to: d.taker,
			data: encodeFunctionData({
				abi: oddsFlowTakerAbi,
				functionName: 'buy',
				args: [market.address, side === 'YES' ? 0n : 1n, fillOrders, plan.tokens, plan.tokens, plan.amount],
			}),
		})
		setTx({
			kind: 'pending',
			label: calls.length > 1 ? 'Confirm in your wallet (approve and buy)…' : 'Confirm in your wallet…',
		})
		try {
			const hashes = await send(calls)
			setTx({
				kind: 'done',
				hashes,
				message: `Bought ${formatTokens(plan.tokens, side)} for ${formatAmount(plan.amount)}.`,
			})
			await queryClient.invalidateQueries()
		} catch (e) {
			setTx({ kind: 'error', message: explain(e, known) })
		}
	}

	return (
		<section className="w-full max-w-md space-y-5" aria-labelledby="buy-heading">
			<h2 id="buy-heading" className="sr-only">
				Buy
			</h2>
			<fieldset className="grid grid-cols-2">
				<legend className="sr-only">Side to buy</legend>
				{(['YES', 'NO'] as const).map((s) => (
					<label
						key={s}
						className={`flex min-h-11 cursor-pointer items-center justify-center border font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gauge ${side === s ? (s === 'YES' ? 'border-yes bg-yes/15' : 'border-no bg-no/15') : 'border-silt text-mist'}`}
					>
						<input
							type="radio"
							name="side"
							value={s}
							checked={side === s}
							onChange={() => setSide(s)}
							className="sr-only"
						/>
						Buy {s}
					</label>
				))}
			</fieldset>

			<label className="block space-y-2">
				<span className="text-sm text-mist">How many {side} tokens</span>
				<div className="flex items-center gap-3">
					<input
						className="field text-lg"
						inputMode="decimal"
						value={text}
						onChange={(e) => setText(e.target.value)}
						aria-describedby="buy-plan"
					/>
					<span className="font-medium">{side}</span>
				</div>
			</label>

			<dl id="buy-plan" className="grid grid-cols-2 gap-y-2 tabular-nums">
				<dt className="text-mist">You pay</dt>
				<dd className="text-right text-lg font-semibold">{formatAmount(plan.amount)}</dd>
				<dt className="text-mist">You get</dt>
				<dd className="text-right">{formatTokens(plan.tokens, side)}</dd>
				<dt className="text-mist">Average price</dt>
				<dd className="text-right">
					{plan.tokens > 0n ? (
						<>
							{formatPrice(avg)} <span className="text-mist">· {formatProbability(avg)}</span>
						</>
					) : bestPrice !== undefined ? (
						<span className="text-mist">from {formatPrice(bestPrice)}</span>
					) : (
						'—'
					)}
				</dd>
				<dt className="text-mist">Orders filled</dt>
				<dd className="text-right">{plan.fills.length}</dd>
			</dl>
			{plan.tokens > 0n && plan.tokens < wanted && (
				<p className="text-sm text-mist">
					Open orders cover {formatTokens(plan.tokens, side)} of the {formatTokens(wanted, side)} you asked for.
				</p>
			)}

			<SignSummary
				moves={`${formatAmount(plan.amount)} from your wallet`}
				happens={`You receive ${formatTokens(plan.tokens, side)} in this transaction, at this price or it does not go through.`}
				doesNot="OddsFlow gets no permission beyond this purchase's exact amount."
				undo="Irreversible once confirmed. The tokens pay 1 sDAI each if the market resolves your way."
				irreversible
			/>

			<button
				type="button"
				className="btn-primary w-full"
				disabled={Boolean(blocked) || tx.kind === 'pending'}
				onClick={buy}
			>
				Buy {formatTokens(plan.tokens, side)} for {formatAmount(plan.amount)}
			</button>
			{blocked && <p className="text-sm text-mist">{blocked}</p>}
			<TxResult state={tx} />
		</section>
	)
}
