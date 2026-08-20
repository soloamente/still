"use client";

import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import type { PatronWatchLedgerOrder } from "@/lib/patron-watch-ledger-order";

const CHIPS: readonly {
	id: PatronWatchLedgerOrder;
	label: string;
	title: string;
}[] = [
	{
		id: "latest_seen",
		label: "Latest seen",
		title: "Newest screenings first — when they watched each title",
	},
	{
		id: "earliest_seen",
		label: "Earliest seen",
		title: "Oldest screenings first — chronological from their first log",
	},
	{
		id: "title_az",
		label: "By title",
		title:
			"Alphabetical by title (A–Z), then newest watch within the same title",
	},
] as const;

/**
 * Diary-style order rail inside the patron watch ledger drawer.
 */
export function PatronWatchLedgerOrderChips({
	order,
	onOrderChange,
}: {
	order: PatronWatchLedgerOrder;
	onOrderChange: (order: PatronWatchLedgerOrder) => void;
}) {
	return (
		<div className="mb-6 flex min-w-0 flex-col gap-1">
			<p id="patron-watch-ledger-order-desc" className="sr-only">
				Choose how this patron&apos;s watch log is ordered — by when they
				watched each title or alphabetically.
			</p>
			<SegmentedPillToolbar
				layoutId="patron-watch-ledger-order-pill"
				aria-label="Watch log order"
				value={order}
				onChange={onOrderChange}
				options={CHIPS}
				compact
				className="mx-auto max-w-full flex-wrap justify-center"
			/>
		</div>
	);
}
