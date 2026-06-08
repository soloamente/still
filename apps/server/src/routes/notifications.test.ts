import { describe, expect, it, mock } from "bun:test";
import { Elysia } from "elysia";

type Notif = {
	id: string;
	userId: string;
	kind: string;
	title: string;
	body: string | null;
	payload: Record<string, unknown>;
	readAt: Date | null;
	createdAt: Date;
};

const state: { notifs: Notif[] } = { notifs: [] };

// Minimal thenable select builder modeling
// .select().from().where().orderBy().limit() -> filtered rows.
function makeDb() {
	return {
		select() {
			return {
				from() {
					return this;
				},
				where() {
					return this;
				},
				orderBy() {
					return this;
				},
				limit(n: number) {
					const rows = state.notifs
						.filter((x) => x.kind === "staff.role_changed" && x.readAt === null)
						.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
						.slice(0, n);
					return Promise.resolve(rows);
				},
			};
		},
	};
}

mock.module("@still/db", () => ({
	db: makeDb(),
	notification: {
		id: "id",
		userId: "userId",
		kind: "kind",
		readAt: "readAt",
		createdAt: "createdAt",
	},
	badge: {},
	profile: {},
}));

mock.module("@still/auth", () => ({
	auth: {
		api: {
			getSession: async ({ headers }: { headers: Headers }) => {
				const id = headers.get("x-user-id");
				return id ? { session: { id: `s-${id}` }, user: { id } } : null;
			},
		},
		handler: () => new Response("ok"),
	},
}));

const { notificationsRoute } = await import("./notifications");

function call(path: string, userId?: string) {
	const headers: Record<string, string> = {};
	if (userId) headers["x-user-id"] = userId;
	return new Elysia()
		.use(notificationsRoute)
		.handle(new Request(`http://localhost${path}`, { headers }));
}

describe("GET /api/notifications/role-change", () => {
	it("401 when signed out", async () => {
		state.notifs = [];
		const res = await call("/api/notifications/role-change");
		expect(res.status).toBe(401);
	});

	it("returns the latest unread role-change notification", async () => {
		state.notifs = [
			{
				id: "ntf-old",
				userId: "u1",
				kind: "staff.role_changed",
				title: "old",
				body: null,
				payload: { direction: "promoted", newRole: "support" },
				readAt: null,
				createdAt: new Date("2026-06-01"),
			},
			{
				id: "ntf-new",
				userId: "u1",
				kind: "staff.role_changed",
				title: "new",
				body: null,
				payload: { direction: "promoted", newRole: "moderator" },
				readAt: null,
				createdAt: new Date("2026-06-05"),
			},
		];
		const res = await call("/api/notifications/role-change", "u1");
		expect(res.status).toBe(200);
		const json = (await res.json()) as { notification: { id: string } | null };
		expect(json.notification?.id).toBe("ntf-new");
	});

	it("returns null when none are unread", async () => {
		state.notifs = [
			{
				id: "ntf-read",
				userId: "u1",
				kind: "staff.role_changed",
				title: "x",
				body: null,
				payload: {},
				readAt: new Date(),
				createdAt: new Date(),
			},
		];
		const res = await call("/api/notifications/role-change", "u1");
		const json = (await res.json()) as { notification: unknown };
		expect(json.notification).toBeNull();
	});
});
