import type { PremiereRow } from "@/lib/movie-detail-tmdb";
import type { WikidataMovieAward } from "@/lib/wikidata-movie-awards";

export type FestivalIconId =
	| "cannes"
	| "venice"
	| "berlinale"
	| "oscars"
	| "bafta"
	| "golden-globes"
	| "sundance"
	| "tiff"
	| "sxsw"
	| "tribeca"
	| "locarno"
	| "rotterdam"
	| "telluride"
	| "busan"
	| "beyond"
	| "zurich"
	| "mill-valley"
	| "spirit"
	| "mtv"
	| "london"
	| "premiere"
	| "award";

/** One MUBI-style festival / award column. */
export type FestivalRecognitionEntry = {
	id: string;
	icon: FestivalIconId;
	title: string;
	/** Lines like `2025 | Winner: Grand Prix` (year prefix when known). */
	lines: string[];
};

/** Film detail awards grid — at most two rows of six on large viewports. */
export const MOVIE_FESTIVAL_RECOGNITION_DISPLAY_MAX = 12;
export const MOVIE_FESTIVAL_RECOGNITION_COLUMNS = 6;

export type MovieFestivalRecognitionBuildOptions = {
	/** Cap festival columns; `null` returns every group (awards drawer). */
	limit?: number | null;
};

function resolveRecognitionLimit(
	options?: MovieFestivalRecognitionBuildOptions,
): number | null {
	if (options?.limit === null) return null;
	return options?.limit ?? MOVIE_FESTIVAL_RECOGNITION_DISPLAY_MAX;
}

function shouldStopRecognitionCollect(
	count: number,
	limit: number | null,
): boolean {
	return limit != null && count >= limit;
}

type FestivalRule = {
	id: FestivalIconId;
	test: RegExp;
	title: string;
	strip: RegExp[];
};

const FESTIVAL_RULES: FestivalRule[] = [
	{
		id: "cannes",
		test: /cannes|palme d/i,
		title: "Cannes Film Festival",
		strip: [/cannes/gi, /film festival/gi, /palme d['']?or/gi],
	},
	{
		id: "venice",
		test: /venice/i,
		title: "Venice Film Festival",
		strip: [/venice/gi, /film festival/gi, /mostra/gi],
	},
	{
		id: "berlinale",
		test: /berlinale|berlin film/i,
		title: "Berlin International Film Festival",
		strip: [/berlinale/gi, /berlin/gi, /film festival/gi],
	},
	{
		id: "oscars",
		test: /oscar|academy award/i,
		title: "Academy Awards",
		strip: [/oscars?/gi, /academy awards?/gi, /the academy/gi],
	},
	{
		id: "bafta",
		test: /bafta/i,
		title: "BAFTA Awards",
		strip: [/bafta/gi, /awards?/gi],
	},
	{
		id: "golden-globes",
		test: /golden globe/i,
		title: "Golden Globe Awards",
		strip: [/golden globes?/gi, /awards?/gi],
	},
	{
		id: "sundance",
		test: /sundance/i,
		title: "Sundance Film Festival",
		strip: [/sundance/gi, /film festival/gi],
	},
	{
		id: "tiff",
		test: /tiff|toronto international/i,
		title: "Toronto International Film Festival",
		strip: [/tiff/gi, /toronto/gi, /international/gi, /film festival/gi],
	},
	{
		id: "sxsw",
		test: /sxsw/i,
		title: "South by Southwest",
		strip: [/sxsw/gi, /south by southwest/gi],
	},
	{
		id: "tribeca",
		test: /tribeca/i,
		title: "Tribeca Festival",
		strip: [/tribeca/gi, /film festival/gi],
	},
	{
		id: "locarno",
		test: /locarno/i,
		title: "Locarno Film Festival",
		strip: [/locarno/gi, /film festival/gi],
	},
	{
		id: "rotterdam",
		test: /rotterdam|iffrr/i,
		title: "International Film Festival Rotterdam",
		strip: [/rotterdam/gi, /iffrr?/gi, /film festival/gi, /international/gi],
	},
	{
		id: "telluride",
		test: /telluride/i,
		title: "Telluride Film Festival",
		strip: [/telluride/gi, /film festival/gi],
	},
	{
		id: "busan",
		test: /busan|biff\b|busan international/i,
		title: "Busan International Film Festival",
		strip: [/busan/gi, /biff/gi, /international/gi, /film festival/gi],
	},
	{
		id: "beyond",
		test: /beyond fest|beyondfest/i,
		title: "Beyond Fest",
		strip: [/beyond\s*fest/gi, /beyondfest/gi, /film festival/gi],
	},
	{
		id: "zurich",
		test: /zurich|zff\b|zurich film festival/i,
		title: "Zurich Film Festival",
		strip: [/zurich/gi, /zff/gi, /film festival/gi],
	},
	{
		id: "mill-valley",
		test: /mill valley|mvff\b|mill valley film festival/i,
		title: "Mill Valley Film Festival",
		strip: [/mill valley/gi, /mvff/gi, /film festival/gi],
	},
	{
		id: "spirit",
		test: /independent spirit/i,
		title: "Film Independent Spirit Awards",
		strip: [/independent spirit/gi, /spirit awards?/gi],
	},
	{
		id: "mtv",
		test: /mtv\s*(movie|awards?)|mtv\b/i,
		title: "MTV Movie & TV Awards",
		strip: [/mtv/gi, /movie\s*&?\s*tv/gi, /awards?/gi],
	},
	{
		id: "london",
		test: /bfi london|london film/i,
		title: "BFI London Film Festival",
		strip: [/bfi/gi, /london/gi, /film festival/gi, /lff/gi],
	},
];

