import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

// ---------------------------------------------------------------------------
// Mutable test state — each test sets the target user row(s) and inspects the
// recorded update / audit calls.
// ---------------------------------------------------------------------------
type TestState = {
	// Map of userId -> role, used by the user-lookup select in ban / set-role.
	users: Record<string, { id: string; role: string }>;
	// Map of userId -> profile row, used by GET/POST /users/:id and /edit /pro.
	profiles: Record<
		string,
		{
			userId: string;
			handle: string;
			displayName: string;
			isPro: boolean;
			isPrivate: boolean;
			statsCache: Record<string, number>;
		}
	>;
	// Notes recorded via POST /users/:id/notes, keyed implicitly by userId.
	notes: Array<{
		id: string;
		userId: string;
		authorId: string;
		body: string;
		createdAt: Date;
	}>;
	// Content rows keyed by table name; presence determines update().returning().
	content: Record<string, Set<string>>;
	updates: Array<{ table: string; set: Record<string, unknown>; id: string }>;
	inserts: Array<{ table: string; values: Record<string, unknown> }>;
	audits: Array<{
		actorId: string;
		action: string;
		targetType: string;
		targetId: string;
		reason?: string | null;
		metadata?: Record<string, unknown>;
	}>;
	authCalls: Array<{ method: string; body: unknown }>;
	// Dedicated counters for impersonation calls.
	impersonateCalls: Array<{ userId: string }>;
	stopImpersonatingCalls: number;
	// Optional session override: when set, the context mock returns this instead
	// of deriving session from x-user-id / x-user-role headers.
	session:
		| {
				user: { id: string; role: string };
				session: { id: string; impersonatedBy: string | null };
		  }
		| undefined;
};

const state: TestState = {
	users: {},
	profiles: {},
	notes: [],
	content: {},
	updates: [],
	inserts: [],
	audits: [],
	authCalls: [],
	impersonateCalls: [],
	stopImpersonatingCalls: 0,
	session: undefined,
};

// Table sentinels. Each carries `__table` (so the db mock can resolve which
// table is being updated) and an `id` column marker.
function makeTable(name: string) {
	return {
		__table: name,
		id: { __column: `${name}.id` },
		userId: { __column: `${name}.userId` },
		authorId: { __column: `${name}.authorId` },
		name: { __column: `${name}.name` },
		email: { __column: `${name}.email` },
		emailVerified: { __column: `${name}.emailVerified` },
		image: { __column: `${name}.image` },
		role: { __column: `${name}.role` },
		banned: { __column: `${name}.banned` },
		banExpires: { __column: `${name}.banExpires` },
		createdAt: { __column: `${name}.createdAt` },
		removedAt: { __column: `${name}.removedAt` },
		removedBy: { __column: `${name}.removedBy` },
		removalReason: { __column: `${name}.removalReason` },
		actorId: { __column: `${name}.actorId` },
		handle: { __column: `${name}.handle` },
		displayName: { __column: `${name}.displayName` },
		bio: { __column: `${name}.bio` },
		pronouns: { __column: `${name}.pronouns` },
		location: { __column: `${name}.location` },
		website: { __column: `${name}.website` },
		bannerUrl: { __column: `${name}.bannerUrl` },
		accentColor: { __column: `${name}.accentColor` },
		isPro: { __column: `${name}.isPro` },
		isPrivate: { __column: `${name}.isPrivate` },
		statsCache: { __column: `${name}.statsCache` },
		body: { __column: `${name}.body` },
	};
}

const userTable = makeTable("user");
const reviewTable = makeTable("review");
const logTable = makeTable("log");
const listTable = makeTable("list");
const postTable = makeTable("post");
const staffAuditLogTable = makeTable("staff_audit_log");
const notificationTable = makeTable("notification");
const profileTable = makeTable("profile");
const staffUserNoteTable = makeTable("staff_user_note");

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
		if (fromTable === "profile") {
			const id = findEqValue(whereCondition);
			const p = id ? state.profiles[id] : undefined;
			return p ? [p] : [];
		}
		if (fromTable === "staff_user_note") {
			const id = findEqValue(whereCondition);
			return state.notes.filter((n) => n.userId === id);
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
			if (tableName === "profile") {
				return id != null && state.profiles[id] ? [{ id }] : [];
			}
			if (tableName === "user") {
				return id != null && state.users[id] ? [{ id }] : [];
			}
			const exists = id != null && state.content[tableName]?.has(id);
			return exists ? [{ id }] : [];
		},
		_id: null as string | null,
	};
	return builder;
}

