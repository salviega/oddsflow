import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: ['packages/*/src/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			include: ['packages/core/src/**/*.ts'],
			// ABIs and fixtures are data, not logic
			exclude: [
				'packages/core/src/**/*.test.ts',
				'packages/core/src/index.ts',
				'packages/core/src/abis/**',
				'packages/core/src/fixtures/**',
			],
			reporter: ['text', 'text-summary'],
			thresholds: {
				lines: 90,
				functions: 90,
				branches: 90,
				statements: 90,
			},
		},
	},
})
