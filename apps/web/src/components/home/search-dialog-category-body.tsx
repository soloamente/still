"use client";

import { cn } from "@still/ui/lib/utils";
import { SearchDialogCastCrewResults } from "@/components/home/search-dialog-cast-crew-results";
import { SearchDialogListResults } from "@/components/home/search-dialog-list-results";
import { SearchDialogPeopleResults } from "@/components/home/search-dialog-people-results";
import { SearchDialogPosterSkeletonGrid } from "@/components/home/search-dialog-result-skeletons";
import { MoviePoster } from "@/components/movie/movie-poster";
import type { SearchCategory } from "@/lib/search-active-category";
import type { useSearchCategoryResults } from "@/lib/use-search-category-results";

type CategorySearch = ReturnType<typeof useSearchCategoryResults>;

/** Poster grid shared by the Films and TV categories. */
function CatalogGrid({
	hits,
	listingKind,
	loading,
	onPick,
}: {
	hits: CategorySearch["films"]["results"];
	listingKind: "movie" | "tv";
	loading: boolean;
	onPick: (id: number, kind: "movie" | "tv") => void;
}) {
	if (loading && hits.length === 0) return <SearchDialogPosterSkeletonGrid />;
	if (hits.length === 0) return null;
	return (
		<div
			className={cn(
				"mt-2 grid auto-rows-min grid-cols-3 gap-3 pb-1 sm:grid-cols-4",
				loading && "opacity-55",
			)}
		>
			{hits.map((hit) => (
				<button
					key={`${listingKind}-${hit.id}`}
					type="button"
					className="min-w-0 cursor-pointer rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
					onClick={() => onPick(hit.id, listingKind)}
				>
					<MoviePoster
						movieId={hit.id}
						title={hit.title}
						posterUrl={hit.poster_url}
						size="md"
						showTitle
						titleLines={1}
						linkable={false}
						listingKind={listingKind}
						frameClassName="rounded-2xl"
					/>
				</button>
			))}
		</div>
	);
}

/** Renders the active search category's results inside the dialog body. */
export function SearchDialogCategoryBody({
	active,
	search,
	query,
	onPickCatalog,
	onSelectPerson,
	onSelectProfile,
	onPickList,
}: {
	active: SearchCategory;
	search: CategorySearch;
	query: string;
	onPickCatalog: (id: number, kind: "movie" | "tv") => void;
	onSelectPerson: (id: number) => void;
	onSelectProfile: (handle: string) => void;
	onPickList: () => void;
}) {
	const trimmed = query.trim();
	const emptyHint = (label: string) =>
		trimmed ? `No ${label} for "${trimmed}".` : `No ${label} found.`;

	if (active === "films") {
		const hasRows = search.films.results.length > 0 || search.films.loading;
		return (
			<div className="flex flex-col px-4 pb-4">
				<CatalogGrid
					hits={search.films.results}
					listingKind="movie"
					loading={search.films.loading}
					onPick={onPickCatalog}
				/>
				{!hasRows ? (
					<p className="text-muted-foreground text-xs leading-relaxed">
						{search.setupHint ?? emptyHint("films")}
					</p>
				) : null}
			</div>
		);
	}

	if (active === "tv") {
		const hasRows = search.tv.results.length > 0 || search.tv.loading;
		return (
			<div className="flex flex-col px-4 pb-4">
				<CatalogGrid
					hits={search.tv.results}
					listingKind="tv"
					loading={search.tv.loading}
					onPick={onPickCatalog}
				/>
				{!hasRows ? (
					<p className="text-muted-foreground text-xs leading-relaxed">
						{search.setupHint ?? emptyHint("TV shows")}
					</p>
				) : null}
			</div>
		);
	}

	if (active === "castcrew") {
		return (
			<SearchDialogCastCrewResults
				results={search.castcrew.results}
				loading={search.castcrew.loading}
				onSelect={onSelectPerson}
			/>
		);
	}

	if (active === "lists") {
		if (search.lists.needsSignIn) {
			return (
				<p className="px-4 pb-4 text-muted-foreground text-xs leading-relaxed">
					Sign in to search your lists.
				</p>
			);
		}
		if (search.lists.results.length === 0 && !search.lists.loading) {
			return (
				<p className="px-4 pb-4 text-muted-foreground text-xs leading-relaxed">
					{emptyHint("lists")}
				</p>
			);
		}
		return (
			<div className={cn("px-4 pb-2", search.lists.loading && "opacity-55")}>
				<SearchDialogListResults
					lists={search.lists.results}
					onPick={onPickList}
				/>
			</div>
		);
	}

	// members
	return (
		<SearchDialogPeopleResults
			hits={search.members.hits}
			loading={search.members.loading}
			onSelect={onSelectProfile}
		/>
	);
}
