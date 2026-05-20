import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import Link from "next/link";

/** `lift` = slight Y translate (default). `elevation` = card-tinted shadow + stack above neighbors (lobby grid). */
export type MoviePosterHoverEffect = "lift" | "elevation";

/**
 * Poster card — 2∶3 aspect with TMDb `sizes` hints.
 * `size="md"` (default) fills grid tracks so ultra-wide layouts grow artwork instead of thin 128 px strips.
 * Wraps in `<Link>` for accessibility / right-click open unless `linkable={false}` (detail hero).
 */
export function MoviePoster({
	movieId,
	title,
	posterUrl,
	size = "md",
	showTitle = false,
	/** Adds a subtle inner bezel so the poster reads like a framed print. */
	filmFrame = false,
	/** Merges onto the poster frame (e.g. `rounded-2xl` for lobby grids). */
	frameClassName,
	className,
	priority = false,
	/** Lobby catalogue: shadow + z-index instead of translate so the card reads over neighbors. */
	hoverEffect = "lift",
	/** Catalogue tiles for TV use `/tv/[id]` (same poster shell as films). */
	listingKind = "movie",
	/** When false, renders a static frame (no self-link) for in-page hero art. */
	linkable = true,
}: {
	movieId: number;
	title: string;
	posterUrl: string | null;
	/** `hero` = full width of parent on small screens (detail page), larger fixed widths from `md` up. */
	size?: "xs" | "sm" | "md" | "lg" | "hero";
	showTitle?: boolean;
	filmFrame?: boolean;
	frameClassName?: string;
	className?: string;
	priority?: boolean;
	hoverEffect?: MoviePosterHoverEffect;
	listingKind?: "movie" | "tv";
	linkable?: boolean;
}) {
	/** Default `md` stretches with grid tracks so ultra-wide shells don’t strand tiny thumbnails. */
	const dim =
		size === "hero"
			? "w-full shrink-0 md:w-72 lg:w-80 xl:w-[22rem] 2xl:w-[24rem]"
			: {
					xs: "w-14",
					sm: "w-24 shrink-0 sm:w-[6.875rem]",
					md: "w-full",
					lg: "w-full max-w-[16rem]",
				}[size];

	/** Detail hero: linked tiles keep flush edges on phones; static hero art stays rounded at every breakpoint. */
	const heroFrame =
		size === "hero"
			? linkable
				? "rounded-none md:rounded-md max-md:border-x-0 max-md:rounded-none"
				: "rounded-[1.25rem] border-border/70 sm:rounded-[1.5rem]"
			: "";

	const imageSizes =
		size === "hero"
			? "(max-width: 768px) 100vw, (max-width: 1536px) 360px, 420px"
			: "(max-width: 640px) 38vw, (max-width: 1024px) 28vw, (max-width: 1536px) 220px, 260px";

	const isElevation = hoverEffect === "elevation";
	const detailHref =
		listingKind === "tv" ? `/tv/${movieId}` : `/movies/${movieId}`;

	const shellClassName = cn(
		"group block w-full min-w-0",
		// Shadow + z-index live on the link (not clipped by `overflow-hidden` on the frame).
		// NOTE: `group-hover:` only targets *descendants* of `.group` — never the group element itself,
		// so elevation must use `hover:` / `focus-within:` on this `<Link>`.
		isElevation &&
			cn(
				"relative z-0 overflow-visible transition-[box-shadow,z-index] duration-200 ease-out",
				"motion-reduce:transition-none motion-reduce:hover:shadow-none motion-reduce:focus-within:shadow-none",
				// Card-tinted scrim only (`var(--card)` = same token as `bg-card`) — no black ink,
				// stacked opaque mixes + large blurs so neighbors read clearly underneath.
				"focus-within:z-[100] [@media(hover:hover)]:hover:z-[100]",
				"[@media(hover:hover)]:hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--card)_92%,var(--border)),0_3vh_40vh_-12vh_color-mix(in_oklab,var(--card)_94%,transparent),0_0_74vh_0_color-mix(in_oklab,var(--card)_90%,transparent),0_14vh_112vh_-24vh_color-mix(in_oklab,var(--card)_86%,transparent),0_20vh_140vh_-34vh_color-mix(in_oklab,var(--card)_80%,transparent),0_28vh_168vh_-42vh_color-mix(in_oklab,var(--card)_72%,transparent),0_0_98vw_0_color-mix(in_oklab,var(--card)_66%,transparent)]",
				"focus-within:shadow-[0_0_0_1px_color-mix(in_oklab,var(--card)_92%,var(--border)),0_3vh_40vh_-12vh_color-mix(in_oklab,var(--card)_94%,transparent),0_0_74vh_0_color-mix(in_oklab,var(--card)_90%,transparent),0_14vh_112vh_-24vh_color-mix(in_oklab,var(--card)_86%,transparent),0_20vh_140vh_-34vh_color-mix(in_oklab,var(--card)_80%,transparent),0_28vh_168vh_-42vh_color-mix(in_oklab,var(--card)_72%,transparent),0_0_98vw_0_color-mix(in_oklab,var(--card)_66%,transparent)]",
			),
		className,
	);

	const frameShellClassName = cn(
		"poster-art relative aspect-[2/3] overflow-hidden rounded-md border border-border bg-card",
		!isElevation &&
			linkable &&
			"transition-transform duration-[var(--aker-duration)] ease-[var(--aker-ease)] group-hover:-translate-y-1 group-hover:border-desert-orange/40",
		isElevation && "border-0 transition-colors duration-200 ease-out",
		filmFrame &&
			"shadow-[inset_0_0_0_1px_rgba(0,0,0,0.5)] ring-1 ring-pure-white/12 ring-inset",
		heroFrame,
		dim,
		frameClassName,
	);

	const posterInner = (
		<>
			{/* `poster-art` lets elevation lobby grids target this frame for `:has()`-driven sibling grayscale. */}
			<div className={frameShellClassName}>
				{posterUrl ? (
					<Image
						src={posterUrl}
						alt={title}
						fill
						sizes={imageSizes}
						className="object-cover"
						priority={priority}
					/>
				) : (
					// No TMDb artwork — show the title in-frame (films + TV) so catalogue grids stay scannable.
					<div className="grid size-full place-items-center p-2 sm:p-2.5">
						<p className="line-clamp-5 max-w-full text-pretty text-center font-medium text-foreground text-xs leading-snug sm:text-sm">
							{title}
						</p>
					</div>
				)}
			</div>
			{showTitle && posterUrl ? (
				<p
					className={cn(
						"mt-2 line-clamp-2 text-[0.8rem] text-muted-foreground leading-snug sm:text-sm",
						linkable && "group-hover:text-foreground",
					)}
				>
					{title}
				</p>
			) : null}
		</>
	);

	if (linkable) {
		return (
			<Link href={detailHref} className={shellClassName} aria-label={title}>
				{posterInner}
			</Link>
		);
	}

	return <div className={shellClassName}>{posterInner}</div>;
}
