"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";

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
	ariaLabelKey: "latestAriaLabel" | "earliestAriaLabel";
}[] = [
	{
		id: "latest",
		labelKey: "latest",
		titleKey: "latestTitle",
		ariaLabelKey: "latestAriaLabel",
	},
	{
		id: "earliest",
		labelKey: "earliest",
		titleKey: "earliestTitle",
		ariaLabelKey: "earliestAriaLabel",
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
	const reduceMotion = useReducedMotion();
	const labels = patronMembersLedgerOrderLabels(sort);

	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	const chipButton = (active: boolean) =>
		cn(
			"relative inline-flex min-h-10 items-center justify-center rounded-full px-3 py-2 text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none sm:px-3.5",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	const sortToolbarDescId = "patron-members-ledger-order-desc";

	return (
		<div className="mb-6 flex min-w-0 flex-col gap-1">
			<p id={sortToolbarDescId} className="sr-only">
				{labels.toolbarDescription}
			</p>
			<div
				className="mx-auto flex max-w-full flex-wrap justify-center gap-1 rounded-full bg-background p-1"
				role="toolbar"
				aria-label="Contribution log order"
				aria-describedby={sortToolbarDescId}
			>
				{ORDER_CHIPS.map(({ id, labelKey, titleKey, ariaLabelKey }) => (
					<button
						key={id}
						type="button"
						aria-current={order === id ? "page" : undefined}
						className={chipButton(order === id)}
						title={labels[titleKey]}
						aria-label={labels[ariaLabelKey]}
						onClick={() => onOrderChange(id)}
					>
						{order === id ? (
							<motion.span
								layoutId="patron-members-ledger-order-pill"
								className="absolute inset-0 z-0 rounded-full bg-card"
								transition={pillTransition}
							/>
						) : null}
						<span className="relative z-10">{labels[labelKey]}</span>
					</button>
				))}
			</div>
		</div>
	);
}
