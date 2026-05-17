import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CreditsFooter } from "@/components/cinema/credits-footer";
import { Letterbox } from "@/components/cinema/letterbox";
import { ListRowStrip } from "@/components/list/list-row-strip";
import { MoviePoster } from "@/components/movie/movie-poster";
import { FollowButton } from "@/components/profile/follow-button";
import { ReviewCard } from "@/components/review/review-card";
import { authServer } from "@/lib/auth-server";
import { toListBoardRow } from "@/lib/list-board-row";
import { profileBannerImageUrl } from "@/lib/profile-banner";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ handle: string }>;
}) {
	const { handle } = await params;
	return { title: `@${handle}` };
}

type ProfileData = {
	user: { id: string; name: string | null; image: string | null };
	profile: {
		userId: string;
		handle: string;
		displayName: string;
		bio: string | null;
		pronouns: string | null;
		location: string | null;
		website: string | null;
		bannerUrl: string | null;
		accentColor: string | null;
		favoriteMovieIds: number[];
		sectionOrder: string[] | null;
		isPrivate: boolean;
	};
	stats: { followers: number; following: number };
	isFollowing: boolean;
	recentlyWatched: {
		log: {
			id: string;
			/** ISO string from JSON, or a Date if the value was not re-serialized. */
			watchedAt: string | Date;
			rating: number | null;
			liked: boolean;
		};
		movie: { tmdbId: number; title: string; posterPath: string | null } | null;
	}[];
	recentReviews: {
		review: {
			id: string;
			userId: string;
			movieId: number;
			title: string | null;
			body: string;
			rating: number | null;
			likesCount: number;
			commentsCount: number;
			publishedAt: string;
		};
		movie: { tmdbId: number; title: string; posterPath: string | null } | null;
	}[];
	lists: {
		id: string;
		title: string;
		itemsCount: number;
		likesCount: number;
		coverMovieIds: number[];
		coverPosterPaths: (string | null)[];
		updatedAt: string;
		isPublic: boolean;
		description: string | null;
	}[];
	pinnedBadges: {
		badgeId: string;
		awardedAt: string;
	}[];
};

/** Rails after filmography — order respects `profile.sectionOrder`. */
const SECTION_ORDER_KEYS = ["favorites", "reviews", "lists"] as const;

type ProfileTab = "filmography" | (typeof SECTION_ORDER_KEYS)[number];

const TAB_LABEL: Record<ProfileTab, string> = {
	filmography: "Filmography",
	favorites: "Favorites",
	reviews: "Reviews",
	lists: "Lists",
};

/**
 * Deduplicates watch logs by movie so filmography stays one credit line per title.
 * Tie-break keeps the freshest `watchedAt` when multiple logs exist for the same `tmdbId`.
 */
function filmographyFromRecentlyWatched(
	recentlyWatched: ProfileData["recentlyWatched"],
): ProfileData["recentlyWatched"] {
	const byTmdbId = new Map<number, ProfileData["recentlyWatched"][number]>();
	for (const row of recentlyWatched) {
		if (!row.movie) continue;
		const existing = byTmdbId.get(row.movie.tmdbId);
		const nextTs = new Date(row.log.watchedAt).getTime();
		const prevTs = existing
			? new Date(existing.log.watchedAt).getTime()
			: Number.NEGATIVE_INFINITY;
		if (!existing || nextTs >= prevTs) {
			byTmdbId.set(row.movie.tmdbId, row);
		}
	}
	return [...byTmdbId.values()].sort(
		(a, b) =>
			new Date(b.log.watchedAt).getTime() - new Date(a.log.watchedAt).getTime(),
	);
}

function creditsRatingLabel(
	row: ProfileData["recentlyWatched"][number],
): string {
	const r = row.log.rating;
	if (r != null && r > 0) return `${String(r)} / 10`;
	return row.log.liked ? "Liked" : "—";
}

/**
 * Filmography “year” column — derive calendar year from whatever timestamp shape
 * the profile API returned (ISO string over the wire, or Date from in-process data).
 */
