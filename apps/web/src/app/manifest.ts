import type { MetadataRoute } from 'next'
import { site } from '@/lib/site'

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: site.name,
		short_name: site.shortName,
		description: site.description,
		start_url: '/',
		display: 'standalone',
		background_color: site.colors.lock,
		theme_color: site.colors.lock,
		categories: ['finance'],
		icons: [
			{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
			{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
			{ src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
		],
	}
}
