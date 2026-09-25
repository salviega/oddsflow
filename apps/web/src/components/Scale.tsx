import { formatAmount, formatPrice, priceToNumber } from '@oddsflow/core'
import { type BookOrder, levels } from '@/lib/book'

const HEIGHT = 384 // h-96
const LABEL = 20 // minimum vertical gap between two labels, in px

/**
 * The market as a gauge (spec 09, "La escala"): 0.00 to 1.00 is the chance of
 * YES. An order buying YES at p sits at p; an order buying NO at q sits at
 * 1 − q, the YES price it implies. Gates sit at their exact level; only their
 * labels move apart when two levels are too close to read.
 */
export function Scale({ orders }: { orders: readonly BookOrder[] }) {
	const gates = levels(orders)
		.map((l) => {
			const p = priceToNumber(l.price)
			return { ...l, p, level: l.side === 'YES' ? p : 1 - p }
		})
		.sort((a, b) => b.level - a.level)
	let previous = Number.POSITIVE_INFINITY
	const placed = gates.map((g) => {
		const exact = g.level * HEIGHT
		const label = Math.min(exact, previous - LABEL)
		previous = label
		return { ...g, exact, label }
	})
	const ticks = [1, 0.75, 0.5, 0.25, 0]
	return (
		<figure className="relative h-96 w-full max-w-md select-none" aria-label="Open orders by price">
			<div className="absolute inset-y-0 left-12 right-0">
				<div className="absolute inset-y-0 left-0 w-1.5 bg-spillway" />
				<div className="absolute inset-y-0 left-40 w-1.5 bg-spillway" />
				{ticks.map((t) => (
					<div
						key={t}
						className="absolute -left-12 flex w-12 items-center"
						style={{ bottom: `calc(${t * 100}% - 0.6rem)` }}
					>
						<span className="w-9 text-right text-sm tabular-nums text-mist">{t.toFixed(2)}</span>
					</div>
				))}
				{placed.map((g) => (
					<div key={`${g.side}:${g.price}`}>
						<div className="absolute left-1.5 h-4 w-[9.6rem] bg-gauge" style={{ bottom: g.exact - 8 }} />
						<span
							className="absolute left-[10.6rem] whitespace-nowrap text-sm font-medium tabular-nums"
							style={{ bottom: g.label - 9 }}
						>
							<span className={g.side === 'YES' ? 'text-yes' : 'text-no'}>{g.side}</span>
							<span className="text-spillway"> at {formatPrice(g.p)}</span>
							<span className="text-mist">
								{' '}
								· {formatAmount(g.available)}
								{g.orders > 1 && ` · ${g.orders} orders`}
							</span>
						</span>
					</div>
				))}
				<svg className="absolute bottom-2 left-2 w-[9.4rem]" viewBox="0 0 150 24" aria-hidden="true">
					<path
						d="M2 8q9-7 18 0t18 0t18 0t18 0t18 0t18 0t18 0t18 0"
						stroke="#E7EAE4"
						strokeWidth="3"
						fill="none"
						strokeLinecap="round"
						opacity="0.9"
					/>
					<path
						d="M2 20q9-7 18 0t18 0t18 0t18 0t18 0t18 0t18 0t18 0"
						stroke="#E7EAE4"
						strokeWidth="3"
						fill="none"
						strokeLinecap="round"
						opacity="0.45"
					/>
				</svg>
			</div>
			{placed.length === 0 && (
				<figcaption className="absolute inset-x-12 top-1/3 text-center text-mist">
					No open orders yet. Place the first one from New orders.
				</figcaption>
			)}
		</figure>
	)
}
