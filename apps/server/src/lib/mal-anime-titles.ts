/**
 * MAL title variants via Jikan (public, no key) — used when TMDb + export titles miss.
 * Rate limit: ~3 req/s — only call after other strategies fail.
 */

const JIKAN_BASE = "https://api.jikan.moe/v4/anime";

export async function fetchMalAnimeSearchTitles(
	idMal: number,
): Promise<string[]> {
	try {
		const res = await fetch(`${JIKAN_BASE}/${idMal}`, {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(8000),
		});
		if (!res.ok) return [];
		const json = (await res.json()) as {
			data?: {
				title?: string;
				title_english?: string | null;
				title_japanese?: string | null;
				titles?: { type?: string; title?: string }[];
			};
		};
		const data = json.data;
		if (!data) return [];

		const out: string[] = [];
		const push = (value: string | null | undefined) => {
			if (typeof value !== "string") return;
			const trimmed = value.trim();
			if (!trimmed || out.includes(trimmed)) return;
			out.push(trimmed);
		};

		push(data.title_english);
		push(data.title);
		push(data.title_japanese);
		for (const row of data.titles ?? []) {
			if (
				row.type === "Default" ||
				row.type === "English" ||
				row.type === "Synonym"
			) {
				push(row.title);
			}
		}
		return out;
	} catch (err) {
		console.warn("[mal-anime-titles] Jikan fetch failed", idMal, err);
		return [];
	}
}
