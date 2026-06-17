# Neon Data Transfer Reduction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut Neon data transfer (197 GB/mo on a 436 MB DB) by stopping hot read paths from re-querying Postgres on every poll, without changing any user-visible behavior.

**Architecture:** Three independent layers. (1) The notifications badge polls a cheap `COUNT` endpoint instead of downloading 50–80 full rows; full rows load only when the panel/page opens; safety polls slow down because SSE already pushes invalidations. (2) A Redis read-through cache (Upstash, already wired) fronts the mutual-follow lookup the presence poll hits every 20s. (3) Poll intervals are lengthened where UX is unaffected.

**Tech Stack:** Bun + TypeScript, Elysia (server), Next.js/React (web), Drizzle + Neon Postgres, Upstash Redis (`@upstash/redis`), `bun:test`.

**Reference spec:** `docs/superpowers/specs/2026-06-17-neon-data-transfer-reduction-design.md`

---

## File Structure

**Layer 1 — lean notifications + interval bumps**
- Modify: `apps/web/src/lib/notifications-inbox-poll.ts` — bump poll interval to 5 min; add `decrementUnread` pure helper.
- Modify: `apps/web/src/lib/notifications-inbox-poll.test.ts` (Create if absent) — test `decrementUnread`.
- Modify: `apps/web/src/components/notifications/notifications-inbox-provider.tsx` — separate `unreadCount` state fed by the count endpoint + SSE; full rows only via `refresh()`.
- Modify: `apps/web/src/lib/still-api-fetch.ts` — add `fetchNotificationsUnreadCount`.
- Modify: `apps/web/src/components/gamification/badge-watcher.tsx` — interval 60s → 120s.

**Layer 2 — Redis read-through cache for mutual follows**
- Create: `apps/server/src/lib/redis-cache.ts` — `cacheRedis()`, `cachedRead()`, `invalidateCache()`.
- Create: `apps/server/src/lib/redis-cache.test.ts` — hit/miss/TTL/failure-fallthrough.
- Create: `apps/server/src/lib/mutual-follow-cache.ts` — `mutualFollowCacheKey()`, `fetchMutualFollowingIds()`, `invalidateMutualFollowCache()`.
- Create: `apps/server/src/lib/mutual-follow-cache.test.ts` — key format + invalidation deletes both keys.
- Modify: `apps/server/src/lib/patron-presence.ts` — use `fetchMutualFollowingIds`.
- Modify: `apps/server/src/lib/listing-presence.ts` — use `fetchMutualFollowingIds`.
- Modify: `apps/server/src/routes/follows.ts` — invalidate on follow/unfollow.

**Layer 3 — interval tuning**
- Modify: `apps/web/src/components/realtime/patron-online-provider.tsx` — `POLL_MS` 20s → 30s.
- Modify: `apps/web/src/hooks/use-listing-presence.ts` — `POLL_MS` 20s → 30s.

**Out of scope (intentional):** trimming `GET /api/notifications/` columns (the panel uses the full row, and it now loads only on open); migrating off `neon-http`; adding a `badge.awarded` realtime event.

---

## Layer 1 — Lean notifications + interval bumps

### Task 1: Pure helper `decrementUnread` + slower safety poll

**Files:**
- Modify: `apps/web/src/lib/notifications-inbox-poll.ts`
- Create: `apps/web/src/lib/notifications-inbox-poll.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/notifications-inbox-poll.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import {
	decrementUnread,
	NOTIFICATIONS_INBOX_POLL_INTERVAL_MS,
} from "./notifications-inbox-poll";

describe("decrementUnread", () => {
	test("decrements by one", () => {
		expect(decrementUnread(3)).toBe(2);
	});

	test("never goes below zero", () => {
		expect(decrementUnread(0)).toBe(0);
	});
});

describe("NOTIFICATIONS_INBOX_POLL_INTERVAL_MS", () => {
	test("is the slow 5-minute safety net (SSE handles freshness)", () => {
		expect(NOTIFICATIONS_INBOX_POLL_INTERVAL_MS).toBe(300_000);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/web/src/lib/notifications-inbox-poll.test.ts`
Expected: FAIL — `decrementUnread` is not exported and the interval is still `60_000`.

- [ ] **Step 3: Edit `notifications-inbox-poll.ts`**

Change the interval constant and add the helper. Replace the first line:

```ts
/** How often the global inbox refetches the unread count while foregrounded (SSE is primary). */
export const NOTIFICATIONS_INBOX_POLL_INTERVAL_MS = 300_000;
```

