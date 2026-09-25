import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: ['packages/*/src/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			include: ['packages/core/src/**/*.ts'],
			exclude: ['packages/core/src/**/*.test.ts', 'packages/core/src/index.ts'],
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
