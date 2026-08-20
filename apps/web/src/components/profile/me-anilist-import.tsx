"use client";

import { AnilistImportPanel } from "@/components/profile/anilist-import-panel";

/** Settings → Data Anilist importer (chrome lives in the panel settings variant). */
export function MeAnilistImport() {
	return <AnilistImportPanel variant="settings" />;
}
