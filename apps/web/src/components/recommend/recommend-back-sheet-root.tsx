"use client";

import { create } from "zustand";

import { RecommendBackSheet } from "@/components/recommend/recommend-back-sheet";
import type {
	RecommendPick,
	RecommendTarget,
} from "@/lib/title-recommendation";

type RecommendBackSheetStore = {
	isOpen: boolean;
	target: RecommendTarget | null;
	onSent: ((pick: RecommendPick) => void) | null;
	/** Bumps per open so the sheet remounts with fresh step / note state. */
	session: number;
	open: (
		target: RecommendTarget,
		onSent?: (pick: RecommendPick) => void,
	) => void;
	close: () => void;
};

const useRecommendBackSheet = create<RecommendBackSheetStore>((set) => ({
	isOpen: false,
	target: null,
	onSent: null,
	session: 0,
	open: (target, onSent) =>
		set((state) => ({
			isOpen: true,
			target,
			onSent: onSent ?? null,
			session: state.session + 1,
		})),
	// Keep `target` while Vaul animates out; the next open replaces it.
	close: () => set({ isOpen: false }),
}));

/** Open **Recommend back** for a preselected recipient (circle card, inbox actions). */
export function openRecommendBackSheet(
	target: RecommendTarget,
	onSent?: (pick: RecommendPick) => void,
): void {
	useRecommendBackSheet.getState().open(target, onSent);
}

/** Mounted once in `AppShell` — one sheet instance for every entry point. */
export function RecommendBackSheetRoot() {
	const { isOpen, target, onSent, session, close } = useRecommendBackSheet();
	if (!target) return null;
	return (
		<RecommendBackSheet
			key={session}
			open={isOpen}
			target={target}
			onClose={close}
			onSent={onSent ?? undefined}
		/>
	);
}
