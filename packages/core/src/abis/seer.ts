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

/** Seer's MarketFactory: permissionless market creation. */
export const marketFactoryAbi = [
	{
		type: 'function',
		name: 'createCategoricalMarket',
		stateMutability: 'nonpayable',
		inputs: [
			{
				name: 'params',
				type: 'tuple',
				components: [
					{ name: 'marketName', type: 'string' },
					{ name: 'outcomes', type: 'string[]' },
					{ name: 'questionStart', type: 'string' },
					{ name: 'questionEnd', type: 'string' },
					{ name: 'outcomeType', type: 'string' },
					{ name: 'parentOutcome', type: 'uint256' },
					{ name: 'parentMarket', type: 'address' },
					{ name: 'category', type: 'string' },
					{ name: 'lang', type: 'string' },
					{ name: 'lowerBound', type: 'uint256' },
					{ name: 'upperBound', type: 'uint256' },
					{ name: 'minBond', type: 'uint256' },
					{ name: 'openingTime', type: 'uint32' },
					{ name: 'tokenNames', type: 'string[]' },
				],
			},
		],
		outputs: [{ type: 'address' }],
	},
	{
		type: 'event',
		name: 'NewMarket',
		inputs: [
			{ name: 'market', type: 'address', indexed: true },
			{ name: 'marketName', type: 'string', indexed: false },
			{ name: 'parentMarket', type: 'address', indexed: false },
			{ name: 'conditionId', type: 'bytes32', indexed: false },
			{ name: 'questionId', type: 'bytes32', indexed: false },
			{ name: 'questionsIds', type: 'bytes32[]', indexed: false },
		],
	},
] as const
