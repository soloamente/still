/**
 * Person awards from Wikidata (P166 won, P1411 nominated) with optional work
 * qualifier (P1686) for film/TV title deep links on person About.
 */

export type WikidataPersonAwardStatus = "won" | "nominated";

export interface WikidataPersonAwardRaw {
	awardLabel: string;
	status: WikidataPersonAwardStatus;
	/** Calendar year when known (from P585). */
	year: number | null;
	workTitle: string | null;
	workTmdbId: number | null;
	workMediaKind: "movie" | "tv" | null;
}

/** SPARQL JSON binding shape consumed by normalizeWikidataPersonAwardBindings. */
export type WikidataPersonAwardBinding = {
	awardLabel?: { value?: string };
	status?: { value?: string };
	year?: { value?: string };
	workLabel?: { value?: string };
	workTmdbMovie?: { value?: string };
	workTmdbTv?: { value?: string };
};

const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";
const USER_AGENT = "Sense/1.0 (person detail; +https://github.com)";

function parseAwardYear(raw: string | undefined): number | null {
	if (!raw) return null;
	const hit = raw.match(/\b(19|20)\d{2}\b/)?.[0];
	return hit ? Number(hit) : null;
}

function parseTmdbId(raw: string | undefined): number | null {
	if (!raw) return null;
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : null;
}

/** Builds a dedupe key; status is omitted so won can replace nominated. */
function personAwardDedupeKey(row: WikidataPersonAwardRaw): string {
	return `${row.awardLabel}|${row.year}|${row.workTitle}|${row.workTmdbId}`;
}

function dedupePersonAwards(
	rows: WikidataPersonAwardRaw[],
): WikidataPersonAwardRaw[] {
	const byKey = new Map<string, WikidataPersonAwardRaw>();
	for (const row of rows) {
		const key = personAwardDedupeKey(row);
		const existing = byKey.get(key);
		if (!existing) {
			byKey.set(key, row);
			continue;
		}
		// Prefer won over nominated when award, year, work, and TMDb id match.
		if (row.status === "won" && existing.status === "nominated") {
			byKey.set(key, row);
		}
	}
	return [...byKey.values()];
}

function buildPersonAwardsQuery(
	tmdbPersonId: number,
	imdbId: string | null,
): string {
	const imdbFilter = imdbId ? `UNION { ?person wdt:P345 "${imdbId}" . }` : "";
	return `
SELECT ?awardLabel ?status ?year ?workLabel ?workTmdbMovie ?workTmdbTv WHERE {
  { ?person wdt:P4985 "${tmdbPersonId}" . }
  ${imdbFilter}
  {
    ?person p:P166 ?stmt .
    ?stmt ps:P166 ?award .
    BIND("won" AS ?status)
    OPTIONAL { ?stmt pq:P585 ?year }
    OPTIONAL {
      ?stmt pq:P1686 ?work .
      OPTIONAL { ?work wdt:P4947 ?workTmdbMovie }
      OPTIONAL { ?work wdt:P4983 ?workTmdbTv }
    }
  } UNION {
    ?person p:P1411 ?stmt .
    ?stmt ps:P1411 ?award .
    BIND("nominated" AS ?status)
    OPTIONAL { ?stmt pq:P585 ?year }
    OPTIONAL {
      ?stmt pq:P1686 ?work .
      OPTIONAL { ?work wdt:P4947 ?workTmdbMovie }
      OPTIONAL { ?work wdt:P4983 ?workTmdbTv }
    }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`.trim();
}

/**
 * Maps raw Wikidata SPARQL bindings into normalized person award rows.
 * Skips rows with missing labels or invalid status; prefers TV TMDb ids over movie.
 */
export function normalizeWikidataPersonAwardBindings(
	bindings: WikidataPersonAwardBinding[],
): WikidataPersonAwardRaw[] {
	const rows: WikidataPersonAwardRaw[] = [];

	for (const binding of bindings) {
		const awardLabel = binding.awardLabel?.value?.trim();
		const status = binding.status?.value;
		if (!awardLabel || (status !== "won" && status !== "nominated")) continue;

		const workTitle = binding.workLabel?.value?.trim() || null;
		const tvId = parseTmdbId(binding.workTmdbTv?.value);
		const movieId = parseTmdbId(binding.workTmdbMovie?.value);

		let workTmdbId: number | null = null;
		let workMediaKind: "movie" | "tv" | null = null;
		if (tvId !== null) {
			workTmdbId = tvId;
			workMediaKind = "tv";
		} else if (movieId !== null) {
			workTmdbId = movieId;
			workMediaKind = "movie";
		}

		rows.push({
			awardLabel,
			status,
			year: parseAwardYear(binding.year?.value),
			workTitle,
			workTmdbId,
			workMediaKind,
		});
	}

	return dedupePersonAwards(rows);
}

/**
 * Loads won / nominated awards for a person by TMDb person id (and optional IMDb id).
 * Returns an empty array on timeout or error so person pages still render.
 */
export async function fetchWikidataPersonAwards(opts: {
	tmdbPersonId: number;
	imdbId?: string | null;
}): Promise<WikidataPersonAwardRaw[]> {
	const { tmdbPersonId, imdbId } = opts;
	if (!Number.isFinite(tmdbPersonId)) return [];

	const query = buildPersonAwardsQuery(tmdbPersonId, imdbId?.trim() || null);
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
			results?: { bindings?: WikidataPersonAwardBinding[] };
		};

		return normalizeWikidataPersonAwardBindings(json.results?.bindings ?? []);
	} catch {
		return [];
	}
}
