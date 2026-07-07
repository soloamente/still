import { formatDate } from "@/lib/format";

/** One raised fact tile in the person detail hero. */
export type PersonDetailInfoCard = {
	id: string;
	label: string;
	value: string;
};

/** TMDb person payload fields used to build hero fact cards. */
export type PersonDetailFactsInput = {
	birthday: string | Date | null;
	deathday: string | Date | null;
	placeOfBirth: string | null;
	gender: number | null;
	knownForDepartment?: string | null;
};

const TMDB_GENDER_LABEL: Record<number, string> = {
	1: "Female",
	2: "Male",
	3: "Non-binary",
};

/** Human label for TMDb `gender` (0 = not set). */
export function formatTmdbGenderLabel(
	gender: number | null | undefined,
): string | null {
	if (gender == null || gender === 0) return null;
	return TMDB_GENDER_LABEL[gender] ?? null;
}

/**
 * Eden treaty may revive `birthday` / `deathday` as `Date` on the server.
 * Normalize to TMDb `YYYY-MM-DD` before parsing.
 */
export function normalizeTmdbPersonDate(value: unknown): string | null {
	if (value == null) return null;
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return null;
		const year = value.getUTCFullYear();
		const month = String(value.getUTCMonth() + 1).padStart(2, "0");
		const day = String(value.getUTCDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}
	return null;
}

/** Parse TMDb `YYYY-MM-DD` strings; month/day `00` means unknown. */
function parseTmdbDateParts(
	value: string | Date | null | undefined,
): { year: number; month: number | null; day: number | null } | null {
	const iso = normalizeTmdbPersonDate(value);
	if (!iso) return null;
	const [yearRaw, monthRaw, dayRaw] = iso.split("-");
	const year = Number(yearRaw);
	if (!Number.isFinite(year) || year <= 0) return null;

	const monthNum = monthRaw ? Number(monthRaw) : Number.NaN;
	const dayNum = dayRaw ? Number(dayRaw) : Number.NaN;
	const month =
		Number.isFinite(monthNum) && monthNum >= 1 && monthNum <= 12
			? monthNum
			: null;
	const day =
		Number.isFinite(dayNum) && dayNum >= 1 && dayNum <= 31 ? dayNum : null;

	return { year, month, day };
}

function tmdbDateToDisplay(
	value: string | Date | null | undefined,
): string | null {
	const parts = parseTmdbDateParts(value);
	if (!parts) return null;

	if (parts.month != null && parts.day != null) {
		return formatDate(
			new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)),
		);
	}
	if (parts.month != null) {
		return formatDate(new Date(Date.UTC(parts.year, parts.month - 1, 1, 12)), {
			month: "long",
			year: "numeric",
		});
	}
	return String(parts.year);
}

/**
 * Whole-year age between two TMDb dates. Returns null when birthday year
 * alone is not enough (needs at least year + month for a stable count).
 */
export function computePersonAgeYears(
	birthday: string | Date | null | undefined,
	asOfIso: string | Date | null | undefined,
): number | null {
	const birth = parseTmdbDateParts(birthday);
	const asOf = parseTmdbDateParts(
		asOfIso ?? new Date().toISOString().slice(0, 10),
	);
	if (!birth || !asOf) return null;

	// Year-only birthdays cannot produce a meaningful age.
	if (birth.month == null || birth.day == null) return null;
	if (asOf.month == null || asOf.day == null) return null;

	let age = asOf.year - birth.year;
	const beforeBirthday =
		asOf.month < birth.month ||
		(asOf.month === birth.month && asOf.day < birth.day);
	if (beforeBirthday) age -= 1;
	return age >= 0 ? age : null;
}

/** Build hero fact cards from TMDb person metadata. */
export function buildPersonDetailInfoCards(
	person: PersonDetailFactsInput,
): PersonDetailInfoCard[] {
	const cards: PersonDetailInfoCard[] = [];

	const birthday = normalizeTmdbPersonDate(person.birthday);
	const deathday = normalizeTmdbPersonDate(person.deathday);

	const bornDisplay = tmdbDateToDisplay(birthday);
	if (bornDisplay) {
		cards.push({ id: "born", label: "Born", value: bornDisplay });
	}

	const asOfIso = deathday ?? new Date().toISOString().slice(0, 10);
	const ageYears = computePersonAgeYears(birthday, asOfIso);
	if (ageYears != null) {
		const deceased = Boolean(deathday);
		cards.push({
			id: "age",
			label: deceased ? "Age at death" : "Age",
			value: deceased ? `${ageYears} years old` : `${ageYears} years old`,
		});
	}

	const place = person.placeOfBirth?.trim();
	if (place) {
		// TMDb exposes birthplace, not current residence.
		cards.push({ id: "born-in", label: "Born in", value: place });
	}

	const diedDisplay = tmdbDateToDisplay(deathday);
	if (diedDisplay) {
		cards.push({ id: "died", label: "Died", value: diedDisplay });
	}

	const genderLabel = formatTmdbGenderLabel(person.gender);
	if (genderLabel) {
		cards.push({ id: "gender", label: "Gender", value: genderLabel });
	}

	return cards;
}
