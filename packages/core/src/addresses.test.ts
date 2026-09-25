import { getAddress, isAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import * as addresses from './addresses'

const deployed = {
	AQUA: addresses.AQUA,
	SUSDS: addresses.SUSDS,
	SEER_MARKET_FACTORY: addresses.SEER_MARKET_FACTORY,
	SEER_ROUTER: addresses.SEER_ROUTER,
	SEER_MARKET_VIEW: addresses.SEER_MARKET_VIEW,
	SEER_REALITY_PROXY: addresses.SEER_REALITY_PROXY,
	CONDITIONAL_TOKENS: addresses.CONDITIONAL_TOKENS,
	REALITY_ETH: addresses.REALITY_ETH,
	SWAPVM_ROUTER_OFFICIAL: addresses.SWAPVM_ROUTER_OFFICIAL,
}

describe('Base addresses', () => {
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

	it('targets Base mainnet', () => {
		expect(addresses.BASE_CHAIN_ID).toBe(8453)
	})

	it('has the Base deployment from packages/contracts/deployments/8453.json', () => {
		const base = addresses.DEPLOYMENTS[addresses.BASE_CHAIN_ID]
		expect(base?.router).toBe(getAddress('0xb8747b3e2f90154420165fb2fc4707d638797140'))
		expect(base?.taker).toBe(getAddress('0xdd026ea05c9256a1162dc3d41102579458a804cd'))
		expect(base?.fromBlock).toBe(51792181n)
	})

	it('has the fork deployment at the addresses dev-fork.sh produces', () => {
		const fork = addresses.DEPLOYMENTS[addresses.FORK_CHAIN_ID]
		expect(fork?.router).toBe(getAddress('0x5fbdb2315678afecb367f032d93f642f64180aa3'))
		expect(fork?.taker).toBe(getAddress('0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0'))
	})
})
