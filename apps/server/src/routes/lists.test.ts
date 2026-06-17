import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

type TestList = {
	id: string;
	userId: string;
	isPublic: boolean;
	isCollaborative: boolean;
	systemKind: string | null;
};

type TestListItem = {
	id: string;
	listId: string;
	position: number;
	addedAt: Date;
	movieId: number | null;
	tvId: number | null;
};

const LIST_SYSTEM_KIND_FAVORITES = "favorites";

const state: {
	list: TestList | null;
	items: TestListItem[];
	collaborators: Array<{ listId: string; userId: string }>;
} = {
	list: null,
	items: [],
	collaborators: [],
};

const listTable = { __table: "list" };
const listItemTable = { __table: "listItem" };
const movieTable = { __table: "movie" };
const tvTable = { __table: "tv" };
const reactionTable = { __table: "reaction" };
const eventLogTable = { __table: "eventLog" };
const profileTable = { __table: "profile" };
const exportedListTable = {
	...listTable,
	id: "id",
	userId: "userId",
	isCollaborative: "isCollaborative",
};
const exportedListItemTable = {
	...listItemTable,
	id: "id",
	listId: "listId",
	position: "position",
	addedAt: "addedAt",
	movieId: "movieId",
	tvId: "tvId",
};
const exportedMovieTable = { ...movieTable, tmdbId: "tmdbId" };
const exportedTvTable = { ...tvTable, tmdbId: "tmdbId" };

function createSelectQuery(projection: unknown) {
	let fromTable: unknown = null;
	let isItemJoin = false;

	async function execute(): Promise<unknown[]> {
		if (fromTable === exportedListTable) {
			return state.list ? [state.list] : [];
		}
		if (fromTable === exportedListItemTable) {
			const sorted = [...state.items].sort((a, b) => {
				if (a.position !== b.position) return a.position - b.position;
				return a.addedAt.getTime() - b.addedAt.getTime();
			});
			if (isItemJoin) {
				return sorted.map((item) => ({ item, movie: null, tv: null }));
			}
			if (
				projection &&
				typeof projection === "object" &&
				"id" in (projection as Record<string, unknown>)
			) {
				return sorted.map((item) => ({ id: item.id }));
			}
			return sorted;
		}
		return [];
	}

	const query = {
		from(table: unknown) {
			fromTable = table;
			return query;
		},
		where(_condition: unknown) {
			return query;
		},
		leftJoin(table: unknown, _condition: unknown) {
			if (table === exportedMovieTable || table === exportedTvTable) {
				isItemJoin = true;
			}
			return query;
		},
		orderBy(..._orderBy: unknown[]) {
			return execute();
		},
		limit(count: number) {
			return execute().then((rows) => rows.slice(0, count));
		},
		// biome-ignore lint/suspicious/noThenProperty: this test double needs Promise-like await support.
		then<TResult1 = unknown[], TResult2 = never>(
			onfulfilled?:
				| ((value: unknown[]) => TResult1 | PromiseLike<TResult1>)
				| null,
			onrejected?:
				| ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
				| null,
		): Promise<TResult1 | TResult2> {
			return execute().then(onfulfilled, onrejected);
		},
	};

	return query;
}

class UpdateQuery {
	private patch: Partial<TestListItem> = {};

	constructor(private readonly table: unknown) {}

	set(values: Partial<TestListItem>): this {
		this.patch = values;
		return this;
	}

	where(_condition: unknown): Promise<void> {
		if (
			this.table === exportedListItemTable &&
			typeof this.patch.position === "number" &&
			_condition &&
			typeof _condition === "object"
		) {
			const literals = extractConditionLiterals(_condition);
			const row = state.items.find((item) => literals.includes(item.id));
			if (row) row.position = this.patch.position;
		}
		return Promise.resolve();
	}
}

function extractConditionLiterals(condition: unknown): string[] {
	if (!condition || typeof condition !== "object") return [];
	const chunks = (condition as { queryChunks?: unknown[] }).queryChunks;
	if (!Array.isArray(chunks)) return [];
	const values: string[] = [];
	for (const chunk of chunks) {
		if (typeof chunk === "string") {
			values.push(chunk);
			continue;
		}
		if (chunk && typeof chunk === "object") {
			values.push(...extractConditionLiterals(chunk));
		}
	}
	return values;
}

const db = {
	select: (projection?: unknown) => createSelectQuery(projection),
	update: (table: unknown) => new UpdateQuery(table),
	transaction: async (
		callback: (tx: { update: typeof db.update }) => Promise<void>,
	) => callback({ update: db.update }),
};

