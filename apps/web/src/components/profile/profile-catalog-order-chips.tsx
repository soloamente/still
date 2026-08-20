"use client";

import { useProfileLobbyParams } from "@/components/profile/profile-lobby-params-context";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import type {
	ProfileLedgerTabId,
	ProfileLobbyOrder,
} from "@/lib/profile-lobby-order";

const CHIPS: readonly {
	id: ProfileLobbyOrder;
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
 * Left chip rail on profile Movies / TV — liquid-gooey Move pill (diary parity).
 */
export function ProfileCatalogOrderChips({
	ledgerTab: _ledgerTab,
}: {
	ledgerTab: ProfileLedgerTabId;
}) {
	const { order, selectOrder } = useProfileLobbyParams();

	return (
		<div className="flex min-w-0 flex-col gap-1">
			<p id="profile-catalog-order-desc" className="sr-only">
				Choose how this patron&apos;s logged titles are ordered — by watch date
				or alphabetically.
			</p>
			<SegmentedPillToolbar
				layoutId="profile-catalog-order-pill"
				aria-label="Profile catalogue order"
				value={order}
				onChange={selectOrder}
				options={CHIPS}
				compact
				className="max-w-full flex-nowrap justify-start"
			/>
		</div>
	);
}
