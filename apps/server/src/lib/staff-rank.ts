import { type AppRole, STAFF_ROLES } from "@still/auth/permissions";

// Highest first in STAFF_ROLES => higher index value via reverse lookup.
const ORDER: AppRole[] = [...STAFF_ROLES].reverse(); // [support, moderator, admin, owner]

export function rankOf(role: string | null | undefined): number {
	if (!role) return 0; // user
	const idx = ORDER.indexOf(role as AppRole);
	return idx < 0 ? 0 : idx + 1; // user=0, support=1, ... owner=4
}

/** True when `actorRole` is strictly higher than `targetRole`. */
export function outranks(
	actorRole: string | null | undefined,
	targetRole: string | null | undefined,
): boolean {
	return rankOf(actorRole) > rankOf(targetRole);
}
