import { getAddress, isAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import * as addresses from './addresses'

const deployed = {
	AQUA: addresses.AQUA,
	COLLATERAL: addresses.COLLATERAL,
	SEER_MARKET_FACTORY: addresses.SEER_MARKET_FACTORY,
	SEER_ROUTER: addresses.SEER_ROUTER,
	SEER_MARKET_VIEW: addresses.SEER_MARKET_VIEW,
	SEER_REALITY_PROXY: addresses.SEER_REALITY_PROXY,
	CONDITIONAL_TOKENS: addresses.CONDITIONAL_TOKENS,
	REALITY_ETH: addresses.REALITY_ETH,
	SWAPVM_ROUTER_OFFICIAL: addresses.SWAPVM_ROUTER_OFFICIAL,
}

describe('Gnosis addresses', () => {
	it.each(Object.entries(deployed))('%s is a valid address', (_name, address) => {
		expect(isAddress(address, { strict: false })).toBe(true)
		// A mixed-case literal must carry a correct EIP-55 checksum.
		if (address !== address.toLowerCase()) {
			expect(address).toBe(getAddress(address))
		}
	})

	it('has no duplicates', () => {
		const unique = new Set(Object.values(deployed).map((a) => a.toLowerCase()))
		expect(unique.size).toBe(Object.keys(deployed).length)
	})

	it('targets Gnosis Chain', () => {
		expect(addresses.CHAIN_ID).toBe(100)
		expect(addresses.COLLATERAL_SYMBOL).toBe('sDAI')
	})

	it('has the Gnosis deployment from packages/contracts/deployments/100.json', () => {
		const d = addresses.DEPLOYMENTS[addresses.CHAIN_ID]
		expect(d?.router).toBe(getAddress('0xb8747b3e2f90154420165fb2fc4707d638797140'))
		expect(d?.taker).toBe(getAddress('0xdd026ea05c9256a1162dc3d41102579458a804cd'))
		expect(d?.fromBlock).toBe(48438501n)
	})

	it('has the fork deployment at the addresses dev-fork.sh produces', () => {
		const fork = addresses.DEPLOYMENTS[addresses.FORK_CHAIN_ID]
		expect(fork?.router).toBe(getAddress('0xd68862941cb82d36940161913afb08a6854ee76c'))
		expect(fork?.taker).toBe(getAddress('0xd07e7e15e8939dde345c1c396728721690c4ac53'))
	})
})
