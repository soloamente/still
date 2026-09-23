/** Cast vs crew input for favorite-people credit fingerprints and inbox verbs. */
export type PersonCreditRoleInput =
	| { kind: "cast"; character?: string | null }
	| { kind: "crew"; job?: string | null };

function normalizeRolePart(value: string | null | undefined): string {
	return (value ?? "").trim().toLowerCase();
}

/**
 * Stable fingerprint for `person_favorite_credit_seen.role_key`
 * (e.g. `cast:paul atreides` / `crew:director`).
 */
export function personFavoriteRoleKey(input: PersonCreditRoleInput): string {
	if (input.kind === "cast") {
		return `cast:${normalizeRolePart(input.character)}`;
	}
	return `crew:${normalizeRolePart(input.job)}`;
}

/**
 * Inbox / pill verb phrase for alert copy:
 * "stars in" | "directed" | "wrote" | "worked on".
 */
export function personFavoriteRoleLabel(input: PersonCreditRoleInput): string {
	if (input.kind === "cast") {
		return "stars in";
	}
	const job = normalizeRolePart(input.job);
	if (job === "director") return "directed";
	if (
		job === "writer" ||
		job === "screenplay" ||
		job === "story" ||
		job === "teleplay"
	) {
		return "wrote";
	}
	return "worked on";
}
