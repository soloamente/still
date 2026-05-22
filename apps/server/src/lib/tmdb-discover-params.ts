/** Parse comma-separated positive integers for TMDb AND filters (`with_genres`, `with_keywords`). */
export function parseCommaIntList(raw?: string): number[] {
	if (!raw?.trim()) return [];
	const out: number[] = [];
	for (const part of raw.split(",")) {
		const n = Math.floor(Number(part.trim()));
		if (Number.isFinite(n) && n > 0 && !out.includes(n)) out.push(n);
	}
	return out;
}

export function commaJoinIds(ids: number[]): string | undefined {
	if (ids.length === 0) return undefined;
	return ids.map((id) => String(Math.floor(id))).join(",");
}