function createInsertQuery(table: unknown) {
	const tableName = (table as { __table?: string }).__table ?? "unknown";
	return {
		async values(values: Record<string, unknown>) {
			state.inserts.push({ table: tableName, values });
			if (tableName === "staff_user_note") {
				state.notes.push({
					id: (values.id as string) ?? `note-${state.notes.length + 1}`,
					userId: values.userId as string,
					authorId: values.authorId as string,
					body: values.body as string,
					createdAt: new Date(),
				});
			}
			return [];
		},
	};
}

const db = {
	select: () => createSelectQuery(),
	update: (table: unknown) => createUpdateQuery(table),
	insert: (table: unknown) => createInsertQuery(table),
};

mock.module("@still/db", () => ({
	db,
	user: userTable,
	profile: profileTable,
	staffUserNote: staffUserNoteTable,
	review: reviewTable,
	log: logTable,
	list: listTable,
	post: postTable,
	staffAuditLog: staffAuditLogTable,
	notification: notificationTable,
}));

// ---------------------------------------------------------------------------
// auth mock: getSession reads x-user-id / x-user-role headers; userHasPermission
// implements the real role -> permission matrix; ban/unban/setRole record calls.
// ---------------------------------------------------------------------------
const MATRIX: Record<string, Record<string, string[]>> = {
	owner: {
		user: [
			"list",
			"ban",
			"unban",
			"set-role",
			"impersonate",
			"edit",
			"note",
			"pro",
		],
		content: ["hide", "delete", "restore"],
		audit: ["read"],
	},
	admin: {
		user: ["list", "ban", "unban", "edit", "note", "pro"],
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
				// Allow tests to override the session (e.g. to simulate an active
				// impersonation session via session.impersonatedBy).
				if (state.session !== undefined) {
					return state.session;
				}
				const id = headers.get("x-user-id");
				if (!id) return null;
				const role = headers.get("x-user-role") ?? "user";
				return {
					session: { id: `session-${id}`, impersonatedBy: null },
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
			impersonateUser: async ({
				body,
				returnHeaders,
			}: {
				body: { userId: string };
				returnHeaders?: boolean;
			}) => {
				state.authCalls.push({ method: "impersonateUser", body });
				state.impersonateCalls.push({ userId: body.userId });
				const payload = { session: { id: "imp-session" }, user: {} };
				if (returnHeaders) {
					return {
						headers: new Headers({
							"set-cookie": "better-auth.session_token=impersonated",
						}),
						response: payload,
					};
				}
				return payload;
			},
			stopImpersonating: async ({
				returnHeaders,
			}: {
				returnHeaders?: boolean;
			}) => {
				state.authCalls.push({ method: "stopImpersonating", body: null });
				state.stopImpersonatingCalls += 1;
				if (returnHeaders) {
					return {
						headers: new Headers({
							"set-cookie": "better-auth.session_token=restored",
						}),
						response: {},
					};
				}
				return {};
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

// Route tests mock `@still/db` without `follow`; mirror profile.statsCache in tests.
mock.module("../lib/staff-user-stats", () => ({
	fetchStaffUserActivityStats: async (userId: string) => {
		const cached = state.profiles[userId]?.statsCache ?? {};
		return {
			filmsLogged: cached.filmsLogged ?? 0,
			reviewsCount: cached.reviewsCount ?? 0,
			listsCount: cached.listsCount ?? 0,
			followers: cached.followers ?? 0,
			following: cached.following ?? 0,
		};
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
	state.profiles = {};
	state.notes = [];
	state.content = {};
	state.updates = [];
	state.inserts = [];
	state.audits = [];
	state.authCalls = [];
	state.impersonateCalls = [];
	state.stopImpersonatingCalls = 0;
	state.session = undefined;
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

describe("GET /api/staff/users/:id", () => {
	test("returns 401 when signed out", async () => {
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1", { method: "GET" }),
		);
		expect(res.status).toBe(401);
	});

	test("moderator (has user:list) gets user + profile + permission summary", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		state.profiles = {
			"u-1": {
				userId: "u-1",
				handle: "cinephile",
				displayName: "Cinephile",
				isPro: true,
				isPrivate: false,
				statsCache: { filmsLogged: 42, followers: 3 },
			},
		};
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1", {
				method: "GET",
				headers: authHeaders("mod-1", "moderator"),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			user: { id: string };
			profile: { handle: string; isPro: boolean } | null;
			permissions: Array<{ resource: string; action: string }>;
		};
		expect(body.user.id).toBe("u-1");
		expect(body.profile?.handle).toBe("cinephile");
		expect(body.profile?.isPro).toBe(true);
		// Target role is "user" -> no staff permissions.
		expect(body.permissions).toEqual([]);
	});

	test("returns the target role's permission summary, not the viewer's", async () => {
		state.users = { "sup-9": { id: "sup-9", role: "support" } };
		state.profiles = {};
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/sup-9", {
				method: "GET",
				headers: authHeaders("owner-1", "owner"),
			}),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			profile: unknown;
			permissions: Array<{ resource: string; action: string }>;
		};
		expect(body.profile).toBeNull();
		expect(body.permissions.map((p) => `${p.resource}:${p.action}`)).toEqual([
			"user:list",
			"content:hide",
		]);
	});

	test("unknown user -> 404", async () => {
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/missing", {
				method: "GET",
				headers: authHeaders("mod-1", "moderator"),
			}),
		);
		expect(res.status).toBe(404);
	});

	test("non-staff viewer lacks user:list -> 403", async () => {
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1", {
				method: "GET",
				headers: authHeaders("plain-1", "user"),
			}),
		);
		expect(res.status).toBe(403);
	});
});

