import type { FestivalIconId } from "@/lib/movie-festival-recognition";
import { resolveFestivalIconFromAwardLabel } from "@/lib/movie-festival-recognition";
import type { WikidataPersonAwardRaw } from "@/lib/wikidata-person-awards";

/** Max wins shown in the person About awards teaser row. */
export const PERSON_AWARDS_TEASER_MAX = 3;

/** Max rows returned for the full awards drawer. */
export const PERSON_AWARDS_DRAWER_MAX = 100;

export type PersonAwardRow = {
	id: string;
	awardLabel: string;
	status: "won" | "nominated";
	year: number | null;
	workTitle: string | null;
	workTmdbId: number | null;
	workMediaKind: "movie" | "tv" | null;
	icon: FestivalIconId;
};

/**
 * Person About prestige — major awards first (Oscars → BAFTA → …), then
 * festivals. Distinct from film `festivalIconPrestigeRank` (Cannes-first
 * `FESTIVAL_RULES` calendar order). Lower = higher prestige.
 */
const PERSON_AWARD_ICON_PRESTIGE_RANK = {
	oscars: 0,
	bafta: 1,
	"golden-globes": 2,
	spirit: 3,
	// Major festivals after awards bodies (no Emmy icon in FestivalIconId yet).
	cannes: 10,
	venice: 11,
	berlinale: 12,
	sundance: 13,
	tiff: 14,
	sxsw: 15,
	tribeca: 16,
	locarno: 17,
	rotterdam: 18,
	telluride: 19,
	busan: 20,
	beyond: 21,
	zurich: 22,
	"mill-valley": 23,
	london: 24,
	mtv: 25,
	// Generic fallbacks last.
	premiere: 100,
	award: 101,
} as const satisfies Record<FestivalIconId, number>;

/** Lower rank = higher prestige for person award sort (not film festival order). */
export function personAwardIconPrestigeRank(icon: FestivalIconId): number {
	return PERSON_AWARD_ICON_PRESTIGE_RANK[icon];
}

/** Maps raw Wikidata awards to sorted UI rows with festival icons. */
export function buildPersonAwardRows(
	raw: WikidataPersonAwardRaw[],
): PersonAwardRow[] {
	const rows: PersonAwardRow[] = raw.map((item, index) => ({
		id: [
			item.status,
			item.awardLabel,
			item.year ?? "na",
			item.workTitle ?? "na",
			item.workTmdbId ?? "na",
			index,
		].join("|"),
		awardLabel: item.awardLabel,
		status: item.status,
		year: item.year,
		workTitle: item.workTitle,
		workTmdbId: item.workTmdbId,
		workMediaKind: item.workMediaKind,
		icon: resolveFestivalIconFromAwardLabel(item.awardLabel),
	}));

	rows.sort((a, b) => {
		if (a.status !== b.status) return a.status === "won" ? -1 : 1;
		const prestige =
			personAwardIconPrestigeRank(a.icon) - personAwardIconPrestigeRank(b.icon);
		if (prestige !== 0) return prestige;
		const ay = a.year ?? -1;
		const by = b.year ?? -1;
		if (ay !== by) return by - ay;
		const labelCmp = a.awardLabel.localeCompare(b.awardLabel);
		if (labelCmp !== 0) return labelCmp;
		return (a.workTitle ?? "").localeCompare(b.workTitle ?? "");
	});

	return rows.slice(0, PERSON_AWARDS_DRAWER_MAX);
}

/** Picks the top wins from already-sorted rows for the About teaser. */
export function pickPersonAwardTeaserWins(
	rows: PersonAwardRow[],
): PersonAwardRow[] {
	return rows
		.filter((row) => row.status === "won")
		.slice(0, PERSON_AWARDS_TEASER_MAX);
}

/** Deep link to the credited work when TMDb id + media kind are known. */
export function personAwardWorkHref(row: PersonAwardRow): string | null {
	if (row.workTmdbId == null || row.workMediaKind == null) return null;
	if (row.workMediaKind === "movie") return `/movies/${row.workTmdbId}`;
	if (row.workMediaKind === "tv") return `/tv/${row.workTmdbId}`;
	return null;
}
