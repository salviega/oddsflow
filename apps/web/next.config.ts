import { join } from 'node:path'
import { loadEnvConfig } from '@next/env'
import type { NextConfig } from 'next'

// The monorepo keeps one .env at its root (see .env.example); Next only reads
// its own directory, so load the root first. On Vercel there is no root .env
// and the project's environment variables apply.
loadEnvConfig(join(process.cwd(), '..', '..'))

const nextConfig: NextConfig = {
	reactStrictMode: true,
	transpilePackages: ['@oddsflow/core'],
	// The repo's own AGENTS.md is the only agent rules file.
	agentRules: false,
}

export default nextConfig
