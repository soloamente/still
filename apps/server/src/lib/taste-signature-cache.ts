import { recomputeUserTasteSignature } from "./recompute-user-taste-signature";
import {
	TASTE_SIGNATURE_VERSION,
	type TasteSignaturePayload,
} from "./sense-taste-signature";

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
