import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	reactStrictMode: true,
	transpilePackages: ['@oddsflow/core'],
	// The repo's own AGENTS.md is the only agent rules file.
	agentRules: false,
}

export default nextConfig
