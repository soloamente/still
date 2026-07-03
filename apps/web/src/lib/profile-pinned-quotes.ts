/** Mirrors `apps/server/src/lib/profile-pinned-quotes.ts` for profile UI. */

import type { SavedQuoteLobbyItem } from "@/lib/quote-saved-types";

export const MAX_PINNED_QUOTES = 3;

/** Normalize + dedupe incoming pin ids while preserving order. */
export function normalizePinnedQuoteSaveIds(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const ids: string[] = [];
	for (const entry of raw) {
		if (typeof entry !== "string") continue;
		const id = entry.trim();
		if (!id || seen.has(id)) continue;
		seen.add(id);
		ids.push(id);
		if (ids.length >= MAX_PINNED_QUOTES) break;
	}
	return ids;
}

/** Profile strip must only show explicit pins — filter stale public-save payloads. */
export function filterPinnedQuoteLobbyItems(
	items: readonly SavedQuoteLobbyItem[],
	pinnedSaveIds: readonly string[],
): SavedQuoteLobbyItem[] {
	if (pinnedSaveIds.length === 0) return [];
	const pinOrder = new Map(pinnedSaveIds.map((id, index) => [id, index]));
	return items
		.filter((item) => pinOrder.has(item.saveId))
		.sort(
			(a, b) => (pinOrder.get(a.saveId) ?? 0) - (pinOrder.get(b.saveId) ?? 0),
		);
}

/** Toggle one quote save id in the patron pin list (max 3). */
export function togglePinnedQuoteSaveId(
	current: readonly string[],
	saveId: string,
): string[] | { error: "max" } {
	if (current.includes(saveId)) {
		return current.filter((id) => id !== saveId);
	}
	if (current.length >= MAX_PINNED_QUOTES) {
		return { error: "max" };
	}
	return [...current, saveId];
}
