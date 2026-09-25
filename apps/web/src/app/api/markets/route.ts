import { getMarketsCached } from '@/lib/markets-cached'

// Every open market an OddsFlow order can back, for the client (order book,
// new orders). Rendered per request with a CDN cache on top of the server one.
export const dynamic = 'force-dynamic'

export async function GET() {
	try {
		return Response.json(await getMarketsCached(), {
			headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
		})
	} catch {
		return Response.json({ error: 'Could not read the markets from Seer' }, { status: 503 })
	}
}
