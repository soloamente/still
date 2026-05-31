/**
 * Parses Anilist anime list JSON exports into a canonical import shape.
 * Supports Sense canonical files, AniList GraphQL exports, and AniPort-style backups.
 */

export type AnilistImportStatus =
	| "COMPLETED"
	| "CURRENT"
	| "PLANNING"
	| "PAUSED"
	| "DROPPED"
	| "REPEATING";

export interface AnilistImportMedia {
	anilistId: number;
	idMal?: number | null;
	title: {
		userPreferred?: string | null;
		romaji?: string | null;
		english?: string | null;
		native?: string | null;
	};
	startDate?: { year?: number | null };
}

export interface AnilistImportEntry {
	media: AnilistImportMedia;
	status: AnilistImportStatus;
	score?: number | null;
	progress?: number | null;
	repeat?: number | null;
	startedAt?: string | null;
	completedAt?: string | null;
}

const VALID_STATUSES = new Set<string>([
	"COMPLETED",
	"CURRENT",
	"PLANNING",
	"PAUSED",
	"DROPPED",
	"REPEATING",
]);

/** Preferred display title for matching and unmatched reports. */
export function anilistEntryDisplayTitle(entry: AnilistImportEntry): string {
	const t = entry.media.title;
	return (
		t.userPreferred?.trim() ||
		t.english?.trim() ||
		t.romaji?.trim() ||
		t.native?.trim() ||
		`Anilist #${entry.media.anilistId}`
	);
}

/** Distinct TMDb search queries — English first (best TMDb index), then romaji/native. */
export function anilistMediaSearchQueries(media: AnilistImportMedia): string[] {
	const t = media.title;
	const raw = [t.english, t.userPreferred, t.romaji, t.native];
	const out: string[] = [];
	for (const candidate of raw) {
		if (typeof candidate !== "string") continue;
		const trimmed = candidate.trim();
		if (!trimmed || out.includes(trimmed)) continue;
		out.push(trimmed);
	}
	return out;
}

/** Normalize Anilist `title` objects from exports or GraphQL API responses. */
export function normalizeAnilistTitleObject(
	raw: unknown,
): AnilistImportMedia["title"] {
	if (typeof raw === "string") {
		const trimmed = raw.trim();
		if (!trimmed) {
			return { userPreferred: null, romaji: null, english: null, native: null };
		}
		return {
			userPreferred: trimmed,
			english: trimmed,
			romaji: null,
			native: null,
		};
	}
	if (!raw || typeof raw !== "object") {
		return { userPreferred: null, romaji: null, english: null, native: null };
	}
	const o = raw as Record<string, unknown>;
	return {
		userPreferred: typeof o.userPreferred === "string" ? o.userPreferred : null,
		romaji: typeof o.romaji === "string" ? o.romaji : null,
		english: typeof o.english === "string" ? o.english : null,
		native: typeof o.native === "string" ? o.native : null,
	};
}

/** Anilist 0–100 user score → stored diary tenths (0–100). */
export function anilistScoreToStoredTenths(score: number): number {
	if (!Number.isFinite(score)) return 0;
	return Math.min(100, Math.max(0, Math.round(score)));
}

/** Stable dedupe key per user import batch. */
export function anilistImportDedupeKey(entry: AnilistImportEntry): string {
	const day = entry.completedAt?.trim().slice(0, 10) ?? "";
	return `anilist:${entry.media.anilistId}:${entry.status}:${day}`;
}

function parseStatus(raw: unknown): AnilistImportStatus | null {
	if (typeof raw !== "string") return null;
	const upper = raw.trim().toUpperCase();
	return VALID_STATUSES.has(upper) ? (upper as AnilistImportStatus) : null;
}

function normalizeMedia(raw: unknown): AnilistImportMedia | null {
	if (!raw || typeof raw !== "object") return null;
	const m = raw as Record<string, unknown>;
	const anilistId = Number(m.anilistId ?? m.id);
	if (!Number.isFinite(anilistId) || anilistId <= 0) return null;

	const type = typeof m.type === "string" ? m.type.toUpperCase() : "ANIME";
	if (type === "MANGA") return null;

	const title = normalizeAnilistTitleObject(m.title);

	const idMalRaw = m.idMal;
	const idMal =
		idMalRaw != null && Number.isFinite(Number(idMalRaw))
			? Math.floor(Number(idMalRaw))
			: null;

	const startDateRaw = m.startDate;
	const startDate =
		startDateRaw && typeof startDateRaw === "object"
			? {
					year:
						(startDateRaw as Record<string, unknown>).year != null &&
						Number.isFinite(
							Number((startDateRaw as Record<string, unknown>).year),
						)
							? Math.floor(
									Number((startDateRaw as Record<string, unknown>).year),
								)
							: null,
				}
			: undefined;

	return { anilistId: Math.floor(anilistId), idMal, title, startDate };
}

