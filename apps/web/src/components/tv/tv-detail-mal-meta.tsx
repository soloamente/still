import {
	formatTvMalEnrichmentLine,
	type TvMalEnrichment,
} from "@/lib/tv-mal-enrichment";

/** Secondary MAL metadata line in TV About — not hero chrome; hidden when unavailable. */
export function TvDetailMalMeta({
	malEnrichment,
}: {
	malEnrichment: TvMalEnrichment | null | undefined;
}) {
	const line = formatTvMalEnrichmentLine(malEnrichment);
	if (!line) return null;

	return (
		<p className="text-center text-muted-foreground text-sm tabular-nums">
			{line}
		</p>
	);
}
