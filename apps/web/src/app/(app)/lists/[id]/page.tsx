import { cn } from "@still/ui/lib/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListDetailCoverPicker } from "@/components/list/list-detail-cover-picker";
import {
	type ListDetailFilmRow,
	ListDetailFilmsGrid,
} from "@/components/list/list-detail-films-grid";
import { ListDetailHeroMedia } from "@/components/list/list-detail-hero-media";
import { ListDetailTopBar } from "@/components/list/list-detail-top-bar";
import { MovieDetailBodySection } from "@/components/movie/movie-detail-body-section";
import { MovieDetailSectionNav } from "@/components/movie/movie-detail-section-nav";
import { authServer } from "@/lib/auth-server";
import { formatDistanceToNowStrict } from "@/lib/format";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import { resolveListCoverImageSrc } from "@/lib/list-cover-image";
import {
	buildListDetailSectionNavItems,
	LIST_DETAIL_SECTION,
} from "@/lib/list-detail-sections";
import {
	MOVIE_DETAIL_SECTION_NAV_GUTTER_CLASS,
	MOVIE_DETAIL_SECTION_SCROLL_MARGIN_CLASS,
} from "@/lib/movie-detail-sections";
import { profilePosterUrlFromPath } from "@/lib/profile-filmography-map";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

type ListDetail = {
	id: string;
	userId: string;
	title: string;
	description: string | null;
	systemKind?: string | null;
	itemsCount: number;
	coverMovieIds: number[];
	coverMovieId: number | null;
	coverImageUrl: string | null;
	isPublic: boolean;
	isRanked: boolean;
	updatedAt: string;
	items: {
		item: {
			id: string;
			position: number;
			note: string | null;
			movieId: number | null;
			tvId?: number | null;
		};
		movie: { tmdbId: number; title: string; posterPath: string | null } | null;
		tv?: { tmdbId: number; title: string; posterPath: string | null } | null;
	}[];
};

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	const api = await serverApi();
	const res = await api.api
		.lists({ id })
		.get()
		.catch(() => ({ data: null }));
	const data = res.data as { title?: string } | null;
	return { title: data?.title ?? "List" };
}

function listHeroPosterUrls(
	listId: string,
	rows: ListDetailFilmRow[],
	coverMovieId: number | null,
	coverImageUrl: string | null,
	updatedAt: string,
): {
	posterUrl: string | null;
	backdropUrl: string | null;
} {
	const customCover = resolveListCoverImageSrc(
		listId,
		coverImageUrl,
		updatedAt,
	);
	if (customCover) {
		const urls: string[] = [customCover];
		for (const row of rows) {
			const posterPath = row.movie?.posterPath ?? row.tv?.posterPath ?? null;
			const src = profilePosterUrlFromPath(posterPath);
			if (src && !urls.includes(src)) urls.push(src);
			if (urls.length >= 2) break;
		}
		return {
			posterUrl: customCover,
			backdropUrl: urls[1] ?? null,
		};
	}

	const ordered =
		coverMovieId != null
			? [
					...rows.filter((r) => r.movie?.tmdbId === coverMovieId),
					...rows.filter((r) => r.movie?.tmdbId !== coverMovieId),
				]
			: rows;

	const urls: string[] = [];
	for (const row of ordered) {
		const posterPath = row.movie?.posterPath ?? row.tv?.posterPath ?? null;
		const src = profilePosterUrlFromPath(posterPath);
		if (src && !urls.includes(src)) urls.push(src);
		if (urls.length >= 2) break;
	}
	return {
		posterUrl: urls[0] ?? null,
		backdropUrl: urls[1] ?? null,
	};
}

