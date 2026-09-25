'use client'

import {
	AQUA,
	aquaAbi,
	buildOrder,
	COLLATERAL,
	CONDITIONAL_TOKENS,
	encodeStrategy,
	formatAmount,
	priceFromCents,
	REALITY_ETH,
} from '@oddsflow/core'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { encodeFunctionData, erc20Abi, formatUnits, maxUint256, parseUnits } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { useOpenMarkets } from '@/hooks/useMarkets'
import type { Side } from '@/lib/book'
import { chain, deployment } from '@/lib/chain'
import type { Market } from '@/lib/seer-api'
import { type Call, explain, send } from '@/lib/tx'
import { GaugeSlider } from './GaugeSlider'
import { OddsRing } from './OddsRing'
import { SignSummary } from './SignSummary'
import { TxResult, type TxState } from './TxResult'

type Draft = { market: string; side: Side; cents: number; limit: string; days: number }

const EXPIRIES = [1, 7, 30]
const PICKER_SIZE = 8

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

function seerOdds(market: Market | undefined, side: Side): number | undefined {
	if (!market?.odds) {
		return undefined
	}
	return (side === 'YES' ? market.odds.yes : market.odds.no) / 100
}

function draftProblem(d: Draft): string | undefined {
	if (!parseAmount(d.limit)) {
		return 'Enter the most this order may spend.'
	}
	if (!Number.isInteger(d.days) || d.days < 1 || d.days > 365) {
		return 'Expiry must be between 1 and 365 days.'
	}
	return undefined
}

function MarketTile({ market, selected, onToggle }: { market: Market; selected: boolean; onToggle: () => void }) {
	return (
		<li>
			<button
				type="button"
				aria-pressed={selected}
				onClick={onToggle}
				className={`flex h-full w-full flex-col gap-3 border p-3 text-left ${selected ? 'border-gauge bg-gauge/10' : 'border-silt/50 hover:border-mist'}`}
			>
				<span className="flex gap-2">
					{market.image ? (
						// biome-ignore lint/performance/noImgElement: remote IPFS image from Seer's CDN
						<img src={market.image} alt="" width={28} height={28} className="h-7 w-7 shrink-0 object-cover" />
					) : (
						<span className="h-7 w-7 shrink-0 bg-spillway/10" aria-hidden="true" />
					)}
					<span className="line-clamp-2 text-sm font-medium leading-snug">{market.name}</span>
				</span>
				<span className="mt-auto flex items-center justify-between text-xs tabular-nums">
					<span className="text-mist">
						{market.odds ? (
							<>
								<span className="text-yes">Yes</span> {market.odds.yes.toFixed(0)}%
							</>
						) : (
							'No Seer odds'
						)}
					</span>
					<span className={selected ? 'font-semibold text-gauge' : 'text-mist'}>{selected ? '✓ Added' : '+ Add'}</span>
				</span>
			</button>
		</li>
	)
}

