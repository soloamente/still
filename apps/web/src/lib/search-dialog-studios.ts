/** One production company in the search dialog studio rail. */
export type SearchDialogStudio = {
	id: number;
	name: string;
	logoUrl: string | null;
};

/** TMDb-fallback studio mark — canvas well when the themed PNG is missing. */
export const SEARCH_DIALOG_STUDIO_LOGO_CHIP_CLASS = "studio-logo-chip";

/** Studio rail / selected-studio tile — raised `bg-card` on the nested body well. */
export const SEARCH_DIALOG_STUDIO_RAIL_CHIP_CLASS =
	"size-16 rounded-2xl bg-card";

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
	if (n.toLowerCase().includes("sony pictures classics")) return "SPC";
	if (n.toLowerCase().includes("sony")) return "Sony";
	if (n.toLowerCase().includes("focus")) return "Focus";
	if (n.toLowerCase().includes("blumhouse")) return "Blumhouse";
	if (n.toLowerCase().includes("annapurna")) return "Annapurna";
	if (n.toLowerCase().includes("disney")) return "Disney";
	if (n.toLowerCase().includes("universal")) return "Universal";
	if (n.toLowerCase().includes("warner")) return "Warner";
	if (n.toLowerCase().includes("paramount")) return "Paramount";
	if (n.toLowerCase().includes("netflix")) return "Netflix";
	if (n.toLowerCase().includes("amazon")) return "Amazon";
	if (n.toLowerCase().includes("marvel")) return "Marvel";
	if (n.toLowerCase().includes("pixar")) return "Pixar";
	if (n.toLowerCase().includes("lionsgate")) return "Lionsgate";
	if (n.toLowerCase().includes("legendary")) return "Legendary";
	if (n.toLowerCase().includes("ghibli")) return "Ghibli";
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
	if (name.includes("blumhouse")) tokens.add("blumhouse");
	if (name.includes("annapurna")) tokens.add("annapurna");
	if (name === "neon" || name.startsWith("neon ")) tokens.add("neon");
	if (name.includes("mubi")) tokens.add("mubi");
	if (name.includes("netflix")) tokens.add("netflix");
	if (name.includes("ghibli")) tokens.add("ghibli");
	if (name.includes("disney")) tokens.add("disney");
	if (name.includes("universal")) tokens.add("universal");
	if (name.includes("warner")) {
		tokens.add("warner");
		tokens.add("wb");
	}
	if (name.includes("paramount")) tokens.add("paramount");
	if (name.includes("dreamworks")) tokens.add("dreamworks");
	if (name.includes("illumination")) tokens.add("illumination");
	if (name.includes("criterion")) tokens.add("criterion");
	if (name.includes("mgm")) tokens.add("mgm");
	if (name.includes("hbo")) tokens.add("hbo");
	if (name.includes("apple")) tokens.add("apple");
	if (name.includes("amazon") || name.includes("prime")) tokens.add("amazon");
	if (name.includes("toho")) tokens.add("toho");
	if (name.includes("studio canal") || name.includes("studiocanal"))
		tokens.add("studiocanal");
	return [...tokens];
}

/** Higher = better Tab-completion rank (exact token beats prefix beats substring). */
export function studioSuggestionMatchScore(
	studio: SearchDialogStudio,
	token: string,
): number {
	const q = token.trim().toLowerCase();
	if (!q) return 0;
	let best = 0;
	for (const t of studioSearchTokens(studio)) {
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
