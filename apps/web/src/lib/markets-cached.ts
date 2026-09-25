import { unstable_cache } from 'next/cache'
import { getOpenMarkets } from './markets'

/**
 * Server-side cache of the open markets: reading them means scanning ~1,600
 * Seer markets, so every server render shares one scan per minute.
 */
export const getOpenMarketsCached = unstable_cache(getOpenMarkets, ['open-markets'], { revalidate: 60 })
