import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

// ---------------------------------------------------------------------------
// Mutable test state — each test sets the target user row(s) and inspects the
// recorded update / audit calls.
// ---------------------------------------------------------------------------
type TestState = {
	// Map of userId -> role, used by the user-lookup select in ban / set-role.
	users: Record<string, { id: string; role: string }>;
	// Content rows keyed by table name; presence determines update().returning().
	content: Record<string, Set<string>>;
	updates: Array<{ table: string; set: Record<string, unknown>; id: string }>;
	audits: Array<{
		actorId: string;
		action: string;
		targetType: string;
		targetId: string;
		reason?: string | null;
		metadata?: Record<string, unknown>;
	}>;
	authCalls: Array<{ method: string; body: unknown }>;
};

const state: TestState = {
	users: {},
	content: {},
	updates: [],
	audits: [],
	authCalls: [],
};

// Table sentinels. Each carries `__table` (so the db mock can resolve which
// table is being updated) and an `id` column marker.
function makeTable(name: string) {
	return {
		__table: name,
		id: { __column: `${name}.id` },
		name: { __column: `${name}.name` },
		email: { __column: `${name}.email` },
		image: { __column: `${name}.image` },
		role: { __column: `${name}.role` },
		banned: { __column: `${name}.banned` },
		banExpires: { __column: `${name}.banExpires` },
		createdAt: { __column: `${name}.createdAt` },
		removedAt: { __column: `${name}.removedAt` },
		removedBy: { __column: `${name}.removedBy` },
		removalReason: { __column: `${name}.removalReason` },
		actorId: { __column: `${name}.actorId` },
	};
}

const userTable = makeTable("user");
const reviewTable = makeTable("review");
const logTable = makeTable("log");
const listTable = makeTable("list");
const postTable = makeTable("post");
const staffAuditLogTable = makeTable("staff_audit_log");

// NOTE: we do NOT mock `drizzle-orm`. `mock.module` is process-global in Bun,
// and stubbing eq/or/desc here would leak into every other route test that
// relies on real Drizzle SQL (e.g. lists.test.ts). Instead the db mock below
// introspects the REAL `eq(col, value)` object: Drizzle stores the bound value
// as a plain primitive inside `queryChunks`, so we pull the single-user-lookup
// id back out of there.

// ---------------------------------------------------------------------------
// db mock: supports the select chain (users list + single-user lookup + audit
// list) and the update chain (content moderation).
// ---------------------------------------------------------------------------
/**
 * Extract the bound value from a real Drizzle `eq(column, value)` SQL node by
 * scanning its `queryChunks` for the first primitive (string/number) chunk.
 */
function findEqValue(condition: unknown): string | null {
	const chunks = (condition as { queryChunks?: unknown[] } | null)?.queryChunks;
	if (!Array.isArray(chunks)) return null;
	for (const chunk of chunks) {
		if (typeof chunk === "string" || typeof chunk === "number") {
			return String(chunk);
		}
	}
	return null;
}

function createSelectQuery() {
	let fromTable: string | null = null;
	let whereCondition: unknown = null;

	const query: Record<string, unknown> = {
		from(table: unknown) {
			fromTable = (table as { __table?: string }).__table ?? null;
			return query;
		},
		where(condition: unknown) {
			whereCondition = condition;
			return query;
		},
		orderBy() {
			return query;
		},
		async limit() {
			return resolve();
		},
		// Real Drizzle query builders are thenable; single-user lookups in the
		// route `await` the builder directly (no `.limit()`), so the mock mirrors
		// that.
		// biome-ignore lint/suspicious/noThenProperty: deliberate test double mirroring Drizzle's thenable builder.
		then(onFulfilled: (rows: unknown[]) => unknown) {
			return Promise.resolve(resolve()).then(onFulfilled);
		},
	};

	function resolve(): unknown[] {
		if (fromTable === "user") {
			const id = findEqValue(whereCondition);
			if (id) {
				const u = state.users[id];
				return u ? [{ id: u.id, role: u.role }] : [];
			}
			// users list
			return Object.values(state.users).map((u) => ({
				id: u.id,
				name: u.id,
				email: `${u.id}@x.test`,
				image: null,
				role: u.role,
				banned: false,
				banExpires: null,
				createdAt: new Date(),
			}));
		}
		if (fromTable === "staff_audit_log") {
			return state.audits;
		}
		return [];
	}

	return query;
}

