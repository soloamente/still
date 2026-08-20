"use client";

import { useDiaryLobbyParams } from "@/components/diary/diary-lobby-params-context";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import type { DiaryLedgerTabId } from "@/lib/diary-lobby-order";

const DIARY_MEDIA_OPTIONS: readonly {
	id: DiaryLedgerTabId;
	label: string;
}[] = [
	{ id: "movies", label: "Movies" },
	{ id: "tv", label: "TV Shows" },
];

/**
 * Center pill rail on `/diary` — Movies vs TV Shows.
 * Uses SegmentedPillToolbar so the active pill gets liquid-gooey Move (SliderThumb).
 */
export function DiaryMediaTabToolbar() {
	const { ledgerTab, selectTab } = useDiaryLobbyParams();

	return (
		<SegmentedPillToolbar
			layoutId="diary-catalog-tab-pill"
			aria-label="Diary media type"
			value={ledgerTab}
			onChange={selectTab}
			options={DIARY_MEDIA_OPTIONS}
			compact
		/>
	);
}