/** Map one raw Anilist list entry object to canonical shape. */
export function normalizeAnilistListEntry(
	raw: unknown,
): AnilistImportEntry | null {
	if (!raw || typeof raw !== "object") return null;
	const row = raw as Record<string, unknown>;

	let media = normalizeMedia(row.media);
	if (!media) {
		// AniPort / flat exports sometimes omit nested `media` but keep mediaId + title on the row.
		const mediaId = Number(row.mediaId ?? row.media_id);
		if (Number.isFinite(mediaId) && mediaId > 0) {
			const idMalRaw = row.idMal ?? row.id_mal;
			const startDateRaw = row.startDate ?? row.start_date;
			media = {
				anilistId: Math.floor(mediaId),
				idMal:
					idMalRaw != null && Number.isFinite(Number(idMalRaw))
						? Math.floor(Number(idMalRaw))
						: null,
				title: normalizeAnilistTitleObject(row.title ?? row.name),
				startDate:
					startDateRaw && typeof startDateRaw === "object"
						? {
								year:
									(startDateRaw as Record<string, unknown>).year != null &&
									Number.isFinite(
										Number((startDateRaw as Record<string, unknown>).year),
									)
										? Math.floor(
												Number((startDateRaw as Record<string, unknown>).year),
											)
										: null,
							}
						: undefined,
			};
		}
	}
	if (!media) return null;
	const status = parseStatus(row.status);
	if (!status) return null;

	const scoreRaw = row.score;
	const score =
		scoreRaw != null && Number.isFinite(Number(scoreRaw))
			? Number(scoreRaw)
			: null;
	const progressRaw = row.progress;
	const progress =
		progressRaw != null && Number.isFinite(Number(progressRaw))
			? Math.max(0, Math.floor(Number(progressRaw)))
			: null;
	const repeatRaw = row.repeat;
	const repeat =
		repeatRaw != null && Number.isFinite(Number(repeatRaw))
			? Math.max(0, Math.floor(Number(repeatRaw)))
			: null;

	const startedAtRaw = row.startedAt ?? row.started_at;
	const completedAtRaw = row.completedAt ?? row.completed_at;

	return {
		media,
		status,
		score,
		progress,
		repeat,
		startedAt:
			typeof startedAtRaw === "string"
				? startedAtRaw
				: typeof startedAtRaw === "number"
					? new Date(startedAtRaw * 1000).toISOString()
					: null,
		completedAt:
			typeof completedAtRaw === "string"
				? completedAtRaw
				: typeof completedAtRaw === "number"
					? new Date(completedAtRaw * 1000).toISOString()
					: null,
	};
}

function collectGraphqlEntries(parsed: Record<string, unknown>): unknown[] {
	const data = parsed.data as Record<string, unknown> | undefined;
	const collection =
		(data?.MediaListCollection as Record<string, unknown> | undefined) ??
		(parsed.MediaListCollection as Record<string, unknown> | undefined);
	const lists = collection?.lists;
	if (!Array.isArray(lists)) return [];
	const out: unknown[] = [];
	for (const list of lists) {
		if (!list || typeof list !== "object") continue;
		const entries = (list as Record<string, unknown>).entries;
		if (Array.isArray(entries)) out.push(...entries);
	}
	return out;
}

/** AniPort backups use `anime` / `manga` top-level arrays. */
export function normalizeAniPortBackup(raw: unknown): AnilistImportEntry[] {
	if (!raw || typeof raw !== "object") return [];
	const root = raw as Record<string, unknown>;
	const anime = root.anime;
	if (Array.isArray(anime)) {
		return anime
			.map((entry) => normalizeAnilistListEntry(entry))
			.filter((e): e is AnilistImportEntry => e != null);
	}
	return [];
}

/**
 * Parse uploaded JSON text into deduped canonical anime entries (manga skipped).
 */
export function parseAnilistImportJson(text: string): AnilistImportEntry[] {
	const trimmed = text.replace(/^\uFEFF/, "").trim();
	if (!trimmed) return [];

	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		return [];
	}

	if (!parsed || typeof parsed !== "object") return [];

	const root = parsed as Record<string, unknown>;
	let rawEntries: unknown[] = [];

	if (
		root.version === 1 &&
		root.source === "anilist" &&
		Array.isArray(root.entries)
	) {
		rawEntries = root.entries;
	} else if (Array.isArray(parsed)) {
		rawEntries = parsed;
	} else {
		const graphql = collectGraphqlEntries(root);
		if (graphql.length > 0) {
			rawEntries = graphql;
		} else {
			const aniport = normalizeAniPortBackup(parsed);
			if (aniport.length > 0) return dedupeAnilistEntries(aniport);
			if (Array.isArray(root.entries)) rawEntries = root.entries;
		}
	}

	const normalized = rawEntries
		.map((entry) => normalizeAnilistListEntry(entry))
		.filter((e): e is AnilistImportEntry => e != null);

	return dedupeAnilistEntries(normalized);
}

/** Last occurrence wins when the same show appears twice in one export. */
export function dedupeAnilistEntries(
	entries: AnilistImportEntry[],
): AnilistImportEntry[] {
	const byId = new Map<number, AnilistImportEntry>();
	for (const entry of entries) {
		byId.set(entry.media.anilistId, entry);
	}
	return [...byId.values()];
}