function creditsYearISO(watchedAt: unknown): string {
	if (watchedAt == null) return "—";
	const d =
		watchedAt instanceof Date
			? watchedAt
			: typeof watchedAt === "string" || typeof watchedAt === "number"
				? new Date(watchedAt)
				: null;
	if (!d || Number.isNaN(d.getTime())) return "—";
	const y = d.getUTCFullYear();
	return Number.isFinite(y) && y > 0 ? String(y) : "—";
}

function profileInitials(displayName: string): string {
	const parts = displayName.trim().split(/\s+/).filter(Boolean);
	if (!parts.length) return "?";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	const a = parts[0][0];
	const b = parts[parts.length - 1][0];
	return `${a}${b}`.toUpperCase();
}

function profileTabHref(handle: string, tab: ProfileTab): string {
	return `/profile/${encodeURIComponent(handle)}?tab=${tab}`;
}

function resolveProfileTab(
	raw: string | undefined,
	available: readonly ProfileTab[],
): ProfileTab {
	const v = raw?.toLowerCase();
	if (v && (available as readonly string[]).includes(v)) return v as ProfileTab;
	return available[0] ?? "filmography";
}

export default async function ProfilePage({
	params,
	searchParams,
}: {
	params: Promise<{ handle: string }>;
	searchParams: Promise<{ tab?: string }>;
}) {
	const { handle } = await params;
	const sp = await searchParams;
	const session = await authServer();
	const api = await serverApi();
	const res = await api.api.profiles({ handle }).get();
	const data = res.data as ProfileData | null;
	if (!data) notFound();
	const { profile, user, stats } = data;
	const isMe = session?.user.id === user.id;

	const favoritesRes = profile.favoriteMovieIds.length
		? await api.api.movies.batch
				.post({ ids: profile.favoriteMovieIds })
				.catch(() => ({ data: [] }))
		: { data: [] };
	const favorites =
		(favoritesRes.data as unknown as {
			tmdbId: number;
			title: string;
			posterPath: string | null;
		}[]) ?? [];

	const orderRaw = profile.sectionOrder?.length
		? profile.sectionOrder
		: [...SECTION_ORDER_KEYS];
	/** Legacy sections like `recent` are ignored now that filmography covers watch history. */
	const order = orderRaw.filter((s): s is (typeof SECTION_ORDER_KEYS)[number] =>
		(SECTION_ORDER_KEYS as readonly string[]).includes(s),
	);

	const accent = profile.accentColor ?? "#b75928";
	const filmographyRows = filmographyFromRecentlyWatched(data.recentlyWatched);

	const orderedRails = order.filter((sec) => {
		if (sec === "favorites") return favorites.length > 0;
		if (sec === "reviews") return data.recentReviews.length > 0;
		if (sec === "lists") return data.lists.length > 0;
		return false;
	});

	const availableTabs: ProfileTab[] = ["filmography", ...orderedRails];
	const activeTab = resolveProfileTab(sp.tab, availableTabs);

	return (
		<div className="-mx-4 sm:-mx-6 lg:-mx-8 xl:-mx-12 2xl:-mx-16">
			<header className="relative overflow-hidden border-border border-b">
				{profile.bannerUrl ? (
					<Letterbox aspect="21:9" bars className="w-full">
						<div className="absolute inset-0">
							<Image
								// Proxied through the API so private Blob stores work (raw `blob.url` is not public).
								src={profileBannerImageUrl(handle)}
								alt=""
								fill
								sizes="100vw"
								priority
								unoptimized
								className="object-cover opacity-50"
							/>
							<div
								className="absolute inset-0"
								style={{
									background: `linear-gradient(to bottom, color-mix(in oklab, ${accent} 15%, transparent), var(--background))`,
								}}
							/>
						</div>
					</Letterbox>
				) : (
					<div
						className="h-44 w-full sm:h-52"
						style={{
							background: `linear-gradient(to bottom, color-mix(in oklab, ${accent} 22%, transparent), var(--background))`,
						}}
					/>
				)}

				{/* Track B.5.7 — centered marquee header (avatar overlaps banner like Letterboxd-class profiles). */}
				<div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center px-4 pt-2 pb-6 text-center md:-mt-12 md:pb-10">
					<div className="-mt-14 mb-4 shrink-0 md:-mt-16">
						{user.image ? (
							<Image
								src={user.image}
								alt=""
								width={96}
								height={96}
								unoptimized
								className="size-24 rounded-full border-4 border-background object-cover shadow-lg ring-2 ring-border md:size-[5.5rem]"
							/>
						) : (
							<div
								className="grid size-24 place-items-center rounded-full border-4 border-background bg-muted font-display font-medium text-muted-foreground text-xl shadow-lg ring-2 ring-border md:size-[5.5rem] md:text-2xl"
								aria-hidden
							>
								{profileInitials(profile.displayName)}
							</div>
						)}
					</div>
					<p className="text-muted-foreground text-xs uppercase tracking-wider">
						@{profile.handle}
					</p>
					<h1 className="mt-1 font-display font-medium text-4xl tracking-[-0.02em] md:text-5xl">
						{profile.displayName}
					</h1>
					{profile.pronouns ? (
						<p className="mt-1 text-muted-foreground text-sm">
							{profile.pronouns}
						</p>
					) : null}
					{profile.bio ? (
						<p className="mt-4 max-w-xl font-editorial text-base text-foreground/85 leading-relaxed">
							{profile.bio}
						</p>
					) : null}

					<dl className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-muted-foreground text-sm">
						<div className="flex items-baseline gap-1.5">
							<dt className="sr-only">Followers</dt>
							<dd className="font-medium text-foreground text-lg tabular-nums">
								{stats.followers}
							</dd>
							<span>followers</span>
						</div>
						<div className="flex items-baseline gap-1.5">
							<dt className="sr-only">Following</dt>
							<dd className="font-medium text-foreground text-lg tabular-nums">
								{stats.following}
							</dd>
							<span>following</span>
						</div>
						{profile.location ? (
							<div className="w-full basis-full text-center text-xs sm:w-auto sm:basis-auto">
								{profile.location}
							</div>
						) : null}
						{profile.website ? (
							<div className="w-full basis-full sm:basis-auto">
								<a
									href={profile.website}
									target="_blank"
									rel="noopener noreferrer"
									className="text-foreground text-xs underline-offset-4 hover:underline"
								>
									{profile.website.replace(/^https?:\/\//, "")}
								</a>
							</div>
						) : null}
					</dl>

					<div className="mt-6 flex flex-wrap justify-center gap-2">
						{isMe ? (
							<>
								<Link href="/me/customization">
									<Button variant="ghost-light" size="pill">
										Customize
									</Button>
								</Link>
								<Link href="/me/settings">
									<Button variant="accent" size="pill">
										Edit profile
									</Button>
								</Link>
							</>
						) : (
							<FollowButton targetUserId={user.id} />
						)}
					</div>
				</div>

				{availableTabs.length > 1 ? (
					<nav
						className="border-border border-t bg-background/85 backdrop-blur-sm supports-[backdrop-filter]:bg-background/70"
						aria-label="Profile sections"
					>
						<div className="mx-auto max-w-4xl overflow-x-auto">
							<ul className="flex min-h-11 justify-center gap-0 px-2">
								{availableTabs.map((tab) => {
									const active = tab === activeTab;
									return (
										<li key={tab}>
											<Link
												href={profileTabHref(handle, tab)}
												aria-current={active ? "page" : undefined}
												className={cn(
													"inline-flex min-h-11 select-none items-center whitespace-nowrap border-b-2 px-4 font-medium text-sm transition-colors duration-[var(--aker-duration-fast)]",
													active
														? "border-desert-orange text-foreground"
														: "border-transparent text-muted-foreground hover:text-foreground",
												)}
											>
												{TAB_LABEL[tab]}
											</Link>
										</li>
									);
								})}
							</ul>
						</div>
					</nav>
				) : null}
			</header>

			<div className="mx-auto max-w-4xl space-y-12 px-3 py-10 sm:px-4 md:px-5">
				{activeTab === "filmography" ? (
					<section aria-labelledby="profile-filmography-heading">
						<h2
							id="profile-filmography-heading"
							className="font-display font-medium text-xl tracking-[-0.02em] md:text-2xl"
						>
							Filmography
						</h2>
						<p className="mt-1 text-muted-foreground text-sm">
							A rolling credit line distilled from screenings you’ve stepped out
							for.
						</p>
						{filmographyRows.length ? (
							<div className="mt-6 overflow-x-auto rounded-2xl border border-border/60 bg-card/40">
								<table className="w-full min-w-[min(100%,520px)] border-collapse text-left text-sm">
									<caption className="sr-only">Filmography credits</caption>
									<thead>
										<tr className="border-border/60 border-b text-[10px] text-muted-foreground uppercase tracking-[0.28em]">
											<th
												scope="col"
												className="px-4 py-3 font-display font-medium sm:px-5"
											>
												Year
											</th>
											<th
												scope="col"
												className="px-2 py-3 font-display font-medium sm:px-3"
											>
												Title
											</th>
											<th
												scope="col"
												className="hidden px-4 py-3 text-right font-display font-medium sm:table-cell sm:px-5"
											>
												Score
											</th>
										</tr>
									</thead>
									<tbody>
										{filmographyRows.map((row) => {
											const y = creditsYearISO(row.log.watchedAt);
											const titleCell = row.movie ? (
												<Link
													href={`/movies/${String(row.movie.tmdbId)}`}
													className="font-display text-foreground hover:text-desert-orange"
												>
													{row.movie.title}
												</Link>
											) : (
												<span className="text-muted-foreground">
													Unknown title
												</span>
											);
											return (
												<tr
													key={row.log.id}
													className="border-border/40 border-b last:border-b-0"
												>
													<td className="px-4 py-3 text-muted-foreground text-xs uppercase tabular-nums sm:px-5">
														{y}
													</td>
													<td className="px-2 py-3 leading-snug sm:px-3">
														{titleCell}
													</td>
													<td className="hidden px-4 py-3 text-right text-muted-foreground text-xs tabular-nums sm:table-cell sm:px-5">
														{creditsRatingLabel(row)}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						) : (
							<p className="mt-6 rounded-2xl border border-border border-dashed bg-card/30 p-8 text-center text-muted-foreground text-sm">
								Nothing on the ledger yet — log a film from{" "}
								<Link href="/search" className="text-foreground underline">
									search
								</Link>{" "}
								or your{" "}
								<Link href="/diary" className="text-foreground underline">
									diary
								</Link>
								.
							</p>
						)}
					</section>
				) : null}

				{activeTab === "favorites" && favorites.length ? (
					<section aria-labelledby="profile-favorites-heading">
						<h2
							id="profile-favorites-heading"
							className="font-display font-medium text-xl tracking-[-0.02em] md:text-2xl"
						>
							Favorites
						</h2>
						<div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
							{favorites.map((f) => (
								<MoviePoster
									key={f.tmdbId}
									movieId={f.tmdbId}
									title={f.title}
									posterUrl={
										f.posterPath
											? `https://image.tmdb.org/t/p/w342${f.posterPath}`
											: null
									}
								/>
							))}
						</div>
					</section>
				) : null}

				{activeTab === "reviews" && data.recentReviews.length ? (
					<section aria-labelledby="profile-reviews-heading">
						<h2
							id="profile-reviews-heading"
							className="font-display font-medium text-xl tracking-[-0.02em] md:text-2xl"
						>
							Reviews
						</h2>
						<ul className="mt-6 grid gap-4 md:grid-cols-2">
							{data.recentReviews.map((r) => (
								<li key={r.review.id}>
									<ReviewCard review={r.review} />
								</li>
							))}
						</ul>
					</section>
				) : null}

				{activeTab === "lists" && data.lists.length ? (
					<section aria-labelledby="profile-lists-heading">
						<h2
							id="profile-lists-heading"
							className="font-display font-medium text-xl tracking-[-0.02em] md:text-2xl"
						>
							Lists
						</h2>
						<ul className="mt-6 overflow-hidden rounded-2xl border border-border bg-card/50">
							{data.lists.map((l) => (
								<li key={l.id}>
									<ListRowStrip list={toListBoardRow(l)} />
								</li>
							))}
						</ul>
					</section>
				) : null}

				<CreditsFooter
					lines={[
						`Patron · @${profile.handle}`,
						`${stats.followers} followers · ${stats.following} following`,
						`${filmographyRows.length} titles on ledger`,
					]}
				/>
			</div>
		</div>
	);
}