function matchRule(name: string): FestivalRule | null {
	return FESTIVAL_RULES.find((rule) => rule.test.test(name)) ?? null;
}

function titleCasePhrase(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed) return trimmed;
	return trimmed.replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractYear(text: string, fallback: number | null): string | null {
	const hit = text.match(/\b(19|20)\d{2}\b/)?.[0];
	if (hit) return hit;
	return fallback != null ? String(fallback) : null;
}

function achievementFromKeyword(
	name: string,
	rule: FestivalRule,
): string | null {
	let detail = name;
	for (const strip of rule.strip) {
		detail = detail.replace(strip, " ");
	}
	detail = detail
		.replace(/\s+/g, " ")
		.trim()
		.replace(/^[-–—|,]+/, "")
		.trim();
	if (!detail || detail.length < 3) return null;
	return prettifyAchievement(detail);
}

function prettifyAchievement(raw: string): string {
	let s = raw.trim();
	if (/^winner\b/i.test(s)) {
		s = s.replace(/^winner\b/i, "Winner:");
	}
	if (/^\d+\s+nomination/i.test(s)) {
		return titleCasePhrase(s.replace(/nomination/i, "nominations"));
	}
	if (/nomination/i.test(s)) {
		s = s.replace(/nomination/i, "Nomination");
	}
	if (/^\d+(st|nd|rd|th)\s+place/i.test(s)) {
		return titleCasePhrase(s);
	}
	return titleCasePhrase(s);
}

/** Year on its own line; achievement (winner/nominee) on the next — no `year | detail` pipe. */
function formatLines(year: string | null, detail: string | null): string[] {
	if (year && detail) return [year, detail];
	if (year) return [year];
	if (detail) return [detail];
	return [];
}

function linesFromKeywords(
	keywords: string[],
	rule: FestivalRule,
	movieYear: number | null,
): string[] {
	const lines: string[] = [];
	const seen = new Set<string>();

	for (const name of keywords) {
		const year = extractYear(name, movieYear);
		const achievement = achievementFromKeyword(name, rule);
		for (const line of formatLines(year, achievement)) {
			if (seen.has(line)) continue;
			seen.add(line);
			lines.push(line);
		}
	}

	if (!lines.length && movieYear != null) {
		lines.push(String(movieYear));
	}

	return lines;
}

/**
 * Groups TMDb festival/award keywords into MUBI-style columns (logo + title + detail lines).
 */
export function buildFestivalRecognitionEntries(
	keywordNames: string[],
	movieYear: number | null,
	limit: number | null = MOVIE_FESTIVAL_RECOGNITION_DISPLAY_MAX,
): FestivalRecognitionEntry[] {
	if (!keywordNames.length) return [];

	const grouped = new Map<
		FestivalIconId,
		{ rule: FestivalRule; keywords: string[] }
	>();
	const unknown: string[] = [];

	for (const name of keywordNames) {
		const rule = matchRule(name);
		if (rule) {
			const bucket = grouped.get(rule.id) ?? { rule, keywords: [] };
			bucket.keywords.push(name);
			grouped.set(rule.id, bucket);
		} else {
			unknown.push(name);
		}
	}

	const entries: FestivalRecognitionEntry[] = [];

	for (const rule of FESTIVAL_RULES) {
		const bucket = grouped.get(rule.id);
		if (!bucket) continue;
		const lines = linesFromKeywords(bucket.keywords, rule, movieYear);
		entries.push({
			id: rule.id,
			icon: rule.id,
			title: rule.title,
			lines,
		});
	}

	for (const name of unknown) {
		if (shouldStopRecognitionCollect(entries.length, limit)) break;
		const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		const year = extractYear(name, movieYear);
		const detailLines = formatLines(year, prettifyAchievement(name));
		entries.push({
			id,
			icon: "award",
			title: titleCasePhrase(name),
			lines:
				detailLines.length > 0
					? detailLines
					: movieYear != null
						? [String(movieYear)]
						: [],
		});
	}

	return entries;
}

