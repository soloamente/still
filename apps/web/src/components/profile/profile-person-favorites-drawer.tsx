"use client";

import { cn } from "@still/ui/lib/utils";
import { Bell } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { create } from "zustand";

import { DetailDrawerScrollBody } from "@/components/movie/detail-drawer-scroll-body";
import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import { PersonCreditPortrait } from "@/components/movie/person-credit-portrait";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import {
	fetchProfilePersonFavorites,
	setPersonFavorite,
} from "@/lib/still-api-fetch";
import { isTmdbCdnUrl } from "@/lib/tmdb-poster-url";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

type PersonFavoriteRow = {
	tmdbPersonId: number;
	name: string;
	profileUrl: string | null;
	knownForDepartment: string | null;
	alertsEnabled: boolean;
	createdAt: string;
};

type Store = {
	isOpen: boolean;
	handle: string | null;
	isOwner: boolean;
	open: (args: { handle: string; isOwner: boolean }) => void;
	close: () => void;
};

const useProfilePersonFavorites = create<Store>((set) => ({
	isOpen: false,
	handle: null,
	isOwner: false,
	open: ({ handle, isOwner }) => set({ isOpen: true, handle, isOwner }),
	close: () => set({ isOpen: false, handle: null, isOwner: false }),
}));

/** Open Favorites drawer from the profile hero count pill. */
export function openProfilePersonFavorites(args: {
	handle: string;
	isOwner: boolean;
}) {
	useProfilePersonFavorites.getState().open(args);
}

const SKELETON_IDS = [
	"person-fav-skel-a",
	"person-fav-skel-b",
	"person-fav-skel-c",
	"person-fav-skel-d",
	"person-fav-skel-e",
	"person-fav-skel-f",
] as const;

/** Mounted once per profile page; sheet driven by Zustand store. */
export function ProfilePersonFavoritesDrawerRoot() {
	const { isOpen, handle, isOwner, close } = useProfilePersonFavorites();
	return (
		<DetailVaulSheet
			open={isOpen}
			onOpenChange={(next) => {
				if (!next) close();
			}}
			title="Favorites"
			description="Favorite cast and crew"
		>
			{handle ? (
				<ProfilePersonFavoritesPanel
					handle={handle}
					isOwner={isOwner}
					active={isOpen}
				/>
			) : null}
		</DetailVaulSheet>
	);
}

