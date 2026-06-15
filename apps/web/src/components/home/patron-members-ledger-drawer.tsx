"use client";

import { create } from "zustand";

import { PatronMembersLedgerPanel } from "@/components/home/patron-members-ledger-panel";
import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import type { DiaryMetalTier } from "@/lib/diary-metal-tier";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import { membersLeaderboardSortLabel } from "@/lib/members-leaderboard";
import type {
	MembersLeaderboardEntry,
	MembersLeaderboardSort,
} from "@/lib/members-leaderboard-types";

export type PatronMembersLedgerSeed = {
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	avatarIsAnimated?: boolean;
	diaryMetalTier?: DiaryMetalTier | null;
	sort: MembersLeaderboardSort;
	period: HomeLeaderboardPeriod;
};

type Store = {
	isOpen: boolean;
	seed: PatronMembersLedgerSeed | null;
	open: (seed: PatronMembersLedgerSeed) => void;
	close: () => void;
};

export const usePatronMembersLedger = create<Store>((set) => ({
	isOpen: false,
	seed: null,
	open: (seed) => set({ isOpen: true, seed }),
	close: () => set({ isOpen: false, seed: null }),
}));

export function openPatronMembersLedger(seed: PatronMembersLedgerSeed) {
	usePatronMembersLedger.getState().open(seed);
}

/** Build drawer seed from a rank row/podium entry. */
export function buildPatronMembersLedgerSeed(
	entry: MembersLeaderboardEntry,
	sort: MembersLeaderboardSort,
	period: HomeLeaderboardPeriod,
): PatronMembersLedgerSeed {
	return {
		userId: entry.userId,
		handle: entry.handle,
		displayName: entry.displayName,
		image: entry.image,
		avatarIsAnimated: entry.avatarIsAnimated,
		diaryMetalTier: entry.diaryMetalTier,
		sort,
		period,
	};
}

function membersLedgerDrawerTitle(seed: PatronMembersLedgerSeed): string {
	const sortLabel = membersLeaderboardSortLabel(seed.sort);
	return `${seed.displayName} — ${sortLabel}`;
}

function membersLedgerDrawerDescription(seed: PatronMembersLedgerSeed): string {
	if (seed.sort === "lists") {
		return `@${seed.handle} in the selected period — tap a cover to open the list`;
	}
	if (seed.sort === "popular") {
		return `@${seed.handle} in the selected period — tap a poster to read the review when one exists`;
	}
	return `@${seed.handle} in the selected period — tap a poster to read the review`;
}

/** Global contribution ledger sheet — opened from Community Ranks patron counts. */
export function PatronMembersLedgerDrawerRoot() {
	const { isOpen, seed, close } = usePatronMembersLedger();

	return (
		<DetailVaulSheet
			open={isOpen}
			onOpenChange={(next) => {
				if (!next) close();
			}}
			title={seed ? membersLedgerDrawerTitle(seed) : "Contribution log"}
			description={seed ? membersLedgerDrawerDescription(seed) : undefined}
		>
			{seed ? <PatronMembersLedgerPanel seed={seed} active={isOpen} /> : null}
		</DetailVaulSheet>
	);
}
