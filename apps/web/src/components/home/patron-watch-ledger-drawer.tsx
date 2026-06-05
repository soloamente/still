"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { create } from "zustand";
import { PatronWatchLedgerPanel } from "@/components/home/patron-watch-ledger-panel";
import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import type { LeaderboardKind } from "@/lib/home-leaderboard-types";

export type PatronWatchLedgerSeed = {
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	kind: LeaderboardKind;
	period: HomeLeaderboardPeriod;
};

type Store = {
	isOpen: boolean;
	seed: PatronWatchLedgerSeed | null;
	open: (seed: PatronWatchLedgerSeed) => void;
	close: () => void;
};

export const usePatronWatchLedger = create<Store>((set) => ({
	isOpen: false,
	seed: null,
	open: (seed) => set({ isOpen: true, seed }),
	close: () => set({ isOpen: false, seed: null }),
}));

export function openPatronWatchLedger(seed: PatronWatchLedgerSeed) {
	usePatronWatchLedger.getState().open(seed);
}

/** Global watch ledger sheet — opened from Community rank counts. */
export function PatronWatchLedgerDrawerRoot() {
	const { isOpen, seed, close } = usePatronWatchLedger();
	const pathname = usePathname();

	// Poster taps and profile links navigate via Next `<Link>` — dismiss the sheet on route change.
	useEffect(() => {
		if (usePatronWatchLedger.getState().isOpen) {
			close();
		}
	}, [pathname, close]);

	const filmographyStyleTitle = seed
		? `${seed.displayName} — ${seed.kind === "tv" ? "TV watch log" : "watch log"}`
		: "Watch log";

	return (
		<DetailVaulSheet
			open={isOpen}
			onOpenChange={(next) => {
				if (!next) close();
			}}
			title={filmographyStyleTitle}
			description={
				seed
					? `Diary logs from @${seed.handle} in the selected period`
					: undefined
			}
		>
			{seed ? <PatronWatchLedgerPanel seed={seed} active={isOpen} /> : null}
		</DetailVaulSheet>
	);
}