function createUpdateQuery(table: unknown) {
	const tableName = (table as { __table?: string }).__table ?? "unknown";
	let setValues: Record<string, unknown> = {};
	const builder = {
		set(values: Record<string, unknown>) {
			setValues = values;
			return builder;
		},
		where(condition: unknown) {
			builder._id = findEqValue(condition);
			return builder;
		},
		async returning() {
			const id = builder._id;
			state.updates.push({ table: tableName, set: setValues, id: id ?? "" });
			const exists = id != null && state.content[tableName]?.has(id);
			return exists ? [{ id }] : [];
		},
		_id: null as string | null,
	};
	return builder;
}

const db = {
	select: () => createSelectQuery(),
	update: (table: unknown) => createUpdateQuery(table),
};

mock.module("@still/db", () => ({
	db,
	user: userTable,
	review: reviewTable,
	log: logTable,
	list: listTable,
	post: postTable,
	staffAuditLog: staffAuditLogTable,
}));

// ---------------------------------------------------------------------------
// auth mock: getSession reads x-user-id / x-user-role headers; userHasPermission
// implements the real role -> permission matrix; ban/unban/setRole record calls.
// ---------------------------------------------------------------------------
const MATRIX: Record<string, Record<string, string[]>> = {
	owner: {
		user: ["list", "ban", "unban", "set-role", "impersonate"],
		content: ["hide", "delete", "restore"],
		audit: ["read"],
	},
	admin: {
		user: ["list", "ban", "unban"],
		content: ["hide", "delete", "restore"],
		audit: ["read"],
	},
	moderator: {
		user: ["list"],
		content: ["hide", "delete", "restore"],
	},
	support: {
		user: ["list"],
		content: ["hide"],
	},
};

function roleHasPermission(
	role: string,
	permissions: Record<string, string[]>,
): boolean {
	const grants = MATRIX[role];
	if (!grants) return false;
	for (const [resource, actions] of Object.entries(permissions)) {
		const allowed = grants[resource] ?? [];
		for (const action of actions) {
			if (!allowed.includes(action)) return false;
		}
	}
	return true;
}

mock.module("@still/auth", () => ({
	auth: {
		api: {
			getSession: async ({ headers }: { headers: Headers }) => {
				const id = headers.get("x-user-id");
				if (!id) return null;
				const role = headers.get("x-user-role") ?? "user";
				return {
					session: { id: `session-${id}` },
					user: { id, role, banned: false, banExpires: null },
				};
			},
			userHasPermission: async ({
				body,
			}: {
				body: { role: string; permissions: Record<string, string[]> };
			}) => ({ success: roleHasPermission(body.role, body.permissions) }),
			banUser: async ({ body }: { body: unknown }) => {
				state.authCalls.push({ method: "banUser", body });
				return { user: {} };
			},
			unbanUser: async ({ body }: { body: unknown }) => {
				state.authCalls.push({ method: "unbanUser", body });
				return { user: {} };
			},
			setRole: async ({ body }: { body: unknown }) => {
				state.authCalls.push({ method: "setRole", body });
				return { user: {} };
			},
		},
		handler: () => new Response("ok"),
	},
}));

mock.module("../lib/rate-limit", () => ({ hit: () => ({ ok: true }) }));

// staff-audit writes into our state so we can assert the recorded action.
mock.module("../lib/staff-audit", () => ({
	writeAuditLog: async (entry: TestState["audits"][number]) => {
		state.audits.push(entry);
	},
}));

const { staffRoute } = await import("./staff");

function makeApp() {
	return new Elysia().use(staffRoute);
}

function authHeaders(id: string, role: string): Record<string, string> {
	return {
		"x-user-id": id,
		"x-user-role": role,
		"content-type": "application/json",
	};
}

beforeEach(() => {
	state.users = {};
	state.content = {};
	state.updates = [];
	state.audits = [];
	state.authCalls = [];
});

describe("GET /api/staff/users", () => {
	test("returns 401 when signed out", async () => {
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users", { method: "GET" }),
		);
		expect(res.status).toBe(401);
	});

	test("returns users for a moderator (has user:list)", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users", {
				method: "GET",
				headers: authHeaders("mod-1", "moderator"),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { users: Array<{ id: string }> };
		expect(body.users.map((u) => u.id)).toContain("u-1");
	});
});

