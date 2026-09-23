"use client";

import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { create } from "zustand";

import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import { PersonCreditPortrait } from "@/components/movie/person-credit-portrait";
import {
	fetchProfilePersonFavorites,
	setPersonFavorite,
} from "@/lib/still-api-fetch";
import { isTmdbCdnUrl } from "@/lib/tmdb-poster-url";

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
	}, [handle]);

	useEffect(() => {
		if (!active) return;
		let cancelled = false;
		void (async () => {
			await loadFirst();
			if (cancelled) return;
		})();
		return () => {
			cancelled = true;
		};
	}, [active, loadFirst]);

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

	return (
		<div className="flex h-full flex-col">
			<div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
				{rows == null ? (
					<ul aria-busy="true" aria-label="Loading favorites">
						{SKELETON_IDS.map((id) => (
							<li key={id} className="flex items-center gap-3 px-2 py-2.5">
								<span className="size-12 shrink-0 animate-pulse rounded-full bg-muted/40" />
								<div className="min-w-0 flex-1 space-y-1.5">
									<span className="block h-3.5 w-32 animate-pulse rounded bg-muted/40" />
									<span className="block h-3 w-20 animate-pulse rounded bg-muted/30" />
								</div>
							</li>
						))}
					</ul>
				) : rows.length === 0 ? (
					<p className="px-3 py-8 text-center text-muted-foreground text-sm">
						{isOwner
							? "Favorite cast and crew from their pages."
							: "No favorites yet."}
					</p>
				) : (
					<ul>
						{rows.map((row) => (
							<li key={row.tmdbPersonId}>
								<div className="flex items-center gap-3 px-2 py-2.5">
									<Link
										href={`/people/${row.tmdbPersonId}`}
										className="flex min-w-0 flex-1 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
										onClick={() =>
											useProfilePersonFavorites.getState().close()
										}
									>
										<span className="relative size-12 shrink-0 overflow-hidden rounded-full bg-muted/30">
											{row.profileUrl ? (
												<Image
													src={row.profileUrl}
													alt=""
													fill
													className="object-cover"
													sizes="48px"
													unoptimized={isTmdbCdnUrl(row.profileUrl)}
												/>
											) : (
												<PersonCreditPortrait
													name={row.name}
													profilePath={null}
													sizes="48px"
													imageClassName="size-full object-cover"
												/>
											)}
										</span>
										<span className="min-w-0 flex-1 text-left">
											<span className="block truncate font-medium text-foreground text-sm">
												{row.name}
											</span>
											{row.knownForDepartment ? (
												<span className="block truncate text-muted-foreground text-xs">
													{row.knownForDepartment}
												</span>
											) : null}
										</span>
									</Link>
									{isOwner ? (
										<button
											type="button"
											className={cn(
												"shrink-0 rounded-full bg-background px-3 py-1.5 text-muted-foreground text-xs",
												"select-none [@media(hover:hover)]:hover:text-foreground",
											)}
											onClick={() => void handleUnfavorite(row.tmdbPersonId)}
										>
											Remove
										</button>
									) : null}
								</div>
							</li>
						))}
					</ul>
				)}
				{nextBefore ? (
					<div className="flex justify-center py-3">
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
		</div>
	);
}
