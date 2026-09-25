import { getOpenMarkets } from '@/lib/markets'

// One read of the open markets per minute for everyone, instead of hundreds
// of RPC calls from every visitor's browser.
export const revalidate = 60

export async function GET() {
	return Response.json(await getOpenMarkets())
}
