/** apps/web cannot import @still/auth, so role labels live here locally. */
export const STAFF_ROLES = ["owner", "admin", "moderator", "support"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ROLE_LABELS: Record<string, string> = {
	owner: "Owner",
	admin: "Admin",
	moderator: "Moderator",
	support: "Support",
	user: "Member",
};

export function roleLabel(role: string): string {
	return STAFF_ROLE_LABELS[role] ?? "Member";
}

/** Coerce API/session role strings into a staff rank for avatar badges. */
export function parseStaffRole(value: unknown): StaffRole | null {
	if (typeof value !== "string") return null;
	if ((STAFF_ROLES as readonly string[]).includes(value)) {
		return value as StaffRole;
	}
	return null;
}

/** "the Owner" / "an Admin" / "a Moderator". */
export function roleWithArticle(role: string): string {
	const label = roleLabel(role);
	if (role === "owner") return `the ${label}`;
	if (role === "admin") return `an ${label}`;
	return `a ${label}`;
}
