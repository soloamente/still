import { beforeEach, describe, expect, mock, test } from "bun:test";

const collaboratorChecks = new Map<string, boolean>();

mock.module("./list-collaborator-access", () => ({
	isListCollaborator: async (listId: string, userId: string) =>
		collaboratorChecks.get(`${listId}:${userId}`) ?? false,
	canEditList: async () => false,
}));

const { canViewList } = await import("./list-view-access");

describe("canViewList", () => {
	const privateList = {
		id: "lst-private",
		isPublic: false,
		userId: "owner-1",
	};
	const publicList = {
		id: "lst-public",
		isPublic: true,
		userId: "owner-1",
	};

	beforeEach(() => {
		collaboratorChecks.clear();
	});

	test("public list is visible to anonymous viewers", async () => {
		expect(await canViewList(publicList, null)).toBe(true);
		expect(await canViewList(publicList, undefined)).toBe(true);
	});

	test("private list is hidden from anonymous and other patrons", async () => {
		expect(await canViewList(privateList, null)).toBe(false);
		expect(await canViewList(privateList, "stranger-1")).toBe(false);
	});

	test("private list is visible to the owner", async () => {
		expect(await canViewList(privateList, "owner-1")).toBe(true);
	});

	test("private list is visible to invited collaborators", async () => {
		collaboratorChecks.set("lst-private:editor-2", true);
		expect(await canViewList(privateList, "editor-2")).toBe(true);
	});
});
