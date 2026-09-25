// The OddsFlow order: its SwapVM program, its Order struct and its Aqua
// strategy hash. This mirrors packages/contracts byte for byte; the parity
// test against fixtures/order.json (written by forge) keeps it that way.

import {
	type Address,
	concat,
	decodeAbiParameters,
	encodeAbiParameters,
	type Hex,
	isAddressEqual,
	keccak256,
	numberToHex,
	pad,
	size,
	slice,
	toHex,
} from 'viem'

/** Opcode indices in OddsFlowRouter: the official Aqua table plus two appended. */
export const OPCODES = {
	deadline: 13,
	salt: 20,
	fixedPriceSwap: 34,
	onlyUnresolvedCondition: 35,
} as const

/** MakerTraits with only `useAquaInsteadOfSignature` set: no hooks, maker receives. */
export const AQUA_ORDER_TRAITS = 1n << 254n

/** Prices are tokenOut per tokenIn, scaled by 1e18. */
export const PRICE_SCALE = 10n ** 18n

export type OrderParams = {
	conditionalTokens: Address
	conditionId: Hex
	/** Unix seconds; the order rejects fills after it. */
	deadline: number
	/** The outcome token the maker buys. */
	tokenIn: Address
	/** The collateral the maker pays (sUSDS). */
	tokenOut: Address
	/** sUSDS per outcome token, 1e18 scale. */
	price: bigint
	/** Makes two otherwise identical orders distinct. */
	salt: bigint
}

export type Order = {
	maker: Address
	traits: bigint
	data: Hex
}

const ORDER_ABI = [
	{
		type: 'tuple',
		components: [
			{ name: 'maker', type: 'address' },
			{ name: 'traits', type: 'uint256' },
			{ name: 'data', type: 'bytes' },
		],
	},
] as const

function instruction(opcode: number, args: Hex): Hex {
	return concat([numberToHex(opcode, { size: 1 }), numberToHex(size(args), { size: 1 }), args])
}

export function buildProgram(p: OrderParams): Hex {
	if (p.price <= 0n) {
		throw new RangeError('price must be greater than zero')
	}
	const program = concat([
		instruction(OPCODES.onlyUnresolvedCondition, concat([p.conditionalTokens, p.conditionId])),
		instruction(OPCODES.deadline, numberToHex(p.deadline, { size: 5 })),
		instruction(OPCODES.fixedPriceSwap, concat([p.tokenIn, p.tokenOut, pad(toHex(p.price), { size: 32 })])),
		instruction(OPCODES.salt, numberToHex(p.salt, { size: 8 })),
	])
	// Addresses keep their checksum casing through concat; the bytes are what count.
	return program.toLowerCase() as Hex
}

export function buildOrder(maker: Address, params: OrderParams): Order {
	return { maker, traits: AQUA_ORDER_TRAITS, data: buildProgram(params) }
}

/** The `strategy` bytes passed to `Aqua.ship`: `abi.encode(order)`. */
export function encodeStrategy(order: Order): Hex {
	return encodeAbiParameters(ORDER_ABI, [order])
}

/** Aqua's strategy hash, which is also the router's order hash for Aqua orders. */
export function strategyHash(order: Order): Hex {
	return keccak256(encodeStrategy(order))
}

export function decodeStrategy(strategy: Hex): Order {
	const [order] = decodeAbiParameters(ORDER_ABI, strategy)
	return { maker: order.maker, traits: order.traits, data: order.data }
}

/**
 * Reads an order's program back into its parameters, or returns null if it is
 * not exactly an OddsFlow program (other opcodes, other order, hooks). The
 * order book shows only orders it fully understands.
 */
export function parseOrder(order: Order): OrderParams | null {
	if (order.traits !== AQUA_ORDER_TRAITS) {
		return null
	}
	const program = order.data
	const expected = [
		[OPCODES.onlyUnresolvedCondition, 52],
		[OPCODES.deadline, 5],
		[OPCODES.fixedPriceSwap, 72],
		[OPCODES.salt, 8],
	] as const
	const args: Hex[] = []
	let pc = 0
	for (const [opcode, length] of expected) {
		if (size(program) < pc + 2 + length) {
			return null
		}
		if (Number(slice(program, pc, pc + 1)) !== opcode || Number(slice(program, pc + 1, pc + 2)) !== length) {
			return null
		}
		args.push(slice(program, pc + 2, pc + 2 + length))
		pc += 2 + length
	}
	if (pc !== size(program)) {
		return null
	}
	const [condition, deadline, swap, salt] = args as [Hex, Hex, Hex, Hex]
	const price = BigInt(slice(swap, 40, 72))
	if (price === 0n) {
		return null
	}
	return {
		conditionalTokens: slice(condition, 0, 20),
		conditionId: slice(condition, 20, 52),
		deadline: Number(deadline),
		tokenIn: slice(swap, 0, 20),
		tokenOut: slice(swap, 20, 40),
		price,
		salt: BigInt(salt),
	}
}

/** Whether a parsed order pays `collateral` for `token`. */
export function ordersToken(params: OrderParams, token: Address, collateral: Address): boolean {
	return isAddressEqual(params.tokenIn, token) && isAddressEqual(params.tokenOut, collateral)
}

/** A price as a number on the 0–1 scale, for display only. */
export function priceToNumber(price: bigint): number {
	return Number(price) / 1e18
}

/** A 0–1 price typed by a user, as a 1e18-scaled bigint, to the cent. */
export function priceFromCents(cents: number): bigint {
	if (!Number.isInteger(cents) || cents < 1 || cents > 99) {
		throw new RangeError(`price must be between 0.01 and 0.99, got ${cents / 100}`)
	}
	return BigInt(cents) * 10n ** 16n
}
