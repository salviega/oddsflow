import { Barlow } from 'next/font/google'
import type { ReactNode } from 'react'
import { JsonLd } from './metadata'
import { Providers } from './providers'
import './globals.css'

export { metadata, viewport } from './metadata'

const barlow = Barlow({
	subsets: ['latin'],
	weight: ['400', '500', '600'],
	variable: '--font-barlow',
	display: 'swap',
})

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" className={barlow.variable}>
			<body>
				<JsonLd />
				<Providers>{children}</Providers>
			</body>
		</html>
	)
}
