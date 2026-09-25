'use client'

import { marketFactoryAbi, SEER_MARKET_FACTORY } from '@oddsflow/core'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { encodeFunctionData, type Hex, parseEventLogs, zeroAddress } from 'viem'
import { useAccount } from 'wagmi'
import { chain, publicClient } from '@/lib/chain'
import { explain, send } from '@/lib/tx'
import { SignSummary } from './SignSummary'
import { TxResult, type TxState } from './TxResult'

// Seer's own minimum bond on Gnosis (10 xDAI): what answering the question on
// Reality.eth costs, paid by whoever answers. Creating the market is free.
const MIN_BOND = 10n * 10n ** 18n
const CATEGORIES = ['misc', 'crypto', 'politics', 'economy', 'technology', 'science', 'sports', 'entertainment']

const TEMPLATES = [
	'Will BTC trade above $150,000 at 00:00 UTC on 31 December 2026 according to CoinGecko?',
	'Will [project] launch its token before 1 January 2027?',
	'Will [team] win [competition] in 2026?',
]

function endOfMonth(): Date {
	const d = new Date()
	return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59)
}

function endOfYear(): Date {
	return new Date(new Date().getFullYear(), 11, 31, 23, 59)
}

function toLocalInput(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function CreateMarket() {
	const { address, chainId } = useAccount()
	const router = useRouter()
	const queryClient = useQueryClient()
	const [question, setQuestion] = useState('')
	const [opening, setOpening] = useState(() => toLocalInput(new Date(Date.now() + 30 * 86_400_000)))
	const [category, setCategory] = useState('misc')
	const [tx, setTx] = useState<TxState>({ kind: 'idle' })

	const text = question.trim()
	const openingTs = Math.floor(new Date(opening).getTime() / 1000)
	const now = Math.floor(Date.now() / 1000)
	const checks = [
		{ ok: text.length >= 10 && text.length <= 250, label: 'Between 10 and 250 characters' },
		{ ok: text.endsWith('?'), label: 'Ends with a question mark' },
		{
			ok: /\b(19|20)\d{2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.test(text),
			label: 'Says when (a date or year)',
		},
		{
			ok: /\b(according to|per|source|on (binance|coingecko|coinmarketcap))\b/i.test(text),
			label: 'Names a source (recommended)',
		},
		{ ok: !/\[[^\]]*\]/.test(text), label: 'No [placeholders] left' },
	]

	const problem = !address
		? 'Connect a wallet to create a market.'
		: chainId !== chain.id
			? `Switch your wallet to ${chain.name}.`
			: text.length < 10
				? 'Write the question: at least 10 characters.'
				: text.length > 250
					? 'Keep the question under 250 characters.'
					: !text.endsWith('?')
						? 'End the question with a question mark.'
						: /\[[^\]]*\]/.test(text)
							? 'Replace the [placeholders] in the question.'
							: !Number.isFinite(openingTs) || openingTs < now + 3600
								? 'The answer date must be at least one hour from now.'
								: openingTs > now + 5 * 365 * 86_400
									? 'The answer date must be within five years.'
									: undefined

	async function create() {
		setTx({ kind: 'pending', label: 'Confirm in your wallet…' })
		try {
			const hashes = await send([
				{
					to: SEER_MARKET_FACTORY,
					data: encodeFunctionData({
						abi: marketFactoryAbi,
						functionName: 'createCategoricalMarket',
						args: [
							{
								marketName: text,
								outcomes: ['Yes', 'No'],
								questionStart: '',
								questionEnd: '',
								outcomeType: '',
								parentOutcome: 0n,
								parentMarket: zeroAddress,
								category,
								lang: 'en_US',
								lowerBound: 0n,
								upperBound: 0n,
								minBond: MIN_BOND,
								openingTime: openingTs,
								tokenNames: ['YES', 'NO'],
							},
						],
					}),
				},
			])
			const receipt = await publicClient.getTransactionReceipt({ hash: hashes.at(-1) as Hex })
			const [created] = parseEventLogs({ abi: marketFactoryAbi, eventName: 'NewMarket', logs: receipt.logs })
			if (!created) {
				throw new Error('reverted')
			}
			setTx({ kind: 'done', hashes, message: 'Market created on Seer. Opening it…' })
			await queryClient.invalidateQueries()
			router.push(`/markets/${created.args.market}`)
		} catch (e) {
			setTx({ kind: 'error', message: explain(e) })
		}
	}

	const openingLabel = Number.isFinite(openingTs)
		? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(openingTs * 1000))
		: '—'

	return (
		<main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_22rem]">
			<div className="space-y-8">
				<header className="space-y-2">
					<h1 className="text-3xl font-semibold tracking-tight">Create a market</h1>
					<p className="max-w-2xl text-mist">
						A YES/NO question on Seer, backed by sDAI. Once it exists, anyone can place OddsFlow orders on it or trade
						it on Seer.
					</p>
				</header>

				<section className="space-y-3" aria-labelledby="q-heading">
					<h2 id="q-heading" className="text-lg font-semibold">
						1 · The question
					</h2>
					<div className="flex flex-wrap gap-2">
						{TEMPLATES.map((t) => (
							<button key={t} type="button" className="btn-secondary text-sm" onClick={() => setQuestion(t)}>
								{t.length > 42 ? `${t.slice(0, 42)}…` : t}
							</button>
						))}
					</div>
					<textarea
						className="field min-h-28 py-2 text-lg"
						maxLength={250}
						aria-label="Question"
						placeholder="Will ETH trade above $3,000 at 00:00 UTC on 31 December 2026?"
						value={question}
						onChange={(e) => setQuestion(e.target.value)}
					/>
					<ul className="grid gap-1 text-sm sm:grid-cols-2">
						{checks.map((c) => (
							<li key={c.label} className={c.ok ? 'text-spillway' : 'text-mist'}>
								<span aria-hidden="true">{c.ok ? '✓' : '○'}</span> {c.label}
								<span className="sr-only">{c.ok ? ' (done)' : ' (not yet)'}</span>
							</li>
						))}
					</ul>
				</section>

				<section className="space-y-3" aria-labelledby="when-heading">
					<h2 id="when-heading" className="text-lg font-semibold">
						2 · When it can be answered
					</h2>
					<p className="text-sm text-mist">
						The moment the outcome can be known. Reality.eth accepts answers from then; OddsFlow orders stop filling at
						the first answer.
					</p>
					<div className="flex flex-wrap gap-2">
						{[
							{ label: 'In 30 days', date: new Date(Date.now() + 30 * 86_400_000) },
							{ label: 'End of month', date: endOfMonth() },
							{ label: 'End of year', date: endOfYear() },
						].map((p) => (
							<button
								key={p.label}
								type="button"
								className="btn-secondary text-sm"
								onClick={() => setOpening(toLocalInput(p.date))}
							>
								{p.label}
							</button>
						))}
						<input
							type="datetime-local"
							aria-label="Answer date"
							className="field w-auto"
							value={opening}
							onChange={(e) => setOpening(e.target.value)}
						/>
					</div>
				</section>

				<section className="space-y-3" aria-labelledby="cat-heading">
					<h2 id="cat-heading" className="text-lg font-semibold">
						3 · Category
					</h2>
					<div className="flex flex-wrap gap-2">
						{CATEGORIES.map((c) => (
							<button
								key={c}
								type="button"
								aria-pressed={category === c}
								onClick={() => setCategory(c)}
								className={`min-h-11 border px-4 capitalize ${category === c ? 'border-gauge text-spillway' : 'border-silt text-mist'}`}
							>
								{c}
							</button>
						))}
					</div>
				</section>
			</div>

			<aside className="space-y-5 lg:sticky lg:top-6 lg:self-start" aria-labelledby="preview-heading">
				<h2 id="preview-heading" className="text-sm text-mist">
					How it will look
				</h2>
				<div className="space-y-4 border border-silt/60 p-4">
					<div className="flex gap-3">
						<div className="h-10 w-10 shrink-0 bg-spillway/10" aria-hidden="true" />
						<p className="line-clamp-4 font-medium leading-snug">{text || 'Your question'}</p>
					</div>
					<div className="flex items-center justify-between text-sm">
						<span>
							<span className="text-yes">Yes</span> · <span className="text-no">No</span>
						</span>
						<span className="capitalize text-mist">{category}</span>
					</div>
					<p className="border-t border-silt/40 pt-3 text-sm text-mist">Answerable from {openingLabel}</p>
				</div>

				<SignSummary
					moves="Nothing. You pay the network fee."
					happens="A public YES/NO market is created on Seer, answered on Reality.eth from the date above by anyone who posts a 10 xDAI bond; final 3.5 days after the last answer."
					doesNot="OddsFlow does not own, run or resolve it. Seer lists it as unverified until Kleros Curate."
					undo="Irreversible: a market cannot be edited or deleted."
					irreversible
				/>

				<button
					type="button"
					className="btn-primary w-full"
					disabled={Boolean(problem) || tx.kind === 'pending'}
					onClick={create}
				>
					Create market on Seer
				</button>
				{problem && <p className="text-sm text-mist">{problem}</p>}
				<TxResult state={tx} />
			</aside>
		</main>
	)
}
