"use client";

import { Button } from "@still/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@still/ui/components/dropdown-menu";
import IconClockRotateClockwise from "@still/ui/icons/clock-rotate-clockwise";
import IconListPlay from "@still/ui/icons/list-play";
import IconPlaylistOutline from "@still/ui/icons/playlist-outline";
import IconTicket from "@still/ui/icons/ticket";
import IconTicketFilled from "@still/ui/icons/ticket-filled";
import { cn } from "@still/ui/lib/utils";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { NavUserAvatar } from "@/components/app/app-nav";
import {
	AppUserAccountMenuBody,
	accountMenuContentClassName,
} from "@/components/app/app-user-account-menu";
import { HomeNotificationsMenu } from "@/components/home/home-notifications-menu";
import { HomeStickySearch } from "@/components/home/home-sticky-search";
import {
	type HomeBrowseSurface,
	parseHomeBrowseSurface,
} from "@/lib/home-browse-surface";
import { DEFAULT_HOME_COMMUNITY_FEED } from "@/lib/home-community-feed";
import {
	buildHomeHrefFromPersisted,
	emptyHomeLobbyPersisted,
	mergePersistFromHomeUrl,
	readHomeLobbyPersisted,
} from "@/lib/home-lobby-persist";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";

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
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const browseSurface = parseHomeBrowseSurface(searchParams.get("browse"));
	/** Diary shortcut uses a filled ticket while the patron is on `/diary` (matches lobby iconography). */
	const isDiaryRoute = pathname === "/diary" || pathname.startsWith("/diary/");
	/** Watchlist shortcut — keeps **clock** iconography; chip + `href` match diary (`layoutId`). */
	const isWatchlistRoute =
		pathname === "/watchlist" || pathname.startsWith("/watchlist/");
	/** Lists shortcut — filled on `/lists`, outline elsewhere (same pattern as diary ticket). */
	const isListsRoute = pathname === "/lists" || pathname.startsWith("/lists/");
	/** `?browse=` only applies on `/home` — on `/diary` we must not treat missing params as “Movies active” or the sliding pill stays left. */
	const isHomeLobby = pathname === "/home" || pathname.startsWith("/home/");
	const [isScrolled, setIsScrolled] = useState(false);
	const [accountMenuOpen, setAccountMenuOpen] = useState(false);
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

	/** Watchlist, lists, and diary icon links share one interaction shell (pill, hover, focus). */
	const stickyLobbyShortcutLinkClass = cn(
		"relative flex h-11 w-11 items-center justify-center rounded-full text-foreground outline-none transition-colors duration-200 ease-out",
		"[@media(hover:hover)]:hover:bg-muted/35",
		"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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

	/** Updates `?browse=`; from diary/watchlist seeds from {@link readHomeLobbyPersisted}. */
	const pushBrowseSurface = (next: HomeBrowseSurface) => {
		const base = "/home";
		const persisted = readHomeLobbyPersisted() ?? emptyHomeLobbyPersisted();

		if (!isHomeLobby) {
			router.push(buildHomeHrefFromPersisted(persisted, next));
			return;
		}

		if (next === "community") {
			const feed = persisted.community?.feed ?? DEFAULT_HOME_COMMUNITY_FEED;
			router.push(buildHomeLobbyHref({ browse: "community", sort: feed }));
			return;
		}

		if (browseSurface === "community") {
			router.push(buildHomeHrefFromPersisted(persisted, next));
			return;
		}

		const params = new URLSearchParams(searchParams.toString());
		if (next === "movies") {
			params.delete("browse");
		} else {
			params.set("browse", next);
		}
		const qs = params.toString();
		router.push(qs ? `${base}?${qs}` : base);
	};

	useEffect(() => {
		if (!isHomeLobby) return;
		mergePersistFromHomeUrl(
			browseSurface,
			new URLSearchParams(searchParams.toString()),
		);
	}, [isHomeLobby, browseSurface, searchParams]);

	return (
		<LayoutGroup id="home-sticky-chrome-browse-pill">
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
						browse lists, reviews, and other work from other members — it is
						still in development.
					</p>
					<div
						className="flex w-fit rounded-full bg-background p-1"
						role="toolbar"
						aria-label="Lobby source"
						aria-describedby="home-sticky-browse-desc"
					>
						<button
							type="button"
							aria-pressed={isHomeLobby && browseSurface === "movies"}
							aria-label="Movies — TMDb film catalogue"
							title="Catalogue from TMDb — films"
							onClick={() => pushBrowseSurface("movies")}
							className={browseChip(isHomeLobby && browseSurface === "movies")}
						>
							{isHomeLobby && browseSurface === "movies" ? (
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
							aria-pressed={isHomeLobby && browseSurface === "tv"}
							aria-label="TV shows — TMDb series catalogue"
							title="Catalogue from TMDb — series"
							onClick={() => pushBrowseSurface("tv")}
							className={browseChip(isHomeLobby && browseSurface === "tv")}
						>
							{isHomeLobby && browseSurface === "tv" ? (
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
							aria-pressed={isHomeLobby && browseSurface === "community"}
							aria-label="Community — lists, reviews, and more from other people"
							title="Things other people made — lists, reviews, and more (in development)"
							onClick={() => pushBrowseSurface("community")}
							className={browseChip(
								isHomeLobby && browseSurface === "community",
							)}
						>
							{isHomeLobby && browseSurface === "community" ? (
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
				<HomeStickySearch />

				{/* Right — shortcuts (watchlist, lists, diary share the browse-rail `layoutId` pill). */}
				<div className="flex justify-center sm:justify-end">
					<div className="flex gap-1">
						<Link
							href="/watchlist"
							className={stickyLobbyShortcutLinkClass}
							aria-label="Your watchlist"
							aria-current={isWatchlistRoute ? "page" : undefined}
							title="Titles you have marked to watch"
						>
							{isWatchlistRoute ? (
								<motion.span
									layoutId="home-sticky-browse-pill"
									className="absolute inset-0 z-0 rounded-full bg-card"
									transition={browsePillTransition}
								/>
							) : null}
							<span className="relative z-10">
								<IconClockRotateClockwise />
							</span>
						</Link>
						<Link
							href="/lists"
							className={stickyLobbyShortcutLinkClass}
							aria-label="Your lists"
							aria-current={isListsRoute ? "page" : undefined}
							title="Lists you have created"
						>
							{isListsRoute ? (
								<motion.span
									layoutId="home-sticky-browse-pill"
									className="absolute inset-0 z-0 rounded-full bg-card"
									transition={browsePillTransition}
								/>
							) : null}
							<span className="relative z-10">
								{isListsRoute ? (
									<IconListPlay size="20px" />
								) : (
									<IconPlaylistOutline size="20px" />
								)}
							</span>
						</Link>
						<Link
							href="/diary"
							className={stickyLobbyShortcutLinkClass}
							aria-label="Your diary"
							aria-current={isDiaryRoute ? "page" : undefined}
							title="Your logged screenings"
						>
							{isDiaryRoute ? (
								<motion.span
									layoutId="home-sticky-browse-pill"
									className="absolute inset-0 z-0 rounded-full bg-card"
									transition={browsePillTransition}
								/>
							) : null}
							<span className="relative z-10">
								{isDiaryRoute ? <IconTicketFilled /> : <IconTicket />}
							</span>
						</Link>
						<HomeNotificationsMenu authenticated={Boolean(user)} />
						{user ? (
							<DropdownMenu
								open={accountMenuOpen}
								onOpenChange={setAccountMenuOpen}
							>
								<DropdownMenuTrigger
									render={
										<Button
											type="button"
											variant="ghost"
											size="icon"
											aria-label="Account menu"
											aria-expanded={accountMenuOpen}
											className={cn(
												"size-11 shrink-0 rounded-full [@media(hover:hover)]:hover:bg-muted/35",
												accountMenuOpen && "bg-card",
											)}
										>
											<NavUserAvatar
												src={user.image}
												name={user.name}
												handle={user.handle}
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
		</LayoutGroup>
	);
}
