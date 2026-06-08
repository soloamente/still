import { beforeEach, describe, expect, mock, test } from "bun:test";

type NoteRow = {
	id: string;
	userId: string;
	authorId: string;
	body: string;
	createdAt: Date;
};

const state: { rows: NoteRow[]; inserted: Array<Record<string, unknown>> } = {
	rows: [],
	inserted: [],
};

const staffUserNoteTable = {
	__table: "staff_user_note",
	userId: { __column: "staff_user_note.userId" },
	createdAt: { __column: "staff_user_note.createdAt" },
};

mock.module("@still/db", () => ({
	db: {
		select: () => ({
			from: () => ({
				where: () => ({
					orderBy: async () => state.rows,
				}),
			}),
		}),
		insert: () => ({
			values: async (values: Record<string, unknown>) => {
				state.inserted.push(values);
				return [];
			},
		}),
	},
	staffUserNote: staffUserNoteTable,
}));

const { addStaffUserNote, listStaffUserNotes } = await import(
	"./staff-user-notes"
);

beforeEach(() => {
	state.rows = [];
	state.inserted = [];
});

describe("listStaffUserNotes", () => {
	test("returns the rows from the db query as-is", async () => {
		state.rows = [
			{
				id: "note_1",
				userId: "u-1",
				authorId: "staff-1",
				body: "Heads up about this account",
				createdAt: new Date("2026-01-01T00:00:00Z"),
			},
		];
		const rows = await listStaffUserNotes("u-1");
		expect(rows).toEqual(state.rows);
	});
});

describe("addStaffUserNote", () => {
	test("inserts a row with a generated id and returns it", async () => {
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

		expect(state.inserted).toHaveLength(1);
		expect(state.inserted[0]).toMatchObject({
			id: note.id,
			userId: "u-1",
			authorId: "staff-1",
			body: "Contacted about a billing issue",
		});
	});
});
