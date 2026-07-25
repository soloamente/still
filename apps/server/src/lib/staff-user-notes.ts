import { db, profile, staffUserNote, user } from "@still/db";
import { desc, eq } from "drizzle-orm";

import { makeId } from "./cuid";

export type StaffUserNote = {
	id: string;
	userId: string;
	authorId: string;
	body: string;
	createdAt: Date;
	/** Patron-facing display name, handle, or auth name — never the raw user id. */
	authorDisplayName: string;
	/** Better Auth role slug on the note author (owner, admin, …). */
	authorRole: string;
};

/** Resolve a staff note author label for staff UI (matches patron feedback notes). */
export function staffUserNoteAuthorLabel(input: {
	authorDisplayName?: string | null;
	authorName?: string | null;
	authorHandle?: string | null;
}): string {
	const displayName = input.authorDisplayName?.trim();
	const name = input.authorName?.trim();
	const handle = input.authorHandle?.trim();

	if (displayName) {
		return handle ? `${displayName} (@${handle})` : displayName;
	}
	if (name) return name;
	if (handle) return `@${handle}`;
	return "Staff";
}

type StaffUserNoteAuthorRow = {
	id: string;
	userId: string;
	authorId: string;
	body: string;
	createdAt: Date;
	authorName: string | null;
	authorDisplayName: string | null;
	authorHandle: string | null;
	authorRole: string | null;
};

function mapStaffUserNoteRow(row: StaffUserNoteAuthorRow): StaffUserNote {
	return {
		id: row.id,
		userId: row.userId,
		authorId: row.authorId,
		body: row.body,
		createdAt: row.createdAt,
		authorDisplayName: staffUserNoteAuthorLabel({
			authorDisplayName: row.authorDisplayName,
			authorName: row.authorName,
			authorHandle: row.authorHandle,
		}),
		authorRole: row.authorRole?.trim() || "user",
	};
}

async function fetchStaffUserNoteWithAuthor(
	noteId: string,
): Promise<StaffUserNote | null> {
	const [row] = await db
		.select({
			id: staffUserNote.id,
			userId: staffUserNote.userId,
			authorId: staffUserNote.authorId,
			body: staffUserNote.body,
			createdAt: staffUserNote.createdAt,
			authorName: user.name,
			authorDisplayName: profile.displayName,
			authorHandle: profile.handle,
			authorRole: user.role,
		})
		.from(staffUserNote)
		.innerJoin(user, eq(staffUserNote.authorId, user.id))
		.leftJoin(profile, eq(staffUserNote.authorId, profile.userId))
		.where(eq(staffUserNote.id, noteId))
		.limit(1);

	return row ? mapStaffUserNoteRow(row) : null;
}

/**
 * Newest-first chronological log for a user — append-only, mirrors
 * `writeAuditLog`'s accountability model. No update/delete counterparts exist.
 */
export async function listStaffUserNotes(
	userId: string,
): Promise<StaffUserNote[]> {
	const rows = await db
		.select({
			id: staffUserNote.id,
			userId: staffUserNote.userId,
			authorId: staffUserNote.authorId,
			body: staffUserNote.body,
			createdAt: staffUserNote.createdAt,
			authorName: user.name,
			authorDisplayName: profile.displayName,
			authorHandle: profile.handle,
			authorRole: user.role,
		})
		.from(staffUserNote)
		.innerJoin(user, eq(staffUserNote.authorId, user.id))
		.leftJoin(profile, eq(staffUserNote.authorId, profile.userId))
		.where(eq(staffUserNote.userId, userId))
		.orderBy(desc(staffUserNote.createdAt));

	return rows.map(mapStaffUserNoteRow);
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

	const enriched = await fetchStaffUserNoteWithAuthor(id);
	if (enriched) return enriched;

	// Fallback when author row is missing — still avoid leaking raw ids in UI.
	return {
		id,
		userId: entry.userId,
		authorId: entry.authorId,
		body: entry.body,
		createdAt,
		authorDisplayName: "Staff",
		authorRole: "user",
	};
}
