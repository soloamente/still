import { cn } from "@still/ui/lib/utils";

/**
 * Morphing dot-field when TMDb art is missing — posters and cast headshots.
 * Keeps “no artwork” readable without ImageOff / UserRound empty tiles.
 *
 * “No poster available” keeps the shine sweep (`background-clip: text`). Ink halo uses
 * `filter: drop-shadow` on a wrapper — `text-shadow` does not paint on clipped fills.
 */
export function MissingArtworkPlaceholder({
	variant = "poster",
	label,
	title,
	className,
	"aria-label": ariaLabel,
}: {
	/** `poster` — title stack; `portrait` — canvas `bg-background` + centered “No image” pill. */
	variant?: "poster" | "portrait";
	/** Visible caption for poster frames (e.g. “No poster available”). */
	label?: string;
	/** Optional title under the label (poster frames). */
	title?: string;
	className?: string;
	"aria-label"?: string;
}) {
	const isPortrait = variant === "portrait";
	const showPosterCopy = !isPortrait && Boolean(label || title);
	/** Ink halo behind glyphs — works with clipped shine text (unlike text-shadow). */
	const labelHaloClass =
		"[filter:drop-shadow(0_1px_1px_oklch(0_0_0/0.7))_drop-shadow(0_2px_8px_oklch(0_0_0/0.45))]";
	const titleShadowClass =
		"[text-shadow:0_1px_2px_oklch(0_0_0/0.75),0_2px_10px_oklch(0_0_0/0.55),0_0_1px_oklch(0_0_0/0.4)]";

	return (
		<div
			className={cn(
				"missing-artwork",
				// Canvas fill — utilities beat the CSS fallback when theme card ≈ background.
				!isPortrait && "bg-background",
				isPortrait && "missing-artwork--portrait bg-background",
				className,
			)}
			role="img"
			aria-label={
				ariaLabel ??
				(isPortrait ? "No image" : (label ?? title ?? "No artwork"))
			}
		>
			<span className="missing-artwork-dots" aria-hidden />
			<span className="missing-artwork-glow" aria-hidden />
			{isPortrait ? (
				<span className="missing-artwork-pill">No image</span>
			) : null}
			{showPosterCopy ? (
				<div className="missing-artwork-copy relative z-1 flex max-w-full flex-col items-center gap-1.5 px-2.5 py-3 text-center">
					{label ? (
						// Wrapper carries drop-shadow; inner span owns the shine clip.
						<span className={cn("inline-block max-w-[90%]", labelHaloClass)}>
							<span className="missing-artwork-label">{label}</span>
						</span>
					) : null}
					{title ? (
						<p
							className={cn(
								"line-clamp-4 max-w-full text-pretty font-medium text-foreground text-xs leading-snug sm:text-sm",
								titleShadowClass,
							)}
						>
							{title}
						</p>
					) : null}
				</div>
			) : null}
		</div>
	);
}
