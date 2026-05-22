"use client";

import IconListPlay from "@still/ui/icons/list-play";
import { cn } from "@still/ui/lib/utils";
import { Check, LayoutGrid, Loader2, Plus } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";

import { SearchPillField } from "@/components/ui/search-pill-field";
import type { ListBoardRow } from "@/lib/list-board-row";
import { resolveListCoverImageSrc } from "@/lib/list-cover-image";

/** Resolve a TMDb still URL from a DB path fragment (same as `ListRowStrip`). */
function tmdbPosterSrc(path: string | null): string | null {
	if (!path?.length) return null;
	if (path.startsWith("http")) return path;
	const fragment = path.startsWith("/") ? path : `/${path}`;
	return `https://image.tmdb.org/t/p/w185${fragment}`;
}

function listVisibilityLabel(list: ListBoardRow): string {
	return list.isPublic ? "Public" : "Private";
}

function listMetaLine(list: ListBoardRow): string {
	const count = list.itemsCount;
	const films = count === 1 ? "film" : "films";
	return `${count} ${films} · ${listVisibilityLabel(list)}`;
}

/** First cover still for the row thumbnail — falls back to a neutral tile. */
function ListPickerThumb({ list }: { list: ListBoardRow }) {
	const paths = list.coverPosterPaths ?? list.coverMovieIds.map(() => null);
	const src =
		resolveListCoverImageSrc(list.id, list.coverImageUrl, list.updatedAt) ??
		tmdbPosterSrc(paths[0] ?? null);

	return (
		<div className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-muted/35 shadow-sm">
			{src ? (
				<Image
					src={src}
					alt=""
					fill
					sizes="44px"
					className="object-cover"
					unoptimized
				/>
			) : (
				<div className="grid size-full place-items-center text-muted-foreground">
					<IconListPlay size="18px" aria-hidden />
				</div>
			)}
		</div>
	);
}

/** Trailing slot — white check when this film is already on the list (aligned with “New list” +). */
function ListPickerSelectionMark({
	busy,
	containsMovie,
	listTitle,
}: {
	busy: boolean;
	containsMovie: boolean;
	listTitle: string;
}) {
	return (
		<span
			className="inline-flex size-9 shrink-0 items-center justify-center text-muted-foreground"
			aria-hidden={!containsMovie && !busy}
		>
			{busy ? (
				<Loader2 className="size-5 animate-spin" aria-hidden />
			) : containsMovie ? (
				<span className="inline-flex size-5 items-center justify-center rounded-full bg-foreground text-background">
					<span className="sr-only">Already in {listTitle}</span>
					<Check className="size-3 stroke-[2.5]" aria-hidden />
				</span>
			) : null}
		</span>
	);
}

type AddToListPickerProps = {
	lists: ListBoardRow[];
	movieTitle: string;
	addingListId: string | null;
	onSelectList: (list: ListBoardRow) => void;
	onCreateNew: () => void;
};

/**
 * Mobbin-style list picker body — search, “New list” affordance, and rich rows with
 * cover thumbs + metadata. Rendered inside the hero add-to-list dropdown sheet.
 */
export function AddToListPicker({
	lists,
	movieTitle,
	addingListId,
	onSelectList,
	onCreateNew,
}: AddToListPickerProps) {
	const [query, setQuery] = useState("");

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return lists;
		return lists.filter((list) => list.title.toLowerCase().includes(q));
	}, [lists, query]);

	return (
		<div className="flex max-h-[min(70vh,28rem)] flex-col gap-3">
			{/* Film context — what patron is filing into a list */}
			<div className="flex items-center gap-3 px-0.5 pt-0.5">
				<div className="grid size-11 shrink-0 place-items-center rounded-xl bg-card shadow-sm">
					<IconListPlay size="20px" className="opacity-85" aria-hidden />
				</div>
				<div className="min-w-0 flex-1">
					<p className="truncate font-semibold text-base text-foreground leading-snug">
						Add to list
					</p>
					<p className="line-clamp-2 text-balance text-muted-foreground text-sm leading-snug">
						{movieTitle}
					</p>
				</div>
			</div>

			<fieldset
				className="min-w-0 border-0 p-0"
				onPointerDown={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<legend className="sr-only">Search lists</legend>
				<SearchPillField
					type="text"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search lists…"
					autoComplete="off"
					autoFocus
					spellCheck={false}
					aria-label="Search your lists"
					showClearQuery={Boolean(query.trim())}
					onClearQuery={() => setQuery("")}
					containerClassName="min-h-11 w-full border-0 bg-card px-3 shadow-none focus-within:border-0 focus-within:shadow-none focus-within:ring-0 focus-within:outline-none"
					className="min-h-10 text-sm"
				/>
			</fieldset>

			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				<p className="px-0.5 pb-2 font-medium text-muted-foreground text-xs tracking-wide">
					Lists
				</p>

				<ul className="space-y-1">
					<li>
						<button
							type="button"
							className={cn(
								"flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors duration-200 ease-out motion-reduce:transition-none",
								"[@media(hover:hover)]:hover:bg-card",
								"focus-visible:bg-card focus-visible:outline-none",
							)}
							onClick={onCreateNew}
						>
							<div className="grid size-11 shrink-0 place-items-center rounded-xl bg-card shadow-sm">
								<LayoutGrid className="size-5 text-foreground/85" aria-hidden />
							</div>
							<div className="min-w-0 flex-1">
								<p className="truncate font-semibold text-base text-foreground leading-snug">
									New list
								</p>
								<p className="truncate text-muted-foreground text-sm leading-snug">
									Your space to organize films
								</p>
							</div>
							<span className="inline-flex size-9 shrink-0 items-center justify-center text-muted-foreground">
								<Plus className="size-5" aria-hidden />
							</span>
						</button>
					</li>

					{filtered.length === 0 ? (
						<li className="px-2 py-6 text-center text-muted-foreground text-sm">
							{query.trim()
								? "No lists match your search."
								: "You have no lists yet."}
						</li>
					) : (
						filtered.map((list) => {
							const busy = addingListId === list.id;
							return (
								<li key={list.id}>
									<button
										type="button"
										disabled={Boolean(addingListId)}
										className={cn(
											"flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors duration-200 ease-out motion-reduce:transition-none",
											"[@media(hover:hover)]:hover:bg-card",
											"focus-visible:bg-card focus-visible:outline-none",
											"disabled:pointer-events-none disabled:opacity-50",
										)}
										onClick={() => onSelectList(list)}
									>
										<ListPickerThumb list={list} />
										<div className="min-w-0 flex-1">
											<p className="truncate font-semibold text-base text-foreground leading-snug">
												{list.title}
											</p>
											<p className="truncate text-muted-foreground text-sm tabular-nums leading-snug">
												{listMetaLine(list)}
											</p>
										</div>
										<ListPickerSelectionMark
											busy={busy}
											containsMovie={Boolean(list.containsMovie)}
											listTitle={list.title}
										/>
									</button>
								</li>
							);
						})
					)}
				</ul>
			</div>
		</div>
	);
}
