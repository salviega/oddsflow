import type { Address } from 'viem'

// Gnosis Chain (chain id 100). Source: spec/definicion/05_stack-y-arquitectura.md §11.
// Addresses are versioned here, not in environment variables: changing one is a commit.
// OddsFlow moved from Base to Gnosis on 2026-09-26: Seer's live markets are here
// (131 open binary markets against none on Base besides our own).

export const CHAIN_ID = 100

/** 1inch Aqua, official deployment (same address on every chain). */
export const AQUA: Address = '0x1111113ccf1426a8e30e2bff5e005d929bf6a90a'

/** Savings DAI, the collateral of every Seer market on Gnosis. */
export const COLLATERAL: Address = '0xaf204776c7245bF4147c2612BF6e5972Ee483701'
export const COLLATERAL_SYMBOL = 'sDAI'

export const SEER_MARKET_FACTORY: Address = '0x83183DA839Ce8228E31Ae41222EaD9EDBb5cDcf1'
/** Seer's GnosisRouter: splitPosition, mergePositions and redeemPositions on sDAI. */
export const SEER_ROUTER: Address = '0xeC9048b59b3467415b1a38F63416407eA0c70fB8'
export const SEER_MARKET_VIEW: Address = '0x95493F3e3F151eD9ee9338a4Fc1f49c00890F59C'
export const SEER_REALITY_PROXY: Address = '0xc260ADfAC11f97c001dC143d2a4F45b98e0f2D6C'

export const CONDITIONAL_TOKENS: Address = '0xCeAfDD6bc0bEF976fdCd1112955828E00543c0Ce'
export const REALITY_ETH: Address = '0xE78996A233895bE74a66F451f1019cA9734205cc'

/** The official 1inch SwapVM router. Reference only: OddsFlow deploys its own. */
export const SWAPVM_ROUTER_OFFICIAL: Address = '0x111111338c5091e8440b67b168bae16a668ac0de'

/** Chain id of the local Gnosis fork from scripts/dev-fork.sh. */
export const FORK_CHAIN_ID = 31337

export type Deployment = {
	/** The OddsFlow SwapVM router, with the two extra opcodes. */
	router: Address
	/** OddsFlowTaker, the counterparty's one-transaction buy and sell. */
	taker: Address
	/** Block of the router's deployment: the order book is read from here. */
	fromBlock: bigint
}

/**
 * OddsFlow's own contracts, per chain. The fork addresses are fixed because
 * scripts/dev-fork.sh deploys from its own dev key at nonce 0; its
 * fromBlock depends on the fork and comes from the web's environment.
 */
export const DEPLOYMENTS: Partial<Record<number, Deployment>> = {
	// Deployed 2026-09-26 with the OnlyUnansweredQuestion opcode, verified on
	// Gnosisscan; router ownership renounced. Supersedes 0xB874…7140 / 0xdD02…04Cd.
	[CHAIN_ID]: {
		router: '0xfA92A297eC2cCC8Ec010ACa475F07240e2D47deC',
		taker: '0xbB9Aa4e736B49E490C774dd674da88A38e89a678',
		fromBlock: 48438751n,
	},
	[FORK_CHAIN_ID]: {
		router: '0xD68862941Cb82d36940161913Afb08A6854EE76C',
		taker: '0xd07e7e15E8939dDe345c1C396728721690c4AC53',
		fromBlock: 0n,
	},
}
