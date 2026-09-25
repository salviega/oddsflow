'use client'

import { useState } from 'react'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { chain } from '@/lib/chain'

export function shortAddress(a: string): string {
	return `${a.slice(0, 6)}…${a.slice(-4)}`
}

export function ConnectButton() {
	const { address, chainId, isConnected } = useAccount()
	const { connectors, connect, isPending } = useConnect()
	const { disconnect } = useDisconnect()
	const { switchChain } = useSwitchChain()
	const [open, setOpen] = useState(false)

	if (isConnected && address) {
		if (chainId !== chain.id) {
			return (
				<button type="button" className="btn-secondary" onClick={() => switchChain({ chainId: chain.id })}>
					Switch to {chain.name}
				</button>
			)
		}
		return (
			<div className="flex items-center gap-3">
				<span className="tabular-nums text-mist">
					{shortAddress(address)} · {chain.name}
				</span>
				<button type="button" className="min-h-11 px-2 text-mist hover:text-spillway" onClick={() => disconnect()}>
					Disconnect
				</button>
			</div>
		)
	}

	return (
		<div className="relative">
			<button type="button" className="btn-secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
				{isPending ? 'Connecting…' : 'Connect wallet'}
			</button>
			{open && (
				<ul className="absolute right-0 z-10 mt-2 w-64 border border-silt bg-lock p-1">
					{connectors.map((c) => (
						<li key={c.uid}>
							<button
								type="button"
								className="flex min-h-11 w-full items-center px-3 text-left hover:bg-spillway/5"
								onClick={() => {
									connect({ connector: c, chainId: chain.id })
									setOpen(false)
								}}
							>
								{c.name}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}
