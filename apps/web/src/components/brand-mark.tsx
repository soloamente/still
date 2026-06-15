import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { APP_NAME, APP_TAGLINE } from "@/lib/app-brand";

/**
 * Sense wordmark with a thin dot standing in for the lens accent.
 * Default `display` applies Fraunces for cinematic headings; auth chrome passes `sans`
 * so SF Pro Rounded (`font-sans` / `--font-proxima-nova`) can carry UI while Fraunces
 * stays reserved for editorial pull quotes beside the split layout.
 *
 * Visible aria-label keeps screen readers happy without relying on the SVG mark alone.
 * A single root <Link> avoids invalid nested anchors when the shell wraps the mark.
 */
export function BrandMark({
	size = "md",
	wordmarkFont = "display",
	/** `surface`: theme foreground on card/canvas. `inverse`: white over imagery (auth). */
	tone = "surface",
	withTagline = false,
	href = "/",
	className,
	"aria-label": ariaLabel = `${APP_NAME} — go to home`,
}: {
	size?: "sm" | "md" | "lg";
	/** `display`: Fraunces. `sans`: SF Pro Rounded stack — use beside quote-only Fraunces. */
	wordmarkFont?: "display" | "sans";
	tone?: "surface" | "inverse";
	withTagline?: boolean;
	/** Logged-in app shell uses `/home`; marketing and auth stay on `/`. */
	href?: string;
	className?: string;
	"aria-label"?: string;
}) {
	const sizeClass = {
		sm: "text-lg",
		md: "text-xl",
		lg: "text-2xl",
	}[size];

	const wordmarkToneClass =
		tone === "inverse" ? "text-pure-white" : "text-foreground";

	return (
		<Link
			href={href}
			aria-label={ariaLabel}
			className={cn(
				"group inline-flex select-none items-baseline gap-2",
				className,
			)}
		>
			<span
				className={cn(
					wordmarkFont === "sans" ? "font-sans" : "font-display",
					sizeClass,
					"font-medium tracking-[-0.02em]",
					wordmarkToneClass,
				)}
			>
				{APP_NAME}
			</span>
			<span
				aria-hidden
				className="size-1.5 rounded-full bg-desert-orange transition-transform duration-[var(--aker-duration)] group-hover:scale-125"
			/>
			{withTagline ? (
				<span className="ml-2 text-slate-border text-xs">{APP_TAGLINE}</span>
			) : null}
		</Link>
	);
}
