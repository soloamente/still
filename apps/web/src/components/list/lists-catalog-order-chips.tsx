"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import {
	buildListsLobbyHref,
	type ListsLobbyOrder,
	parseListsLobbyOrder,
} from "@/lib/lists-lobby-order";

const CHIPS: readonly {
	id: ListsLobbyOrder;
	label: string;
	title: string;
}[] = [
	{
		id: "recently_updated",
		label: "Recently updated",
		title: "Lists you edited most recently appear first",
	},
	{
		id: "oldest",
		label: "Oldest",
		title: "Lists you created or edited longest ago appear first",
	},
	{
		id: "title_az",
		label: "By title",
		title: "Alphabetical by list name (A–Z)",
	},
] as const;

/**
 * Left chip rail on `/lists` — liquid-gooey Move pill (watchlist / diary parity).
 */
export function ListsCatalogOrderChips() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const order = parseListsLobbyOrder(searchParams.get("order"));

	return (
		<div className="flex min-w-0 flex-col gap-1">
			<p id="lists-catalog-order-desc" className="sr-only">
				Choose how your lists are ordered in the poster wall — by last edit or
				alphabetically by list name.
			</p>
			<SegmentedPillToolbar
				layoutId="lists-catalog-order-pill"
				aria-label="List order"
				value={order}
				onChange={(next) => {
					router.push(buildListsLobbyHref({ order: next }), { scroll: false });
				}}
				options={CHIPS}
				compact
				className="max-w-full flex-nowrap justify-start"
			/>
		</div>
	);
}
