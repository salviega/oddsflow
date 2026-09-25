import { site } from '@/lib/site'

export default function Home() {
	return (
		<main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 bg-lock px-6 text-spillway">
			{/* biome-ignore lint/performance/noImgElement: static SVG logo, no optimization needed */}
			<img src="/logo-dark.svg" alt={site.name} width={223} height={64} />
			<h1 className="text-4xl font-semibold tracking-tight">{site.tagline}</h1>
			<p className="max-w-xl text-lg text-mist">{site.description}</p>
			<div className="h-1 w-16 bg-gauge" aria-hidden="true" />
		</main>
	)
}