mock.module("@still/db", () => ({
	db,
	list: exportedListTable,
	listItem: exportedListItemTable,
	movie: exportedMovieTable,
	tv: exportedTvTable,
	reaction: reactionTable,
	eventLog: eventLogTable,
	profile: profileTable,
	LIST_SYSTEM_KIND_FAVORITES,
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

mock.module("@still/env/server", () => ({
	env: {
		CORS_ORIGIN: "*",
		BLOB_READ_WRITE_TOKEN: "",
		BLOB_STORE_ACCESS: "public",
	},
}));

mock.module("@vercel/blob", () => ({
	get: async () => null,
}));

mock.module("../lib/rate-limit", () => ({
	hit: () => ({ ok: true }),
}));

mock.module("../lib/tv-cache", () => ({
	ensureTvCached: async () => undefined,
}));

mock.module("../lib/vercel-blob-image-put", () => ({
	vercelBlobImagePut: async () => ({ error: "not-used" }),
}));

mock.module("../lib/favorites-list-sync", () => ({
	isFavoritesSystemList: (row: { systemKind: string | null }) =>
		row.systemKind === LIST_SYSTEM_KIND_FAVORITES,
	repairFavoritesListPositions: async () => undefined,
	refreshListAggregates: async () => undefined,
}));

mock.module("../lib/list-collaborator-access", () => ({
	canEditList: async (
		userId: string | undefined,
		listRow: { id: string; userId: string } | null | undefined,
	) => {
		if (!userId || !listRow) return false;
		if (listRow.userId === userId) return true;
		return state.collaborators.some(
			(c) => c.listId === listRow.id && c.userId === userId,
		);
	},
	isListCollaborator: async (listId: string, userId: string) =>
		state.collaborators.some((c) => c.listId === listId && c.userId === userId),
}));

mock.module("../lib/list-collaborators", () => ({
	fetchCollaboratedListsForPatron: async () => [],
	fetchListCollaborators: async () => [],
	inviteListCollaboratorByHandle: async () => ({
		ok: true as const,
		collaboratorUserId: "editor-2",
	}),
	removeListCollaborator: async () => ({ ok: true as const }),
}));

const publishRealtimeEventMock = mock(async () => {});

mock.module("../lib/realtime-publish", () => ({
	publishRealtimeEvent: publishRealtimeEventMock,
}));

// lists.ts imports this module for owner diary scores — avoid pulling `log` from the db mock.
mock.module("../lib/list-owner-log-scores", () => ({
	fetchOwnerLogScoresForListItems: async () => new Map(),
}));

const { listsRoute } = await import("./lists");

function testListFixture(): TestList {
	if (!state.list) setBaseFixture();
	if (!state.list) throw new Error("list fixture missing");
	return state.list;
}

function setBaseFixture(): void {
	state.list = {
		id: "lst-1",
		userId: "owner-1",
		isPublic: true,
		isCollaborative: false,
		systemKind: null,
	};
	state.collaborators = [];
	state.items = [
		{
			id: "lit-1",
			listId: "lst-1",
			position: 7,
			addedAt: new Date("2026-05-01T00:00:00.000Z"),
			movieId: 1,
			tvId: null,
		},
		{
			id: "lit-2",
			listId: "lst-1",
			position: 3,
			addedAt: new Date("2026-05-02T00:00:00.000Z"),
			movieId: 2,
			tvId: null,
		},
		{
			id: "lit-3",
			listId: "lst-1",
			position: 11,
			addedAt: new Date("2026-05-03T00:00:00.000Z"),
			movieId: 3,
			tvId: null,
		},
	];
}

function makeApp() {
	return new Elysia().use(listsRoute);
}

async function postReorder(input: {
	userId?: string;
	itemIds: string[];
	listId?: string;
}): Promise<Response> {
	const app = makeApp();
	return app.handle(
		new Request(
			`http://localhost/api/lists/${input.listId ?? "lst-1"}/reorder`,
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					...(input.userId ? { "x-user-id": input.userId } : {}),
				},
				body: JSON.stringify({ itemIds: input.itemIds }),
			},
		),
	);
}

beforeEach(() => {
	setBaseFixture();
});

async function getList(input: {
	listId?: string;
	userId?: string;
}): Promise<Response> {
	const app = makeApp();
	return app.handle(
		new Request(`http://localhost/api/lists/${input.listId ?? "lst-1"}`, {
			method: "GET",
			headers: {
				...(input.userId ? { "x-user-id": input.userId } : {}),
			},
		}),
	);
}

describe("GET /api/lists/:id", () => {
	test("returns public list to anonymous viewers", async () => {
		state.list = { ...testListFixture(), isPublic: true };
		const response = await getList({});
		expect(response.status).toBe(200);
		const payload = (await response.json()) as { id: string };
		expect(payload.id).toBe("lst-1");
	});

	test("returns 404 for private list when anonymous", async () => {
		state.list = { ...testListFixture(), isPublic: false };
		const response = await getList({});
		expect(response.status).toBe(404);
	});

	test("returns 404 for private list when viewer is not owner", async () => {
		state.list = { ...testListFixture(), isPublic: false };
		const response = await getList({ userId: "stranger-1" });
		expect(response.status).toBe(404);
	});

	test("returns private list to owner", async () => {
		state.list = { ...testListFixture(), isPublic: false };
		const response = await getList({ userId: "owner-1" });
		expect(response.status).toBe(200);
	});
});

describe("POST /api/lists/:id/reorder", () => {
	beforeEach(() => {
		publishRealtimeEventMock.mockClear();
	});

	test("allows owner reorder and normalizes positions deterministically", async () => {
		const response = await postReorder({
			userId: "owner-1",
			itemIds: ["lit-3", "lit-1", "lit-2"],
		});
		expect(response.status).toBe(200);
		const payload = (await response.json()) as {
			ok: boolean;
			items: Array<{ item: TestListItem }>;
		};
		expect(payload.ok).toBe(true);
		expect(payload.items.map((row) => row.item.id)).toEqual([
			"lit-3",
			"lit-1",
			"lit-2",
		]);
		expect(payload.items.map((row) => row.item.position)).toEqual([0, 1, 2]);
		expect(publishRealtimeEventMock).toHaveBeenCalledTimes(1);
		expect(publishRealtimeEventMock).toHaveBeenCalledWith("list:lst-1", {
			type: "list.reordered",
			itemIds: ["lit-3", "lit-1", "lit-2"],
		});
	});

	test("allows collaborative editor reorder", async () => {
		state.collaborators.push({ listId: "lst-1", userId: "editor-2" });
		const response = await postReorder({
			userId: "editor-2",
			itemIds: ["lit-2", "lit-3", "lit-1"],
		});
		expect(response.status).toBe(200);
		const payload = (await response.json()) as {
			items: Array<{ item: TestListItem }>;
		};
		expect(payload.items.map((row) => row.item.id)).toEqual([
			"lit-2",
			"lit-3",
			"lit-1",
		]);
	});

	test("rejects unauthorized users", async () => {
		const response = await postReorder({
			userId: "other-user",
			itemIds: ["lit-1", "lit-2", "lit-3"],
		});
		expect(response.status).toBe(403);
	});

	test("rejects strangers even when list is flagged collaborative", async () => {
		if (state.list) state.list.isCollaborative = true;
		const response = await postReorder({
			userId: "stranger-1",
			itemIds: ["lit-1", "lit-2", "lit-3"],
		});
		expect(response.status).toBe(403);
	});

	test("allows owner reorder on favorites system list", async () => {
		if (state.list) {
			state.list.systemKind = LIST_SYSTEM_KIND_FAVORITES;
			state.list.isRanked = true;
		}
		const response = await postReorder({
			userId: "owner-1",
			itemIds: ["lit-3", "lit-1", "lit-2"],
		});
		expect(response.status).toBe(200);
		const payload = (await response.json()) as {
			items: Array<{ item: { id: string; position: number } }>;
		};
		expect(payload.items.map((row) => row.item.position)).toEqual([0, 1, 2]);
		expect(payload.items.map((row) => row.item.id)).toEqual([
			"lit-3",
			"lit-1",
			"lit-2",
		]);
	});

	test("rejects duplicate ids", async () => {
		const response = await postReorder({
			userId: "owner-1",
			itemIds: ["lit-1", "lit-1", "lit-3"],
		});
		expect(response.status).toBe(400);
	});

	test("rejects partial id set", async () => {
		const response = await postReorder({
			userId: "owner-1",
			itemIds: ["lit-1", "lit-2"],
		});
		expect(response.status).toBe(400);
	});

	test("rejects foreign ids", async () => {
		const response = await postReorder({
			userId: "owner-1",
			itemIds: ["lit-1", "lit-2", "lit-foreign"],
		});
		expect(response.status).toBe(400);
	});
});
