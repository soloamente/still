"use client";

import { Button } from "@still/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@still/ui/components/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@still/ui/components/tooltip";
import IconClockRotateClockwise from "@still/ui/icons/clock-rotate-clockwise";
import IconListPlay from "@still/ui/icons/list-play";
import IconPlaylistOutline from "@still/ui/icons/playlist-outline";
import IconQuotes from "@still/ui/icons/quotes";
import IconQuotesFilled from "@still/ui/icons/quotes-filled";
import IconTicket from "@still/ui/icons/ticket";
import IconTicketFilled from "@still/ui/icons/ticket-filled";
import { cn } from "@still/ui/lib/utils";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
	AppUserAccountMenuBody,
	accountMenuContentClassName,
} from "@/components/app/app-user-account-menu";
import { NavUserAvatar } from "@/components/app/nav-user-avatar";
import { useHomeBrowseSurfaceOptional } from "@/components/home/home-browse-surface-context";
import { HomeNotificationsMenu } from "@/components/home/home-notifications-menu";
import { HomeStickySearch } from "@/components/home/home-sticky-search";
import { InviteEarnHeaderButton } from "@/components/referrals/invite-earn-header-button";
import type { DiaryMetalTier } from "@/lib/diary-metal-tier";
import {
	type HomeBrowseSurface,
	parseHomeBrowseSurface,
} from "@/lib/home-browse-surface";
import { buildBrowseSurfaceNavigateHref } from "@/lib/home-browse-surface-nav";
import {
	emptyHomeLobbyPersisted,
	mergePersistFromHomeUrl,
	readHomeLobbyPersisted,
} from "@/lib/home-lobby-persist";

/** Header shortcut + menu icons — `size-5` (20px); Button `size="icon"` otherwise forces `size-4`. */
const HOME_STICKY_HEADER_ICON_CLASS = "size-5 shrink-0";
/** Compact shortcut tooltips: smaller label and tighter trigger gap for icon-only buttons. */
const HOME_STICKY_SHORTCUT_TOOLTIP_CLASS = "px-2 py-2 text-xs leading-none";

/** Browse rail — `?browse=` drives the lobby catalogue on the RSC page; we keep URL + UI in sync. */