describe("POST /api/staff/users/:id/edit", () => {
	test("admin edits a regular user's profile -> 200, updates profile, audits user.edit", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		state.profiles = {
			"u-1": {
				userId: "u-1",
				handle: "old-handle",
				displayName: "Old Name",
				isPro: false,
				isPrivate: false,
				statsCache: {},
			},
		};
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/edit", {
				method: "POST",
				headers: authHeaders("admin-1", "admin"),
				body: JSON.stringify({
					displayName: "New Name",
					handle: "new-handle",
					bio: "Loves cinema",
				}),
			}),
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });

		const upd = state.updates.find((u) => u.table === "profile");
		expect(upd).toBeDefined();
		expect(upd?.id).toBe("u-1");
		expect(upd?.set.displayName).toBe("New Name");
		expect(upd?.set.handle).toBe("new-handle");
		expect(upd?.set.bio).toBe("Loves cinema");

		const audit = state.audits.find((a) => a.action === "user.edit");
		expect(audit).toBeDefined();
		expect(audit?.targetId).toBe("u-1");
		expect(audit?.metadata).toEqual({
			changedFields: ["displayName", "handle", "bio"],
		});
	});

	test("invalid handle format -> 400, no update/audit", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		state.profiles = {
			"u-1": {
				userId: "u-1",
				handle: "old-handle",
				displayName: "Old Name",
				isPro: false,
				isPrivate: false,
				statsCache: {},
			},
		};
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/edit", {
				method: "POST",
				headers: authHeaders("admin-1", "admin"),
				body: JSON.stringify({ handle: "Not Valid!" }),
			}),
		);
		expect(res.status).toBe(400);
		expect(state.updates).toHaveLength(0);
		expect(state.audits).toHaveLength(0);
	});

	test("admin editing an owner -> 403 from outranks, no update/audit", async () => {
		state.users = { "owner-1": { id: "owner-1", role: "owner" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/owner-1/edit", {
				method: "POST",
				headers: authHeaders("admin-1", "admin"),
				body: JSON.stringify({ displayName: "Hijacked" }),
			}),
		);
		expect(res.status).toBe(403);
		expect(state.updates).toHaveLength(0);
		expect(state.audits).toHaveLength(0);
	});

	test("moderator lacks user:edit -> 403", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/edit", {
				method: "POST",
				headers: authHeaders("mod-1", "moderator"),
				body: JSON.stringify({ displayName: "Nope" }),
			}),
		);
		expect(res.status).toBe(403);
		expect(state.updates).toHaveLength(0);
	});

	test("handle is lowercased before validation and storage", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		state.profiles = {
			"u-1": {
				userId: "u-1",
				handle: "old-handle",
				displayName: "Old Name",
				isPro: false,
				isPrivate: false,
				statsCache: {},
			},
		};
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/edit", {
				method: "POST",
				headers: authHeaders("admin-1", "admin"),
				body: JSON.stringify({ handle: "New-Handle" }),
			}),
		);
		expect(res.status).toBe(200);
		const upd = state.updates.find((u) => u.table === "profile");
		expect(upd?.set.handle).toBe("new-handle");
	});

	test("empty body (no editable fields) -> 400, no update/audit", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		state.profiles = {
			"u-1": {
				userId: "u-1",
				handle: "h",
				displayName: "H",
				isPro: false,
				isPrivate: false,
				statsCache: {},
			},
		};
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/edit", {
				method: "POST",
				headers: authHeaders("admin-1", "admin"),
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(400);
		expect(state.updates).toHaveLength(0);
		expect(state.audits).toHaveLength(0);
	});
});

