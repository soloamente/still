import { db, staffUserNote } from "@still/db";
import { desc, eq } from "drizzle-orm";

import { makeId } from "./cuid";

export type StaffUserNote = {
	id: string;
	userId: string;
	authorId: string;
	body: string;
	createdAt: Date;
};

/**
 * Newest-first chronological log for a user — append-only, mirrors
 * `writeAuditLog`'s accountability model. No update/delete counterparts exist.
 */
export async function listStaffUserNotes(
	userId: string,
): Promise<StaffUserNote[]> {
	return db
		.select()
		.from(staffUserNote)
		.where(eq(staffUserNote.userId, userId))
		.orderBy(desc(staffUserNote.createdAt));
}

export async function addStaffUserNote(entry: {
	userId: string;
	authorId: string;
	body: string;
}): Promise<StaffUserNote> {
	const id = makeId("note");
	const createdAt = new Date();
	await db.insert(staffUserNote).values({
		id,
		userId: entry.userId,
		authorId: entry.authorId,
		body: entry.body,
	});
	return {
		id,
		userId: entry.userId,
		authorId: entry.authorId,
		body: entry.body,
		createdAt,
	};
}
