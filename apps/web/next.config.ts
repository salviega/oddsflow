import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	reactStrictMode: true,
	transpilePackages: ['@oddsflow/core'],
}

export default nextConfig
