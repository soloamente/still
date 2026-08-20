"use client";

import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import type { MembersLeaderboardSort } from "@/lib/members-leaderboard-types";
import {
	DEFAULT_PATRON_MEMBERS_LEDGER_ORDER,
	type PatronMembersLedgerOrder,
	patronMembersLedgerOrderLabels,
} from "@/lib/patron-members-ledger-order";

const ORDER_CHIPS: readonly {
	id: PatronMembersLedgerOrder;
	labelKey: "latest" | "earliest";
	titleKey: "latestTitle" | "earliestTitle";
}[] = [
	{
		id: "latest",
		labelKey: "latest",
		titleKey: "latestTitle",
	},
	{
		id: "earliest",
		labelKey: "earliest",
		titleKey: "earliestTitle",
	},
] as const;

/**
 * Recency-only order rail for the patron members contribution ledger — labels
 * follow the active rank dimension (reviews, lists, diary logs).
 */
export function PatronMembersLedgerOrderChips({
	sort,
	order = DEFAULT_PATRON_MEMBERS_LEDGER_ORDER,
	onOrderChange,
}: {
	sort: MembersLeaderboardSort;
	order?: PatronMembersLedgerOrder;
	onOrderChange: (order: PatronMembersLedgerOrder) => void;
}) {
	const labels = patronMembersLedgerOrderLabels(sort);
	const sortToolbarDescId = "patron-members-ledger-order-desc";

	return (
		<div className="mb-6 flex min-w-0 flex-col gap-1">
			<p id={sortToolbarDescId} className="sr-only">
				{labels.toolbarDescription}
			</p>
			<SegmentedPillToolbar
				layoutId="patron-members-ledger-order-pill"
				aria-label="Contribution log order"
				value={order}
				onChange={onOrderChange}
				options={ORDER_CHIPS.map(({ id, labelKey, titleKey }) => ({
					id,
					label: labels[labelKey],
					title: labels[titleKey],
				}))}
				compact
				className="mx-auto max-w-full flex-wrap justify-center"
			/>
		</div>
	);
}
