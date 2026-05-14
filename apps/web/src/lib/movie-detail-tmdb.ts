/**
 * Pure helpers for shaping TMDb payloads on the movie detail page (cast/crew
 * tables, festival-flavored keywords, premiere rows, merged recommendations).
 * Kept separate from React so we can unit-test the transforms later if needed.
 */

export type TmdbMovieSummary = {
  id: number;
  title: string;
  poster_path: string | null;
};

export type TmdbCrewEntry = {
  id: number;
  name: string;
  job?: string;
  department?: string;
  profile_path: string | null;
};

/** Jobs listed first — mirrors how services like MUBI order head crew. */
const CREW_JOB_PRIORITY = [
  "Director",
  "Co-Director",
  "Writer",
  "Screenplay",
  "Story",
  "Director of Photography",
  "Editor",
  "Original Music Composer",
  "Music",
  "Production Design",
  "Producer",
  "Executive Producer",
] as const;

const FESTIVAL_AWARD_RE =
  /festival|oscar|cannes|berlinale|venice film|venice\b|sundance|tribeca|bafta|golden globe|palme d|award|nomination|sxsw|rotterdam|tiff\b|toronto international|bfi london|locarno|karlovy|telluride|independent spirit/i;

export type CrewRow = { job: string; people: { id: number; name: string }[] };

/**
 * Collapse duplicate credits per job, keeping one entry per person id (TMDb)
 * so filmography links stay unambiguous.
 */
export function buildCrewRows(crew: TmdbCrewEntry[] | undefined, maxExtraJobs = 14): CrewRow[] {
  if (!crew?.length) return [];
  const byJob = new Map<string, Map<number, string>>();
  for (const c of crew) {
    const job = c.job?.trim();
    if (!job || !c.id) continue;
    let inner = byJob.get(job);
    if (!inner) {
      inner = new Map();
      byJob.set(job, inner);
    }
    inner.set(c.id, c.name);
  }

  const rows: CrewRow[] = [];
  const used = new Set<string>();
  for (const job of CREW_JOB_PRIORITY) {
    const inner = byJob.get(job);
    if (!inner?.size) continue;
    used.add(job);
    rows.push({
      job,
      people: [...inner.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  const rest = [...byJob.keys()]
    .filter((j) => !used.has(j))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, maxExtraJobs);
  for (const job of rest) {
    const inner = byJob.get(job)!;
    rows.push({
      job,
      people: [...inner.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  }
  return rows;
}

/** Narrow shape for `<CreditsCrawl>` — trims long crew lists without losing department order. */
export type CreditsCrawlLineSeed = { role: string; people: string[] };

/**
 * Turns `buildCrewRows` output into slow-crawl segments (JOB line + capped names below).
 */
export function crewRowsToCreditsCrawlLines(
  rows: CrewRow[],
  opts?: { maxNamesPerRole?: number; maxRoles?: number },
): CreditsCrawlLineSeed[] {
  const maxNamesPerRole = opts?.maxNamesPerRole ?? 10;
  const maxRoles = opts?.maxRoles ?? 44;
  return rows.slice(0, maxRoles).map((row) => ({
    role: row.job.toUpperCase(),
    people: row.people.slice(0, maxNamesPerRole).map((p) => p.name),
  }));
}

export type PremiereRow = { region: string; date: string; note?: string; kind: "Premiere" | "Limited" };

/**
 * TMDb uses ISO date strings; JSONB round-trips or clients may deserialize to `Date`.
 * Coerce to `YYYY-MM-DD` before sorting or displaying.
 */
function tmdbDayStamp(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const s = raw.trim();
    return s.length >= 10 ? s.slice(0, 10) : s || null;
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  return null;
}

/**
 * TMDb release `type` 1 = Premiere, 2 = Limited theatrical — closest proxy to
 * festival / platform bows without a dedicated awards API.
 */
export function extractPremiereRows(
  release_dates:
    | {
        results: {
          iso_3166_1: string;
          release_dates: {
            certification: string;
            note?: string;
            release_date: unknown;
            type: number;
          }[];
        }[];
      }
    | undefined,
): PremiereRow[] {
  if (!release_dates?.results?.length) return [];
  const rows: PremiereRow[] = [];
  for (const block of release_dates.results) {
    for (const rd of block.release_dates ?? []) {
      if (rd.type !== 1 && rd.type !== 2) continue;
      const d = tmdbDayStamp(rd.release_date);
      if (!d) continue;
      const kind: PremiereRow["kind"] = rd.type === 1 ? "Premiere" : "Limited";
      rows.push({
        region: block.iso_3166_1,
        date: d,
        note: rd.note?.trim() || undefined,
        kind,
      });
    }
  }
  const seen = new Set<string>();
  const deduped = rows.filter((r) => {
    const k = `${r.region}-${r.date}-${r.kind}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  deduped.sort((a, b) => a.date.localeCompare(b.date) || a.region.localeCompare(b.region));
  return deduped;
}

export function festivalAndAwardKeywordNames(
  keywords: { id: number; name: string }[] | undefined,
): string[] {
  if (!keywords?.length) return [];
  const hits = keywords.filter((k) => FESTIVAL_AWARD_RE.test(k.name)).map((k) => k.name);
  return [...new Set(hits)].sort((a, b) => a.localeCompare(b));
}

/**
 * Prefer TMDb recommendations, then similar titles — de-duplicated for rails.
 */
export function mergeMoreLikeThis(
  recommendations: { results?: TmdbMovieSummary[] } | undefined,
  similar: { results?: TmdbMovieSummary[] } | undefined,
  limit = 18,
): TmdbMovieSummary[] {
  const seen = new Set<number>();
  const out: TmdbMovieSummary[] = [];
  for (const list of [recommendations?.results, similar?.results]) {
    if (!list?.length) continue;
    for (const m of list) {
      if (!m?.id) continue;
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
