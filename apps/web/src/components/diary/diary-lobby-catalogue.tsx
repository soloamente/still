"use client";

import { DiaryLobbyGrid } from "@/components/diary/diary-lobby-grid";
import type { DiaryLobbyGridItem } from "@/lib/diary-lobby-grouping";

/**
 * Client boundary for `/diary` — grouped TV cells and expand state live in `DiaryLobbyGrid`.
 */
export function DiaryLobbyCatalogue({
	items,
	catalogueWaveKeyOverride,
	monochromePeersOnHover,
}: {
	items: DiaryLobbyGridItem[];
	catalogueWaveKeyOverride: string;
	monochromePeersOnHover: boolean;
}) {
	return (
		<DiaryLobbyGrid
			items={items}
			monochromePeersOnHover={monochromePeersOnHover}
			waveKey={catalogueWaveKeyOverride}
		/>
	);
}