function achievementFromWikidataAward(
	award: WikidataMovieAward,
	rule: FestivalRule,
): string {
	let detail = award.awardLabel;
	for (const strip of rule.strip) {
		detail = detail.replace(strip, " ");
	}
	detail = detail
		.replace(/academy awards?\s+for\s+/gi, "")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/^for\s+/i, "")
		.trim();
	if (!detail || detail.length < 3) {
		detail = award.awardLabel.replace(/^academy award for /i, "").trim();
	}
	const label = prettifyAchievement(detail);
	if (award.status === "won") {
		if (/^winner:/i.test(label)) return label;
		return `Winner: ${label}`;
	}
	if (/^nominee:/i.test(label) || /nomination/i.test(label)) return label;
	return `Nominee: ${label}`;
}

function linesFromWikidataAwards(
	awards: WikidataMovieAward[],
	rule: FestivalRule,
	movieYear: number | null,
): string[] {
	const lines: string[] = [];
	const seen = new Set<string>();

	for (const award of awards) {
		const year =
			award.year != null
				? String(award.year)
				: extractYear(award.awardLabel, movieYear);
		const achievement = achievementFromWikidataAward(award, rule);
		for (const line of formatLines(year, achievement)) {
			if (seen.has(line)) continue;
			seen.add(line);
			lines.push(line);
		}
	}

	return lines;
}

/** Groups Wikidata P166 / P1411 awards into festival columns with Winner / Nominee lines. */
export function buildFestivalRecognitionFromWikidataAwards(
	awards: WikidataMovieAward[],
	movieYear: number | null,
	limit: number | null = MOVIE_FESTIVAL_RECOGNITION_DISPLAY_MAX,
): FestivalRecognitionEntry[] {
	if (!awards.length) return [];

	const grouped = new Map<
		FestivalIconId,
		{ rule: FestivalRule; awards: WikidataMovieAward[] }
	>();
	const unknown: WikidataMovieAward[] = [];

	for (const award of awards) {
		const rule = matchRule(award.awardLabel);
		if (rule) {
			const bucket = grouped.get(rule.id) ?? { rule, awards: [] };
			bucket.awards.push(award);
			grouped.set(rule.id, bucket);
		} else {
			unknown.push(award);
		}
	}

	const entries: FestivalRecognitionEntry[] = [];

	for (const rule of FESTIVAL_RULES) {
		const bucket = grouped.get(rule.id);
		if (!bucket) continue;
		const lines = linesFromWikidataAwards(
			bucket.awards,
			bucket.rule,
			movieYear,
		);
		if (!lines.length) continue;
		entries.push({
			id: `wd-${rule.id}`,
			icon: rule.id,
			title: rule.title,
			lines,
		});
	}

	for (const award of unknown) {
		if (shouldStopRecognitionCollect(entries.length, limit)) break;
		const id = award.awardLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		const year =
			award.year != null
				? String(award.year)
				: extractYear(award.awardLabel, movieYear);
		const prefix = award.status === "won" ? "Winner" : "Nominee";
		const detailLines = formatLines(
			year,
			`${prefix}: ${titleCasePhrase(award.awardLabel)}`,
		);
		entries.push({
			id: `wd-${id}`,
			icon: "award",
			title: titleCasePhrase(award.awardLabel),
			lines: detailLines,
		});
	}

	return entries;
}

function mergeFestivalRecognitionEntries(
	...lists: FestivalRecognitionEntry[][]
): FestivalRecognitionEntry[] {
	const byIcon = new Map<FestivalIconId, FestivalRecognitionEntry>();

	for (const list of lists) {
		for (const entry of list) {
			const key = entry.icon;
			const existing = byIcon.get(key);
			if (!existing) {
				byIcon.set(key, { ...entry, lines: [...entry.lines] });
				continue;
			}
			const lineSet = new Set(existing.lines);
			for (const line of entry.lines) {
				if (!lineSet.has(line)) {
					existing.lines.push(line);
					lineSet.add(line);
				}
			}
		}
	}

	const ordered: FestivalRecognitionEntry[] = [];
	const seen = new Set<FestivalIconId>();
	for (const rule of FESTIVAL_RULES) {
		const entry = byIcon.get(rule.id);
		if (entry) {
			ordered.push(entry);
			seen.add(rule.id);
		}
	}
	for (const [key, entry] of byIcon) {
		if (!seen.has(key)) ordered.push(entry);
	}
	return ordered;
}

