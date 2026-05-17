"use client";

import { Button } from "@still/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@still/ui/components/dropdown-menu";
import IconBell from "@still/ui/icons/bell";
import IconClockRotateClockwise from "@still/ui/icons/clock-rotate-clockwise";
import IconTicket from "@still/ui/icons/ticket";
import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { NavUserAvatar } from "@/components/app/app-nav";
import {
	AppUserAccountMenuBody,
	accountMenuContentClassName,
} from "@/components/app/app-user-account-menu";
import { useCommandPalette } from "@/components/app/command-palette";
import {
	type HomeBrowseSurface,
	parseHomeBrowseSurface,
} from "@/lib/home-browse-surface";

/** Browse rail — `?browse=` drives the lobby catalogue on the RSC page; we keep URL + UI in sync. */

/** Session + profile row — passed from `/home` RSC so the avatar menu matches bottom `AppNav`. */
export type HomeStickyChromeUser = {
	id: string;
	name: string;
	image: string | null;
	handle: string;
	email?: string | null;
	isPro?: boolean;
};

/**
 * Home top chrome: sticky header plus a tall **gradient scrim** (only while scrolled)
 * that actually softens the seam — box-shadow alone rarely hides a hard opaque edge.
 */
export function HomeStickyChrome({
	user,
}: {
	user: HomeStickyChromeUser | null;
}) {
	const router = useRouter();
	const openCommand = useCommandPalette((s) => s.open);
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const browseSurface = parseHomeBrowseSurface(searchParams.get("browse"));
	const [isScrolled, setIsScrolled] = useState(false);
	const reduceMotion = useReducedMotion();

	const browsePillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	const browseChip = (active: boolean) =>
		cn(
			/* `relative` pins the sliding `layoutId` pill (`absolute inset-0`) to each chip. */
			"relative inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-5 py-2.5 text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	useEffect(() => {
		// Read scroll on the window — `(app)` content scrolls with the document, not an inner pane.
		const onScroll = () => {
			setIsScrolled(window.scrollY > 2);
		};

		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	/** Updates `?browse=` while preserving `sort=` and any other home query keys. */
	const pushBrowseSurface = (next: HomeBrowseSurface) => {
		const params = new URLSearchParams(searchParams.toString());
		if (next === "movies") {
			params.delete("browse");
		} else {
			params.set("browse", next);
		}
		const qs = params.toString();
		const base = pathname && pathname.length > 0 ? pathname : "/home";
		router.push(qs ? `${base}?${qs}` : base);
	};

	return (
		<header
			className={cn(
				"sticky top-0 z-20 grid w-full grid-cols-1 items-center gap-3 overflow-visible bg-background py-2.5 sm:grid-cols-[1fr_minmax(20rem,56rem)_1fr] sm:gap-4",
				// Full-opacity canvas at the seam, then a long multi-stop fade so the poster row
				// eases in instead of meeting a razor line (same token as `bg-background`).
				"after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[clamp(7rem,42svh,18rem)] after:bg-[linear-gradient(180deg,var(--background)_0%,color-mix(in_oklab,var(--background)_92%,transparent)_14%,color-mix(in_oklab,var(--background)_68%,transparent)_38%,color-mix(in_oklab,var(--background)_32%,transparent)_68%,transparent_100%)] after:opacity-0 after:transition-opacity after:duration-300 after:ease-out after:content-[''] motion-reduce:after:transition-none",
				isScrolled && "after:opacity-100",
			)}
		>
			{/* Left — browse tabs (shared `layoutId` pill slides like `/home` Latest ↔ Popular). */}
			<div className="flex min-w-0 flex-wrap justify-center sm:justify-start">
				<p id="home-sticky-browse-desc" className="sr-only">
					Movies and TV load the TMDb catalogue. Community is where you will
					browse lists, reviews, and other work from other members — it is still
					in development.
				</p>
				<div
					className="flex w-fit rounded-full bg-background p-1"
					role="toolbar"
					aria-label="Lobby source"
					aria-describedby="home-sticky-browse-desc"
				>
					<button
						type="button"
						aria-pressed={browseSurface === "movies"}
						aria-label="Movies — TMDb film catalogue"
						title="Catalogue from TMDb — films"
						onClick={() => pushBrowseSurface("movies")}
						className={browseChip(browseSurface === "movies")}
					>
						{browseSurface === "movies" ? (
							<motion.span
								layoutId="home-sticky-browse-pill"
								className="absolute inset-0 z-0 rounded-full bg-card"
								transition={browsePillTransition}
							/>
						) : null}
						<span className="relative z-10">Movies</span>
					</button>
					<button
						type="button"
						aria-pressed={browseSurface === "tv"}
						aria-label="TV shows — TMDb series catalogue"
						title="Catalogue from TMDb — series"
						onClick={() => pushBrowseSurface("tv")}
						className={browseChip(browseSurface === "tv")}
					>
						{browseSurface === "tv" ? (
							<motion.span
								layoutId="home-sticky-browse-pill"
								className="absolute inset-0 z-0 rounded-full bg-card"
								transition={browsePillTransition}
							/>
						) : null}
						<span className="relative z-10">TV Shows</span>
					</button>
					<button
						type="button"
						aria-pressed={browseSurface === "community"}
						aria-label="Community — lists, reviews, and more from other people"
						title="Things other people made — lists, reviews, and more (in development)"
						onClick={() => pushBrowseSurface("community")}
						className={browseChip(browseSurface === "community")}
					>
						{browseSurface === "community" ? (
							<motion.span
								layoutId="home-sticky-browse-pill"
								className="absolute inset-0 z-0 rounded-full bg-card"
								transition={browsePillTransition}
							/>
						) : null}
						<span className="relative z-10">Community</span>
					</button>
				</div>
			</div>

			{/*
				`justify-self-center`: when the pill is narrower than the middle track
				(`minmax(20rem,56rem)`), it stays centered in that column — `w-lg` alone
				stuck the bar to the start edge and broke optical centering.
			*/}
			<label className="flex w-[min(100%,48rem)] min-w-0 shrink-0 items-center gap-2 justify-self-center rounded-full bg-card px-5 py-3 sm:w-[min(100%,36rem)]">
				<Search className="size-4 shrink-0" aria-hidden />
				<input
					type="search"
					placeholder="Search"
					autoComplete="off"
					spellCheck={false}
					className="min-w-0 flex-1 border-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground md:text-sm"
				/>
			</label>

			{/* Right — shortcuts */}
			<div className="flex justify-center sm:justify-end">
				<div className="flex gap-1">
					<button
						type="button"
						className="flex h-11 w-11 items-center justify-center rounded-full"
					>
						<IconClockRotateClockwise />
					</button>
					<button
						type="button"
						className="flex h-11 w-11 items-center justify-center rounded-full"
					>
						<IconTicket />
					</button>
					<button
						type="button"
						className="flex h-11 w-11 items-center justify-center rounded-full"
					>
						<IconBell />
					</button>
					{user ? (
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button
										type="button"
										variant="ghost"
										size="icon"
										aria-label="Account menu"
										className="size-11 shrink-0 rounded-full bg-card [@media(hover:hover)]:hover:bg-muted/35"
									>
										<NavUserAvatar
											src={user.image}
											name={user.name}
											size="compact"
										/>
									</Button>
								}
							/>
							<DropdownMenuContent
								align="end"
								className={accountMenuContentClassName}
							>
								<AppUserAccountMenuBody
									user={{
										id: user.id,
										name: user.name,
										image: user.image,
										handle: user.handle,
										email: user.email,
										isPro: user.isPro,
									}}
									onRequestContent={openCommand}
								/>
							</DropdownMenuContent>
						</DropdownMenu>
					) : (
						<div
							className="size-11 shrink-0 rounded-full bg-muted/40"
							aria-hidden
						/>
					)}
				</div>
			</div>
		</header>
	);
}
