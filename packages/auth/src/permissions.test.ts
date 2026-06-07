import { describe, expect, it } from "bun:test";
import { ac, roles, STAFF_ROLES } from "./permissions";

describe("staff permission matrix", () => {
	it("exposes exactly the four staff roles", () => {
		expect(Object.keys(roles).sort()).toEqual([
			"admin",
			"moderator",
			"owner",
			"support",
		]);
		expect(STAFF_ROLES).toEqual(["owner", "admin", "moderator", "support"]);
	});

	it("owner can do everything including set-role and audit", () => {
		expect(roles.owner.authorize({ user: ["set-role"] }).success).toBe(true);
		expect(roles.owner.authorize({ user: ["ban"] }).success).toBe(true);
		expect(roles.owner.authorize({ content: ["delete"] }).success).toBe(true);
		expect(roles.owner.authorize({ audit: ["read"] }).success).toBe(true);
	});

	it("admin can ban and read audit but cannot set-role or impersonate", () => {
		expect(roles.admin.authorize({ user: ["ban"] }).success).toBe(true);
		expect(roles.admin.authorize({ audit: ["read"] }).success).toBe(true);
		expect(roles.admin.authorize({ user: ["set-role"] }).success).toBe(false);
		expect(roles.admin.authorize({ user: ["impersonate"] }).success).toBe(
			false,
		);
	});

	it("moderator can moderate content but not ban or read audit", () => {
		expect(roles.moderator.authorize({ content: ["delete"] }).success).toBe(
			true,
		);
		expect(roles.moderator.authorize({ content: ["hide"] }).success).toBe(true);
		expect(roles.moderator.authorize({ user: ["ban"] }).success).toBe(false);
		// `moderator` was not granted any `audit` statements, so better-auth
		// narrows its `authorize` query type to exclude the `audit` resource.
		// The cast preserves the runtime assertion (still returns success: false)
		// without changing the permission matrix.
		expect(
			roles.moderator.authorize({ audit: ["read"] } as never).success,
		).toBe(false);
	});

	it("support can hide and list users but cannot delete or ban", () => {
		expect(roles.support.authorize({ content: ["hide"] }).success).toBe(true);
		expect(roles.support.authorize({ user: ["list"] }).success).toBe(true);
		expect(roles.support.authorize({ content: ["delete"] }).success).toBe(
			false,
		);
		expect(roles.support.authorize({ content: ["restore"] }).success).toBe(
			false,
		);
		expect(roles.support.authorize({ user: ["ban"] }).success).toBe(false);
	});

	it("ac includes the better-auth default user statements", () => {
		expect(ac.statements.user).toContain("ban");
	});
});
