"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";

import { useDiaryLobbyParams } from "@/components/diary/diary-lobby-params-context";
import type { DiaryLedgerTabId } from "@/lib/diary-lobby-order";

const TAB_LABEL: Record<DiaryLedgerTabId, string> = {
	movies: "Movies",
	tv: "TV Shows",
};

/**
 * Center pill rail on `/diary` — Movies vs TV Shows, matching profile ledger tabs.
 */
export function DiaryMediaTabToolbar() {
	const { ledgerTab, selectTab } = useDiaryLobbyParams();
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
			"relative inline-flex min-h-10 items-center justify-center rounded-full text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			"px-3 py-2 sm:px-3.5",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	const ledgerTabs: DiaryLedgerTabId[] = ["movies", "tv"];

	return (
		<nav
			className="flex min-w-0 max-w-full flex-wrap gap-1 rounded-full bg-background p-1 sm:flex-nowrap"
			role="toolbar"
			aria-label="Diary media type"
		>
			{ledgerTabs.map((tab) => {
				const active = tab === ledgerTab;
				return (
					<button
						key={tab}
						type="button"
						aria-current={active ? "page" : undefined}
						className={chipButton(active)}
						onClick={() => selectTab(tab)}
					>
						{active ? (
							<motion.span
								layoutId="diary-catalog-tab-pill"
								className="absolute inset-0 z-0 rounded-full bg-card"
								transition={pillTransition}
							/>
						) : null}
						<span className="relative z-10 whitespace-nowrap">
							{TAB_LABEL[tab]}
						</span>
					</button>
				);
			})}
		</nav>
	);
}
