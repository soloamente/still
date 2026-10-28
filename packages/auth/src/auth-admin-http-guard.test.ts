import { describe, expect, it } from "bun:test";

import {
	BLOCKED_AUTH_ADMIN_HTTP_PATHS,
	matchBlockedAuthAdminHttpPath,
	maybeBlockAuthAdminHttp,
} from "./auth-admin-http-guard";

describe("matchBlockedAuthAdminHttpPath", () => {
	it("matches ban, unban, and set-role under /api/auth", () => {
		expect(matchBlockedAuthAdminHttpPath("/api/auth/admin/ban-user")).toBe(
			"/admin/ban-user",
		);
		expect(matchBlockedAuthAdminHttpPath("/api/auth/admin/unban-user")).toBe(
			"/admin/unban-user",
		);
		expect(matchBlockedAuthAdminHttpPath("/api/auth/admin/set-role")).toBe(
			"/admin/set-role",
		);
	});

	it("matches trailing slash variants", () => {
		expect(matchBlockedAuthAdminHttpPath("/api/auth/admin/ban-user/")).toBe(
			"/admin/ban-user",
		);
	});

	it("does not match other admin or auth paths", () => {
		expect(matchBlockedAuthAdminHttpPath("/api/auth/admin/get-user")).toBe(
			null,
		);
		expect(matchBlockedAuthAdminHttpPath("/api/auth/sign-in/email")).toBe(null);
		expect(matchBlockedAuthAdminHttpPath("/api/staff/users/x/ban")).toBe(null);
	});

	it("lists exactly the three mutation paths Sense staff wraps", () => {
		expect([...BLOCKED_AUTH_ADMIN_HTTP_PATHS]).toEqual([
			"/admin/ban-user",
			"/admin/unban-user",
			"/admin/set-role",
		]);
	});
});

describe("maybeBlockAuthAdminHttp", () => {
	it("returns 403 JSON for POST ban-user", async () => {
		const res = maybeBlockAuthAdminHttp(
			new Request("http://localhost/api/auth/admin/ban-user", {
				method: "POST",
			}),
		);
		expect(res).not.toBeNull();
		expect(res?.status).toBe(403);
		const body = (await res?.json()) as { error: string; path: string };
		expect(body.error).toBe("FORBIDDEN");
		expect(body.path).toBe("/admin/ban-user");
	});

	it("passes through GET and non-blocked POST", () => {
		expect(
			maybeBlockAuthAdminHttp(
				new Request("http://localhost/api/auth/admin/ban-user", {
					method: "GET",
				}),
			),
		).toBeNull();
		expect(
			maybeBlockAuthAdminHttp(
				new Request("http://localhost/api/auth/sign-in/email", {
					method: "POST",
				}),
			),
		).toBeNull();
	});
});
