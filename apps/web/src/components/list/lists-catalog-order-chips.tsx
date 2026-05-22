"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
	buildListsLobbyHref,
	type ListsLobbyOrder,
	parseListsLobbyOrder,
} from "@/lib/lists-lobby-order";

const CHIPS: readonly {
	id: ListsLobbyOrder;
	label: string;
	title: string;
	ariaLabel: string;
}[] = [
	{
		id: "recently_updated",
		label: "Recently updated",
		title: "Lists you edited most recently appear first",
		ariaLabel: "Recently updated — newest edits first",
	},
	{
		id: "oldest",
		label: "Oldest",
		title: "Lists you created or edited longest ago appear first",
		ariaLabel: "Oldest — earliest updates first",
	},
	{
		id: "title_az",
		label: "By title",
		title: "Alphabetical by list name (A–Z)",
		ariaLabel: "By title — alphabetical order",
	},
] as const;

/**
 * Left chip rail on `/lists` — same shell as `WatchlistCatalogOrderChips` / `DiaryCatalogOrderChips`.
 */
export function ListsCatalogOrderChips() {
	const searchParams = useSearchParams();
	const order = parseListsLobbyOrder(searchParams.get("order"));
	const reduceMotion = useReducedMotion();

	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	const chipLink = (active: boolean) =>
		cn(
			"relative inline-flex min-h-10 items-center justify-center rounded-full px-3 py-2 text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none sm:px-3.5",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	const sortToolbarDescId = "lists-catalog-order-desc";

	return (
		<div className="flex min-w-0 flex-col gap-1">
			<p id={sortToolbarDescId} className="sr-only">
				Choose how your lists are ordered in the poster wall — by last edit or
				alphabetically by list name.
			</p>
			<div
				className="flex max-w-full flex-wrap gap-1 rounded-full bg-background p-1 sm:flex-nowrap"
				role="toolbar"
				aria-label="List order"
				aria-describedby={sortToolbarDescId}
			>
				{CHIPS.map(({ id, label, title, ariaLabel }) => (
					<Link
						key={id}
						href={buildListsLobbyHref({ order: id })}
						scroll={false}
						aria-current={order === id ? "page" : undefined}
						className={chipLink(order === id)}
						title={title}
						aria-label={ariaLabel}
					>
						{order === id ? (
							<motion.span
								layoutId="lists-catalog-order-pill"
								className="absolute inset-0 z-0 rounded-full bg-card"
								transition={pillTransition}
							/>
						) : null}
						<span className="relative z-10">{label}</span>
					</Link>
				))}
			</div>
		</div>
	);
}
