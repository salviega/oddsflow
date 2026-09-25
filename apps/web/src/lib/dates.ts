/** A market's closing time, in the reader's own time zone. */
export function formatOpening(ts: number): string {
	return new Intl.DateTimeFormat('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
		timeZoneName: 'short',
	}).format(new Date(ts * 1000))
}