describe("POST /api/staff/users/:id/pro", () => {
	test("admin grants Pro -> 200, updates profile.isPro, audits user.pro.grant", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		state.profiles = {
			"u-1": {
				userId: "u-1",
				handle: "h",
				displayName: "H",
				isPro: false,
				isPrivate: false,
				statsCache: {},
			},
		};
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/pro", {
				method: "POST",
				headers: authHeaders("admin-1", "admin"),
				body: JSON.stringify({ isPro: true }),
			}),
		);
		expect(res.status).toBe(200);
		const upd = state.updates.find((u) => u.table === "profile");
		expect(upd?.set.isPro).toBe(true);
		expect(
			state.audits.find((a) => a.action === "user.pro.grant"),
		).toBeDefined();
	});

	test("admin revokes Pro -> 200, audits user.pro.revoke", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		state.profiles = {
			"u-1": {
				userId: "u-1",
				handle: "h",
				displayName: "H",
				isPro: true,
				isPrivate: false,
				statsCache: {},
			},
		};
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/pro", {
				method: "POST",
				headers: authHeaders("admin-1", "admin"),
				body: JSON.stringify({ isPro: false }),
			}),
		);
		expect(res.status).toBe(200);
		expect(
			state.audits.find((a) => a.action === "user.pro.revoke"),
		).toBeDefined();
	});

	test("admin acting on an owner -> 403 from outranks", async () => {
		state.users = { "owner-1": { id: "owner-1", role: "owner" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/owner-1/pro", {
				method: "POST",
				headers: authHeaders("admin-1", "admin"),
				body: JSON.stringify({ isPro: true }),
			}),
		);
		expect(res.status).toBe(403);
		expect(state.updates).toHaveLength(0);
		expect(state.audits).toHaveLength(0);
	});

	test("moderator lacks user:pro -> 403", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/pro", {
				method: "POST",
				headers: authHeaders("mod-1", "moderator"),
				body: JSON.stringify({ isPro: true }),
			}),
		);
		expect(res.status).toBe(403);
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

