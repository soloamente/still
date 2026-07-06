import { recomputeUserTasteSignature } from "./recompute-user-taste-signature";
import {
	TASTE_SIGNATURE_VERSION,
	type TasteArchetype,
	type TasteSignaturePayload,
} from "./sense-taste-signature";

/** Archetypes that show a persona pill — require stored `pillLabel` (v4 lexicon). */
const PILL_PERSONA_ARCHETYPES = new Set<TasteArchetype>([
	"genre-purist",
	"genre-led",
	"dual-affinity",
	"eclectic",
]);

function tasteArchetypeNeedsPillLabel(
	archetype: unknown,
): archetype is TasteArchetype {
	return (
		typeof archetype === "string" &&
		PILL_PERSONA_ARCHETYPES.has(archetype as TasteArchetype)
	);
}

/** True when cached JSON predates archetype + dual-headline shape. */
export function isStaleTasteSignature(value: unknown): boolean {
	if (value == null || typeof value !== "object") return true;
	const row = value as Record<string, unknown>;
	if (typeof row.headlineVisitor !== "string" || !row.headlineVisitor.trim()) {
		return true;
	}
	if (typeof row.archetype !== "string" || !row.archetype.trim()) {
		return true;
	}
	if (row.version !== TASTE_SIGNATURE_VERSION) {
		return true;
	}
	// v4 rows saved before persona pills shipped — recompute once for pillLabel.
	if (tasteArchetypeNeedsPillLabel(row.archetype)) {
		const pillLabel = row.pillLabel;
		if (typeof pillLabel !== "string" || !pillLabel.trim()) {
			return true;
		}
	}
	return false;
}

/**
 * Rebuilds taste copy when the profile cache is legacy — one-time per patron after deploy.
 */
export async function ensureFreshTasteSignature(
	userId: string,
	cached: unknown,
): Promise<TasteSignaturePayload | null> {
	if (!isStaleTasteSignature(cached)) {
		return cached as TasteSignaturePayload;
	}
	try {
		return await recomputeUserTasteSignature(userId);
	} catch (err) {
		console.error("[taste-signature] refresh failed", userId, err);
		return null;
	}
}