Append at the end of the file:

```ts
/** Optimistic unread-badge decrement when marking a single row read (never negative). */
export function decrementUnread(current: number): number {
	return Math.max(0, current - 1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/web/src/lib/notifications-inbox-poll.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/notifications-inbox-poll.ts apps/web/src/lib/notifications-inbox-poll.test.ts
git commit -m "perf(web): slow inbox safety poll to 5m + add decrementUnread helper"
```

---

### Task 2: Add `fetchNotificationsUnreadCount` client helper

**Files:**
- Modify: `apps/web/src/lib/still-api-fetch.ts`

- [ ] **Step 1: Read the existing badge fetch for the call pattern**

Run: open `apps/web/src/lib/still-api-fetch.ts` and find `fetchBadgesRecent` (~line 600) to mirror its `stillApiOrigin()` + fetch + credentials shape.

- [ ] **Step 2: Add the helper**

Append next to the other notification helpers in `apps/web/src/lib/still-api-fetch.ts` (use the same `stillApiOrigin()` + `credentials: "include"` pattern already used in that file):

```ts
/** Cheap unread-badge count — avoids downloading the full inbox on every poll. */
export async function fetchNotificationsUnreadCount(): Promise<number> {
	const res = await fetch(new URL("/api/notifications/unread-count", stillApiOrigin()), {
		credentials: "include",
	});
	if (!res.ok) return 0;
	const data = (await res.json()) as { count?: number };
	return typeof data.count === "number" ? data.count : 0;
}
```

> Note: the server route `GET /api/notifications/unread-count` already exists in `apps/server/src/routes/notifications.ts` and returns `{ count }`.

- [ ] **Step 3: Verify it typechecks**

