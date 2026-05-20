/**
 * Festival / award lines from Wikidata (P166 won, P1411 nominated) when TMDb
 * keywords and release notes lack nomination detail.
 */

export type WikidataAwardStatus = "won" | "nominated";

export interface WikidataMovieAward {
	awardLabel: string;
	status: WikidataAwardStatus;
	/** Calendar year when known (from P585). */
	year: number | null;
}

const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";
const USER_AGENT = "Still/1.0 (movie detail; +https://github.com)";

function parseAwardYear(raw: string | undefined): number | null {
	if (!raw) return null;
	const hit = raw.match(/\b(19|20)\d{2}\b/)?.[0];
	return hit ? Number(hit) : null;
}

function dedupeAwards(rows: WikidataMovieAward[]): WikidataMovieAward[] {
	const byLabel = new Map<string, WikidataMovieAward>();
	for (const row of rows) {
		const key = row.awardLabel.toLowerCase();
		const existing = byLabel.get(key);
		if (!existing) {
			byLabel.set(key, row);
			continue;
		}
		if (row.status === "won" && existing.status === "nominated") {
			byLabel.set(key, row);
		}
	}
	return [...byLabel.values()];
}

function buildAwardsQuery(tmdbId: number, imdbId: string | null): string {
	const imdbFilter = imdbId ? `UNION { ?film wdt:P345 "${imdbId}" . }` : "";
	return `
SELECT ?awardLabel ?status ?year WHERE {
  { ?film wdt:P4947 "${tmdbId}" . }
  ${imdbFilter}
  {
    ?film p:P166 ?stmt . ?stmt ps:P166 ?award . BIND("won" AS ?status) .
    OPTIONAL { ?stmt pq:P585 ?year }
  } UNION {
    ?film p:P1411 ?stmt . ?stmt ps:P1411 ?award . BIND("nominated" AS ?status) .
    OPTIONAL { ?stmt pq:P585 ?year }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`.trim();
}

/**
 * Loads won / nominated awards for a film by TMDb id (and optional IMDb id).
 * Returns an empty array on timeout or error so movie pages still render.
 */
export async function fetchWikidataMovieAwards(opts: {
	tmdbId: number;
	imdbId?: string | null;
}): Promise<WikidataMovieAward[]> {
	const { tmdbId, imdbId } = opts;
	if (!Number.isFinite(tmdbId)) return [];

	const query = buildAwardsQuery(tmdbId, imdbId?.trim() || null);
	const url = new URL(WIKIDATA_SPARQL);
	url.searchParams.set("query", query);
	url.searchParams.set("format", "json");

	try {
		const res = await fetch(url, {
			headers: {
				Accept: "application/sparql-results+json",
				"User-Agent": USER_AGENT,
			},
			next: { revalidate: 60 * 60 * 24 },
			signal: AbortSignal.timeout(5000),
		});
		if (!res.ok) return [];

		const json = (await res.json()) as {
			results?: {
				bindings?: {
					awardLabel?: { value?: string };
					status?: { value?: string };
					year?: { value?: string };
				}[];
			};
		};

		const rows: WikidataMovieAward[] = [];
		for (const binding of json.results?.bindings ?? []) {
			const awardLabel = binding.awardLabel?.value?.trim();
			const status = binding.status?.value;
			if (!awardLabel || (status !== "won" && status !== "nominated")) continue;
			rows.push({
				awardLabel,
				status,
				year: parseAwardYear(binding.year?.value),
			});
		}

		return dedupeAwards(rows);
	} catch {
		return [];
	}
}
