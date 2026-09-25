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

	return (
		<main className="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-6">
			<header className="space-y-2">
				<h1 className="text-3xl font-semibold tracking-tight">Create a market</h1>
				<p className="text-mist">
					A YES/NO question on Seer, backed by sDAI. Anyone can then place OddsFlow orders on it or trade it on Seer.
				</p>
			</header>

			<label className="block space-y-2">
				<span className="text-sm text-mist">Question</span>
				<textarea
					className="field min-h-24 py-2"
					maxLength={250}
					placeholder="Will ETH trade above $3,000 at 00:00 UTC on 31 December 2026?"
					value={question}
					onChange={(e) => setQuestion(e.target.value)}
				/>
				<span className="block text-sm text-mist">
					Answerable with Yes or No, with a date and a source when it helps. {text.length}/250
				</span>
			</label>

			<div className="grid gap-4 sm:grid-cols-2">
				<label className="block space-y-2">
					<span className="text-sm text-mist">Can be answered from</span>
					<input type="datetime-local" className="field" value={opening} onChange={(e) => setOpening(e.target.value)} />
					<span className="block text-sm text-mist">When the outcome can be known, in your time zone.</span>
				</label>
				<label className="block space-y-2">
					<span className="text-sm text-mist">Category</span>
					<select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
						{CATEGORIES.map((c) => (
							<option key={c} value={c} className="bg-lock">
								{c}
							</option>
						))}
					</select>
				</label>
			</div>

			<SignSummary
				moves="Nothing. You pay the network fee."
				happens="A public YES/NO market is created on Seer. Its question is answered on Reality.eth from the date above, by anyone who posts a 10 xDAI bond; the answer is final 3.5 days after the last one."
				doesNot="OddsFlow does not own, run or resolve the market. Seer lists it as unverified until it passes Kleros Curate."
				undo="Irreversible: a market cannot be edited or deleted once created."
				irreversible
			/>

			<button
				type="button"
				className="btn-primary w-full sm:w-auto"
				disabled={Boolean(problem) || tx.kind === 'pending'}
				onClick={create}
			>
				Create market on Seer
			</button>
			{problem && <p className="text-sm text-mist">{problem}</p>}
			<TxResult state={tx} />
		</main>
	)
}