/** Session + profile row — passed from `/home` RSC so the avatar menu matches bottom `AppNav`. */
export type HomeStickyChromeUser = {
	id: string;
	name: string;
	image: string | null;
	handle: string;
	email?: string | null;
	isPro?: boolean;
	avatarIsAnimated?: boolean;
	diaryMetalTier?: DiaryMetalTier | null;
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
	const browseSurfaceCtx = useHomeBrowseSurfaceOptional();
	const prefetchBrowseSurface = browseSurfaceCtx?.prefetchBrowseSurface;
	const urlBrowse =
		browseSurfaceCtx?.urlBrowse ??
		parseHomeBrowseSurface(searchParams.get("browse"));
	/** Optimistic on `/home`; elsewhere URL-only (no provider). */
	const activeBrowse = browseSurfaceCtx?.activeBrowse ?? urlBrowse;
	/** Diary shortcut uses a filled ticket while the patron is on `/diary` (matches lobby iconography). */
	const isDiaryRoute = pathname === "/diary" || pathname.startsWith("/diary/");
	/** Watchlist shortcut — keeps **clock** iconography; chip + `href` match diary (`layoutId`). */
	const isWatchlistRoute =
		pathname === "/watchlist" || pathname.startsWith("/watchlist/");
	/** Lists shortcut — filled on `/lists`, outline elsewhere (same pattern as diary ticket). */
	const isListsRoute = pathname === "/lists" || pathname.startsWith("/lists/");
	/** Saved quotes shortcut — filled on `/quotes`, outline elsewhere. */
	const isQuotesRoute =
		pathname === "/quotes" || pathname.startsWith("/quotes/");
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

	/** Legacy push when chrome renders outside `HomeLobbyNavigationRoot` (diary, lists, watchlist). */
	const pushBrowseSurfaceLegacy = useCallback(
		(next: HomeBrowseSurface) => {
			const href = buildBrowseSurfaceNavigateHref(next, {
				isHomeLobby,
				currentParams: new URLSearchParams(searchParams.toString()),
				persisted: readHomeLobbyPersisted() ?? emptyHomeLobbyPersisted(),
			});
			router.push(href);
		},
		[isHomeLobby, router, searchParams],
	);

	const onBrowseSurfaceSelect = useCallback(
		(next: HomeBrowseSurface) => {
			if (browseSurfaceCtx) {
				browseSurfaceCtx.selectBrowseSurface(next);
				return;
			}
			pushBrowseSurfaceLegacy(next);
		},
		[browseSurfaceCtx, pushBrowseSurfaceLegacy],
	);

	useEffect(() => {
		if (!isHomeLobby) return;
		mergePersistFromHomeUrl(
			urlBrowse,
			new URLSearchParams(searchParams.toString()),
		);
	}, [isHomeLobby, urlBrowse, searchParams]);

	return (
		<LayoutGroup id="home-sticky-chrome-browse-pill">
			<header
				className={cn(
					/*
					 * Side tracks: `minmax(max-content,1fr)` keeps browse + shortcuts visible.
					 * Center: `minmax(0,36rem)` — search shrinks first when horizontal space is tight.
					 */
					"sticky top-0 z-20 grid w-full grid-cols-1 items-center gap-3 bg-background py-2.5 sm:grid-cols-[minmax(max-content,1fr)_minmax(0,36rem)_minmax(max-content,1fr)] sm:gap-4",
					// Full-opacity canvas at the seam, then a long multi-stop fade so the poster row
					// eases in instead of meeting a razor line (same token as `bg-background`).
					"after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[clamp(7rem,42svh,18rem)] after:bg-[linear-gradient(180deg,var(--background)_0%,color-mix(in_oklab,var(--background)_92%,transparent)_14%,color-mix(in_oklab,var(--background)_68%,transparent)_38%,color-mix(in_oklab,var(--background)_32%,transparent)_68%,transparent_100%)] after:opacity-0 after:transition-opacity after:duration-300 after:ease-out after:content-[''] motion-reduce:after:transition-none",
					isScrolled && "after:opacity-100",
				)}
			>
				{/* Left — browse tabs; side track min-width is `max-content` so chips are not clipped. */}
				<div className="flex min-w-0 flex-wrap justify-center sm:justify-start">
					<p id="home-sticky-browse-desc" className="sr-only">
						Movies and TV load the TMDb catalogue. Community is where you will
						browse lists, reviews, and other work from other members — it is
						still in development.
					</p>
					<div
						className="flex w-fit max-w-full shrink-0 rounded-full bg-background p-1"
						role="toolbar"
						aria-label="Lobby source"
						aria-describedby="home-sticky-browse-desc"
					>
						<button
							type="button"
							aria-pressed={isHomeLobby && activeBrowse === "movies"}
							aria-label="Movies — TMDb film catalogue"
							title="Catalogue from TMDb — films"
							onClick={() => onBrowseSurfaceSelect("movies")}
							className={browseChip(isHomeLobby && activeBrowse === "movies")}
						>
							{isHomeLobby && activeBrowse === "movies" ? (
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
							aria-pressed={isHomeLobby && activeBrowse === "tv"}
							aria-label="TV shows — TMDb series catalogue"
							title="Catalogue from TMDb — series"
							onClick={() => onBrowseSurfaceSelect("tv")}
							className={browseChip(isHomeLobby && activeBrowse === "tv")}
						>
							{isHomeLobby && activeBrowse === "tv" ? (
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
							aria-pressed={isHomeLobby && activeBrowse === "community"}
							aria-label="Community — lists, reviews, and more from other people"
							title="Things other people made — lists, reviews, and more (in development)"
							onClick={() => onBrowseSurfaceSelect("community")}
							onPointerEnter={() => prefetchBrowseSurface?.("community")}
							onFocus={() => prefetchBrowseSurface?.("community")}
							className={browseChip(
								isHomeLobby && activeBrowse === "community",
							)}
						>
							{isHomeLobby && activeBrowse === "community" ? (
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

				{/* Middle — fills the shrinkable grid track (up to 36rem). */}
				<div className="flex w-full min-w-0 justify-center">
					<HomeStickySearch />
				</div>

				{/* Right — shortcuts (watchlist, lists, diary share the browse-rail `layoutId` pill). */}
				<div className="hidden min-w-0 shrink-0 justify-center sm:justify-end md:flex">
					{/* Icon-only header shortcuts should reveal instantly on hover. */}
					<TooltipProvider delay={0} closeDelay={80}>
						<div className="flex shrink-0 gap-1">
							<Tooltip>
								<TooltipTrigger
									render={
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
												<IconClockRotateClockwise
													className={HOME_STICKY_HEADER_ICON_CLASS}
												/>
											</span>
										</Link>
									}
								/>
								<TooltipContent
									sideOffset={2}
									className={HOME_STICKY_SHORTCUT_TOOLTIP_CLASS}
								>
									Watchlist
								</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger
									render={
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
													<IconListPlay
														className={HOME_STICKY_HEADER_ICON_CLASS}
													/>
												) : (
													<IconPlaylistOutline
														className={HOME_STICKY_HEADER_ICON_CLASS}
													/>
												)}
											</span>
										</Link>
									}
								/>
								<TooltipContent
									sideOffset={2}
									className={HOME_STICKY_SHORTCUT_TOOLTIP_CLASS}
								>
									Lists
								</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger
									render={
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
												{isDiaryRoute ? (
													<IconTicketFilled
														className={HOME_STICKY_HEADER_ICON_CLASS}
													/>
												) : (
													<IconTicket
														className={HOME_STICKY_HEADER_ICON_CLASS}
													/>
												)}
											</span>
										</Link>
									}
								/>
								<TooltipContent
									sideOffset={2}
									className={HOME_STICKY_SHORTCUT_TOOLTIP_CLASS}
								>
									Diary
								</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger
									render={
										<Link
											href="/quotes"
											className={stickyLobbyShortcutLinkClass}
											aria-label="Your saved quotes"
											aria-current={isQuotesRoute ? "page" : undefined}
											title="Lines you have saved"
										>
											{isQuotesRoute ? (
												<motion.span
													layoutId="home-sticky-browse-pill"
													className="absolute inset-0 z-0 rounded-full bg-card"
													transition={browsePillTransition}
												/>
											) : null}
											<span className="relative z-10">
												{isQuotesRoute ? (
													<IconQuotesFilled
														className={HOME_STICKY_HEADER_ICON_CLASS}
													/>
												) : (
													<IconQuotes
														className={HOME_STICKY_HEADER_ICON_CLASS}
													/>
												)}
											</span>
										</Link>
									}
								/>
								<TooltipContent
									sideOffset={2}
									className={HOME_STICKY_SHORTCUT_TOOLTIP_CLASS}
								>
									Quotes
								</TooltipContent>
							</Tooltip>
							<HomeNotificationsMenu authenticated={Boolean(user)} />
							{user ? <InviteEarnHeaderButton /> : null}
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
													isAnimated={user.avatarIsAnimated ?? false}
													diaryMetalTier={user.diaryMetalTier ?? null}
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
												avatarIsAnimated: user.avatarIsAnimated,
												diaryMetalTier: user.diaryMetalTier ?? null,
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
					</TooltipProvider>
				</div>
			</header>
		</LayoutGroup>
	);
}
