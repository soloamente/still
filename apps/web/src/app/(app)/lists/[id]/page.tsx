import { cn } from "@still/ui/lib/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListDetailCollaboratorsByline } from "@/components/list/list-detail-collaborators-byline";
import {
	type ListDetailFilmRow,
	ListDetailFilmsGrid,
} from "@/components/list/list-detail-films-grid";
import { ListDetailHeroMedia } from "@/components/list/list-detail-hero-media";
import { ListDetailLikeSection } from "@/components/list/list-detail-like-section";
import { ListDetailOwnerControls } from "@/components/list/list-detail-owner-controls";
import {
	canReorderRankedList,
	toRankedReorderRows,
} from "@/components/list/list-detail-page-branching";
import { ListDetailTopBar } from "@/components/list/list-detail-top-bar";
import { RankedListReorderGrid } from "@/components/list/ranked-list-reorder-grid";
import { MovieDetailBodySection } from "@/components/movie/movie-detail-body-section";
import { MovieDetailSectionNav } from "@/components/movie/movie-detail-section-nav";
import { authServer } from "@/lib/auth-server";
import {
	fetchListDetailById,
	type ListDetailRecord,
	listDetailToFilmRows,
} from "@/lib/fetch-list-detail";
import { formatDistanceToNowStrict } from "@/lib/format";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import { listHeroPosterUrls } from "@/lib/list-detail-hero-posters";
import {
	buildListDetailSectionNavItems,
	LIST_DETAIL_SECTION,
} from "@/lib/list-detail-sections";
import {
	MOVIE_DETAIL_SECTION_NAV_GUTTER_CLASS,
	MOVIE_DETAIL_SECTION_SCROLL_MARGIN_CLASS,
} from "@/lib/movie-detail-sections";
import {
	OG_DEFAULT_PATH,
	ogImageMetadataFields,
	ogListPath,
} from "@/lib/og/og-image-metadata";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

/** SEO canonical for public lists — guests and crawlers use `/l/[id]`. */
function listSharePath(list: ListDetailRecord): string {
	return list.isPublic ? `/l/${list.id}` : `/lists/${list.id}`;
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	const data = await fetchListDetailById(id);
	const title = data?.title ?? "List";
	const description = data?.description?.trim();
	const imageFields = ogImageMetadataFields(
		data?.isPublic ? ogListPath(id) : OG_DEFAULT_PATH,
		title,
	);

	return {
		title,
		description: description || undefined,
		openGraph: {
			...(description
				? { title, description: description.slice(0, 200) }
				: { title }),
			...imageFields.openGraph,
		},
		twitter: imageFields.twitter,
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
	const data = listRes.data as ListDetailRecord | null;
	if (!data) notFound();

	const filmRows: ListDetailFilmRow[] = listDetailToFilmRows(data);
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
	const isOwner = session?.user?.id === data.userId;
	const viewerCanEdit = Boolean(
		data.viewerCanEdit ?? (isOwner && !isSystemFavorites),
	);
	// System favorites: diary-synced membership, but owners may drag-rank when `isRanked`.
	const viewerCanReorder =
		isSystemFavorites && isOwner ? Boolean(data.isRanked) : viewerCanEdit;
	const canReorder = canReorderRankedList({
		isRanked: data.isRanked,
		viewerId: session?.user?.id,
		viewerCanEdit: viewerCanReorder,
	});
	const collaborators = data.collaborators ?? [];
	const ownerProfile = data.owner ?? null;
	const canEditListNotes =
		viewerCanEdit && !isSystemFavorites && Boolean(session?.user);
	const rankedRows = canReorder ? toRankedReorderRows(filmRows) : null;
	const hasFilms = filmRows.length > 0;
	const sectionNavItems = buildListDetailSectionNavItems({ hasFilms });
	const showSectionNav = sectionNavItems.length >= 2;

	const heroMetaBits: string[] = [];
	if (!isOwner && viewerCanEdit) heroMetaBits.push("Shared with you");
	if (isSystemFavorites) heroMetaBits.push("Synced from diary");
	if (data.isRanked) heroMetaBits.push("Ranked");
	if (!data.isPublic && isOwner) heroMetaBits.push("Private");
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
			? "Titles synced from your diary favorites — drag to set your order (#1 is the top pick)."
			: "Every title you have favorited from your diary."
		: data.isRanked
			? "Position order as you arranged this list — lowest number is the top pick."
			: "Every title in this collection — open a poster to visit its page.";
	const filmsSectionSubtitleOwner =
		isOwner && !isSystemFavorites
			? `${filmsSectionSubtitle} Add a short note on each title to share why it belongs here.`
			: filmsSectionSubtitle;

	return (
		<div className="flex flex-1 flex-col overflow-visible bg-background">
			<ListDetailTopBar title={data.title} sharePath={listSharePath(data)} />
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
							owner={ownerProfile}
							collaborators={collaborators}
						/>
						{data.isPublic ? (
							<ListDetailLikeSection
								listId={data.id}
								likesCount={Number(data.likesCount ?? 0)}
								initialLiked={Boolean(data.liked)}
								canInteract={Boolean(session?.user) && !isOwner}
								showSignInHint={!session?.user}
							/>
						) : null}
						{isOwner ? (
							<div className="mt-8 flex w-full justify-center">
								<ListDetailOwnerControls
									listId={data.id}
									films={filmRows}
									coverMovieId={coverMovieId}
									coverTvId={coverTvId}
									coverImageUrl={coverImageUrl}
									updatedAt={data.updatedAt}
									initialTitle={data.title}
									initialDescription={data.description}
									allowEditDetails={!isSystemFavorites}
									isPublic={data.isPublic}
									showDiscoverabilityNudge={!heroBlurb}
									collaborators={collaborators}
								/>
							</div>
						) : null}
					</div>

					<div className="mx-auto max-w-7xl space-y-12 px-2.5 pt-8 pb-10 sm:px-4 sm:pt-10 md:px-5 md:pt-12">
						<MovieDetailBodySection
							id={LIST_DETAIL_SECTION.films}
							title={filmsSectionTitle}
							subtitle={
								isOwner && !isSystemFavorites
									? filmsSectionSubtitleOwner
									: filmsSectionSubtitle
							}
							className="pt-2 pb-2"
						>
							{canReorder && rankedRows ? (
								<RankedListReorderGrid
									listId={data.id}
									items={rankedRows}
									allItemIds={data.items.map((entry) => entry.item.id)}
									canEditNotes={canEditListNotes}
									systemKind={data.systemKind ?? null}
									viewerCanEdit={viewerCanEdit}
								/>
							) : (
								<ListDetailFilmsGrid
									items={filmRows}
									isRanked={data.isRanked}
									listId={data.id}
									canEditNotes={canEditListNotes}
									systemKind={data.systemKind ?? null}
									viewerCanEdit={viewerCanEdit}
								/>
							)}
						</MovieDetailBodySection>
					</div>
				</article>
			</section>
		</div>
	);
}
