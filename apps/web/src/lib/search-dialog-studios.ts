/** One production company in the search dialog studio rail. */
export type SearchDialogStudio = {
	id: number;
	name: string;
	logoUrl: string | null;
};

export function findSearchDialogStudio(
	studios: SearchDialogStudio[],
	companyId: number | null | undefined,
): SearchDialogStudio | null {
	if (companyId == null || !Number.isFinite(companyId)) return null;
	return studios.find((s) => s.id === Math.floor(companyId)) ?? null;
}

/** Short label for tight logo tiles (Searchlight Pictures → Searchlight). */
export function studioShortName(name: string): string {
	const n = name.trim();
	if (n.length <= 12) return n;
	if (n.toLowerCase().includes("searchlight")) return "Searchlight";
	if (n.toLowerCase().includes("sony")) return "SPC";
	if (n.toLowerCase().includes("focus")) return "Focus";
	return n.split(/\s+/)[0] ?? n;
}

/** Tokens used for Tab-completion and recent-query restore (aliases + full name). */
export function studioSearchTokens(studio: SearchDialogStudio): string[] {
	const name = studio.name.trim().toLowerCase();
	const tokens = new Set<string>([name]);
	const first = name.split(/\s+/)[0];
	if (first) tokens.add(first);
	const short = studioShortName(studio.name).trim().toLowerCase();
	if (short) tokens.add(short);
	if (name.includes("searchlight")) tokens.add("searchlight");
	if (name.includes("sony")) {
		tokens.add("sony");
		tokens.add("spc");
	}
	if (name.includes("focus")) tokens.add("focus");
	if (name === "neon" || name.startsWith("neon ")) tokens.add("neon");
	if (name.includes("mubi")) tokens.add("mubi");
	if (name.includes("netflix")) tokens.add("netflix");
	if (name.includes("ghibli")) tokens.add("ghibli");
	return [...tokens];
}

/** Prefix or substring match for studio names in the token field (parity with genres). */
export function studioNameMatchesToken(
	studio: SearchDialogStudio,
	token: string,
): boolean {
	const q = token.trim().toLowerCase();
	if (!q) return false;
	for (const t of studioSearchTokens(studio)) {
		if (t.startsWith(q)) return true;
		if (q.length >= 2 && t.includes(q)) return true;
	}
	return false;
}
