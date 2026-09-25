// Import into src/app/layout.tsx:
//   export { metadata, viewport } from './metadata'
// and render <JsonLd /> inside <body>.

import type { Metadata, Viewport } from 'next'
import { site } from '@/lib/site'

export const metadata: Metadata = {
	metadataBase: new URL(site.url),
	title: { default: site.title, template: `%s — ${site.name}` },
	description: site.description,
	keywords: [...site.keywords],
	applicationName: site.name,
	alternates: { canonical: '/' },
	icons: {
		icon: [
			{ url: '/favicon.svg', type: 'image/svg+xml' },
			{ url: '/favicon.ico', sizes: 'any' },
			{ url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
			{ url: '/icon-16.png', sizes: '16x16', type: 'image/png' },
		],
		apple: { url: '/icon-180.png', sizes: '180x180' },
	},
	openGraph: {
		type: 'website',
		url: '/',
		siteName: site.name,
		title: site.title,
		description: site.description,
		locale: site.locale,
		images: [site.ogImage],
	},
	twitter: {
		card: 'summary_large_image',
		title: site.title,
		description: site.description,
		images: [site.ogImage.url],
	},
	robots: { index: true, follow: true },
}

// Pages that depend on the connected wallet (my orders, positions, new
// orders) export this instead: they are useless to a crawler and must not
// compete with the market pages in search results.
export const walletPageRobots: Metadata['robots'] = { index: false, follow: true }

export const viewport: Viewport = {
	themeColor: site.colors.lock,
	colorScheme: 'dark',
}

export function JsonLd() {
	const data = {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: site.name,
		url: site.url,
		description: site.description,
		applicationCategory: 'FinanceApplication',
		operatingSystem: 'Web',
		isAccessibleForFree: true,
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
		sameAs: [site.repo],
	}
	return (
		<script
			type="application/ld+json"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD built from site.ts
			dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
		/>
	)
}
