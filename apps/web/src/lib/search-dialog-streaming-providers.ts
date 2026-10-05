/** One flatrate platform from `GET /api/movies/streaming-providers`. */
export type SearchDialogStreamingProvider = {
	id: number;
	name: string;
	logoUrl: string | null;
};

export function findSearchDialogStreamingProvider(
	providers: SearchDialogStreamingProvider[],
	providerId: number | null | undefined,
): SearchDialogStreamingProvider | null {
	if (providerId == null || !Number.isFinite(providerId)) return null;
	return providers.find((p) => p.id === Math.floor(providerId)) ?? null;
}

/** Tokens for Tab-completion (brand names + common aliases). */
export function streamingProviderSearchTokens(
	provider: SearchDialogStreamingProvider,
): string[] {
	const name = provider.name.trim().toLowerCase();
	const tokens = new Set<string>([name]);
	const first = name.split(/\s+/)[0];
	if (first) tokens.add(first);
	if (name.includes("netflix")) tokens.add("netflix");
	if (name.includes("disney")) tokens.add("disney");
	if (name.includes("hbo") || name.includes("max")) tokens.add("hbo");
	if (name.includes("prime") || name.includes("amazon")) {
		tokens.add("prime");
		tokens.add("amazon");
	}
	if (name.includes("apple")) tokens.add("apple");
	if (name.includes("hulu")) tokens.add("hulu");
	if (name.includes("paramount")) tokens.add("paramount");
	if (name.includes("peacock")) tokens.add("peacock");
	return [...tokens];
}

export function streamingProviderNameMatchesToken(
	provider: SearchDialogStreamingProvider,
	token: string,
): boolean {
	const q = token.trim().toLowerCase();
	if (!q) return false;
	for (const t of streamingProviderSearchTokens(provider)) {
		if (t.startsWith(q)) return true;
		if (q.length >= 2 && t.includes(q)) return true;
	}
	return false;
}

export function streamingProviderSuggestionMatchScore(
	provider: SearchDialogStreamingProvider,
	token: string,
): number {
	const q = token.trim().toLowerCase();
	if (!q) return 0;
	let best = 0;
	for (const t of streamingProviderSearchTokens(provider)) {
		if (t === q) {
			best = Math.max(best, 100);
			continue;
		}
		if (t.startsWith(q)) {
			best = Math.max(best, 70 - Math.min(20, t.length - q.length));
			continue;
		}
		if (q.length >= 2 && t.includes(q)) {
			best = Math.max(best, 35);
		}
	}
	return best;
}
