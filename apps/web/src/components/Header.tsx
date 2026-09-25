'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectButton } from './ConnectButton'

const nav = [
	{ href: '/', label: 'Markets' },
	{ href: '/orders/new', label: 'New orders' },
	{ href: '/markets/new', label: 'Create market' },
	{ href: '/orders', label: 'My orders' },
	{ href: '/positions', label: 'Positions' },
]

export function Header() {
	const path = usePathname()
	return (
		<header className="border-b border-silt/40">
			<div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-4 sm:px-6">
				<Link href="/" className="shrink-0" aria-label="OddsFlow home">
					{/* biome-ignore lint/performance/noImgElement: static SVG logo */}
					<img src="/logo-dark.svg" alt="OddsFlow" width={112} height={32} />
				</Link>
				<nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-2 sm:w-auto" aria-label="Main">
					{nav.map((n) => {
						const active = n.href === '/' ? path === '/' : path === n.href
						return (
							<Link
								key={n.href}
								href={n.href}
								aria-current={active ? 'page' : undefined}
								className={`flex min-h-11 items-center whitespace-nowrap px-3 font-medium ${active ? 'text-spillway' : 'text-mist hover:text-spillway'}`}
							>
								{n.label}
							</Link>
						)
					})}
				</nav>
				<div className="order-2 ml-auto sm:order-3">
					<ConnectButton />
				</div>
			</div>
		</header>
	)
}
