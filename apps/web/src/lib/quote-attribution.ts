export type QuoteAttributionFields = {
	speaker: string | null;
	timestampLabel: string | null;
};

export type ResolvedQuoteAttribution = {
	speaker: string | null;
	timestampLabel: string | null;
};

/** Pass through speaker and timestamp when the catalogue row has them. */
export function resolveQuoteAttribution({
	speaker,
	timestampLabel,
}: QuoteAttributionFields): ResolvedQuoteAttribution {
	const trimmedSpeaker = speaker?.trim() ?? "";
	const trimmedTimestamp = timestampLabel?.trim() ?? "";

	return {
		speaker: trimmedSpeaker ? trimmedSpeaker : null,
		timestampLabel: trimmedTimestamp ? trimmedTimestamp : null,
	};
}