function OrderEditor({
	draft,
	market,
	balance,
	onChange,
	onRemove,
}: {
	draft: Draft
	market: Market | undefined
	balance: bigint | undefined
	onChange: (patch: Partial<Draft>) => void
	onRemove: () => void
}) {
	const reference = seerOdds(market, draft.side)
	const price = draft.cents / 100
	const diff = reference !== undefined ? Math.round((price - reference) * 100) : undefined
	const problem = draftProblem(draft)
	return (
		<li className="space-y-4 border border-silt/60 p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="flex gap-3">
					{market?.odds && <OddsRing yes={market.odds.yes} no={market.odds.no} />}
					<h3 className="font-medium leading-snug">{market?.name ?? draft.market}</h3>
				</div>
				<button
					type="button"
					onClick={onRemove}
					className="min-h-11 shrink-0 px-2 text-sm text-mist hover:text-spillway"
				>
					Remove
				</button>
			</div>

			<div className="flex flex-col gap-6 sm:flex-row">
				<GaugeSlider
					cents={draft.cents}
					side={draft.side}
					reference={reference}
					onChange={(cents) => onChange({ cents })}
					label={`Price for ${market?.name ?? 'this market'}`}
				/>

				<div className="flex-1 space-y-4">
					<fieldset className="grid grid-cols-2">
						<legend className="mb-1 text-sm text-mist">Buy</legend>
						{(['YES', 'NO'] as const).map((s) => (
							<label
								key={s}
								className={`flex min-h-11 cursor-pointer items-center justify-center border font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gauge ${draft.side === s ? (s === 'YES' ? 'border-yes bg-yes/15' : 'border-no bg-no/15') : 'border-silt text-mist'}`}
							>
								<input
									type="radio"
									className="sr-only"
									name={`side-${draft.market}`}
									checked={draft.side === s}
									onChange={() => onChange({ side: s })}
								/>
								{s}
							</label>
						))}
					</fieldset>

					<p className="text-sm">
						Buy <span className={draft.side === 'YES' ? 'text-yes' : 'text-no'}>{draft.side}</span> at{' '}
						<span className="font-semibold tabular-nums">{price.toFixed(2)}</span> or less —{' '}
						<span className="tabular-nums">{draft.cents}%</span> chance.{' '}
						{diff !== undefined && (
							<span className="text-mist">
								{diff === 0
									? 'Same as Seer now.'
									: diff < 0
										? `${-diff} points under Seer: it fills if someone sells ${draft.side} cheaper than Seer.`
										: `${diff} points over Seer: likely to fill soon.`}
							</span>
						)}
					</p>

					<label className="block space-y-1">
						<span className="text-sm text-mist">Spend up to</span>
						<div className="flex gap-2">
							<input
								className="field"
								inputMode="decimal"
								value={draft.limit}
								onChange={(e) => onChange({ limit: e.target.value })}
							/>
							<button
								type="button"
								className="btn-secondary"
								disabled={!balance}
								onClick={() => balance && onChange({ limit: Number(formatUnits(balance, 18)).toFixed(2) })}
							>
								Max
							</button>
						</div>
					</label>

					<fieldset>
						<legend className="mb-1 text-sm text-mist">Expires in</legend>
						<div className="flex flex-wrap gap-2">
							{EXPIRIES.map((days) => (
								<button
									key={days}
									type="button"
									aria-pressed={draft.days === days}
									onClick={() => onChange({ days })}
									className={`min-h-11 border px-4 ${draft.days === days ? 'border-gauge text-spillway' : 'border-silt text-mist'}`}
								>
									{days === 1 ? '1 day' : `${days} days`}
								</button>
							))}
							<label className="flex items-center gap-2 text-sm text-mist">
								<input
									className="field w-20"
									inputMode="numeric"
									aria-label="Custom expiry in days"
									value={draft.days}
									onChange={(e) => onChange({ days: Number(e.target.value.replace(/\D/g, '')) || 0 })}
								/>
								days
							</label>
						</div>
						<p className="mt-1 text-xs text-mist">
							It also stops the moment anyone answers the question on Reality.eth.
						</p>
					</fieldset>
					{problem && <p className="text-sm text-spillway">{problem}</p>}
				</div>
			</div>
		</li>
	)
}

