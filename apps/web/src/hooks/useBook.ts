'use client'

import { useQuery } from '@tanstack/react-query'
import { getBook } from '@/lib/book'
import { deployment } from '@/lib/chain'
import type { Market } from '@/lib/markets'

/** The order book for the given markets, refreshed every 15 seconds. */
export function useBook(markets: readonly Market[] | undefined) {
	const d = deployment()
	return useQuery({
		queryKey: ['book', d?.router, markets?.map((m) => m.address).join()],
		queryFn: () => (d && markets ? getBook(d, markets) : []),
		enabled: Boolean(markets),
		refetchInterval: 15_000,
	})
}
