import { type PlanTierId, parsePlanTierId } from "@still/plans";
import type { CSSProperties } from "react";

/** Coerce unknown API values (missing field on stale payloads) to a tier. */
export function resolveAvatarAuraTier(value: unknown): PlanTierId {
	return parsePlanTierId(value);
}

/** Free tier renders the plain portrait — no rim, no hover effect. */
export function hasAvatarAura(
	tier: PlanTierId,
): tier is Exclude<PlanTierId, "still"> {
	return tier !== "still";
}

type PaidTier = Exclude<PlanTierId, "still">;

/**
 * Rest-state rim gradients — the static tier cue. Muted stops so the rim reads
 * as chrome, not a notification ring; hover effects carry the spectacle.
 */
const RIM_GRADIENTS: Record<PaidTier, string> = {
	attuned:
		"conic-gradient(from 210deg, oklch(0.62 0.07 75), oklch(0.48 0.05 60), oklch(0.7 0.09 85), oklch(0.62 0.07 75))",
	immersed:
		"conic-gradient(from 210deg, oklch(0.78 0.12 85), oklch(0.6 0.1 70), oklch(0.85 0.13 95), oklch(0.78 0.12 85))",
	devoted:
		"conic-gradient(from 210deg, oklch(0.75 0.1 320), oklch(0.78 0.11 200), oklch(0.8 0.12 90), oklch(0.74 0.1 260), oklch(0.75 0.1 320))",
};

export function avatarAuraRimStyle(tier: PaidTier): CSSProperties {
	return { background: RIM_GRADIENTS[tier] };
}
