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
	signedIn = false,
}: {
	items: DiaryLobbyGridItem[];
	catalogueWaveKeyOverride: string;
	monochromePeersOnHover: boolean;
	signedIn?: boolean;
}) {
	return (
		<DiaryLobbyGrid
			items={items}
			monochromePeersOnHover={monochromePeersOnHover}
			signedIn={signedIn}
			waveKey={catalogueWaveKeyOverride}
		/>
	);
}
