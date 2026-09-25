// The order book, rebuilt from Aqua's events and live reads (spec 05 §4).
// An order the web does not fully understand (other opcodes, other router,
// other collateral) never enters it.

import {
	AQUA,
	aquaAbi,
	COLLATERAL,
	coverableToday,
	type Deployment,
	decodeStrategy,
	type Order,
	type OrderParams,
	type OrderStatus,
	orderStatus,
	parseOrder,
} from '@oddsflow/core'
import { type Address, erc20Abi, type Hex, isAddressEqual, parseAbiItem } from 'viem'
import { publicClient } from './chain'
import type { Market } from './markets'

export type Side = 'YES' | 'NO'

export type BookOrder = {
	strategyHash: Hex
	order: Order
	params: OrderParams
	maker: Address
	market: Address
	/** The side the maker buys. */
	side: Side
	/** sDAI per token, 1e18 scale. */
	price: bigint
	/** sDAI the order started with. */
	cap: bigint
	/** sDAI already paid on fills. */
	filled: bigint
	capLeft: bigint
	status: OrderStatus
	/** sDAI the order can pay today (0 unless active). */
	available: bigint
	/** What the maker can pay across all their orders: min(balance, approval to Aqua). */
	makerFunds: bigint
	deadline: number
}

const shipped = parseAbiItem('event Shipped(address maker, address app, bytes32 strategyHash, bytes strategy)')
const docked = parseAbiItem('event Docked(address maker, address app, bytes32 strategyHash)')
const pulled = parseAbiItem(
	'event Pulled(address maker, address app, bytes32 strategyHash, address token, uint256 amount)',
)

export async function getBook(deployment: Deployment, markets: readonly Market[]): Promise<BookOrder[]> {
	const range = { address: AQUA, fromBlock: deployment.fromBlock, toBlock: 'latest' } as const
	const [shipLogs, dockLogs, pullLogs, block] = await Promise.all([
		publicClient.getLogs({ ...range, event: shipped }),
		publicClient.getLogs({ ...range, event: docked }),
		publicClient.getLogs({ ...range, event: pulled }),
		publicClient.getBlock(),
	])
	const ours = (app: Address | undefined) => app !== undefined && isAddressEqual(app, deployment.router)

	const byToken = new Map<string, { market: Market; side: Side }>()
	for (const m of markets) {
		byToken.set(m.yes.toLowerCase(), { market: m, side: 'YES' })
		byToken.set(m.no.toLowerCase(), { market: m, side: 'NO' })
	}

	const candidates = shipLogs.flatMap((log) => {
		const { maker, app, strategyHash, strategy } = log.args
		if (!maker || !strategyHash || !strategy || !ours(app)) {
			return []
		}
		const order = decodeStrategy(strategy)
		const params = parseOrder(order)
		const where = params && byToken.get(params.tokenIn.toLowerCase())
		if (!params || !where || !isAddressEqual(params.tokenOut, COLLATERAL) || !isAddressEqual(order.maker, maker)) {
			return []
		}
		if (params.conditionId.toLowerCase() !== where.market.conditionId.toLowerCase()) {
			return []
		}
		return [{ strategyHash, order, params, maker, market: where.market, side: where.side }]
	})
	if (candidates.length === 0) {
		return []
	}

	const dockedSet = new Set(dockLogs.filter((l) => ours(l.args.app)).map((l) => l.args.strategyHash))
	const paid = new Map<string, bigint>()
	for (const l of pullLogs) {
		if (ours(l.args.app) && l.args.token && isAddressEqual(l.args.token, COLLATERAL) && l.args.strategyHash) {
			paid.set(l.args.strategyHash, (paid.get(l.args.strategyHash) ?? 0n) + (l.args.amount ?? 0n))
		}
	}

	const makers = [...new Set(candidates.map((c) => c.maker.toLowerCase()))] as Address[]
	const reads = await publicClient.multicall({
		allowFailure: false,
		contracts: [
			...candidates.map(
				(c) =>
					({
						address: AQUA,
						abi: aquaAbi,
						functionName: 'rawBalances',
						args: [c.maker, deployment.router, c.strategyHash, COLLATERAL],
					}) as const,
			),
			...makers.map((m) => ({ address: COLLATERAL, abi: erc20Abi, functionName: 'balanceOf', args: [m] }) as const),
			...makers.map(
				(m) => ({ address: COLLATERAL, abi: erc20Abi, functionName: 'allowance', args: [m, AQUA] }) as const,
			),
		],
	})
	const balance = new Map<string, bigint>()
	const allowance = new Map<string, bigint>()
	makers.forEach((m, i) => {
		balance.set(m, reads[candidates.length + i] as bigint)
		allowance.set(m, reads[candidates.length + makers.length + i] as bigint)
	})

	return candidates.map((c, i) => {
		const [capLeft] = reads[i] as readonly [bigint, number]
		const filled = paid.get(c.strategyHash) ?? 0n
		const r = {
			docked: dockedSet.has(c.strategyHash),
			capLeft,
			makerBalance: balance.get(c.maker.toLowerCase()) ?? 0n,
			makerAllowance: allowance.get(c.maker.toLowerCase()) ?? 0n,
			deadline: c.params.deadline,
			now: Number(block.timestamp),
			resolved: c.market.resolved,
		}
		return {
			strategyHash: c.strategyHash,
			order: c.order,
			params: c.params,
			maker: c.maker,
			market: c.market.address,
			side: c.side,
			price: c.params.price,
			cap: capLeft + filled,
			filled,
			capLeft,
			status: orderStatus(r),
			available: coverableToday(r),
			makerFunds: r.makerBalance < r.makerAllowance ? r.makerBalance : r.makerAllowance,
			deadline: c.params.deadline,
		}
	})
}

export type Level = { side: Side; price: bigint; available: bigint; orders: number }

/**
 * Active orders grouped by side and price. Orders from one maker share one
 * balance, so a maker adds at most what they can pay in total to a level.
 */
export function levels(orders: readonly BookOrder[]): Level[] {
	const groups = new Map<string, BookOrder[]>()
	for (const o of orders) {
		if (o.status !== 'active' || o.available === 0n) {
			continue
		}
		const key = `${o.side}:${o.price}`
		groups.set(key, [...(groups.get(key) ?? []), o])
	}
	return [...groups.values()].map((group) => {
		const byMaker = new Map<string, { sum: bigint; funds: bigint }>()
		for (const o of group) {
			const m = byMaker.get(o.maker.toLowerCase()) ?? { sum: 0n, funds: o.makerFunds }
			byMaker.set(o.maker.toLowerCase(), { sum: m.sum + o.available, funds: m.funds })
		}
		const available = [...byMaker.values()].reduce((t, m) => t + (m.sum < m.funds ? m.sum : m.funds), 0n)
		const first = group[0] as BookOrder
		return { side: first.side, price: first.price, available, orders: group.length }
	})
}
