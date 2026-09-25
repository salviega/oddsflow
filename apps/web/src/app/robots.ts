import type { MetadataRoute } from 'next'
import { site } from '@/lib/site'

// Everything is crawlable: wallet pages opt out with a noindex meta tag
// (walletPageRobots), which a crawler can only read if it may fetch the page.
export default function robots(): MetadataRoute.Robots {
	return {
		rules: { userAgent: '*', allow: '/' },
		sitemap: `${site.url}/sitemap.xml`,
	}
}
