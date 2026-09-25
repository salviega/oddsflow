// Seer's markets, from the public API its own app uses (app.seer.pm):
// paginated search over an index Seer keeps in sync with chain, with images,
// odds and liquidity already computed. Third-party and unversioned, so every
// response is validated; if Seer is down the list is empty, while trading
// keeps working on chain. Read on the server only, cached.

import { COLLATERAL } from '@oddsflow/core'
import { type Address, getAddress, type Hex } from 'viem'
import { z } from 'zod'

const SEER_SEARCH = 'https://app.seer.pm/.netlify/functions/markets-search'
const ZERO = '0x0000000000000000000000000000000000000000'

const hex = z.string().regex(/^0x[0-9a-fA-F]*$/)

const seerMarket = z.object({
	id: hex,
	marketName: z.string(),
	chainId: z.number(),
	templateId: z.union([z.number(), z.string()]),
	outcomes: z.array(z.string()),
	collateralToken: hex,
	parentMarket: z.object({ id: hex }).nullish(),
	conditionId: hex,
	// questions[0].id is the Reality.eth question; the top-level questionId is
	// Seer's own hash of the questions and must not be used for Reality reads.
	questions: z.array(z.object({ id: hex })).min(1),
	wrappedTokens: z.array(hex).min(3),
	openingTs: z.number(),
	hasAnswers: z.boolean().nullish(),
	payoutReported: z.boolean().nullish(),
	odds: z.array(z.number().nullable()).nullish(),
	liquidityUSD: z.number().nullish(),
	images: z.object({ market: z.string().url().nullish() }).nullish(),
	verification: z.object({ status: z.string() }).nullish(),
})

const searchResponse = z.object({ markets: z.array(z.unknown()), count: z.number(), pages: z.number() })

export type Market = {
	address: Address
	name: string
	conditionId: Hex
	/** The Reality.eth question; OddsFlow orders stop filling once it has any answer. */
	questionId: Hex
	openingTs: number
	resolved: boolean
	yes: Address
	no: Address
	invalid: Address
	/** Seer's own market odds (its AMM), 0–100, for YES and NO. Reference only. */
	odds?: { yes: number; no: number }
	liquidityUSD?: number
	image?: string
	verified?: boolean
}

/** Plain YES/NO on sDAI, not yet answered: the markets an OddsFlow order can back. */
function toMarket(raw: unknown): Market | null {
	const r = seerMarket.safeParse(raw)
	if (!r.success) {
		return null
	}
	const m = r.data
	const [first, second] = m.outcomes.map((o) => o.toLowerCase())
	const plain =
		m.chainId === 100 &&
		String(m.templateId) === '2' &&
		first === 'yes' &&
		second === 'no' &&
		(m.parentMarket?.id ?? ZERO).toLowerCase() === ZERO &&
		m.collateralToken.toLowerCase() === COLLATERAL.toLowerCase() &&
		!m.hasAnswers &&
		!m.payoutReported
	if (!plain) {
		return null
	}
	const [yes, no, invalid] = m.wrappedTokens.map((t) => getAddress(t))
	const [oddsYes, oddsNo] = m.odds ?? []
	return {
		address: getAddress(m.id),
		name: m.marketName,
		conditionId: m.conditionId as Hex,
		questionId: (m.questions[0] as { id: string }).id as Hex,
		openingTs: m.openingTs,
		resolved: false,
		yes: yes as Address,
		no: no as Address,
		invalid: invalid as Address,
		odds: typeof oddsYes === 'number' && typeof oddsNo === 'number' ? { yes: oddsYes, no: oddsNo } : undefined,
		liquidityUSD: m.liquidityUSD ?? undefined,
		image: m.images?.market ?? undefined,
		verified: m.verification?.status === 'verified',
	}
}

// Seer's statuses: 'not_open' (before the question accepts answers) and 'open'
// (accepting answers, none yet). Both can back an order; the opcode stops
// fills at the first answer either way.
const STATUSES = ['not_open', 'open']

async function searchPage(page: number): Promise<{ markets: unknown[]; pages: number }> {
	const res = await fetch(SEER_SEARCH, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			chainsList: ['100'],
			marketStatusList: STATUSES,
			limit: 100,
			page,
			// Paging over a stable order: many markets share a liquidity value, and
			// offset paging over ties repeats some markets and skips others.
			orderBy: 'creationDate',
			orderDirection: 'desc',
		}),
		cache: 'no-store',
	})
	if (!res.ok) {
		throw new Error(`Seer markets-search: ${res.status}`)
	}
	return searchResponse.parse(await res.json())
}

/** Every open market an OddsFlow order can back, most liquid first. */
export async function getSeerMarkets(): Promise<Market[]> {
	const first = await searchPage(1)
	const rest = await Promise.all(Array.from({ length: Math.max(0, first.pages - 1) }, (_, i) => searchPage(i + 2)))
	const byAddress = new Map<string, Market>()
	for (const raw of [first, ...rest].flatMap((p) => p.markets)) {
		const m = toMarket(raw)
		if (m) {
			byAddress.set(m.address, m)
		}
	}
	return [...byAddress.values()].sort((a, b) => (b.liquidityUSD ?? 0) - (a.liquidityUSD ?? 0))
}
