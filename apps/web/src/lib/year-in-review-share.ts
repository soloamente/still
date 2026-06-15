/** Current UTC calendar year — default Wrapped route target. */
export function currentWrappedYear(): number {
	return new Date().getUTCFullYear();
}

/** Signed-in patron Wrapped page (top-level, like Achievements). */
export function yearInReviewPagePath(year: number): string {
	return `/year/${year}`;
}

/** Lobby entry — redirects to the current year. */
export function yearInReviewLobbyPath(): string {
	return "/year";
}

/** Public share URL — OG metadata + redirect for humans. */
export function yearInReviewSharePath(handle: string, year: number): string {
	return `/year/${encodeURIComponent(handle.toLowerCase())}/${year}`;
}

/** @deprecated Use {@link yearInReviewPagePath}. */
export function yearInReviewMePath(year: number): string {
	return yearInReviewPagePath(year);
}

export { ogYearInReviewPath } from "@/lib/og/og-image-metadata";
