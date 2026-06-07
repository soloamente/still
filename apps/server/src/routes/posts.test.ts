import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

type TestPost = {
	id: string;
	userId: string;
	body: string;
	publishedAt: Date;
	removedAt: Date | null;
};

const state: { posts: TestPost[] } = { posts: [] };

// Column sentinels. `removedAt` is a uniquely identifiable object so the mock
// can detect whether a query's WHERE clause actually references it — that is
// what proves the route applied `isNull(post.removedAt)`.
const REMOVED_AT_COLUMN = { __column: "post.removedAt" };
const postTable = {
	__table: "post",
	id: { __column: "post.id" },
	userId: { __column: "post.userId" },
	publishedAt: { __column: "post.publishedAt" },
	removedAt: REMOVED_AT_COLUMN,
	likesCount: { __column: "post.likesCount" },
};
const userTable = { __table: "user", id: "id", image: "image" };
const profileTable = { __table: "profile", userId: "userId" };
const reactionTable = { __table: "reaction" };
const eventLogTable = { __table: "eventLog" };

/** Recursively walk a drizzle condition tree looking for the removedAt column. */
function conditionReferencesRemovedAt(condition: unknown): boolean {
	if (!condition || typeof condition !== "object") return false;
	if (condition === REMOVED_AT_COLUMN) return true;
	for (const value of Object.values(condition as Record<string, unknown>)) {
		if (value === REMOVED_AT_COLUMN) return true;
		if (Array.isArray(value)) {
			for (const entry of value) {
				if (conditionReferencesRemovedAt(entry)) return true;
			}
			continue;
		}
		if (value && typeof value === "object") {
			if (conditionReferencesRemovedAt(value)) return true;
		}
	}
	return false;
}

function createSelectQuery() {
	let fromTable: unknown = null;
	let filtersRemoved = false;

	async function execute(): Promise<unknown[]> {
		if (fromTable !== postTable) return [];
		const rows = filtersRemoved
			? state.posts.filter((p) => p.removedAt == null)
			: state.posts;
		return rows.map((post) => ({ post, user: null, profile: null }));
	}

	const query = {
		from(table: unknown) {
			fromTable = table;
			return query;
		},
		leftJoin(_table: unknown, _condition: unknown) {
			return query;
		},
		where(condition: unknown) {
			if (conditionReferencesRemovedAt(condition)) filtersRemoved = true;
			return query;
		},
		orderBy(..._orderBy: unknown[]) {
			return query;
		},
		limit(count: number) {
			return execute().then((rows) => rows.slice(0, count));
		},
	};

	return query;
}

const db = {
	select: () => createSelectQuery(),
};

mock.module("@still/db", () => ({
	db,
	post: postTable,
	user: userTable,
	profile: profileTable,
	reaction: reactionTable,
	eventLog: eventLogTable,
}));

mock.module("@still/auth", () => ({
	auth: {
		api: {
			getSession: async ({ headers }: { headers: Headers }) => {
				const id = headers.get("x-user-id");
				if (!id) return null;
				return { session: { id: `session-${id}` }, user: { id } };
			},
		},
		handler: () => new Response("ok"),
	},
}));

mock.module("../lib/rate-limit", () => ({
	hit: () => ({ ok: true }),
}));

const { postsRoute } = await import("./posts");

function makeApp() {
	return new Elysia().use(postsRoute);
}

async function getByUser(userId: string): Promise<Response> {
	const app = makeApp();
	return app.handle(
		new Request(`http://localhost/api/posts/by-user/${userId}`, {
			method: "GET",
		}),
	);
}

beforeEach(() => {
	state.posts = [
		{
			id: "pst-visible",
			userId: "author-1",
			body: "still up",
			publishedAt: new Date("2026-05-01T00:00:00.000Z"),
			removedAt: null,
		},
		{
			id: "pst-removed",
			userId: "author-1",
			body: "moderated away",
			publishedAt: new Date("2026-05-02T00:00:00.000Z"),
			removedAt: new Date("2026-05-03T00:00:00.000Z"),
		},
	];
});

describe("GET /api/posts/by-user/:userId", () => {
	test("excludes soft-removed posts from the public profile feed", async () => {
		const response = await getByUser("author-1");
		expect(response.status).toBe(200);
		const rows = (await response.json()) as Array<{ post: { id: string } }>;
		const ids = rows.map((row) => row.post.id);
		expect(ids).toContain("pst-visible");
		expect(ids).not.toContain("pst-removed");
	});
});