export default async function ListDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const [session, api] = await Promise.all([authServer(), serverApi()]);
	const listRes = await api.api.lists({ id }).get();
	const data = listRes.data as ListDetail | null;
	if (!data) notFound();

	const filmRows: ListDetailFilmRow[] = [];
	for (const row of data.items) {
		if (row.movie) {
			filmRows.push({ item: row.item, movie: row.movie, tv: null });
		} else if (row.tv) {
			filmRows.push({ item: row.item, movie: null, tv: row.tv });
		}
	}
	const isSystemFavorites = data.systemKind === "favorites";

	const coverMovieId =
		typeof data.coverMovieId === "number" ? data.coverMovieId : null;
	const coverImageUrl =
		typeof data.coverImageUrl === "string" ? data.coverImageUrl : null;
	const { posterUrl, backdropUrl } = listHeroPosterUrls(
		data.id,
		filmRows,
		coverMovieId,
		coverImageUrl,
		data.updatedAt,
	);
	const isOwner = session?.user?.id === data.userId;
	const hasFilms = filmRows.length > 0;
	const sectionNavItems = buildListDetailSectionNavItems({ hasFilms });
	const showSectionNav = sectionNavItems.length >= 2;

	const heroMetaBits: string[] = [];
	if (isSystemFavorites) heroMetaBits.push("Synced from diary");
	if (data.isRanked) heroMetaBits.push("Ranked");
	if (!data.isPublic) heroMetaBits.push("Private");
	heroMetaBits.push(
		`${data.itemsCount} ${data.itemsCount === 1 ? "title" : "titles"}`,
	);
	heroMetaBits.push(
		`Updated ${formatDistanceToNowStrict(new Date(data.updatedAt))} ago`,
	);
	const heroMetaLine = heroMetaBits.join("\u00a0\u00a0");

	const heroBlurb = data.description?.trim() ?? null;

	const filmsSectionTitle = data.isRanked ? "Ranked" : "Titles";
	const filmsSectionSubtitle = isSystemFavorites
		? "Every title you have favorited from your diary — most recent first."
		: data.isRanked
			? "Position order as you arranged this list — lowest number is the top pick."
			: "Every title in this collection — open a poster to visit its page.";

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-visible bg-background">
			<ListDetailTopBar title={data.title} sharePath={`/lists/${data.id}`} />
			{showSectionNav ? (
				<MovieDetailSectionNav sections={sectionNavItems} />
			) : null}

			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"min-h-0 flex-1 overflow-visible",
				)}
			>
				<article
					className={cn(
						"flex min-h-0 flex-1 flex-col",
						showSectionNav && MOVIE_DETAIL_SECTION_NAV_GUTTER_CLASS,
					)}
				>
					<div
						id={LIST_DETAIL_SECTION.about}
						className={cn(
							MOVIE_DETAIL_SECTION_SCROLL_MARGIN_CLASS,
							"mx-auto flex w-full max-w-lg flex-col items-center px-2.5 pt-12 pb-6 text-center sm:max-w-xl sm:px-3 sm:pt-14 sm:pb-8 md:pt-16 md:pb-10 lg:max-w-2xl lg:pt-20",
						)}
					>
						{heroMetaLine ? (
							<p className="mb-5 text-muted-foreground text-xs tracking-wide">
								{heroMetaLine}
							</p>
						) : null}
						<ListDetailHeroMedia
							title={data.title}
							posterUrl={posterUrl}
							backdropUrl={backdropUrl}
						/>
						{isOwner && !isSystemFavorites ? (
							<ListDetailCoverPicker
								listId={data.id}
								films={filmRows}
								coverMovieId={coverMovieId}
								coverImageUrl={coverImageUrl}
								updatedAt={data.updatedAt}
							/>
						) : null}
						<h1 className="mt-7 text-balance font-sans font-semibold text-3xl leading-[1.05] tracking-[-0.02em] sm:text-4xl">
							{data.title}
						</h1>
						{heroBlurb ? (
							<p className="mt-4 w-full max-w-2xl text-balance font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base">
								{heroBlurb}
							</p>
						) : null}
					</div>

					<div className="mx-auto max-w-7xl space-y-12 px-2.5 pt-8 pb-10 sm:px-4 sm:pt-10 md:px-5 md:pt-12">
						<MovieDetailBodySection
							id={LIST_DETAIL_SECTION.films}
							title={filmsSectionTitle}
							subtitle={filmsSectionSubtitle}
							className="pt-2 pb-2"
						>
							<ListDetailFilmsGrid items={filmRows} isRanked={data.isRanked} />
						</MovieDetailBodySection>
					</div>
				</article>
			</section>
		</div>
	);
}
