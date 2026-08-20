"use client";

import { useDiaryLobbyParams } from "@/components/diary/diary-lobby-params-context";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import type { DiaryLobbyOrder } from "@/lib/diary-lobby-order";

const CHIPS: readonly {
	id: DiaryLobbyOrder;
	label: string;
	title: string;
}[] = [
	{
		id: "latest_seen",
		label: "Latest seen",
		title: "Newest screenings first — when you watched each title",
	},
	{
		id: "earliest_seen",
		label: "Earliest seen",
		title: "Oldest screenings first — chronological from your first log",
	},
	{
		id: "title_az",
		label: "By title",
		title:
			"Alphabetical by film title (A–Z), then newest watch within the same title",
	},
] as const;

/**
 * Left chip rail on `/diary` — diary order with liquid-gooey Move pill.
 */
export function DiaryCatalogOrderChips() {
	const { order, selectOrder } = useDiaryLobbyParams();

	return (
		<div className="flex min-w-0 flex-col gap-1">
			<p id="diary-catalog-order-desc" className="sr-only">
				Choose how your diary screenings are ordered in the poster wall — by
				when you watched them or alphabetically by film title.
			</p>
			<SegmentedPillToolbar
				layoutId="diary-catalog-order-pill"
				aria-label="Diary order"
				value={order}
				onChange={selectOrder}
				options={CHIPS}
				compact
				className="max-w-full flex-nowrap justify-start"
			/>
		</div>
	);
}
