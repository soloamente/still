/**
 * Pure offset-pagination helpers for the community feed endpoints. Kept separate
 * from the routes so the math is unit-testable without a DB.
 */
export function parseCommunityPage(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return 1;
	return Math.floor(n);
}

export function communityOffset(page: number, limit: number): number {
	return Math.max(0, (page - 1) * limit);
}
