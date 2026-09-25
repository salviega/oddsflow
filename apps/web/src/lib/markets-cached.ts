import { unstable_cache } from 'next/cache'
import { getSeerMarkets } from './seer-api'

/** Seer's open markets, fetched once every five minutes for every visitor. */
export const getMarketsCached = unstable_cache(getSeerMarkets, ['seer-markets'], { revalidate: 300 })
