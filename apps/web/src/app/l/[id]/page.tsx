import { cn } from "@still/ui/lib/utils";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ListDetailCollaboratorsByline } from "@/components/list/list-detail-collaborators-byline";
import { ListDetailFilmsGrid } from "@/components/list/list-detail-films-grid";
import { ListDetailHeroMedia } from "@/components/list/list-detail-hero-media";
import { ListDetailLikeSection } from "@/components/list/list-detail-like-section";
import { ListDetailPublicSignInCta } from "@/components/list/list-detail-public-sign-in-cta";
import { ListDetailPublicTopBar } from "@/components/list/list-detail-public-top-bar";
import { MovieDetailBodySection } from "@/components/movie/movie-detail-body-section";
import { MovieDetailSectionNav } from "@/components/movie/movie-detail-section-nav";
import { authServer } from "@/lib/auth-server";
import {
	fetchListDetailById,
	listDetailToFilmRows,
} from "@/lib/fetch-list-detail";
import { formatDistanceToNowStrict } from "@/lib/format";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import { listHeroPosterUrls } from "@/lib/list-detail-hero-posters";
import {
	buildListDetailSectionNavItems,
	LIST_DETAIL_SECTION,
} from "@/lib/list-detail-sections";
import { listHasDiscoverabilityDescription } from "@/lib/list-quality";
import {
	MOVIE_DETAIL_SECTION_NAV_GUTTER_CLASS,
	MOVIE_DETAIL_SECTION_SCROLL_MARGIN_CLASS,
} from "@/lib/movie-detail-sections";

export const dynamic = "force-dynamic";

const publicListSharePath = (listId: string) => `/l/${listId}`;

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	const data = await fetchListDetailById(id);
	if (!data?.isPublic) {
		return { title: "List", robots: { index: false, follow: false } };
	}

	const title = data.title;
	const description = data.description?.trim();
	const indexable = listHasDiscoverabilityDescription(description);
	const canonical = publicListSharePath(id);

	return {
		title,
		description: description || undefined,
		alternates: { canonical },
		robots: indexable
			? { index: true, follow: true }
			: { index: false, follow: false },
		openGraph: {
			title,
			description: description?.slice(0, 200),
			url: canonical,
			type: "article",
		},
		twitter: {
			card: description ? "summary_large_image" : "summary",
			title,
			description: description?.slice(0, 200),
		},
	};
}

export default async function PublicListDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const session = await authServer();
	if (session) redirect(`/lists/${id}`);

	const data = await fetchListDetailById(id);
	if (!data?.isPublic) notFound();

	const filmRows = listDetailToFilmRows(data);
	const isSystemFavorites = data.systemKind === "favorites";
	const coverMovieId =
		typeof data.coverMovieId === "number" ? data.coverMovieId : null;
	const coverTvId = typeof data.coverTvId === "number" ? data.coverTvId : null;
	const coverImageUrl =
		typeof data.coverImageUrl === "string" ? data.coverImageUrl : null;
	const { posterUrl, backdropUrl } = listHeroPosterUrls(
		data.id,
		filmRows,
		coverMovieId,
		coverTvId,
		coverImageUrl,
		data.updatedAt,
	);

	const hasFilms = filmRows.length > 0;
	const sectionNavItems = buildListDetailSectionNavItems({ hasFilms });
	const showSectionNav = sectionNavItems.length >= 2;
	const sharePath = publicListSharePath(data.id);

	const heroMetaBits: string[] = [];
	if (isSystemFavorites) heroMetaBits.push("Synced from diary");
	if (data.isRanked) heroMetaBits.push("Ranked");
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
		? data.isRanked
			? "Ranked favorites from this patron's diary — #1 is their top pick."
			: "Every title favorited from this patron's diary."
		: data.isRanked
			? "Position order — lowest number is the top pick."
			: "Every title in this collection.";

	return (
		<div className="flex min-h-[100dvh] flex-col bg-background">
			<ListDetailPublicTopBar title={data.title} sharePath={sharePath} />
			{showSectionNav ? (
				<MovieDetailSectionNav sections={sectionNavItems} />
			) : null}

			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"flex-1 overflow-x-clip overflow-y-visible",
				)}
			>
				<article
					className={cn(
						"flex flex-1 flex-col",
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
						<h1 className="mt-7 text-balance font-sans font-semibold text-3xl leading-[1.05] tracking-[-0.02em] sm:text-4xl">
							{data.title}
						</h1>
						{heroBlurb ? (
							<p className="mt-4 w-full max-w-2xl text-balance font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base">
								{heroBlurb}
							</p>
						) : null}
						<ListDetailCollaboratorsByline
							owner={data.owner ?? null}
							collaborators={data.collaborators ?? []}
						/>
						<ListDetailLikeSection
							listId={data.id}
							likesCount={Number(data.likesCount ?? 0)}
							initialLiked={false}
							canInteract={false}
							showSignInHint
						/>
						<ListDetailPublicSignInCta listId={data.id} className="mt-8" />
					</div>

					<div className="mx-auto max-w-7xl space-y-12 px-2.5 pt-8 pb-16 sm:px-4 sm:pt-10 md:px-5 md:pt-12">
						<MovieDetailBodySection
							id={LIST_DETAIL_SECTION.films}
							title={filmsSectionTitle}
							subtitle={filmsSectionSubtitle}
							className="pt-2 pb-2"
						>
							<ListDetailFilmsGrid
								items={filmRows}
								isRanked={data.isRanked}
								listId={data.id}
								canEditNotes={false}
								systemKind={data.systemKind ?? null}
								viewerCanEdit={false}
							/>
						</MovieDetailBodySection>
						<ListDetailPublicSignInCta listId={data.id} />
					</div>
				</article>
			</section>
		</div>
	);
}
