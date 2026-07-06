import { db, notification, user } from "@still/db";
import { userInboxRoomId } from "@still/realtime";
import { inArray } from "drizzle-orm";

import { APP_NAME } from "./app-brand";
import { makeId } from "./cuid";
import { publishRealtimeEvent } from "./realtime-publish";

export interface NotifyStaffDevotedRequestInput {
	patronUserId: string;
	patronHandle: string;
	patronDisplayName: string | null;
}

/** Owner + admin staff accounts that receive Devoted request alerts. */
export async function listDevotedRequestStaffRecipientIds(): Promise<string[]> {
	const rows = await db
		.select({ id: user.id })
		.from(user)
		.where(inArray(user.role, ["owner", "admin"]));
	return rows.map((row) => row.id);
}

/**
 * Alert owner/admin staff inboxes when a patron requests Devoted access.
 * Direct insert (not preference-gated) so operational requests are not missed.
 */
export async function notifyStaffDevotedRequest(
	input: NotifyStaffDevotedRequestInput,
): Promise<void> {
	try {
		const staffUserIds = await listDevotedRequestStaffRecipientIds();
		if (staffUserIds.length === 0) return;

		const display =
			input.patronDisplayName?.trim() || `@${input.patronHandle}` || "A patron";
		const title = "Devoted invite request";
		const body = `${display} (@${input.patronHandle}) requested Devoted access on ${APP_NAME}.`;

		for (const staffUserId of staffUserIds) {
			const notificationId = makeId("ntf");
			await db.insert(notification).values({
				id: notificationId,
				userId: staffUserId,
				kind: "devoted.request",
				title,
				body,
				payload: {
					href: "/staff",
					patronUserId: input.patronUserId,
					patronHandle: input.patronHandle,
				},
			});
			void publishRealtimeEvent(userInboxRoomId(staffUserId), {
				type: "notification.created",
				notificationId,
				kind: "devoted.request",
			});
		}
	} catch (err) {
		console.error("[devoted-request-notification]", err);
	}
}
