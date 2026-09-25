// Which chain the web talks to: Base mainnet, or the local fork from
// scripts/dev-fork.sh when NEXT_PUBLIC_FORK=1.

import { DEPLOYMENTS, type Deployment, FORK_CHAIN_ID } from '@oddsflow/core'
import { type Address, createPublicClient, defineChain, http } from 'viem'
import { base } from 'viem/chains'

export const isFork = process.env.NEXT_PUBLIC_FORK === '1'

export const baseFork = defineChain({
	id: FORK_CHAIN_ID,
	name: 'Base (local fork)',
	nativeCurrency: base.nativeCurrency,
	rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
	contracts: base.contracts,
})

export const chain = isFork ? baseFork : base

export const rpcUrl = isFork ? 'http://127.0.0.1:8545' : process.env.NEXT_PUBLIC_BASE_RPC_URL

export const publicClient = createPublicClient({ chain, transport: http(rpcUrl, { batch: true, timeout: 60_000 }) })

/** OddsFlow's contracts on the current chain, or undefined before deployment. */
export function deployment(): Deployment | undefined {
	const d = DEPLOYMENTS[chain.id]
	if (!d) {
		return undefined
	}
	const fromBlock = isFork ? BigInt(process.env.NEXT_PUBLIC_FORK_FROM_BLOCK ?? '0') : d.fromBlock
	return { ...d, fromBlock }
}

/** Markets shown first: the demo market, then the rest. */
export const featuredMarkets: Address[] = [process.env.NEXT_PUBLIC_FORK_MARKET, process.env.NEXT_PUBLIC_DEMO_MARKET]
	.filter((a): a is string => Boolean(a))
	.map((a) => a as Address)

export function explorerTx(hash: string): string | undefined {
	return isFork ? undefined : `https://basescan.org/tx/${hash}`
}
