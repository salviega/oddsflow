'use client'

import { useQuery } from '@tanstack/react-query'
import { getOpenMarkets } from '@/lib/markets'

export function useOpenMarkets() {
	return useQuery({ queryKey: ['markets'], queryFn: getOpenMarkets, staleTime: 60_000 })
}
