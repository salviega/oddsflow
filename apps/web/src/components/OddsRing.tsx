/**
 * Seer's odds for a market as a ring: YES in the Yes colour, NO in the No
 * colour, always next to the words and numbers (spec 09 §3: colour is never
 * the only carrier of meaning).
 */
export function OddsRing({ yes, no }: { yes: number; no: number }) {
	const total = yes + no || 1
	const r = 16
	const c = 2 * Math.PI * r
	const yesLength = (yes / total) * c
	return (
		<svg viewBox="0 0 40 40" className="h-14 w-14 shrink-0 -rotate-90" aria-hidden="true">
			<circle cx="20" cy="20" r={r} fill="none" stroke="var(--color-no)" strokeWidth="7" />
			<circle
				cx="20"
				cy="20"
				r={r}
				fill="none"
				stroke="var(--color-yes)"
				strokeWidth="7"
				strokeDasharray={`${yesLength} ${c - yesLength}`}
			/>
		</svg>
	)
}