export function NewOrders({ initialMarket = '' }: { initialMarket?: string }) {
	const markets = useOpenMarkets()
	const { address, chainId } = useAccount()
	const queryClient = useQueryClient()
	const d = deployment()
	const [query, setQuery] = useState('')
	const [drafts, setDrafts] = useState<Draft[]>(() =>
		initialMarket ? [{ market: initialMarket, side: 'YES', cents: 20, limit: '', days: 7 }] : [],
	)
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
	const byAddress = useMemo(() => new Map(list.map((m) => [m.address.toLowerCase(), m])), [list])
	const find = (a: string) => byAddress.get(a.toLowerCase())
	const shown = useMemo(() => {
		const q = query.trim().toLowerCase()
		return (q ? list.filter((m) => m.name.toLowerCase().includes(q)) : list).slice(0, PICKER_SIZE)
	}, [list, query])
	const selected = new Set(drafts.map((x) => x.market.toLowerCase()))

	const defaultLimit = balance ? Number(formatUnits(balance, 18)).toFixed(2) : ''
	const withLimits = drafts.map((x) => ({ ...x, limit: x.limit || defaultLimit }))
	const needsApproval = (allowance ?? 0n) < maxUint256 / 2n

	const blocked = !d
		? 'OddsFlow is not deployed on this network yet.'
		: !address
			? 'Connect a wallet to place orders.'
			: chainId !== chain.id
				? `Switch your wallet to ${chain.name}.`
				: drafts.length === 0
					? 'Add at least one market.'
					: balance === 0n
						? 'Your wallet has no sDAI. Orders need sDAI in the wallet to fill.'
						: withLimits.map(draftProblem).find((p) => p !== undefined)

	function toggle(m: Market) {
		setDrafts((current) =>
			current.some((x) => x.market.toLowerCase() === m.address.toLowerCase())
				? current.filter((x) => x.market.toLowerCase() !== m.address.toLowerCase())
				: [
						...current,
						{
							market: m.address,
							side: 'YES',
							cents: m.odds ? Math.min(99, Math.max(1, Math.round(m.odds.yes) - 5)) : 20,
							limit: '',
							days: 7,
						},
					],
		)
	}

	function update(market: string, patch: Partial<Draft>) {
		setDrafts((current) => current.map((x) => (x.market === market ? { ...x, ...patch } : x)))
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
		for (const x of withLimits) {
			const market = find(x.market)
			if (!market) {
				continue
			}
			const tokenIn = x.side === 'YES' ? market.yes : market.no
			const order = buildOrder(address, {
				conditionalTokens: CONDITIONAL_TOKENS,
				conditionId: market.conditionId,
				realitio: REALITY_ETH,
				questionId: market.questionId,
				deadline: Math.floor(Date.now() / 1000) + x.days * 86_400,
				tokenIn,
				tokenOut: COLLATERAL,
				price: priceFromCents(x.cents),
				salt: randomSalt(),
			})
			calls.push({
				to: AQUA,
				data: encodeFunctionData({
					abi: aquaAbi,
					functionName: 'ship',
					args: [d.router, encodeStrategy(order), [tokenIn, COLLATERAL], [0n, parseAmount(x.limit) as bigint]],
				}),
			})
		}
		const n = withLimits.length
		setTx({ kind: 'pending', label: `Confirm in your wallet (${n} order${n > 1 ? 's' : ''})…` })
		try {
			const hashes = await send(calls)
			setTx({
				kind: 'done',
				hashes,
				message: `${n} order${n > 1 ? 's are' : ' is'} live. Your sDAI stays in your wallet until one fills.`,
			})
			setDrafts([])
			await queryClient.invalidateQueries()
		} catch (e) {
			setTx({ kind: 'error', message: explain(e) })
		}
	}

	return (
		<main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_22rem]">
			<div className="space-y-8">
				<header className="space-y-2">
					<h1 className="text-3xl font-semibold tracking-tight">New orders</h1>
					<p className="max-w-2xl text-mist">
						Pick markets, set a price on each, and publish them together. Every order can use your whole balance: the
						money leaves your wallet only when someone takes the other side.
					</p>
				</header>

				<section className="space-y-3" aria-labelledby="pick-heading">
					<div className="flex flex-wrap items-end justify-between gap-3">
						<h2 id="pick-heading" className="text-lg font-semibold">
							1 · Pick markets
						</h2>
						<input
							className="field w-full sm:w-72"
							placeholder="Search markets"
							aria-label="Search markets"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
						/>
					</div>
					{markets.isPending ? (
						<div role="status" className="h-40 animate-pulse bg-spillway/5">
							<span className="sr-only">Loading markets</span>
						</div>
					) : markets.isError ? (
						<p role="alert" className="border border-silt px-3 py-2">
							Could not read the markets from Seer. Reload to try again.
						</p>
					) : shown.length === 0 ? (
						<p className="text-mist">No open market matches “{query}”.</p>
					) : (
						<ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
							{shown.map((m) => (
								<MarketTile
									key={m.address}
									market={m}
									selected={selected.has(m.address.toLowerCase())}
									onToggle={() => toggle(m)}
								/>
							))}
						</ul>
					)}
				</section>

				<section className="space-y-3" aria-labelledby="set-heading">
					<h2 id="set-heading" className="text-lg font-semibold">
						2 · Set each order
					</h2>
					{drafts.length === 0 ? (
						<p className="border border-dashed border-silt/60 px-4 py-8 text-center text-mist">
							Add a market above. Drag the gate on its gauge to set your price.
						</p>
					) : (
						<ol className="space-y-4">
							{withLimits.map((x) => (
								<OrderEditor
									key={x.market}
									draft={x}
									market={find(x.market)}
									balance={balance}
									onChange={(patch) => update(x.market, patch)}
									onRemove={() => setDrafts((current) => current.filter((y) => y.market !== x.market))}
								/>
							))}
						</ol>
					)}
				</section>
			</div>

			<aside className="space-y-5 lg:sticky lg:top-6 lg:self-start" aria-labelledby="balance-heading">
				<div className="space-y-4 border border-silt/60 p-4">
					<h2 id="balance-heading" className="text-sm text-mist">
						One balance, every order
					</h2>
					<p className="text-2xl font-semibold tabular-nums">{balance === undefined ? '—' : formatAmount(balance)}</p>
					{withLimits.length > 0 && balance ? (
						<ul className="space-y-2">
							{withLimits.map((x) => {
								const limit = parseAmount(x.limit) ?? 0n
								const share = balance > 0n ? Math.min(100, Number((limit * 100n) / balance)) : 0
								return (
									<li key={x.market} className="space-y-1">
										<div className="flex justify-between gap-2 text-xs">
											<span className="truncate text-mist">{find(x.market)?.name ?? x.market}</span>
											<span className="shrink-0 tabular-nums">{x.limit || '0'}</span>
										</div>
										<div className="h-2 bg-spillway/10">
											<div className="h-2 bg-gauge" style={{ width: `${share}%` }} />
										</div>
									</li>
								)
							})}
						</ul>
					) : null}
					<p className="text-xs text-mist">
						Each bar is what that order may spend, and each draws on the same sDAI. Nothing moves until a fill; if fills
						add up to more than you hold, the later ones fail and you lose nothing.
					</p>
				</div>

				<SignSummary
					moves={
						needsApproval ? 'Nothing. Network fee, and a one-time approval to Aqua.' : 'Nothing. Network fee only.'
					}
					happens={`${drafts.length || 'Your'} order${drafts.length === 1 ? '' : 's'} wait at your price until filled, cancelled, expired or the question gets an answer.`}
					doesNot="OddsFlow never gets permission over your sDAI; only your orders can use it, and only when they fill."
					undo="Cancel any order at any time from My orders."
				/>
				<details className="text-sm text-mist">
					<summary className="cursor-pointer">A fixed price does not follow the news</summary>
					<p className="mt-2">
						If the outcome becomes obvious before anyone answers, someone can fill your order at its old price. Pick a
						short expiry for markets that move fast.
					</p>
				</details>

				<button
					type="button"
					className="btn-primary w-full"
					disabled={Boolean(blocked) || tx.kind === 'pending'}
					onClick={place}
				>
					Place {drafts.length || ''} order{drafts.length === 1 ? '' : 's'}
				</button>
				{blocked && <p className="text-sm text-mist">{blocked}</p>}
				<TxResult state={tx} />
			</aside>
		</main>
	)
}
