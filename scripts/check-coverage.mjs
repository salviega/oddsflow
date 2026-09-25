// Reads `forge coverage --report summary` from stdin and fails if the Total
// row is under the threshold (first argument, percent) for lines, statements,
// branches or functions. Foundry has no built-in coverage floor.
import { argv, exit, stdin } from 'node:process'

const threshold = Number(argv[2] ?? 90)
let input = ''
for await (const chunk of stdin) input += chunk
process.stdout.write(input)

const total = input.split('\n').find((line) => /^\|\s*Total\s*\|/.test(line))
if (!total) {
	console.error('check-coverage: no "Total" row in forge coverage output')
	exit(1)
}

const [lines, statements, branches, functions] = [...total.matchAll(/([\d.]+)%/g)].map((m) => Number(m[1]))
const metrics = { lines, statements, branches, functions }
const failing = Object.entries(metrics).filter(([, value]) => value < threshold)
if (failing.length > 0) {
	console.error(`check-coverage: under ${threshold}% — ${failing.map(([k, v]) => `${k} ${v}%`).join(', ')}`)
	exit(1)
}
console.log(`check-coverage: all metrics at or above ${threshold}%`)