Run: `bun run check-types`
Expected: PASS (no new type errors).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/still-api-fetch.ts
git commit -m "feat(web): add fetchNotificationsUnreadCount client helper"
```

---

### Task 3: Make the inbox provider count-only in steady state

**Files:**
- Modify: `apps/web/src/components/notifications/notifications-inbox-provider.tsx`

Behavior contract (must stay identical for the user): the bell dot and mobile-tab dot reflect unread count; opening the bell menu (`refresh()` on open) and the `/notifications` page (`refresh()` on mount) still load full rows. Only the *background* path changes from "fetch full list" to "fetch count".

- [ ] **Step 1: Add the count import**

In `notifications-inbox-provider.tsx`, add to the imports:

```ts
import {
	computeNotificationsUnreadCount,
	decrementUnread,
	NOTIFICATIONS_INBOX_FETCH_LIMIT,
	NOTIFICATIONS_INBOX_POLL_INTERVAL_MS,
	shouldRunNotificationsInboxPoll,
} from "@/lib/notifications-inbox-poll";
import { fetchNotificationsUnreadCount } from "@/lib/still-api-fetch";
```

(The file already imports `postNotificationRead` from `@/lib/still-api-fetch`; merge into one import line.)

- [ ] **Step 2: Add `unreadCount` state and drop the derived memo**

Replace the state block near the top of `NotificationsInboxProvider`:

```ts
	const [rows, setRows] = useState<NotificationPreviewRow[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [loading, setLoading] = useState(false);
	const inFlight = useRef(new Set<string>());
	const rowsRef = useRef(rows);
	rowsRef.current = rows;
```

And delete the later derived memo entirely:

```ts
	// DELETE these lines:
	const unreadCount = useMemo(
		() => computeNotificationsUnreadCount(rows),
		[rows],
	);
```

- [ ] **Step 3: Reconcile count inside `refresh` (full-rows path)**

Update `refresh` so loading full rows also syncs the badge (no extra request — same behavior as before, derived from rows):

```ts
	const refresh = useCallback(async () => {
		if (rowsRef.current.length === 0) setLoading(true);
		try {
			const data = await fetchNotifications();
			setRows(data);
			setUnreadCount(computeNotificationsUnreadCount(data));
		} catch {
			// Keep last good inbox on transient failure.
		} finally {
			setLoading(false);
		}
	}, [fetchNotifications]);
```

- [ ] **Step 4: Replace the background effect to poll the count, not the list**

Replace the whole `useEffect` that currently calls `loadQuiet` (the one starting `let cancelled = false;` with the `loadQuiet`/`startPoll`/`syncPoll` block) with:

```ts
	useEffect(() => {
		let cancelled = false;

		const loadCount = async () => {
			try {
				const count = await fetchNotificationsUnreadCount();
				if (!cancelled) setUnreadCount(count);
			} catch {
				// Best-effort — keep last known count on transient failure.
			}
		};

		void loadCount();

		// SSE invalidation is primary; this poll is just a slow safety net.
		let timer: ReturnType<typeof setInterval> | null = null;
		const startPoll = () => {
			if (timer != null) return;
			timer = setInterval(() => {
				if (shouldRunNotificationsInboxPoll(document.visibilityState)) {
					void loadCount();
				}
			}, NOTIFICATIONS_INBOX_POLL_INTERVAL_MS);
		};
		const stopPoll = () => {
			if (timer == null) return;
			clearInterval(timer);
			timer = null;
		};

		if (shouldRunNotificationsInboxPoll(document.visibilityState)) startPoll();

		const onVisibility = () => {
			if (document.visibilityState === "visible") {
				void loadCount();
				startPoll();
			} else {
				stopPoll();
			}
		};
		document.addEventListener("visibilitychange", onVisibility);

		const unsubLive = subscribeNotificationsInboxLive(() => {
			if (shouldRunNotificationsInboxPoll(document.visibilityState)) {
				void loadCount();
			}
		});

		return () => {
			cancelled = true;
			stopPoll();
			unsubLive();
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, []);
```

> Why no full fetch on mount anymore: the bell menu calls `refresh()` on open (`notifications-bell-menu.tsx`) and the `/notifications` page calls `refresh()` on mount (`notifications-list-live.tsx`). Steady state with the bell closed now issues only the cheap count call.

- [ ] **Step 5: Keep the badge accurate when marking read**

In `markOneRead`, after the optimistic row update, also decrement the count (only when the row was actually unread). Insert right after `setRows((prev) => ...)` optimistic update and before `postNotificationRead`:

```ts
		if (!previousReadAt) setUnreadCount((c) => decrementUnread(c));
```

And on failure (inside the `if (!res.ok)` block), restore it:

```ts
			if (!previousReadAt) setUnreadCount((c) => c + 1);
```

In `markAllRead`, after the optimistic `setRows(...)` mapping, add:

```ts
			setUnreadCount(0);
```

- [ ] **Step 6: Verify typecheck + lint**

Run: `bun run check-types && bun run check`
Expected: PASS. If `computeNotificationsUnreadCount` or `useMemo` is now unused anywhere, remove the dangling import — `check` (biome) will flag it.

- [ ] **Step 7: Manual smoke (preview)**

Start the web app, sign in, and confirm: bell dot reflects unread; opening the bell loads the list; marking one read decrements the dot; "mark all read" clears it. No console errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/notifications/notifications-inbox-provider.tsx
git commit -m "perf(web): inbox badge polls unread-count, full rows load on open"
```

---

### Task 4: Slow the badge watcher poll

**Files:**
- Modify: `apps/web/src/components/gamification/badge-watcher.tsx`

The watcher already uses a lightweight since-cursor query (`/badges/me/recent`); only the cadence needs to drop.

- [ ] **Step 1: Change the interval**

In `badge-watcher.tsx`, change:

```ts
		const interval = setInterval(poll, 60_000);
```

to:

```ts
		const interval = setInterval(poll, 120_000);
```

- [ ] **Step 2: Verify typecheck**

Run: `bun run check-types`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/gamification/badge-watcher.tsx
git commit -m "perf(web): halve badge-watcher poll frequency (120s)"
```

---

## Layer 2 — Redis read-through cache for mutual follows

### Task 5: `redis-cache.ts` read-through helper

**Files:**
- Create: `apps/server/src/lib/redis-cache.ts`
- Create: `apps/server/src/lib/redis-cache.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/lib/redis-cache.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { cachedRead, invalidateCache } from "./redis-cache";

function fakeRedis() {
	const store = new Map<string, unknown>();
	return {
		store,
		get: async <T>(key: string): Promise<T | null> =>
			(store.has(key) ? (store.get(key) as T) : null),
		set: async (key: string, value: unknown) => {
			store.set(key, value);
		},
		del: async (...keys: string[]) => {
			for (const k of keys) store.delete(k);
		},
	};
}

describe("cachedRead", () => {
	test("loads and caches on miss", async () => {
		const redis = fakeRedis();
		let calls = 0;
		const loader = async () => {
			calls += 1;
			return ["a", "b"];
		};
		const first = await cachedRead(redis, "k", 60, loader);
		const second = await cachedRead(redis, "k", 60, loader);
		expect(first).toEqual(["a", "b"]);
		expect(second).toEqual(["a", "b"]);
		expect(calls).toBe(1); // second call served from cache
	});

	test("falls through to loader when redis is null", async () => {
		const value = await cachedRead(null, "k", 60, async () => "x");
		expect(value).toBe("x");
	});
});

describe("invalidateCache", () => {
	test("deletes the given keys", async () => {
		const redis = fakeRedis();
		redis.store.set("a", 1);
		redis.store.set("b", 2);
		await invalidateCache(redis, "a", "b");
		expect(redis.store.has("a")).toBe(false);
		expect(redis.store.has("b")).toBe(false);
	});

	test("is a no-op when redis is null", async () => {
		await expect(invalidateCache(null, "a")).resolves.toBeUndefined();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/server/src/lib/redis-cache.test.ts`
Expected: FAIL — module `./redis-cache` not found.

- [ ] **Step 3: Implement `redis-cache.ts`**

Create `apps/server/src/lib/redis-cache.ts`:

```ts
import { getRealtimeRedis } from "./realtime-redis";

/** Minimal Upstash surface used for read-through caching. */
export type CacheRedis = {
	get: <T>(key: string) => Promise<T | null>;
	set: (
		key: string,
		value: unknown,
		opts?: { ex?: number },
	) => Promise<unknown>;
	del: (...keys: string[]) => Promise<unknown>;
};

/** Shared Upstash client typed for caching; null in local dev without Upstash env. */
export function cacheRedis(): CacheRedis | null {
	return getRealtimeRedis() as unknown as CacheRedis | null;
}

/**
 * Read-through cache. On hit returns the cached value; on miss runs `loader`,
 * stores the result with a TTL, and returns it. Cache errors never fail the
 * caller — they fall through to `loader`.
 */
export async function cachedRead<T>(
	redis: CacheRedis | null,
	key: string,
	ttlSec: number,
	loader: () => Promise<T>,
): Promise<T> {
	if (!redis) return loader();
	try {
		const cached = await redis.get<T>(key);
		if (cached !== null && cached !== undefined) return cached;
	} catch {
		// Cache read failed — fall through to the source of truth.
	}
	const value = await loader();
	try {
		await redis.set(key, value, { ex: ttlSec });
	} catch {
		// Best-effort cache write.
	}
	return value;
}

/** Delete cache keys; best-effort, no-op without a client. */
export async function invalidateCache(
	redis: CacheRedis | null,
	...keys: string[]
): Promise<void> {
	if (!redis || keys.length === 0) return;
	try {
		await redis.del(...keys);
	} catch {
		// Best-effort invalidation.
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/server/src/lib/redis-cache.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/redis-cache.ts apps/server/src/lib/redis-cache.test.ts
git commit -m "feat(server): add Upstash read-through cache helper"
```

---

### Task 6: `mutual-follow-cache.ts`

**Files:**
- Create: `apps/server/src/lib/mutual-follow-cache.ts`
- Create: `apps/server/src/lib/mutual-follow-cache.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/lib/mutual-follow-cache.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { mutualFollowCacheKey } from "./mutual-follow-cache";

describe("mutualFollowCacheKey", () => {
	test("namespaces by viewer id", () => {
		expect(mutualFollowCacheKey("user_123")).toBe(
			"cache:follow:mutual:user_123",
		);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/server/src/lib/mutual-follow-cache.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `mutual-follow-cache.ts`**

Create `apps/server/src/lib/mutual-follow-cache.ts`:

```ts
import { db, follow } from "@still/db";
import { and, eq } from "drizzle-orm";

import { cacheRedis, cachedRead, invalidateCache } from "./redis-cache";

/** TTL for a viewer's mutual-following set — short; also invalidated on follow change. */
export const MUTUAL_FOLLOW_CACHE_TTL_SEC = 60;

/** Redis key for a viewer's full set of mutual-following user ids. */
export function mutualFollowCacheKey(viewerId: string): string {
	return `cache:follow:mutual:${viewerId}`;
}

/**
 * All user ids the viewer mutually follows. Cached in Redis (read-through) so
 * the presence poll stops hitting Neon every ~20s. Callers filter this set
 * against the candidate ids they care about in memory.
 */
export async function fetchMutualFollowingIds(
	viewerId: string,
): Promise<string[]> {
	return cachedRead(
		cacheRedis(),
		mutualFollowCacheKey(viewerId),
		MUTUAL_FOLLOW_CACHE_TTL_SEC,
		async () => {
			const rows = await db
				.select({ userId: follow.followingId })
				.from(follow)
				.where(and(eq(follow.followerId, viewerId), eq(follow.isMutual, true)));
			return rows.map((row) => row.userId);
		},
	);
}

/** Drop cached mutual sets for the affected users after a follow/unfollow. */
export async function invalidateMutualFollowCache(
	...userIds: string[]
): Promise<void> {
	await invalidateCache(cacheRedis(), ...userIds.map(mutualFollowCacheKey));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/server/src/lib/mutual-follow-cache.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/mutual-follow-cache.ts apps/server/src/lib/mutual-follow-cache.test.ts
git commit -m "feat(server): cached mutual-following set with invalidation"
```

---

### Task 7: Use the cache in `patron-presence.ts`

**Files:**
- Modify: `apps/server/src/lib/patron-presence.ts`

- [ ] **Step 1: Add the import**

Add near the other lib imports in `patron-presence.ts`:

```ts
import { fetchMutualFollowingIds } from "./mutual-follow-cache";
```

- [ ] **Step 2: Replace the inline mutual query**

In `resolveVisiblePresenceForViewer`, replace this block:

```ts
	const mutualRows = await db
		.select({ userId: follow.followingId })
		.from(follow)
		.where(
			and(
				eq(follow.followerId, viewerId),
				eq(follow.isMutual, true),
				inArray(follow.followingId, candidateIds),
			),
		);
	const mutualIds = new Set(mutualRows.map((row) => row.userId));
```

with:

```ts
	const mutualAll = await fetchMutualFollowingIds(viewerId);
	const mutualIds = new Set(
		candidateIds.filter((id) => mutualAll.includes(id)),
	);
```

- [ ] **Step 3: Clean up now-unused imports**

`follow` is no longer referenced in this file. Remove it from the `@still/db` import (keep `db`, `profile`). If `and`/`eq`/`inArray`/`isNotNull` are still used by the remaining `profile` query (they are: the profile `where` uses `and`, `inArray`, `eq`, `isNotNull`), leave them. Run `bun run check` to confirm no unused-import errors.

- [ ] **Step 4: Verify existing presence tests still pass**

Run: `bun test apps/server/src/lib/patron-presence.test.ts`
Expected: PASS. (Pure mappers like `pickVisiblePresenceForViewer` are unchanged; if a test directly exercises `resolveVisiblePresenceForViewer` with a mock that lacks Upstash env, `cacheRedis()` returns null and `cachedRead` falls through to the DB loader — behavior identical to before.)

- [ ] **Step 5: Typecheck + commit**

```bash
bun run check-types
git add apps/server/src/lib/patron-presence.ts
git commit -m "perf(server): serve presence mutual lookup from Redis cache"
```

---

### Task 8: Use the cache in `listing-presence.ts`

**Files:**
- Modify: `apps/server/src/lib/listing-presence.ts`

- [ ] **Step 1: Add the import**

Add near the other lib imports in `listing-presence.ts`:

```ts
import { fetchMutualFollowingIds } from "./mutual-follow-cache";
```

- [ ] **Step 2: Replace the inline mutual query in `fetchViewingPatronsInRoom`**

Replace:

```ts
	const mutualRows = await db
		.select({ userId: follow.followingId })
		.from(follow)
		.where(
			and(
				eq(follow.followerId, viewerId),
				eq(follow.isMutual, true),
				inArray(follow.followingId, candidateIds),
			),
		);
	const mutualIds = new Set(mutualRows.map((row) => row.userId));
```

with:

```ts
	const mutualAll = await fetchMutualFollowingIds(viewerId);
	const mutualIds = new Set(
		candidateIds.filter((id) => mutualAll.includes(id)),
	);
```

- [ ] **Step 3: Clean up imports**

The remaining `profile`+`user` join query still uses `db`, `and`, `eq`, `inArray`, `isNotNull`, `asc`. Confirm whether `follow` is still referenced elsewhere in the file; if not, remove it from the `@still/db` import. Run `bun run check` to confirm.

- [ ] **Step 4: Verify listing-presence tests still pass**

Run: `bun test apps/server/src/lib/listing-presence.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
bun run check-types
git add apps/server/src/lib/listing-presence.ts
git commit -m "perf(server): serve listing presence mutual lookup from Redis cache"
```

---

### Task 9: Invalidate the cache on follow/unfollow

**Files:**
- Modify: `apps/server/src/routes/follows.ts`

- [ ] **Step 1: Add the import**

Add to the lib imports in `follows.ts`:

```ts
import { invalidateMutualFollowCache } from "../lib/mutual-follow-cache";
```

- [ ] **Step 2: Invalidate in the POST (follow) handler**

In the `.post("/:userId", ...)` handler, just before `return { following: true };`, add:

```ts
				await invalidateMutualFollowCache(viewer.id, params.userId);
```

(The mutual flag may have just flipped to true for both directions, so both viewers' cached sets are stale.)

- [ ] **Step 3: Invalidate in the DELETE (unfollow) handler**

In the `.delete("/:userId", ...)` handler, just before `return { following: false };`, add:

```ts
				await invalidateMutualFollowCache(viewer.id, params.userId);
```

- [ ] **Step 4: Verify typecheck**

Run: `bun run check-types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/follows.ts
git commit -m "fix(server): invalidate mutual-follow cache on follow/unfollow"
```

---

## Layer 3 — Interval tuning

### Task 10: Lengthen presence poll intervals

**Files:**
- Modify: `apps/web/src/components/realtime/patron-online-provider.tsx`
- Modify: `apps/web/src/hooks/use-listing-presence.ts`

Heartbeats (`HEARTBEAT_MS = 25_000`) keep occupancy fresh and write only to Redis — leave them. Only the Neon-touching online/snapshot **poll** slows down; `presence.updated` SSE still pushes changes immediately.

- [ ] **Step 1: Bump `POLL_MS` in `patron-online-provider.tsx`**

Change:

```ts
const POLL_MS = 20_000;
```

to:

```ts
const POLL_MS = 30_000;
```

- [ ] **Step 2: Bump `POLL_MS` in `use-listing-presence.ts`**

Change:

```ts
const POLL_MS = 20_000;
```

to:

```ts
const POLL_MS = 30_000;
```

- [ ] **Step 3: Verify typecheck**

Run: `bun run check-types`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/realtime/patron-online-provider.tsx apps/web/src/hooks/use-listing-presence.ts
git commit -m "perf(web): slow presence online poll to 30s (SSE remains primary)"
```

---

## Final verification

### Task 11: Full check + measurement note

- [ ] **Step 1: Typecheck the whole monorepo**

Run: `bun run check-types`
Expected: PASS.

- [ ] **Step 2: Lint/format**

Run: `bun run check`
Expected: PASS (no unused imports left behind from Tasks 7–8).

- [ ] **Step 3: Run the touched test files**

Run:
```bash
bun test apps/web/src/lib/notifications-inbox-poll.test.ts \
	apps/server/src/lib/redis-cache.test.ts \
	apps/server/src/lib/mutual-follow-cache.test.ts \
	apps/server/src/lib/patron-presence.test.ts \
	apps/server/src/lib/listing-presence.test.ts
```
Expected: all PASS.

- [ ] **Step 4: Manual smoke**

Sign in on the running app and confirm, with the browser network tab open: with the bell **closed**, the only notifications request on the interval is `…/notifications/unread-count` (not `…/notifications`); presence `…/realtime/presence/online` fires ~every 30s; opening the bell issues one `…/notifications` request and shows the list; following/unfollowing a user still updates "online" chips correctly.

- [ ] **Step 5: Measurement (post-merge)**

After deploy, watch the Neon dashboard **Data transfer** line over 2–3 days at comparable traffic. Expect the largest drop from Task 3 (count-only inbox). Record before/after in the spec if you want a paper trail. No schema or UX changes were made, so any user-visible regression is a bug — roll back the offending task's commit.

---

## Self-Review notes (already applied)

- **Spec coverage:** Layer 1 (1a count-only → Tasks 2–3; 1b slow poll → Task 1; 1c badge → Task 4), Layer 2 (cache helper → Task 5; presence application → Tasks 6–8; invalidation → Task 9), Layer 3 (intervals → Task 10), verification/measurement → Task 11. Profile-by-handle caching from the spec was intentionally dropped to avoid presence-privacy staleness; the mutual-follow cache (with invalidation) delivers the presence win safely. `SELECT *` column trimming dropped as YAGNI (panel uses the full row; rows now load only on open).
- **Type consistency:** `cachedRead`/`invalidateCache`/`cacheRedis`/`CacheRedis` used identically across Tasks 5–6; `fetchMutualFollowingIds(viewerId)` signature identical in Tasks 6–8; `decrementUnread`/`NOTIFICATIONS_INBOX_POLL_INTERVAL_MS` identical in Tasks 1 and 3.
- **No placeholders:** every code step shows the full code; every run step shows the command and expected result.
