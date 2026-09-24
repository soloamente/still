/** Omitted `media` keeps today's movie routes. `tv` is the only filter. */
export type TodayMediaParam = "all" | "tv" | "invalid";

export function parseTodayMediaParam(raw: string | undefined): TodayMediaParam {
	const value = raw?.trim() ?? "";
	if (value === "") return "all";
	if (value === "tv") return "tv";
	return "invalid";
}
