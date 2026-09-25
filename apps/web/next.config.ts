import { join } from 'node:path'
import { loadEnvConfig } from '@next/env'
import type { NextConfig } from 'next'

// The monorepo keeps one .env at its root (see .env.example); Next only reads
// its own directory, so load the root first. On Vercel there is no root .env
// and the project's environment variables apply.
// forceReload: @next/env caches its first load (apps/web, done by Next itself)
// and would otherwise return it without reading the root.
loadEnvConfig(join(process.cwd(), '..', '..'), process.env.NODE_ENV !== 'production', undefined, true)

// Turbopack inlines NEXT_PUBLIC_ values only from apps/web's own env files, so
// the ones loaded above from the root reach client code through `env`.
const publicEnv = Object.fromEntries(
	Object.entries(process.env).filter(
		(e): e is [string, string] => e[0].startsWith('NEXT_PUBLIC_') && e[1] !== undefined,
	),
)

const nextConfig: NextConfig = {
	reactStrictMode: true,
	env: publicEnv,
	transpilePackages: ['@oddsflow/core'],
	// The repo's own AGENTS.md is the only agent rules file.
	agentRules: false,
}

export default nextConfig
