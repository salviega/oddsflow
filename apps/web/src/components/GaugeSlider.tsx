'use client'

import { type KeyboardEvent, type PointerEvent, useRef } from 'react'
import type { Side } from '@/lib/book'

const HEIGHT = 176 // px, the gauge's track

/**
 * The order's price as a gate on a gauge (spec 09, "La escala"): drag it,
 * click the track, or use the keyboard. 0.01–0.99, in cents. Seer's own odds
 * sit on the gauge as a dashed reference line.
 */
export function GaugeSlider({
	cents,
	onChange,
	side,
	reference,
	label,
}: {
	cents: number
	onChange: (cents: number) => void
	side: Side
	/** Seer's odds for this side, 0–1, if known. */
	reference?: number
	label: string
}) {
	const track = useRef<HTMLDivElement>(null)

	function fromPointer(clientY: number) {
		const box = track.current?.getBoundingClientRect()
		if (!box) {
			return
		}
		const ratio = 1 - (clientY - box.top) / box.height
		onChange(Math.min(99, Math.max(1, Math.round(ratio * 100))))
	}

	function onPointerDown(e: PointerEvent<HTMLDivElement>) {
		e.currentTarget.setPointerCapture(e.pointerId)
		fromPointer(e.clientY)
	}

	function onPointerMove(e: PointerEvent<HTMLDivElement>) {
		if (e.currentTarget.hasPointerCapture(e.pointerId)) {
			fromPointer(e.clientY)
		}
	}

	function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
		const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key]
		const jump = { Home: 1, End: 99 }[e.key]
		if (step === undefined && jump === undefined) {
			return
		}
		e.preventDefault()
		onChange(jump ?? Math.min(99, Math.max(1, cents + (step ?? 0))))
	}

	const level = (cents / 100) * HEIGHT
	const referenceLevel = reference !== undefined ? reference * HEIGHT : undefined

	return (
		<div className="flex select-none items-stretch gap-2">
			<div
				className="relative flex w-8 flex-col justify-between text-right text-xs tabular-nums text-mist"
				style={{ height: HEIGHT }}
			>
				<span>1.00</span>
				<span>0.50</span>
				<span>0.00</span>
			</div>
			<div
				ref={track}
				role="slider"
				tabIndex={0}
				aria-label={label}
				aria-valuemin={0.01}
				aria-valuemax={0.99}
				aria-valuenow={cents / 100}
				aria-valuetext={`${side} at ${(cents / 100).toFixed(2)}`}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onKeyDown={onKeyDown}
				className="relative w-24 cursor-ns-resize touch-none outline-none focus-visible:ring-2 focus-visible:ring-gauge"
				style={{ height: HEIGHT }}
			>
				<div className="absolute inset-y-0 left-0 w-1 bg-spillway" />
				<div className="absolute inset-y-0 right-0 w-1 bg-spillway" />
				{referenceLevel !== undefined && (
					<div
						className="absolute inset-x-1 border-t border-dashed border-mist"
						style={{ bottom: referenceLevel }}
						aria-hidden="true"
					/>
				)}
				<div
					className="absolute inset-x-1 h-3 bg-gauge shadow-[0_0_0_2px_var(--color-lock)]"
					style={{ bottom: level - 6 }}
					aria-hidden="true"
				/>
				<svg className="absolute bottom-1 left-1 w-[5.5rem]" viewBox="0 0 88 10" aria-hidden="true">
					<path
						d="M2 5q5.5-4 11 0t11 0t11 0t11 0t11 0t11 0t11 0t11 0"
						stroke="#E7EAE4"
						strokeWidth="2"
						fill="none"
						opacity="0.6"
					/>
				</svg>
			</div>
			<div className="relative w-28 text-sm" style={{ height: HEIGHT }}>
				<span className="absolute whitespace-nowrap font-semibold tabular-nums" style={{ bottom: level - 9 }}>
					<span className={side === 'YES' ? 'text-yes' : 'text-no'}>{side}</span> {(cents / 100).toFixed(2)}
				</span>
				{referenceLevel !== undefined && Math.abs(referenceLevel - level) > 16 && (
					<span
						className="absolute whitespace-nowrap text-xs tabular-nums text-mist"
						style={{ bottom: referenceLevel - 8 }}
					>
						Seer {(reference as number).toFixed(2)}
					</span>
				)}
			</div>
		</div>
	)
}