describe("POST /api/staff/content/:type/:id/:op", () => {
	test("moderator can hide a post -> 200, updates post.removedAt, audits content.hide", async () => {
		state.content = { post: new Set(["pst-1"]) };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/content/post/pst-1/hide", {
				method: "POST",
				headers: authHeaders("mod-1", "moderator"),
				body: JSON.stringify({ reason: "spam" }),
			}),
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });

		const upd = state.updates.find((u) => u.table === "post");
		expect(upd).toBeDefined();
		expect(upd?.id).toBe("pst-1");
		expect(upd?.set.removedAt).toBeInstanceOf(Date);
		expect(upd?.set.removedBy).toBe("mod-1");
		expect(upd?.set.removalReason).toBe("spam");

		const audit = state.audits.find((a) => a.action === "content.hide");
		expect(audit).toBeDefined();
		expect(audit?.targetType).toBe("post");
		expect(audit?.targetId).toBe("pst-1");
	});

	test("support CANNOT delete a review -> 403 (requirePermission denies)", async () => {
		state.content = { review: new Set(["rev-1"]) };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/content/review/rev-1/delete", {
				method: "POST",
				headers: authHeaders("sup-1", "support"),
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(403);
		// Must not have touched the db / audit log.
		expect(state.updates).toHaveLength(0);
		expect(state.audits).toHaveLength(0);
	});

	test("support CAN hide a review -> 200 (sanity: matrix allows content:hide)", async () => {
		state.content = { review: new Set(["rev-1"]) };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/content/review/rev-1/hide", {
				method: "POST",
				headers: authHeaders("sup-1", "support"),
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(200);
	});

	test("unknown content type -> 400", async () => {
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/content/widget/w-1/hide", {
				method: "POST",
				headers: authHeaders("mod-1", "moderator"),
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(400);
	});

	test("restore on a missing row -> 404", async () => {
		state.content = { post: new Set() };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/content/post/nope/restore", {
				method: "POST",
				headers: authHeaders("mod-1", "moderator"),
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(404);
	});
});

describe("POST /api/staff/users/:id/ban (outranks enforcement)", () => {
	test("admin banning an owner -> 403 from outranks, not permission", async () => {
		state.users = { "owner-1": { id: "owner-1", role: "owner" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/owner-1/ban", {
				method: "POST",
				headers: authHeaders("admin-1", "admin"),
				body: JSON.stringify({ reason: "nope" }),
			}),
		);
		expect(res.status).toBe(403);
		// Permission passed (admin has user:ban) but outranks blocked the call,
		// so better-auth banUser was never invoked.
		expect(state.authCalls).toHaveLength(0);
		expect(state.audits).toHaveLength(0);
	});

	test("admin banning a regular user -> 200, calls banUser + audits user.ban", async () => {
		state.users = { "u-9": { id: "u-9", role: "user" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-9/ban", {
				method: "POST",
				headers: authHeaders("admin-1", "admin"),
				body: JSON.stringify({ reason: "spam", expiresInSeconds: 3600 }),
			}),
		);
		expect(res.status).toBe(200);
		const call = state.authCalls.find((c) => c.method === "banUser");
		expect(call).toBeDefined();
		expect((call?.body as { userId: string }).userId).toBe("u-9");
		expect((call?.body as { banReason: string }).banReason).toBe("spam");
		expect((call?.body as { banExpiresIn: number }).banExpiresIn).toBe(3600);
		expect(state.audits.find((a) => a.action === "user.ban")).toBeDefined();
	});

	test("support cannot ban (no user:ban) -> 403", async () => {
		state.users = { "u-9": { id: "u-9", role: "user" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-9/ban", {
				method: "POST",
				headers: authHeaders("sup-1", "support"),
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(403);
		expect(state.authCalls).toHaveLength(0);
	});
});

describe("GET /api/staff/audit", () => {
	test("moderator lacks audit:read -> 403", async () => {
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/audit", {
				method: "GET",
				headers: authHeaders("mod-1", "moderator"),
			}),
		);
		expect(res.status).toBe(403);
	});

	test("admin can read audit -> 200", async () => {
		state.audits.push({
			actorId: "admin-1",
			action: "user.ban",
			targetType: "user",
			targetId: "u-9",
		});
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/audit", {
				method: "GET",
				headers: authHeaders("admin-1", "admin"),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { entries: unknown[] };
		expect(body.entries.length).toBeGreaterThan(0);
	});
});
