import { gnosis } from 'viem/chains'
import { createConfig, http } from 'wagmi'
import { injected, mock } from 'wagmi/connectors'
import { chain, gnosisFork, isFork } from './chain'

// On the local fork, Anvil's unlocked accounts stand in for wallets so every
// flow can be exercised without an extension: 1 and 2 hold the sample orders,
// 3 is a buyer. Their keys are public test keys; they are never used on Gnosis.
const forkAccounts = {
	'Maker (account 1)': '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
	'Maker (account 2)': '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
	'Buyer (account 3)': '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
} as const

const forkConnectors = Object.entries(forkAccounts).map(([name, address]) => {
	const connector = mock({ accounts: [address], features: { reconnect: true } })
	return (config: Parameters<typeof connector>[0]) => ({ ...connector(config), name })
})

export const wagmiConfig = createConfig({
	chains: [chain],
	connectors: isFork ? forkConnectors : [injected()],
	transports: {
		[gnosis.id]: http(process.env.NEXT_PUBLIC_GNOSIS_RPC_URL, { batch: true }),
		[gnosisFork.id]: http('http://127.0.0.1:8545', { batch: true }),
	},
	ssr: true,
})

declare module 'wagmi' {
	interface Register {
		config: typeof wagmiConfig
	}
}
