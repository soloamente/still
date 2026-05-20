/**
 * Mobbin “trusted by” band — achromatic wordmarks (no fake logo assets).
 * Keeps the centered marketing rhythm without importing third-party marks.
 */
const TRUSTED_LABELS = [
	"Festival programmers",
	"Repertory houses",
	"Film educators",
	"Critics on deadline",
	"Poster collectors",
	"Late-night rewatches",
] as const;

export function LandingSocialProof() {
	return (
		<section
			aria-label="Who uses Still"
			className="mx-auto max-w-mobbin-page px-6 pb-14 text-center"
		>
			<p className="text-muted-foreground text-sm">
				Loved by people who keep a diary
			</p>
			<ul className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
				{TRUSTED_LABELS.map((label) => (
					<li
						key={label}
						className="font-medium font-sans text-foreground/35 text-sm tracking-[-0.01em] sm:text-base"
					>
						{label}
					</li>
				))}
			</ul>
		</section>
	);
}