describe("POST /api/staff/users/:id/role (demotion to user)", () => {
	test("owner demotes a moderator to user -> 200, setRole + audits user.set-role", async () => {
		state.users = { "mod-9": { id: "mod-9", role: "moderator" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/mod-9/role", {
				method: "POST",
				headers: authHeaders("owner-1", "owner"),
				body: JSON.stringify({ role: "user" }),
			}),
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });

		const call = state.authCalls.find((c) => c.method === "setRole");
		expect(call).toBeDefined();
		expect(call?.body).toEqual({ userId: "mod-9", role: "user" });

		const audit = state.audits.find((a) => a.action === "user.set-role");
		expect(audit).toBeDefined();
		expect(audit?.targetType).toBe("user");
		expect(audit?.targetId).toBe("mod-9");
		expect(audit?.metadata).toEqual({ from: "moderator", to: "user" });

		const ntf = state.inserts.find((i) => i.table === "notification");
		expect(ntf).toBeDefined();
		expect(ntf?.values.kind).toBe("staff.role_changed");
		const payload = ntf?.values.payload as Record<string, unknown>;
		expect(payload.direction).toBe("demoted");
		expect(payload.newRole).toBe("user");
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

describe("staff user notes endpoints", () => {
	test("GET /users/:id/notes -> 200 with notes for admin with user:note", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		state.notes = [
			{
				id: "note-1",
				userId: "u-1",
				authorId: "admin-1",
				body: "Heads up",
				createdAt: new Date("2026-01-01T00:00:00Z"),
			},
		];
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/notes", {
				headers: authHeaders("admin-1", "admin"),
			}),
		);
		expect(res.status).toBe(200);
		const data = (await res.json()) as { notes: Array<{ id: string }> };
		expect(data.notes).toHaveLength(1);
		expect(data.notes[0]?.id).toBe("note-1");
	});

	test("POST /users/:id/notes -> 201, persists note, audits user.note.add with note id", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/notes", {
				method: "POST",
				headers: authHeaders("admin-1", "admin"),
				body: JSON.stringify({ body: "Watch this account" }),
			}),
		);
		expect(res.status).toBe(201);
		expect(state.notes).toHaveLength(1);
		expect(state.notes[0]?.body).toBe("Watch this account");
		expect(state.notes[0]?.authorId).toBe("admin-1");
		const audit = state.audits.find((a) => a.action === "user.note.add");
		expect(audit).toBeDefined();
		expect(audit?.metadata?.noteId).toBeDefined();
	});

	test("POST /users/:id/notes rejects an empty body -> 422", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/notes", {
				method: "POST",
				headers: authHeaders("admin-1", "admin"),
				body: JSON.stringify({ body: "" }),
			}),
		);
		expect(res.status).toBe(422);
		expect(state.notes).toHaveLength(0);
	});

	test("moderator lacks user:note -> 403", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/notes", {
				headers: authHeaders("mod-1", "moderator"),
			}),
		);
		expect(res.status).toBe(403);
	});

	test("support lacks user:note -> 403", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/notes", {
				headers: authHeaders("support-1", "support"),
			}),
		);
		expect(res.status).toBe(403);
	});
});

describe("staff impersonation endpoints", () => {
	test("POST /users/:id/impersonate -> 200, calls auth.api.impersonateUser, audits user.impersonate.start", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/impersonate", {
				method: "POST",
				headers: authHeaders("owner-1", "owner"),
			}),
		);
		expect(res.status).toBe(200);
		expect(state.impersonateCalls).toEqual([{ userId: "u-1" }]);
		expect(
			state.audits.find((a) => a.action === "user.impersonate.start"),
		).toBeDefined();
		const setCookies = res.headers.getSetCookie().join("\n");
		expect(setCookies).toContain("better-auth.session_token=impersonated");
	});

	test("POST /users/:id/impersonate -> owner can impersonate another owner (no outranks gate)", async () => {
		state.users = { "owner-2": { id: "owner-2", role: "owner" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/owner-2/impersonate", {
				method: "POST",
				headers: authHeaders("owner-1", "owner"),
			}),
		);
		expect(res.status).toBe(200);
		expect(state.impersonateCalls).toEqual([{ userId: "owner-2" }]);
	});

	test("admin lacks user:impersonate -> 403", async () => {
		state.users = { "u-1": { id: "u-1", role: "user" } };
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/users/u-1/impersonate", {
				method: "POST",
				headers: authHeaders("admin-1", "admin"),
			}),
		);
		expect(res.status).toBe(403);
		expect(state.impersonateCalls).toHaveLength(0);
	});

	test("POST /stop-impersonating -> 200, calls auth.api.stopImpersonating, audits user.impersonate.stop attributed to the real actor", async () => {
		state.session = {
			user: { id: "u-1", role: "user" },
			session: { id: "sess-1", impersonatedBy: "owner-1" },
		};
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/stop-impersonating", {
				method: "POST",
				headers: authHeaders("u-1", "user"),
			}),
		);
		expect(res.status).toBe(200);
		expect(state.stopImpersonatingCalls).toBe(1);
		const entry = state.audits.find(
			(a) => a.action === "user.impersonate.stop",
		);
		expect(entry?.actorId).toBe("owner-1");
		expect(entry?.targetId).toBe("u-1");
	});

	test("POST /stop-impersonating when not impersonating -> 400", async () => {
		state.session = {
			user: { id: "u-1", role: "user" },
			session: { id: "sess-1", impersonatedBy: null },
		};
		const res = await makeApp().handle(
			new Request("http://localhost/api/staff/stop-impersonating", {
				method: "POST",
				headers: authHeaders("u-1", "user"),
			}),
		);
		expect(res.status).toBe(400);
		expect(state.stopImpersonatingCalls).toBe(0);
	});
});
