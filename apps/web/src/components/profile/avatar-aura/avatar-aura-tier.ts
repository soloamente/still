import { type PlanTierId, parsePlanTierId } from "@still/plans";

import { parseStaffRole } from "@/lib/staff-role-labels";

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

export type AvatarAuraVisual =
	| { kind: "none" }
	| { kind: "staff" }
	| { kind: "plan"; tier: PaidTier };

/** Staff badge wins over subscription tier when both apply. */
export function resolveAvatarAuraVisual(opts: {
	planTier?: unknown;
	staffRole?: unknown;
}): AvatarAuraVisual {
	if (parseStaffRole(opts.staffRole)) {
		return { kind: "staff" };
	}
	const tier = resolveAvatarAuraTier(opts.planTier);
	if (hasAvatarAura(tier)) {
		return { kind: "plan", tier };
	}
	return { kind: "none" };
}

export function hasAvatarAuraVisual(visual: AvatarAuraVisual): boolean {
	return visual.kind !== "none";
}

/** Modifier class for tier-specific static rims in globals.css. */
export function avatarAuraTierClassName(tier: PaidTier): string {
	return `avatar-aura-rim--${tier}`;
}

export function avatarAuraVisualClassName(
	visual: AvatarAuraVisual,
): string | null {
	if (visual.kind === "staff") return "avatar-aura-rim--staff";
	if (visual.kind === "plan") return avatarAuraTierClassName(visual.tier);
	return null;
}

/** Kept for tests — rim paint lives in CSS for animated conic rims. */
export function avatarAuraRimStyle(_tier: PaidTier): Record<string, never> {
	return {};
}
