// The parts of Seer, Conditional Tokens and Reality.eth on Base that the web
// reads or calls (spec/definicion/05 §4). Hand-written: a few functions each.

export const seerMarketAbi = [
	{ type: 'function', name: 'marketName', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
	{ type: 'function', name: 'numOutcomes', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
	{ type: 'function', name: 'conditionId', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
	{ type: 'function', name: 'questionsIds', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32[]' }] },
	{
		type: 'function',
		name: 'wrappedOutcome',
		stateMutability: 'view',
		inputs: [{ name: 'index', type: 'uint256' }],
		outputs: [
			{ name: 'wrapped1155', type: 'address' },
			{ name: 'data', type: 'bytes' },
		],
	},
] as const

export const seerRouterAbi = [
	{
		type: 'function',
		name: 'redeemPositions',
		stateMutability: 'nonpayable',
		inputs: [
			{ name: 'collateralToken', type: 'address' },
			{ name: 'market', type: 'address' },
			{ name: 'outcomeIndexes', type: 'uint256[]' },
			{ name: 'amounts', type: 'uint256[]' },
		],
		outputs: [],
	},
] as const

export const conditionalTokensAbi = [
	{
		type: 'function',
		name: 'payoutDenominator',
		stateMutability: 'view',
		inputs: [{ name: 'conditionId', type: 'bytes32' }],
		outputs: [{ type: 'uint256' }],
	},
	{
		type: 'function',
		name: 'payoutNumerators',
		stateMutability: 'view',
		inputs: [
			{ name: 'conditionId', type: 'bytes32' },
			{ name: 'index', type: 'uint256' },
		],
		outputs: [{ type: 'uint256' }],
	},
] as const

export const realityAbi = [
	{
		type: 'function',
		name: 'getOpeningTS',
		stateMutability: 'view',
		inputs: [{ name: 'questionId', type: 'bytes32' }],
		outputs: [{ type: 'uint32' }],
	},
] as const
