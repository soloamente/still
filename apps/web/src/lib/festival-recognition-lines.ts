import type {
	FestivalIconId,
	FestivalRecognitionEntry,
} from "@/lib/movie-festival-recognition";

const YEAR_ONLY = /^\d{4}$/;

/** Pairs flat `[year, detail, …]` lines into one block per award. */
export function groupFestivalDetailLines(
	lines: string[],
): Array<{ year: string | null; detail: string | null }> {
	const groups: Array<{ year: string | null; detail: string | null }> = [];
	let index = 0;

	while (index < lines.length) {
		const current = lines[index] ?? "";
		const next = lines[index + 1];
		const currentIsYear = YEAR_ONLY.test(current.trim());
		const nextIsDetail =
			next != null && next.length > 0 && !YEAR_ONLY.test(next.trim());

		if (currentIsYear && nextIsDetail) {
			groups.push({ year: current, detail: next });
			index += 2;
			continue;
		}

		if (currentIsYear) {
			groups.push({ year: current, detail: null });
			index += 1;
			continue;
		}

		groups.push({ year: null, detail: current });
		index += 1;
	}

	return groups;
}

export type FestivalAchievementStatus = "won" | "nominated";

/** Pull Won / Nominated out of `Winner: …` / `Nominee: …` detail copy for pill chips. */
export function parseFestivalAchievementDetail(detail: string): {
	status: FestivalAchievementStatus | null;
	label: string;
} {
	const trimmed = detail.trim();
	if (!trimmed) {
		return { status: null, label: "" };
	}

	const winnerMatch = /^winner:\s*(.+)$/i.exec(trimmed);
	if (winnerMatch?.[1]) {
		return { status: "won", label: winnerMatch[1].trim() };
	}

	const nomineeMatch = /^nominee:\s*(.+)$/i.exec(trimmed);
	if (nomineeMatch?.[1]) {
		return { status: "nominated", label: nomineeMatch[1].trim() };
	}

	// Aggregate / keyword nomination lines without a Winner:/Nominee: prefix.
	if (/\bnominations?\b/i.test(trimmed)) {
		return { status: "nominated", label: trimmed };
	}

	return { status: null, label: trimmed };
}

export type FestivalRecognitionListRow = {
	id: string;
	icon: FestivalIconId;
	/** Festival / award body name (e.g. Academy Awards). */
	festivalTitle: string;
	year: string | null;
	status: FestivalAchievementStatus | null;
	/** Category or note with status prefix stripped (e.g. Best Actor). */
	achievement: string | null;
};

function statusSortRank(status: FestivalAchievementStatus | null): number {
	if (status === "won") return 0;
	if (status === null) return 1;
	return 2;
}

/**
 * Flatten festival columns into person-awards-style list rows.
 * Wins first, then status-less lines, then nominations (stable within each band).
 */
export function buildFestivalRecognitionListRows(
	entries: FestivalRecognitionEntry[],
): FestivalRecognitionListRow[] {
	const rows: FestivalRecognitionListRow[] = [];

	for (const entry of entries) {
		const groups = groupFestivalDetailLines(entry.lines);
		if (groups.length === 0) {
			rows.push({
				id: entry.id,
				icon: entry.icon,
				festivalTitle: entry.title,
				year: null,
				status: null,
				achievement: null,
			});
			continue;
		}

		for (const [i, group] of groups.entries()) {
			const parsed = group.detail
				? parseFestivalAchievementDetail(group.detail)
				: { status: null as FestivalAchievementStatus | null, label: "" };
			const achievement = parsed.label.trim() || null;
			rows.push({
				id: `${entry.id}:${i}:${group.year ?? ""}:${group.detail ?? ""}`,
				icon: entry.icon,
				festivalTitle: entry.title,
				year: group.year,
				status: parsed.status,
				achievement,
			});
		}
	}

	return rows
		.map((row, index) => ({ row, index }))
		.sort((a, b) => {
			const byStatus =
				statusSortRank(a.row.status) - statusSortRank(b.row.status);
			return byStatus !== 0 ? byStatus : a.index - b.index;
		})
		.map(({ row }) => row);
}
