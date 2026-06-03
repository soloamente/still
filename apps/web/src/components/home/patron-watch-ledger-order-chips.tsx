"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";

import type { PatronWatchLedgerOrder } from "@/lib/patron-watch-ledger-order";

const CHIPS: readonly {
	id: PatronWatchLedgerOrder;
	label: string;
	title: string;
	ariaLabel: string;
}[] = [
	{
		id: "latest_seen",
		label: "Latest seen",
		title: "Newest screenings first — when they watched each title",
		ariaLabel: "Latest seen — order by most recent watch date",
	},
	{
		id: "earliest_seen",
		label: "Earliest seen",
		title: "Oldest screenings first — chronological from their first log",
		ariaLabel: "Earliest seen — order by oldest watch date first",
	},
	{
		id: "title_az",
		label: "By title",
		title:
			"Alphabetical by title (A–Z), then newest watch within the same title",
		ariaLabel: "By title — alphabetical order",
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
	const reduceMotion = useReducedMotion();

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

	const sortToolbarDescId = "patron-watch-ledger-order-desc";

	return (
		<div className="mb-6 flex min-w-0 flex-col gap-1">
			<p id={sortToolbarDescId} className="sr-only">
				Choose how this patron&apos;s watch log is ordered — by when they
				watched each title or alphabetically.
			</p>
			<div
				className="mx-auto flex max-w-full flex-wrap justify-center gap-1 rounded-full bg-background p-1"
				role="toolbar"
				aria-label="Watch log order"
				aria-describedby={sortToolbarDescId}
			>
				{CHIPS.map(({ id, label, title, ariaLabel }) => (
					<button
						key={id}
						type="button"
						aria-current={order === id ? "page" : undefined}
						className={chipButton(order === id)}
						title={title}
						aria-label={ariaLabel}
						onClick={() => onOrderChange(id)}
					>
						{order === id ? (
							<motion.span
								layoutId="patron-watch-ledger-order-pill"
								className="absolute inset-0 z-0 rounded-full bg-card"
								transition={pillTransition}
							/>
						) : null}
						<span className="relative z-10">{label}</span>
					</button>
				))}
			</div>
		</div>
	);
}
