import { db, notification } from "@still/db";
import { APP_NAME } from "./app-brand";
import { makeId } from "./cuid";
import { rankOf } from "./staff-rank";

export type RoleChangeDirection = "promoted" | "demoted";

/** Display labels for the role string stored on `user.role`. */
const ROLE_LABELS: Record<string, string> = {
	owner: "Owner",
	admin: "Admin",
	moderator: "Moderator",
	support: "Support",
	user: "Member",
};

export function roleLabel(role: string): string {
	return ROLE_LABELS[role] ?? "Member";
}

/** "the Owner" / "an Admin" / "a Moderator". */
export function roleWithArticle(role: string): string {
	const label = roleLabel(role);
	if (role === "owner") return `the ${label}`;
	if (role === "admin") return `an ${label}`;
	return `a ${label}`;
}

/** Compare rank; null when unchanged (no notification should be sent). */
export function roleChangeDirection(
	previousRole: string,
	newRole: string,
): RoleChangeDirection | null {
	const prev = rankOf(previousRole);
	const next = rankOf(newRole);
	if (next > prev) return "promoted";
	if (next < prev) return "demoted";
	return null;
}

/** Inbox title/body for the stored notification row. */
export function roleChangeNotificationContent(
	direction: RoleChangeDirection,
	newRole: string,
): { title: string; body: string } {
	if (direction === "promoted") {
		return {
			title: `You're now ${roleWithArticle(newRole)}`,
			body: `You've got new staff permissions on ${APP_NAME}.`,
		};
	}
	if (newRole === "user") {
		return {
			title: "Your role has changed",
			body: "You no longer have staff access.",
		};
	}
	return {
		title: "Your role has changed",
		body: `You're now ${roleWithArticle(newRole)} — some staff tools are no longer available.`,
	};
}

export interface NotifyRoleChangeInput {
	userId: string;
	previousRole: string;
	newRole: string;
}

/**
 * Insert a `staff.role_changed` notification when the rank actually changed.
 * Inserted directly (not via deliverNotification) so this account-level event
 * is always delivered, bypassing the user-toggleable preference gate. Never
 * throws — a notification failure must not break the role change.
 */
export async function notifyRoleChanged(
	input: NotifyRoleChangeInput,
): Promise<void> {
	try {
		const direction = roleChangeDirection(input.previousRole, input.newRole);
		if (!direction) return;
		const content = roleChangeNotificationContent(direction, input.newRole);
		await db.insert(notification).values({
			id: makeId("ntf"),
			userId: input.userId,
			kind: "staff.role_changed",
			title: content.title,
			body: content.body,
			payload: {
				direction,
				newRole: input.newRole,
				previousRole: input.previousRole,
			},
		});
	} catch (err) {
		console.error("[role-change-notification]", err);
	}
}
