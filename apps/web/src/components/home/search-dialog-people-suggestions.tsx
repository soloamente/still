"use client";

import { cn } from "@still/ui/lib/utils";
import { useEffect, useState } from "react";

import { SearchDialogPeopleRow } from "@/components/home/search-dialog-people-row";
import {
	type FollowSuggestionRow,
	fetchFollowSuggestions,
	fetchTasteSuggestedPatrons,
} from "@/lib/still-api-fetch";
import {
	type TasteSuggestedPatronRow,
	tasteSuggestedPatronMetaLine,
} from "@/lib/taste-suggested-patrons";

/** Follow + taste-match lists for the People browse column (signed-in only). */
export function SearchDialogPeopleSuggestions({
	enabled,
	onSelect,
	className,
	showEmptyState = false,
}: {
	enabled: boolean;
	onSelect: (handle: string) => void;
	className?: string;
	/** When true, show copy if suggestions load empty (browse column). */
	showEmptyState?: boolean;
}) {
	const [tasteRows, setTasteRows] = useState<TasteSuggestedPatronRow[]>([]);
	const [networkRows, setNetworkRows] = useState<FollowSuggestionRow[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!enabled) {
			setTasteRows([]);
			setNetworkRows([]);
			setLoading(false);
			return;
		}

		const ctrl = new AbortController();
		setLoading(true);
		void (async () => {
			try {
				const [tasteRes, followRes] = await Promise.all([
					fetchTasteSuggestedPatrons({ signal: ctrl.signal }),
					fetchFollowSuggestions({ signal: ctrl.signal }),
				]);
				if (ctrl.signal.aborted) return;

				const tastePayload = tasteRes.data as {
					patrons?: TasteSuggestedPatronRow[];
				} | null;
				const tasteList = Array.isArray(tastePayload?.patrons)
					? tastePayload.patrons.filter((r) => r.handle?.trim())
					: [];
				setTasteRows(tasteList);

				const followList = Array.isArray(followRes.data)
					? (followRes.data as FollowSuggestionRow[])
					: [];
				const tasteHandles = new Set(
					tasteList.map((r) => r.handle.trim().toLowerCase()),
				);
				setNetworkRows(
					followList.filter(
						(r) =>
							r.handle?.trim() &&
							!tasteHandles.has(r.handle.trim().toLowerCase()),
					),
				);
			} catch {
				if (!ctrl.signal.aborted) {
					setTasteRows([]);
					setNetworkRows([]);
				}
			} finally {
				if (!ctrl.signal.aborted) setLoading(false);
			}
		})();

		return () => ctrl.abort();
	}, [enabled]);

	if (!enabled) return null;

	const hasTaste = tasteRows.length > 0;
	const hasNetwork = networkRows.length > 0;
	if (!loading && !hasTaste && !hasNetwork) {
		if (!showEmptyState) return null;
		return (
			<p className="text-muted-foreground text-xs leading-relaxed">
				No suggestions right now — try again in a moment.
			</p>
		);
	}

	// Skip skeleton while loading — the browse column stays quiet until rows arrive.
	if (loading && !hasTaste && !hasNetwork) return null;

	return (
		<div className={cn("space-y-3", className)}>
			{hasTaste ? (
				<div>
					<div className="mb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
						Taste matches
					</div>
					<ul className="space-y-0.5">
						{tasteRows.map((row) => {
							const handle = row.handle.trim();
							return (
								<SearchDialogPeopleRow
									key={row.userId}
									handle={handle}
									displayName={row.displayName?.trim() || handle}
									image={row.image}
									metaLine={tasteSuggestedPatronMetaLine(row)}
									onSelect={() => onSelect(handle)}
								/>
							);
						})}
					</ul>
				</div>
			) : null}
			{hasNetwork ? (
				<div>
					<div className="mb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
						From your network
					</div>
					<ul className="space-y-0.5">
						{networkRows.map((row) => {
							const handle = row.handle?.trim();
							if (!handle) return null;
							return (
								<SearchDialogPeopleRow
									key={row.user_id}
									handle={handle}
									displayName={row.name?.trim() || handle}
									image={row.image}
									metaLine={
										row.shared_follows > 0
											? `${row.shared_follows} mutual follow${row.shared_follows === 1 ? "" : "s"}`
											: null
									}
									onSelect={() => onSelect(handle)}
								/>
							);
						})}
					</ul>
				</div>
			) : null}
		</div>
	);
}
