"use client";

import { buttonVariants } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import {
	Bell,
	BookMarked,
	History,
	Search,
	SlidersHorizontal,
	Tv,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useCommandPalette } from "@/components/app/command-palette";
import { ActivityItem } from "@/components/feed/activity-item";
import { HomeFriendActivityRail } from "@/components/home/home-friend-activity-rail";
import { MoviePoster } from "@/components/movie/movie-poster";
import type { HomeFriendRailEntry } from "@/lib/home-friend-rail";

type Browse = "movies" | "tv" | "community";
type Sort = "latest" | "popular";

type MovieStub = { id: number; title: string; poster_url: string | null };
type ActivityKind = "log" | "review" | "list";
type ActivityItemShape = { kind: ActivityKind; at: string; payload: unknown };

/** Stable React keys for merged feed rows (matches server `home/page` helper). */
function activityRowKey(item: ActivityItemShape): string {
	const pl = item.payload as Record<string, unknown>;
	if (
		item.kind === "log" &&
		pl.log &&
		typeof pl.log === "object" &&
		"id" in pl.log
	) {
		return `log:${(pl.log as { id: string }).id}`;
	}
	if (
		item.kind === "review" &&
		pl.review &&
		typeof pl.review === "object" &&
		"id" in pl.review
	) {
		return `review:${(pl.review as { id: string }).id}`;
	}
	if (
		item.kind === "list" &&
		pl.list &&
		typeof pl.list === "object" &&
		"id" in pl.list
	) {
		return `list:${(pl.list as { id: string }).id}`;
	}
	return `${item.kind}:${item.at}`;
}

const browseTabs: { id: Browse; label: string }[] = [
	{ id: "movies", label: "Movies" },
	{ id: "tv", label: "TV Shows" },
	{ id: "community", label: "Community" },
];

/**
 * Track B — home “lobby”: top browse chrome (tabs, search, shortcuts) sits on
 * the page `background`; only the catalogue block (sort / filters + poster grid)
 * sits inside the raised ring + rounded inner panel (design feedback 2026-05).
 */
