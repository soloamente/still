"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";

import { useDiaryLobbyParams } from "@/components/diary/diary-lobby-params-context";
import type { DiaryLobbyOrder } from "@/lib/diary-lobby-order";

const CHIPS: readonly {
	id: DiaryLobbyOrder;
	label: string;
	title: string;
	ariaLabel: string;
}[] = [
	{
		id: "latest_seen",
		label: "Latest seen",
		title: "Newest screenings first — when you watched each title",
		ariaLabel: "Latest seen — order by most recent watch date",
	},
	{
		id: "earliest_seen",
		label: "Earliest seen",
		title: "Oldest screenings first — chronological from your first log",
		ariaLabel: "Earliest seen — order by oldest watch date first",
	},
	{
		id: "title_az",
		label: "By title",
		title:
			"Alphabetical by film title (A–Z), then newest watch within the same title",
		ariaLabel: "By title — alphabetical order",
	},
] as const;

/**
 * Left chip rail on `/diary` — replaces TMDb **Upcoming / Latest / Popular** with patron-facing
 * diary order. Visually matches `HomeCatalogSortChips` so the lobby stays one system.
 */
export function DiaryCatalogOrderChips() {
	const { order, selectOrder } = useDiaryLobbyParams();
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

	const sortToolbarDescId = "diary-catalog-order-desc";

	return (
		<div className="flex min-w-0 flex-col gap-1">
			<p id={sortToolbarDescId} className="sr-only">
				Choose how your diary screenings are ordered in the poster wall — by
				when you watched them or alphabetically by film title.
			</p>
			<div
				className="flex max-w-full flex-wrap gap-1 rounded-full bg-background p-1 sm:flex-nowrap"
				role="toolbar"
				aria-label="Diary order"
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
						onClick={() => selectOrder(id)}
					>
						{order === id ? (
							<motion.span
								layoutId="diary-catalog-order-pill"
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
