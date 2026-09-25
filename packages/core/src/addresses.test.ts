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

	it('leaves the OddsFlow contracts unset until they are deployed', () => {
		expect(addresses.ODDSFLOW_ROUTER).toBeUndefined()
		expect(addresses.ODDSFLOW_TAKER).toBeUndefined()
	})
})
