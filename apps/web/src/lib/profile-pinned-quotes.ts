/** Mirrors `apps/server/src/lib/profile-pinned-quotes.ts` for profile UI. */

export const MAX_PINNED_QUOTES = 3;

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
