import { beforeEach, describe, expect, mock, test } from "bun:test";

const getSessionMock = mock(
	async (_opts: {
		headers: Headers;
		query?: { disableCookieCache?: boolean };
	}) => ({
		session: { id: "sess_1" },
		user: { id: "usr_1", email: "a@b.c" },
	}),
);

mock.module("@still/auth", () => ({
	auth: {
		api: {
			getSession: getSessionMock,
		},
	},
}));

describe("resolveRequestSession", () => {
	let resolveRequestSession: typeof import("../context").resolveRequestSession;

	beforeEach(async () => {
		getSessionMock.mockClear();
		const mod = await import("../context");
		resolveRequestSession = mod.resolveRequestSession;
	});

	test("uses cached session by default", async () => {
		const request = new Request("http://localhost/api/test");
		const ctx = await resolveRequestSession(request);
		expect(ctx.user?.id).toBe("usr_1");
		expect(getSessionMock).toHaveBeenCalledTimes(1);
		expect(getSessionMock.mock.calls[0]?.[0]?.query).toBeUndefined();
	});

	test("forces fresh Postgres validation when fresh=true", async () => {
		const request = new Request("http://localhost/api/staff/users");
		await resolveRequestSession(request, { fresh: true });
		expect(getSessionMock.mock.calls[0]?.[0]?.query).toEqual({
			disableCookieCache: true,
		});
	});
});
