/** apps/web cannot import @still/auth, so role labels live here locally. */
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

/** "the Owner" / "an Admin" / "a Moderator". */
export function roleWithArticle(role: string): string {
	const label = roleLabel(role);
	if (role === "owner") return `the ${label}`;
	if (role === "admin") return `an ${label}`;
	return `a ${label}`;
}
