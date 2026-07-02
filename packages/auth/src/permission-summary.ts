import { type AppRole, roles } from "./permissions";

export type PermissionSummaryEntry = {
	resource: string;
	action: string;
	label: string;
};

/**
 * Human-readable label per `resource:action`. Covers the resource/action pairs
 * the staff roles in `roles` currently grant (`user`/`content`/`audit`). If a
 * role is later granted a new action — including from `defaultStatements`'s
 * `session` resource — and this map isn't updated, that capability would be
 * silently omitted from the "This role can…" display. The test below guards
 * against that drift. Object key order defines display order (user, content,
 * audit) so the list renders in a stable, predictable sequence.
 */
export const ACTION_LABELS: Record<string, Record<string, string>> = {
	user: {
		list: "View the user list",
		ban: "Ban users",
		unban: "Unban users",
		"set-role": "Change a user's staff role",
		impersonate: "Impersonate a user's account",
		"impersonate-admins": "Impersonate owner and admin accounts",
		edit: "Edit a user's profile",
		note: "Leave internal notes on a user",
		pro: "Grant or revoke complimentary Pro",
	},
	content: {
		hide: "Hide content",
		delete: "Delete content",
		restore: "Restore removed content",
	},
	audit: {
		read: "Read the staff audit log",
	},
	feedback: {
		read: "View patron feedback inbox",
		reply: "Reply to feedback and change ticket status",
	},
};

/**
 * Flat, human-readable list of what a role can actually do — derived purely
 * from the role's granted statements (`roles[role].statements`, no extra DB
 * access). Consumed by `GET /api/staff/users/:id` and rendered as "This role
 * can…" in the user-detail view. Pure + read-only by design (no per-user
 * à la carte overrides — see the spec's "Out of Scope").
 */
export function permissionSummary(role: AppRole): PermissionSummaryEntry[] {
	const granted = roles[role].statements as Record<string, readonly string[]>;
	const entries: PermissionSummaryEntry[] = [];
	for (const [resource, actionLabels] of Object.entries(ACTION_LABELS)) {
		const allowed = granted[resource] ?? [];
		for (const [action, label] of Object.entries(actionLabels)) {
			if (allowed.includes(action)) entries.push({ resource, action, label });
		}
	}
	return entries;
}
