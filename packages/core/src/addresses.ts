import type { Address } from 'viem'

// Base mainnet (chain id 8453). Source: spec/definicion/05_stack-y-arquitectura.md §11.
// Addresses are versioned here, not in environment variables: changing one is a commit.

export const BASE_CHAIN_ID = 8453

/** 1inch Aqua, official deployment. */
export const AQUA: Address = '0x1111113ccf1426a8e30e2bff5e005d929bf6a90a'

/** Savings USDS, the collateral of every OddsFlow market. */
export const SUSDS: Address = '0x5875eEE11Cf8398102FdAd704C9E96607675467a'

export const SEER_MARKET_FACTORY: Address = '0x886Ef0A78faBbAE942F1dA1791A8ed02a5aF8BC6'
export const SEER_ROUTER: Address = '0x3124e97ebF4c9592A17d40E54623953Ff3c77a73'
export const SEER_MARKET_VIEW: Address = '0x179d8F8c811B8C759c33809dbc6c5ceDc62D05DD'
export const SEER_REALITY_PROXY: Address = '0xfE8bF5140F00de6F75BAFa3Ca0f4ebf2084A46B2'

export const CONDITIONAL_TOKENS: Address = '0xAb797C4C6022A401c31543E316D3cd04c67a87fC'
export const REALITY_ETH: Address = '0x2F39f464d16402Ca3D8527dA89617b73DE2F60e8'

/** The official 1inch SwapVM router. Reference only: OddsFlow deploys its own. */
export const SWAPVM_ROUTER_OFFICIAL: Address = '0x111111338c5091e8440b67b168bae16a668ac0de'

/** Chain id of the local Base fork from scripts/dev-fork.sh. */
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
 * OddsFlow's own contracts, per chain. Base mainnet is added when
 * `pnpm deploy:base` runs. The fork addresses are fixed because
 * scripts/dev-fork.sh resets the deployer's nonce before deploying; its
 * fromBlock depends on the fork and comes from the web's environment.
 */
export const DEPLOYMENTS: Partial<Record<number, Deployment>> = {
	[FORK_CHAIN_ID]: {
		router: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
		taker: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
		fromBlock: 0n,
	},
}
