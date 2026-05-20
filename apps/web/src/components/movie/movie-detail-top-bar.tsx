"use client";

import IconShareIn from "@still/ui/icons/share-in";
import IconShareOut from "@still/ui/icons/share-out";
import { cn } from "@still/ui/lib/utils";
import { Check } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
	DetailMotionButton,
	DetailMotionLink,
} from "@/components/movie/detail-motion-pressable";
import { useMovieDetailReturn } from "@/components/movie/use-movie-detail-return";

/**
 * Track B film header — dynamic back pill (last lobby / diary / watchlist) in the leading
 * column; About/Streaming use the same **sliding `layoutId` pill** as `/home` sort chips.
 * Back + Share use hero-row spring press; tabs keep color-only transitions (no scale).
 */
export function MovieDetailTopBar({
	movieId,
	title,
	view,
	/** Defaults to `/movies/[id]`; TV detail passes `/tv/[id]`. */
	detailBasePath,
}: {
	movieId: number;
	title: string;
	view: "about" | "streaming";
	detailBasePath?: string;
}) {
	const basePath = detailBasePath ?? `/movies/${movieId}`;
	const aboutHref = basePath;
	const streamingHref = `${basePath}?view=streaming`;

	const reduceMotion = useReducedMotion();
	const pathname = usePathname();
	const back = useMovieDetailReturn();
	/** Same scroll seam treatment as `/home` sticky chrome — gradient scrim, no backdrop blur. */
	const [isScrolled, setIsScrolled] = useState(false);
	const [shareCopied, setShareCopied] = useState(false);

	useEffect(() => {
		const onScroll = () => {
			setIsScrolled(window.scrollY > 2);
		};

		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	/** Raised pill on canvas — matches `/home` sticky shortcut chips (`bg-card`). */
	const pill = cn(
		"inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 font-medium text-sm transition-colors duration-200 ease-out",
		"bg-card text-foreground [@media(hover:hover)]:hover:bg-muted/35",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
	);

	/** Copies the current page URL — no native share sheet. */
	async function handleShare() {
		const href =
			typeof window !== "undefined"
				? `${window.location.origin}${pathname}`
				: `${basePath}${view === "streaming" ? "?view=streaming" : ""}`;

		try {
			await navigator.clipboard.writeText(href);
			setShareCopied(true);
			toast.success("Link copied");
			window.setTimeout(() => setShareCopied(false), 1600);
		} catch {
			toast.error("Couldn't copy link");
		}
	}

	const segLink = (active: boolean) =>
		cn(
			"relative inline-flex min-h-10 items-center justify-center rounded-full px-5 py-2 text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	return (
		<header
			className={cn(
				"sticky top-0 z-30 w-full overflow-visible bg-background",
				// Match `/home` sticky chrome: opaque bar + long gradient below the seam when scrolled.
				"after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[clamp(7rem,42svh,18rem)] after:bg-[linear-gradient(180deg,var(--background)_0%,color-mix(in_oklab,var(--background)_92%,transparent)_14%,color-mix(in_oklab,var(--background)_68%,transparent)_38%,color-mix(in_oklab,var(--background)_32%,transparent)_68%,transparent_100%)] after:opacity-0 after:transition-opacity after:duration-300 after:ease-out after:content-[''] motion-reduce:after:transition-none",
				isScrolled && "after:opacity-100",
			)}
		>
			<div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 px-2.5 py-2 sm:px-3">
				<div className="flex min-w-0 justify-start">
					<DetailMotionLink href={back.href} className={cn(pill, "pl-3")}>
						<IconShareIn size="20px" className="shrink-0 opacity-90" />
						{back.label}
					</DetailMotionLink>
				</div>
				<nav
					aria-label="Film detail"
					className="flex shrink-0 gap-1 rounded-full bg-card p-1"
				>
					{/* Tab segments: sliding pill only — no hero-row scale on press. */}
					<Link
						href={aboutHref}
						className={segLink(view === "about")}
						aria-current={view === "about" ? "page" : undefined}
					>
						{view === "about" ? (
							<motion.span
								layoutId="movie-detail-view-pill"
								className="absolute inset-0 z-0 rounded-full bg-background"
								transition={pillTransition}
							/>
						) : null}
						<span className="relative z-10">About</span>
					</Link>
					<Link
						href={streamingHref}
						className={segLink(view === "streaming")}
						aria-current={view === "streaming" ? "page" : undefined}
					>
						{view === "streaming" ? (
							<motion.span
								layoutId="movie-detail-view-pill"
								className="absolute inset-0 z-0 rounded-full bg-background"
								transition={pillTransition}
							/>
						) : null}
						<span className="relative z-10">Streaming</span>
					</Link>
				</nav>
				<div className="flex min-w-0 justify-end">
					<DetailMotionButton
						type="button"
						className={cn(pill, "pr-3")}
						onClick={() => void handleShare()}
						aria-label={shareCopied ? "Link copied" : `Copy link for ${title}`}
						iconSwapKey={shareCopied ? "copied" : "share"}
					>
						{shareCopied ? "Copied" : "Share"}
						{shareCopied ? (
							<Check className="size-4 shrink-0 opacity-90" aria-hidden />
						) : (
							<IconShareOut size="20px" className="shrink-0 opacity-90" />
						)}
					</DetailMotionButton>
				</div>
			</div>
		</header>
	);
}