export function HomeLobby({
	user,
	popular,
	upcoming,
	items,
	friendRailEntries,
	tmdbHint,
}: {
	user: { name: string; image: string | null; handle: string };
	popular: MovieStub[];
	upcoming: MovieStub[];
	items: ActivityItemShape[];
	friendRailEntries: HomeFriendRailEntry[];
	tmdbHint: string | null;
}) {
	const [browse, setBrowse] = useState<Browse>("movies");
	const [sort, setSort] = useState<Sort>("popular");
	const openCommand = useCommandPalette((s) => s.open);
	const [searchHint, setSearchHint] = useState("⌘K");

	useEffect(() => {
		const mac =
			typeof navigator !== "undefined" &&
			/Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
		setSearchHint(mac ? "⌘K" : "Ctrl K");
	}, []);

	const gridMovies =
		browse === "movies" ? (sort === "latest" ? upcoming : popular) : [];

	const initial = user.name?.trim()?.charAt(0)?.toUpperCase() ?? "?";

	return (
		<div>
			{/* Top chrome — flush on page `background` (not inside the rounded catalogue card). */}
			<div className="flex flex-col gap-4 pb-6 lg:flex-row lg:items-center lg:gap-5">
				<nav
					className="flex shrink-0 flex-wrap gap-1"
					aria-label="Browse modes"
				>
					{browseTabs.map(({ id, label }) => {
						const active = browse === id;
						return (
							<button
								key={id}
								type="button"
								onClick={() => setBrowse(id)}
								className={cn(
									"select-none rounded-full px-3.5 py-2 font-medium text-sm transition-colors duration-[var(--aker-duration-fast)] ease-[var(--aker-ease)]",
									active
										? "bg-card text-foreground shadow-sm"
										: "text-muted-foreground hover:bg-card/50 hover:text-foreground",
								)}
							>
								{label}
							</button>
						);
					})}
				</nav>

				<div className="flex min-w-0 flex-1 flex-col gap-2 lg:items-center">
					{/* Opens the same ⌘K palette as the floating nav — keeps one search system. */}
					<button
						type="button"
						onClick={() => openCommand()}
						className={cn(
							"flex w-full items-center gap-2.5 rounded-full border border-border/80 bg-card px-3 py-2.5 text-left shadow-sm transition-[box-shadow,transform] duration-[var(--aker-duration-fast)] ease-[var(--aker-ease)]",
							"hover:border-border hover:shadow-md active:scale-[0.99]",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
						)}
					>
						<Search
							className="size-4 shrink-0 text-muted-foreground"
							aria-hidden
						/>
						<span className="min-w-0 flex-1 truncate text-base text-muted-foreground md:text-sm">
							Search movies, TV, people…
						</span>
						<kbd className="hidden shrink-0 rounded-md border border-border/80 bg-background/80 px-2 py-0.5 font-medium font-mono text-[0.65rem] text-muted-foreground sm:inline">
							{searchHint}
						</kbd>
					</button>
				</div>

				<div className="flex items-center justify-end gap-1 sm:gap-1.5">
					<Link
						href="/diary"
						className={cn(
							buttonVariants({ variant: "ghost", size: "icon" }),
							"rounded-full text-muted-foreground hover:bg-card hover:text-foreground",
						)}
						aria-label="Diary"
					>
						<History className="size-[1.125rem]" />
					</Link>
					<Link
						href="/watchlist"
						className={cn(
							buttonVariants({ variant: "ghost", size: "icon" }),
							"rounded-full text-muted-foreground hover:bg-card hover:text-foreground",
						)}
						aria-label="Watchlist"
					>
						<BookMarked className="size-[1.125rem]" />
					</Link>
					<Link
						href="/notifications"
						className={cn(
							buttonVariants({ variant: "ghost", size: "icon" }),
							"rounded-full text-muted-foreground hover:bg-card hover:text-foreground",
						)}
						aria-label="Notifications"
					>
						<Bell className="size-[1.125rem]" />
					</Link>
					<Link
						href={`/profile/${user.handle}`}
						className="ml-0.5 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/80 bg-card font-semibold text-foreground text-sm shadow-sm transition-opacity hover:opacity-90"
						aria-label="Your profile"
					>
						{user.image ? (
							<Image
								src={user.image}
								alt={user.name}
								width={36}
								height={36}
								className="size-full object-cover"
							/>
						) : (
							<span aria-hidden>{initial}</span>
						)}
					</Link>
				</div>
			</div>

			{/* Catalogue panel — sort / filters + grid only (bleeds to shell gutters). */}
			{browse === "movies" ? (
				<div className="-mx-4 sm:-mx-6 lg:-mx-8 xl:-mx-12 2xl:-mx-16">
					<div className="rounded-none border-white/[0.04] border-x bg-card px-2.5 pt-2.5 pb-3 sm:rounded-[2rem] sm:border sm:px-3 sm:shadow-[0_32px_120px_-48px_rgba(0,0,0,0.65)] md:px-4 md:pt-4 md:pb-4">
						<div className="rounded-2xl border border-white/[0.06] bg-background p-4 sm:rounded-[1.75rem] sm:p-5 md:rounded-[2rem] md:p-6 lg:p-8">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<fieldset className="m-0 flex flex-wrap gap-1 border-0 p-0">
									<legend className="sr-only">Sort catalogue</legend>
									{(["latest", "popular"] as const).map((id) => {
										const active = sort === id;
										const label = id === "latest" ? "Latest" : "Popular";
										return (
											<button
												key={id}
												type="button"
												onClick={() => setSort(id)}
												className={cn(
													"select-none rounded-full px-3.5 py-2 font-medium text-sm transition-colors duration-[var(--aker-duration-fast)] ease-[var(--aker-ease)]",
													active
														? "bg-card text-foreground shadow-sm"
														: "text-muted-foreground hover:bg-card/50 hover:text-foreground",
												)}
											>
												{label}
											</button>
										);
									})}
								</fieldset>
								<Link
									href="/movies/discover"
									className={cn(
										buttonVariants({ variant: "secondary", size: "sm" }),
										"gap-2 rounded-full border border-border/70 bg-card px-4 py-2 font-medium text-sm shadow-sm hover:bg-card/90",
									)}
								>
									<SlidersHorizontal className="size-3.5" aria-hidden />
									Filters
								</Link>
							</div>

							<div className="mt-6">
								{tmdbHint ? (
									<p
										className="mb-4 text-muted-foreground text-sm"
										role="status"
									>
										{tmdbHint}
									</p>
								) : null}
								{gridMovies.length ? (
									<ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-5 lg:gap-5 xl:grid-cols-6 xl:gap-6">
										<li className="min-w-0 list-none">
											<Link
												href="/movies/discover"
												className="group flex aspect-[2/3] flex-col justify-end rounded-2xl bg-gradient-to-b from-amber-300 via-yellow-400 to-amber-500 p-4 text-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-transform duration-[var(--aker-duration)] ease-[var(--aker-ease)] hover:-translate-y-1"
											>
												<span className="font-semibold text-[0.65rem] uppercase tracking-[0.12em] opacity-90">
													Spotlight
												</span>
												<span className="mt-1 font-sans font-semibold text-lg leading-snug tracking-tight">
													Open full browse
												</span>
											</Link>
										</li>
										{gridMovies.map((m, i) => (
											<li key={m.id} className="min-w-0 list-none">
												<MoviePoster
													movieId={m.id}
													title={m.title}
													posterUrl={m.poster_url}
													size="md"
													priority={i < 6}
													frameClassName="rounded-2xl"
												/>
											</li>
										))}
									</ul>
								) : (
									<p className="text-muted-foreground text-sm" role="status">
										No titles in this runway yet — try the other sort or check
										back after the catalog sync.
									</p>
								)}
							</div>
						</div>
					</div>
				</div>
			) : null}

			{browse === "tv" ? (
				<div className="mt-2 rounded-2xl border border-border border-dashed bg-card/30 px-6 py-16 text-center">
					<Tv className="mx-auto size-10 text-muted-foreground" aria-hidden />
					<p className="mt-4 font-medium font-sans text-foreground text-lg">
						TV catalog is on the way
					</p>
					<p className="mt-2 text-muted-foreground text-sm">
						For now, search surfaces shows and cast in one place.
					</p>
					<Link
						href="/search"
						className={cn(
							buttonVariants({ variant: "default", size: "pill" }),
							"mt-6 inline-flex",
						)}
					>
						Go to search
					</Link>
				</div>
			) : null}

			{browse === "community" ? (
				<div className="mt-2 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-8">
					<div className="min-w-0 flex-1">
						{items.length ? (
							<ul className="space-y-3">
								{items.slice(0, 20).map((item) => (
									<li key={activityRowKey(item)}>
										<ActivityItem item={item} />
									</li>
								))}
							</ul>
						) : (
							<div className="rounded-2xl border border-border border-dashed bg-card/30 p-10 text-center">
								<p className="font-medium font-sans text-foreground text-lg">
									No screenings from your circle yet
								</p>
								<p className="mt-2 text-muted-foreground text-sm">
									Follow people whose logs you want in this feed — it lights up
									as soon as they post.
								</p>
								<Link
									href="/search"
									className={cn(
										buttonVariants({ variant: "accent", size: "pill" }),
										"mt-5 inline-flex",
									)}
								>
									Find people
								</Link>
							</div>
						)}
					</div>
					<HomeFriendActivityRail entries={friendRailEntries} />
				</div>
			) : null}
		</div>
	);
}
