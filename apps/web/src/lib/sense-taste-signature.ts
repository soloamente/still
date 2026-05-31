export type TasteSignatureConfidence = "low" | "medium" | "high";

export interface TasteSignatureJson {
	headline: string;
	confidence: TasteSignatureConfidence;
}

export function parseTasteSignatureJson(
	value: unknown,
): TasteSignatureJson | null {
	if (!value || typeof value !== "object") return null;
	const o = value as Record<string, unknown>;
	if (typeof o.headline !== "string" || !o.headline.trim()) return null;
	const confidence = o.confidence;
	if (
		confidence !== "low" &&
		confidence !== "medium" &&
		confidence !== "high"
	) {
		return { headline: o.headline.trim(), confidence: "low" };
	}
	return { headline: o.headline.trim(), confidence };
}
