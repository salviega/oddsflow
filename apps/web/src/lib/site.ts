// Single source for name, copy and SEO. Every metadata file reads from here.

export const site = {
	name: 'OddsFlow',
	shortName: 'OddsFlow',
	// The canonical URL and Open Graph image must live on a public domain:
	// Vercel protects its per-team and per-branch aliases with a login, and a
	// link preview that meets a login shows nothing. So: the explicit URL, else
	// the production domain Vercel reports, else ours.
	url:
		process.env.NEXT_PUBLIC_SITE_URL ??
		(process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
			? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
			: 'https://oddsflow-teal.vercel.app'),
	repo: 'https://github.com/salviega/oddsflow',
	locale: 'en_US',

	title: 'OddsFlow — Limit orders for prediction markets',
	tagline: 'One balance. Every market.',
	description:
		'Limit orders across many prediction markets with one balance. Your sDAI stays in your wallet until someone takes the other side. Built on 1inch Aqua.',
	keywords: [
		'prediction markets',
		'limit orders',
		'onchain betting',
		'Seer',
		'1inch Aqua',
		'SwapVM',
		'shared liquidity',
		'capital efficiency',
		'Gnosis Chain',
		'DeFi',
	],

	ogImage: { url: '/og-image.png', width: 1200, height: 630, alt: 'OddsFlow — One balance. Every market.' },

	colors: {
		lock: '#0F2B2E',
		spillway: '#E7EAE4',
		gauge: '#F2C12E',
	},

	// Indexable routes for the sitemap. Market pages (/markets/[address]) are
	// added at build time from the order book; wallet pages are never listed.
	routes: ['/'] as const,
} as const
