'use client'

import { useQuery } from '@tanstack/react-query'
import type { Market } from '@/lib/markets'

export function useOpenMarkets() {
	return useQuery({
		queryKey: ['markets'],
		queryFn: async (): Promise<Market[]> => {
			const res = await fetch('/api/markets')
			if (!res.ok) {
				throw new Error(`markets: ${res.status}`)
			}
			return res.json()
		},
		staleTime: 60_000,
	})
}
