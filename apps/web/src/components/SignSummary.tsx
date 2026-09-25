/** What a signature does, before it is signed (spec 09 §7). */
export function SignSummary({
	moves,
	happens,
	doesNot,
	undo,
	irreversible = false,
}: {
	moves: string
	happens: string
	doesNot: string
	undo: string
	irreversible?: boolean
}) {
	const rows: [string, string][] = [
		['Moves', moves],
		['What happens', happens],
		['What does not', doesNot],
		['Undo', undo],
	]
	return (
		<dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 border-t border-silt/50 pt-4 text-sm">
			{rows.map(([k, v]) => (
				<div key={k} className="contents">
					<dt className="text-mist">{k}</dt>
					<dd className={k === 'Undo' && irreversible ? 'font-medium text-spillway' : 'text-spillway'}>{v}</dd>
				</div>
			))}
		</dl>
	)
}
