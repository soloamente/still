/**
 * Cast & crew “arc spotlight” — billing order is re-mapped so the lead sits in the
 * visual center and supporting credits fan out toward the edges (Mobbin comp).
 */

export type ArcCreditCard = {
	id: number;
	name: string;
	/** Cast: character; crew: job title. */
	subtitle: string | null;
	profilePath: string | null;
};

/** Default visible slots per arc row (odd count keeps a true center card). */
export const CAST_CREW_ARC_SLOT_COUNT = 11;

/** Narrow viewports — hide outer billing so portraits stay legible. */
export const CAST_CREW_ARC_MOBILE_SLOT_COUNT = 5;

/** Outermost card offset from the row baseline at full width (11-slot row). */
export const CAST_CREW_ARC_EDGE_OFFSET_PX = 80;

/** Gentler arc lift on mobile when fewer slots are visible. */
export const CAST_CREW_ARC_MOBILE_EDGE_OFFSET_PX = 64;

/** Scale down edge translate on mobile — larger cards need a shallower curve. */
export const CAST_CREW_ARC_MOBILE_CURVE_SCALE = 0.82;

/**
 * Bleed arc rows into About column gutters (`MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME`)
 * so outer portraits are not clipped on narrow viewports.
 */
export const CAST_CREW_ARC_COLUMN_BLEED_CLASSNAME =
	"-mx-2.5 w-[calc(100%+1.25rem)] sm:-mx-4 sm:w-[calc(100%+2rem)] md:-mx-5 md:w-[calc(100%+2.5rem)]";

/** How many slots to show — always odd when >1 so one card sits on the arc apex. */
export function arcVisibleSlotCount(
	length: number,
	max = CAST_CREW_ARC_SLOT_COUNT,
): number {
	const capped = Math.min(Math.max(max, 0), length);
	if (capped <= 1) return capped;
	return capped % 2 === 0 ? capped - 1 : capped;
}

/**
 * Reorders the first `visibleCount` billing entries so index 0 (lead) lands in the
 * middle slot and alternates right/left for 2nd, 3rd, … billed.
 */
export function reorderForCenterArc<T>(items: T[], visibleCount: number): T[] {
	const n = arcVisibleSlotCount(items.length, visibleCount);
	if (n === 0) return [];
	const picked = items.slice(0, n);
	if (n === 1) return picked;

	const center = Math.floor(n / 2);
	const result: T[] = Array.from({ length: n });
	result[center] = picked[0] as T;

	let left = center - 1;
	let right = center + 1;
	let billingIdx = 1;

	while (billingIdx < n) {
		if (right < n) {
			result[right] = picked[billingIdx] as T;
			right += 1;
			billingIdx += 1;
		}
		if (billingIdx >= n) break;
		if (left >= 0) {
			result[left] = picked[billingIdx] as T;
			left -= 1;
			billingIdx += 1;
		}
	}

	return result;
}

/**
 * Keeps the visual center of an already arc-ordered row — drops outer slots so
 * mobile can show fewer, larger portraits without clipping off-screen.
 */
export function sliceArcCenterCards<T>(items: T[], maxVisible: number): T[] {
	const n = arcVisibleSlotCount(items.length, maxVisible);
	if (n >= items.length) return items;

	const center = Math.floor(items.length / 2);
	const half = Math.floor(n / 2);
	const start = Math.max(0, center - half);
	return items.slice(start, start + n);
}

export type ArcRowVisual = {
	/** Vertical offset only — same card size; edges step down/up to form the arc. */
	translateY: number;
};

/**
 * Per-slot vertical offset for a symmetric arc: center stays on the baseline;
 * cast edges move down, crew edges move up (mirrored curve).
 *
 * Uses a normalized parabola so the first step away from center is visible (~14px
 * on an 11-slot row) — the old `distance² * 2` formula left neighbors at ~2px.
 */
export function arcRowVisualForSlot(
	slotIndex: number,
	slotCount: number,
	row: "cast" | "crew",
): ArcRowVisual {
	if (slotCount <= 1) return { translateY: 0 };

	const center = (slotCount - 1) / 2;
	const distance = Math.abs(slotIndex - center);
	const maxDistance = Math.max(center, 1);
	const t = distance / maxDistance;
	// Slightly gentler than t² so mid-row cards still read as an arc, not a flat plateau.
	const curve = t ** 1.35 * CAST_CREW_ARC_EDGE_OFFSET_PX;
	const translateY = row === "cast" ? curve : -curve;

	return { translateY };
}

export function mapCastToArcCards(
	cast:
		| {
				id: number;
				name: string;
				character?: string;
				profile_path: string | null;
		  }[]
		| undefined,
	slotCount = CAST_CREW_ARC_SLOT_COUNT,
): ArcCreditCard[] {
	if (!cast?.length) return [];
	const ordered = reorderForCenterArc(cast, slotCount);
	return ordered.map((c) => ({
		id: c.id,
		name: c.name,
		subtitle: c.character?.trim() || null,
		profilePath: c.profile_path,
	}));
}

const ARC_CREW_JOB_PRIORITY = [
	"Director",
	"Co-Director",
	"Writer",
	"Screenplay",
	"Director of Photography",
	"Editor",
	"Original Music Composer",
	"Producer",
	"Executive Producer",
] as const;

/**
 * Picks head crew for the lower arc — one face per prioritized job when possible.
 */
export function mapCrewToArcCards(
	crew:
		| {
				id: number;
				name: string;
				job?: string;
				profile_path: string | null;
		  }[]
		| undefined,
	slotCount = CAST_CREW_ARC_SLOT_COUNT,
): ArcCreditCard[] {
	if (!crew?.length) return [];

	const byJob = new Map<string, typeof crew>();
	for (const c of crew) {
		const job = c.job?.trim();
		if (!job || !c.id) continue;
		const list = byJob.get(job);
		if (list) list.push(c);
		else byJob.set(job, [c]);
	}

	const picked: (typeof crew)[number][] = [];
	const usedIds = new Set<number>();

	for (const job of ARC_CREW_JOB_PRIORITY) {
		const list = byJob.get(job);
		if (!list?.length) continue;
		const person = list.find((p) => !usedIds.has(p.id)) ?? list[0];
		if (!person || usedIds.has(person.id)) continue;
		usedIds.add(person.id);
		picked.push(person);
		if (picked.length >= slotCount) break;
	}

	if (picked.length < slotCount) {
		for (const c of crew) {
			if (picked.length >= slotCount) break;
			if (usedIds.has(c.id)) continue;
			usedIds.add(c.id);
			picked.push(c);
		}
	}

	const ordered = reorderForCenterArc(picked, slotCount);
	return ordered.map((c) => ({
		id: c.id,
		name: c.name,
		subtitle: c.job?.trim() || null,
		profilePath: c.profile_path,
	}));
}