function augmentPremiereFestivals(
	existing: FestivalRecognitionEntry[],
	premiereRows: PremiereRow[],
	movieYear: number | null,
	limit: number | null = MOVIE_FESTIVAL_RECOGNITION_DISPLAY_MAX,
): FestivalRecognitionEntry[] {
	const coveredIcons = new Set(existing.map((e) => e.icon));
	const extras: FestivalRecognitionEntry[] = [];

	for (const row of premiereRows) {
		const icon = premiereIconFromRow(row);
		if (icon === "premiere" || icon === "award") continue;
		if (coveredIcons.has(icon)) continue;
		const year =
			row.date.length >= 4
				? row.date.slice(0, 4)
				: extractYear(row.note ?? "", movieYear);
		const detailLines = formatLines(year, "Festival screening");
		if (!detailLines.length) continue;
		coveredIcons.add(icon);
		extras.push({
			id: `premiere-${icon}-${row.region}-${row.date}`,
			icon,
			title: premiereTitleFromRow(row),
			lines: detailLines,
		});
	}

	const combined = [...existing, ...extras];
	return limit == null ? combined : combined.slice(0, limit);
}

function premiereTitleFromRow(row: PremiereRow): string {
	const note = row.note?.trim();
	if (note) {
		const rule = matchRule(note);
		if (rule) return rule.title;
		return titleCasePhrase(note);
	}
	return row.kind === "Premiere" ? "Festival premiere" : "Limited theatrical";
}

function premiereIconFromRow(row: PremiereRow): FestivalIconId {
	const note = row.note?.trim();
	if (note) {
		const rule = matchRule(note);
		if (rule) return rule.id;
	}
	return row.kind === "Premiere" ? "premiere" : "award";
}

/** Year + nomination/achievement under the festival column title (same shape as keyword rows). */
function premiereAchievementFromRow(row: PremiereRow): string {
	const note = row.note?.trim();
	if (note) {
		const rule = matchRule(note);
		if (rule) {
			const fromNote = achievementFromKeyword(note, rule);
			if (fromNote) return fromNote;
			// Release note is only the festival name — avoid a generic "Premiere" line.
			return "Festival screening";
		}
	}
	if (row.kind === "Limited") return "Limited theatrical";
	return row.kind === "Premiere" ? "Festival screening" : "Release";
}

function premiereLinesFromRow(row: PremiereRow): string[] {
	const year =
		row.date.length >= 4
			? row.date.slice(0, 4)
			: extractYear(row.note ?? "", null);
	return formatLines(year, premiereAchievementFromRow(row));
}

/** When there are no festival keywords, surface premiere rows as simple columns. */
export function premiereEntriesFromRows(
	rows: PremiereRow[],
	limit: number | null = MOVIE_FESTIVAL_RECOGNITION_DISPLAY_MAX,
): FestivalRecognitionEntry[] {
	const scoped = limit == null ? rows : rows.slice(0, limit);
	return scoped.map((r) => {
		const title = premiereTitleFromRow(r);
		return {
			id: `premiere-${r.region}-${r.date}-${r.kind}-${r.note ?? ""}`,
			icon: premiereIconFromRow(r),
			title,
			lines: premiereLinesFromRow(r),
		};
	});
}

export function buildMovieRecognitionEntries(
	keywordNames: string[],
	premiereRows: PremiereRow[],
	movieYear: number | null,
	wikidataAwards: WikidataMovieAward[] = [],
	options?: MovieFestivalRecognitionBuildOptions,
): FestivalRecognitionEntry[] {
	const limit = resolveRecognitionLimit(options);
	const fromWikidata = buildFestivalRecognitionFromWikidataAwards(
		wikidataAwards,
		movieYear,
		limit,
	);
	const fromKeywords = buildFestivalRecognitionEntries(
		keywordNames,
		movieYear,
		limit,
	);
	const merged = mergeFestivalRecognitionEntries(fromWikidata, fromKeywords);

	if (merged.length > 0) {
		return augmentPremiereFestivals(merged, premiereRows, movieYear, limit);
	}

	return premiereEntriesFromRows(premiereRows, limit);
}
