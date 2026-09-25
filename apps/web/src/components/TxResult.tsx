import { explorerTx } from '@/lib/chain'

export type TxState =
	| { kind: 'idle' }
	| { kind: 'pending'; label: string }
	| { kind: 'done'; hashes: string[]; message: string }
	| { kind: 'error'; message: string }

export function TxResult({ state }: { state: TxState }) {
	if (state.kind === 'idle') {
		return null
	}
	if (state.kind === 'pending') {
		return (
			<p role="status" className="text-mist">
				{state.label}
			</p>
		)
	}
	if (state.kind === 'error') {
		return (
			<p role="alert" className="border border-silt px-3 py-2 text-spillway">
				{state.message}
			</p>
		)
	}
	return (
		<div role="status" className="space-y-1">
			<p className="text-spillway">{state.message}</p>
			<ul className="text-sm text-mist">
				{state.hashes.map((h) => {
					const url = explorerTx(h)
					return (
						<li key={h} className="tabular-nums">
							{url ? (
								<a className="underline hover:text-spillway" href={url} target="_blank" rel="noreferrer">
									{h.slice(0, 10)}…{h.slice(-6)} on Basescan
								</a>
							) : (
								<>
									{h.slice(0, 10)}…{h.slice(-6)} (local fork)
								</>
							)}
						</li>
					)
				})}
			</ul>
		</div>
	)
}