function ProfilePersonFavoritesPanel({
	handle,
	isOwner,
	active,
}: {
	handle: string;
	isOwner: boolean;
	active: boolean;
}) {
	const [rows, setRows] = useState<PersonFavoriteRow[] | null>(null);
	const [nextBefore, setNextBefore] = useState<string | null>(null);
	const [loadingMore, setLoadingMore] = useState(false);
	const [panelOpen, setPanelOpen] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		active,
	);

	const loadFirst = useCallback(async () => {
		const result = await fetchProfilePersonFavorites(handle);
		if (!result.ok) {
			setRows([]);
			setNextBefore(null);
			return;
		}
		setRows(result.results);
		setNextBefore(result.nextBefore);
	}, [handle]);

	useEffect(() => {
		setRows(null);
		setNextBefore(null);
		setPanelOpen(false);
	}, [handle]);

	useEffect(() => {
		if (!active) {
			setPanelOpen(false);
			return;
		}
		let cancelled = false;
		void (async () => {
			await loadFirst();
			if (cancelled) return;
		})();
		return () => {
			cancelled = true;
		};
	}, [active, loadFirst]);

	// transitions.dev panel reveal — open only after the first page is ready.
	useLayoutEffect(() => {
		if (rows == null) {
			setPanelOpen(false);
			return;
		}
		setPanelOpen(false);
		const frame = window.requestAnimationFrame(() => {
			setPanelOpen(true);
		});
		return () => window.cancelAnimationFrame(frame);
	}, [rows]);

	async function loadMore() {
		if (!nextBefore || loadingMore) return;
		setLoadingMore(true);
		const result = await fetchProfilePersonFavorites(handle, {
			before: nextBefore,
		});
		setLoadingMore(false);
		if (!result.ok) return;
		setRows((prev) => [...(prev ?? []), ...result.results]);
		setNextBefore(result.nextBefore);
	}

	async function handleUnfavorite(personId: number) {
		const prev = rows;
		setRows((list) =>
			list ? list.filter((row) => row.tmdbPersonId !== personId) : list,
		);
		const result = await setPersonFavorite(personId, false);
		if (!result.ok) {
			setRows(prev);
			toast.error("Couldn’t remove favorite");
		}
	}

	const count = rows?.length ?? null;

	return (
		<div className="relative isolate flex min-h-0 w-full flex-1 flex-col">
			<header className="shrink-0 px-4 pt-1 pb-3 text-center">
				<p className="font-semibold text-foreground text-lg tracking-tight">
					Favorites
				</p>
				<p className="mt-0.5 text-muted-foreground text-sm">
					{count == null
						? "Cast and crew"
						: count === 0
							? "No one yet"
							: count === 1
								? "1 person"
								: `${count} people`}
				</p>
			</header>

			<DetailDrawerScrollBody scrollRef={scrollRef}>
				<div className="px-3 pb-8 sm:px-4">
					{rows == null ? (
						<ul
							aria-busy="true"
							aria-label="Loading favorites"
							className="flex flex-wrap justify-center gap-x-5 gap-y-7 sm:gap-x-6 sm:gap-y-8"
						>
							{SKELETON_IDS.map((id) => (
								<li
									key={id}
									className="flex w-22 flex-col items-center gap-2 sm:w-24"
								>
									<span className="size-18 shrink-0 animate-pulse rounded-full bg-muted/40 sm:size-20" />
									<span className="h-3 w-16 animate-pulse rounded bg-muted/40" />
									<span className="h-2.5 w-12 animate-pulse rounded bg-muted/30" />
								</li>
							))}
						</ul>
					) : (
						<div
							className="t-panel-slide"
							data-open={panelOpen ? "true" : "false"}
						>
							{rows.length === 0 ? (
								<div className="flex min-h-48 flex-col items-center justify-center px-4 text-center">
									<p className="font-medium text-foreground text-sm">
										No favorites yet
									</p>
									<p className="mt-1 max-w-xs text-pretty text-muted-foreground text-sm">
										{isOwner
											? "Favorite cast and crew from their pages to pin them here."
											: "This patron has not favorited anyone yet."}
									</p>
								</div>
							) : (
								<ul
									className={cn(
										// Flex wrap centers 1–3 (and short last rows) instead of left-packing a grid.
										"flex flex-wrap justify-center gap-x-6 gap-y-8 sm:gap-x-8 sm:gap-y-10",
										rows.length <= 3 && "gap-x-8 gap-y-10 sm:gap-x-10",
									)}
								>
									{rows.map((row) => (
										<li
											key={row.tmdbPersonId}
											className={cn(
												"min-w-0",
												// Wider tiles when few; denser when the shelf fills.
												rows.length <= 3 ? "w-26 sm:w-28" : "w-22 sm:w-24",
											)}
										>
											<div className="flex flex-col items-center gap-2 text-center">
												<div className="relative">
													<Link
														href={`/people/${row.tmdbPersonId}`}
														className={cn(
															"group relative block overflow-hidden rounded-full bg-muted/30 outline-none",
															rows.length <= 3
																? "size-20 sm:size-24"
																: "size-18 sm:size-20",
															"ring-offset-2 ring-offset-card transition-transform duration-200 ease-out",
															"focus-visible:ring-2 focus-visible:ring-ring",
															"[@media(hover:hover)]:hover:scale-[1.04]",
														)}
														onClick={() =>
															useProfilePersonFavorites.getState().close()
														}
													>
														{row.profileUrl ? (
															<Image
																src={row.profileUrl}
																alt=""
																fill
																className="object-cover"
																sizes="96px"
																unoptimized={isTmdbCdnUrl(row.profileUrl)}
															/>
														) : (
															<PersonCreditPortrait
																name={row.name}
																profilePath={null}
																sizes="96px"
																imageClassName="size-full object-cover"
															/>
														)}
													</Link>
													{row.alertsEnabled ? (
														<span
															className="absolute right-0 bottom-0 flex size-6 items-center justify-center rounded-full bg-card text-foreground"
															title="Release alerts on"
														>
															<Bell className="size-3" aria-hidden />
															<span className="sr-only">Release alerts on</span>
														</span>
													) : null}
												</div>
												<div className="w-full min-w-0 px-0.5">
													<Link
														href={`/people/${row.tmdbPersonId}`}
														className="block outline-none focus-visible:underline"
														onClick={() =>
															useProfilePersonFavorites.getState().close()
														}
													>
														<span className="block truncate font-medium text-foreground text-sm leading-tight">
															{row.name}
														</span>
														{row.knownForDepartment ? (
															<span className="mt-0.5 block truncate text-muted-foreground text-xs">
																{row.knownForDepartment}
															</span>
														) : null}
													</Link>
													{isOwner ? (
														<button
															type="button"
															aria-label={`Remove ${row.name} from favorites`}
															className={cn(
																"mt-2 w-full rounded-full bg-background px-2.5 py-1.5",
																"font-medium text-foreground text-xs",
																"select-none transition-opacity",
																"[@media(hover:hover)]:hover:opacity-80",
															)}
															onClick={() =>
																void handleUnfavorite(row.tmdbPersonId)
															}
														>
															Remove
														</button>
													) : null}
												</div>
											</div>
										</li>
									))}
								</ul>
							)}

							{nextBefore ? (
								<div className="flex justify-center pt-6">
									<button
										type="button"
										className="rounded-full bg-background px-4 py-2 text-sm disabled:opacity-45"
										disabled={loadingMore}
										onClick={() => void loadMore()}
									>
										{loadingMore ? "Loading…" : "Load more"}
									</button>
								</div>
							) : null}
						</div>
					)}
				</div>
			</DetailDrawerScrollBody>
			<SheetScrollScrims
				showHeaderFade={showHeaderFade}
				showFooterFade={showFooterFade}
				footerTone="filmography"
			/>
		</div>
	);
}
