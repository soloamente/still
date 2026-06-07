import { db, staffAuditLog } from "@still/db";

import { makeId } from "./cuid";

export type AuditTargetType =
	| "user"
	| "review"
	| "list"
	| "post"
	| "comment"
	| "log";

export async function writeAuditLog(entry: {
	actorId: string;
	action: string;
	targetType: AuditTargetType;
	targetId: string;
	reason?: string | null;
	metadata?: Record<string, unknown>;
}): Promise<void> {
	await db.insert(staffAuditLog).values({
		id: makeId("aud"),
		actorId: entry.actorId,
		action: entry.action,
		targetType: entry.targetType,
		targetId: entry.targetId,
		reason: entry.reason ?? null,
		metadata: entry.metadata ?? {},
	});
}
