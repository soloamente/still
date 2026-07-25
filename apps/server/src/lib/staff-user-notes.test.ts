import { beforeEach, describe, expect, mock, test } from "bun:test";

type NoteRow = {
	id: string;
	userId: string;
	authorId: string;
	body: string;
	createdAt: Date;
};

type AuthorProfile = {
	displayName: string | null;
	handle: string | null;
	name: string | null;
	role: string | null;
};

const state: {
	rows: NoteRow[];
	inserted: Array<Record<string, unknown>>;
	authors: Record<string, AuthorProfile>;
} = {
	rows: [],
	inserted: [],
	authors: {},
};

const staffUserNoteTable = {
	__table: "staff_user_note",
	userId: { __column: "staff_user_note.userId" },
	createdAt: { __column: "staff_user_note.createdAt" },
	id: { __column: "staff_user_note.id" },
};

const userTable = { __table: "user" };
const profileTable = { __table: "profile" };

function enrichNoteRow(row: NoteRow) {
	const author = state.authors[row.authorId];
	return {
		...row,
		authorName: author?.name ?? null,
		authorDisplayName: author?.displayName ?? null,
		authorHandle: author?.handle ?? null,
		authorRole: author?.role ?? null,
	};
}

function createSelectQuery() {
	let fromTable: string | null = null;
	let whereValue: string | null = null;

	const query: Record<string, unknown> = {
		from(table: unknown) {
			fromTable = (table as { __table?: string }).__table ?? null;
			return query;
		},
		innerJoin() {
			return query;
		},
		leftJoin() {
			return query;
		},
		where(condition: unknown) {
			const chunks = (condition as { queryChunks?: unknown[] } | null)
				?.queryChunks;
			if (Array.isArray(chunks)) {
				for (const chunk of chunks) {
					if (typeof chunk === "string" || typeof chunk === "number") {
						whereValue = String(chunk);
					}
				}
			}
			return query;
		},
		orderBy() {
			return query;
		},
		async limit(count?: number) {
			if (fromTable !== "staff_user_note" || !whereValue) return [];
			const byId = state.rows.find((row) => row.id === whereValue);
			const filtered = byId
				? [byId]
				: state.rows.filter((row) => row.userId === whereValue);
			const enriched = filtered.map(enrichNoteRow);
			return count != null ? enriched.slice(0, count) : enriched;
		},
		// biome-ignore lint/suspicious/noThenProperty: deliberate test double mirroring Drizzle's thenable builder.
		then(onFulfilled: (rows: unknown[]) => unknown) {
			return query.limit?.().then(onFulfilled);
		},
	};

	return query;
}

mock.module("@still/db", () => ({
	db: {
		select: () => createSelectQuery(),
		insert: () => ({
			values: async (values: Record<string, unknown>) => {
				state.inserted.push(values);
				state.rows.push({
					id: values.id as string,
					userId: values.userId as string,
					authorId: values.authorId as string,
					body: values.body as string,
					createdAt: new Date(),
				});
				return [];
			},
		}),
	},
	staffUserNote: staffUserNoteTable,
	user: userTable,
	profile: profileTable,
}));

const { addStaffUserNote, listStaffUserNotes, staffUserNoteAuthorLabel } =
	await import("./staff-user-notes");

beforeEach(() => {
	state.rows = [];
	state.inserted = [];
	state.authors = {};
});

describe("staffUserNoteAuthorLabel", () => {
	test("prefers profile display name and handle", () => {
		expect(
			staffUserNoteAuthorLabel({
				authorDisplayName: "Alex Staff",
				authorName: "Alex User",
				authorHandle: "alexstaff",
			}),
		).toBe("Alex Staff (@alexstaff)");
	});

	test("falls back to auth name then handle", () => {
		expect(
			staffUserNoteAuthorLabel({
				authorDisplayName: null,
				authorName: "Alex User",
				authorHandle: "alexstaff",
			}),
		).toBe("Alex User");
		expect(
			staffUserNoteAuthorLabel({
				authorDisplayName: null,
				authorName: null,
				authorHandle: "alexstaff",
			}),
		).toBe("@alexstaff");
	});
});

describe("listStaffUserNotes", () => {
	test("returns notes with a readable author label", async () => {
		state.rows = [
			{
				id: "note_1",
				userId: "u-1",
				authorId: "staff-1",
				body: "Heads up about this account",
				createdAt: new Date("2026-01-01T00:00:00Z"),
			},
		];
		state.authors["staff-1"] = {
			displayName: "Admin Patron",
			handle: "admin",
			name: "Admin User",
			role: "admin",
		};

		const rows = await listStaffUserNotes("u-1");
		expect(rows).toEqual([
			{
				id: "note_1",
				userId: "u-1",
				authorId: "staff-1",
				body: "Heads up about this account",
				createdAt: new Date("2026-01-01T00:00:00Z"),
				authorDisplayName: "Admin Patron (@admin)",
				authorRole: "admin",
			},
		]);
	});
});

describe("addStaffUserNote", () => {
	test("inserts a row with a generated id and returns author label", async () => {
		state.authors["staff-1"] = {
			displayName: "Admin Patron",
			handle: "admin",
			name: "Admin User",
			role: "admin",
		};

		const note = await addStaffUserNote({
			userId: "u-1",
			authorId: "staff-1",
			body: "Contacted about a billing issue",
		});

		expect(note.id).toMatch(/^note_/);
		expect(note.userId).toBe("u-1");
		expect(note.authorId).toBe("staff-1");
		expect(note.body).toBe("Contacted about a billing issue");
		expect(note.createdAt).toBeInstanceOf(Date);
		expect(note.authorDisplayName).toBe("Admin Patron (@admin)");
		expect(note.authorRole).toBe("admin");

		expect(state.inserted).toHaveLength(1);
		expect(state.inserted[0]).toMatchObject({
			id: note.id,
			userId: "u-1",
			authorId: "staff-1",
			body: "Contacted about a billing issue",
		});
	});
});
