import { describe, expect, it } from "bun:test";

import { permissionSummary } from "./permission-summary";

describe("permissionSummary", () => {
	it("owner gets the full list including impersonate and pro", () => {
		const labels = permissionSummary("owner").map((e) => e.label);
		expect(labels).toContain("Impersonate a user's account");
		expect(labels).toContain("Grant or revoke complimentary Pro");
		expect(labels).toContain("Read the staff audit log");
	});

	it("admin gets edit/note/pro but not impersonate or set-role", () => {
		const actions = permissionSummary("admin").map(
			(e) => `${e.resource}:${e.action}`,
		);
		expect(actions).toContain("user:edit");
		expect(actions).toContain("user:note");
		expect(actions).toContain("user:pro");
		expect(actions).not.toContain("user:impersonate");
		expect(actions).not.toContain("user:set-role");
	});

	it("moderator gets only list + content moderation, in stable order", () => {
		const actions = permissionSummary("moderator").map(
			(e) => `${e.resource}:${e.action}`,
		);
		expect(actions).toEqual([
			"user:list",
			"content:hide",
			"content:delete",
			"content:restore",
		]);
	});

	it("support gets list + hide only", () => {
		const actions = permissionSummary("support").map(
			(e) => `${e.resource}:${e.action}`,
		);
		expect(actions).toEqual(["user:list", "content:hide"]);
	});

	it("a plain user gets nothing", () => {
		expect(permissionSummary("user")).toEqual([]);
	});
});
