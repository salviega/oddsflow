import { getOpenMarketsCached } from '@/lib/markets-cached'

// Rendered per request, never at build time: a slow RPC must not break a
// deploy. Vercel's CDN keeps each answer for a minute, so everyone shares one
// read of the markets instead of hundreds of RPC calls per visitor.
export const dynamic = 'force-dynamic'

export async function GET() {
	try {
		return Response.json(await getOpenMarketsCached(), {
			headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
		})
	} catch {
		return Response.json({ error: 'Could not read the markets from Gnosis' }, { status: 503 })
	}
}
