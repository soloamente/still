# Presence AFK Status (Orange Dot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an orange away dot (with micro-pop motion) when a connected patron is AFK — tab hidden or no input for 5 minutes — on every global `PatronOnlineDot` surface and listing presence rows.

**Architecture:** Client `usePatronActivityTracker` derives `activityState: "active" | "away"` and sends it on existing `POST /api/realtime/presence` heartbeats (immediate on flip, else every 25s). Server stores per-user state in Redis HASH `sense:presence:activity` alongside existing ZSET heartbeats. Batch read (`GET /online`) and listing snapshot return `state` / `presenceState` for UI color + SR labels.

**Tech Stack:** Elysia, Upstash Redis (ZSET + HASH), Next.js client hooks, `motion/react`, Bun tests.

**Spec:** [`docs/superpowers/specs/2026-06-16-presence-afk-status-design.md`](../specs/2026-06-16-presence-afk-status-design.md)

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/server/src/lib/presence-activity.ts` | Activity HASH key, read/write helpers, `normalizeActivityState` |
| `apps/server/src/lib/listing-presence.ts` | Extend `ListingPresenceRedis` + touch/leave to persist activity |
| `apps/server/src/lib/patron-presence.ts` | Return `{ handle, state }[]` instead of bare handles |
| `apps/server/src/routes/realtime-presence.ts` | Accept `activityState` on POST; return `presence` on GET `/online` |
| `apps/web/src/lib/patron-activity-tracker.ts` | Pure AFK derivation + constants (testable without DOM) |
| `apps/web/src/hooks/use-patron-activity-tracker.ts` | DOM listeners + interval; exposes `activityState` |
| `apps/web/src/lib/fetch-patron-online.ts` | Send `activityState` on POST; parse `presence[]` |
| `apps/web/src/lib/fetch-listing-presence.ts` | Send `activityState`; type `presenceState` on patrons |
| `apps/web/src/components/realtime/patron-online-provider.tsx` | Heartbeat with activity; `presenceByHandle` map |
| `apps/web/src/components/profile/patron-online-dot.tsx` | Green/orange + micro-pop on state change |
| `apps/web/src/components/profile/patron-portrait-with-metal-tier.tsx` | `usePatronPresenceState` → dot |
| `apps/web/src/components/movie/listing-presence-row.tsx` | `showOnlineStatus` + `presenceState` from snapshot |
| `apps/web/src/components/movie/listing-presence-drawer.tsx` | Same for drawer rows |

---

### Task 1: Server activity state helpers

**Files:**
- Create: `apps/server/src/lib/presence-activity.ts`
- Test: `apps/server/src/lib/presence-activity.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/server/src/lib/presence-activity.test.ts
import { describe, expect, test } from "bun:test";
import {
	normalizeActivityState,
	presenceActivityRedisKey,
	readActivityStateForUser,
} from "./presence-activity";

describe("normalizeActivityState", () => {
	test("defaults missing to active", () => {
		expect(normalizeActivityState(undefined)).toBe("active");
	});
	test("accepts away", () => {
		expect(normalizeActivityState("away")).toBe("away");
	});
	test("rejects invalid values", () => {
		expect(normalizeActivityState("offline")).toBe("active");
	});
});

describe("readActivityStateForUser", () => {
	test("missing hash field returns active", async () => {
		const redis = {
			hget: async () => null,
		};
		expect(await readActivityStateForUser(redis, "usr_1")).toBe("active");
	});
	test("away hash value returns away", async () => {
		const redis = {
			hget: async () => "away",
		};
		expect(await readActivityStateForUser(redis, "usr_1")).toBe("away");
	});
});

test("presenceActivityRedisKey is stable", () => {
	expect(presenceActivityRedisKey()).toBe("sense:presence:activity");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/lib/presence-activity.test.ts`  
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/server/src/lib/presence-activity.ts
export type PatronActivityState = "active" | "away";

export const PRESENCE_ACTIVITY_HASH_KEY = "sense:presence:activity";

export function presenceActivityRedisKey(): string {
	return PRESENCE_ACTIVITY_HASH_KEY;
}

export function normalizeActivityState(
	raw: string | undefined | null,
): PatronActivityState {
	if (raw === "away") return "away";
	return "active";
}

export type PresenceActivityRedis = {
	hset: (key: string, field: string, value: string) => Promise<unknown>;
	hget: (key: string, field: string) => Promise<string | null>;
	hdel: (key: string, field: string) => Promise<unknown>;
};

export async function writeActivityStateForUser(
	redis: PresenceActivityRedis,
	userId: string,
	state: PatronActivityState,
): Promise<void> {
	await redis.hset(presenceActivityRedisKey(), userId, state);
}

export async function clearActivityStateForUser(
	redis: PresenceActivityRedis,
	userId: string,
): Promise<void> {
	await redis.hdel(presenceActivityRedisKey(), userId);
}

export async function readActivityStateForUser(
	redis: Pick<PresenceActivityRedis, "hget">,
	userId: string,
): Promise<PatronActivityState> {
	const raw = await redis.hget(presenceActivityRedisKey(), userId);
	return normalizeActivityState(raw);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && bun test src/lib/presence-activity.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/presence-activity.ts apps/server/src/lib/presence-activity.test.ts
git commit -m "feat(server): add presence activity state redis helpers"
```

---

### Task 2: Wire activity into touch / leave

**Files:**
- Modify: `apps/server/src/lib/listing-presence.ts`
- Modify: `apps/server/src/lib/patron-presence.ts`
- Test: `apps/server/src/lib/listing-presence.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `listing-presence.test.ts`:

```ts
test("touchListingPresence writes activity state when redis supports hset", async () => {
	const store = new Map<string, string>();
	const redis = {
		zadd: async () => {},
		zremrangebyscore: async () => {},
		zcard: async () => 1,
		zrem: async () => {},
		zrange: async () => ["usr_1"],
		expire: async () => {},
		hset: async (_key: string, field: string, value: string) => {
			store.set(field, value);
		},
		hget: async (_key: string, field: string) => store.get(field) ?? null,
		hdel: async (_key: string, field: string) => {
			store.delete(field);
		},
	};
	await touchListingPresence(redis, "listing:movie:1", "usr_1", Date.now(), "away");
	expect(store.get("usr_1")).toBe("away");
});
```

Extend `touchListingPresence` / `leaveListingPresence` signatures to accept optional `activityState` and call `writeActivityStateForUser` / `clearActivityStateForUser`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/lib/listing-presence.test.ts`  
Expected: FAIL — `touchListingPresence` does not accept activity state.

- [ ] **Step 3: Write minimal implementation**

- Extend `ListingPresenceRedis` type with optional `hset`/`hget`/`hdel` (or intersect with `PresenceActivityRedis`).
- In `touchListingPresence`, after `zadd`, if `activityState` provided and `hset` exists, call `writeActivityStateForUser`.
- In `leaveListingPresence`, after `zrem`, call `clearActivityStateForUser` when `hdel` exists.
- Update `touchPatronAppPresence` to forward `activityState`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && bun test src/lib/listing-presence.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/listing-presence.ts apps/server/src/lib/listing-presence.test.ts apps/server/src/lib/patron-presence.ts
git commit -m "feat(server): persist activity state on presence touch/leave"
```

---

### Task 3: Listing snapshot returns `presenceState`

**Files:**
- Modify: `apps/server/src/lib/listing-presence.ts`
- Test: `apps/server/src/lib/listing-presence.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("pickListingPresenceViewingPatrons maps activity state per user", () => {
	const patrons = pickListingPresenceViewingPatrons(
		[{ userId: "u1", handle: "ada", /* ... */ isMutualWithViewer: true }],
		new Map(),
		8,
		new Map([["u1", "away" as const]]),
	);
	expect(patrons[0]?.presenceState).toBe("away");
});
```

Replace `isOnlineNow: true` with `presenceState` in `ListingPresenceViewingPatron` type.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/lib/listing-presence.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

- Add `activityByUserId: ReadonlyMap<string, PatronActivityState>` param to `pickListingPresenceViewingPatrons` (default empty → `active`).
- In `fetchViewingPatronsInRoom` / `getListingPresenceSnapshot`, batch-read activity via `hget` per candidate userId (or `hmget` if added).
- Set `presenceState` on each patron row.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && bun test src/lib/listing-presence.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/listing-presence.ts apps/server/src/lib/listing-presence.test.ts
git commit -m "feat(server): expose presenceState on listing presence patrons"
```

---

### Task 4: Batch online API returns presence rows with state

**Files:**
- Modify: `apps/server/src/lib/patron-presence.ts`
- Modify: `apps/server/src/lib/patron-presence.test.ts`
- Modify: `apps/server/src/routes/realtime-presence.ts`
- Modify: `apps/server/src/routes/realtime-presence.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// patron-presence.test.ts
test("pickVisiblePresenceForViewer returns state away when hash says away", () => {
	const rows = pickVisiblePresenceForViewer(
		VIEWER_ID,
		[row({ userId: "usr_friend", handle: "friend" })],
		new Set(["usr_friend"]),
		new Map([["usr_friend", "away" as const]]),
	);
	expect(rows).toEqual([{ handle: "friend", state: "away" }]);
});
```

Route test: `GET /online` returns `{ presence: [{ handle, state }] }` not `onlineHandles`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/lib/patron-presence.test.ts src/routes/realtime-presence.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

- Add `pickVisiblePresenceForViewer` (refactor from `pickVisibleOnlineHandles`; keep old helper as thin wrapper if needed elsewhere).
- `resolveVisibleOnlineHandlesForViewer` → `resolveVisiblePresenceForViewer` returning `Array<{ handle: string; state: PatronActivityState }>`.
- `POST /` body: add optional `activityState` with Elysia `t.Union([t.Literal("active"), t.Literal("away")])`.
- Pass `normalizeActivityState(body.activityState)` into touch functions.
- `GET /online`: return `{ presence: rows }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && bun test src/lib/patron-presence.test.ts src/routes/realtime-presence.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/patron-presence.ts apps/server/src/lib/patron-presence.test.ts apps/server/src/routes/realtime-presence.ts apps/server/src/routes/realtime-presence.test.ts
git commit -m "feat(server): presence batch API returns active/away state"
```

---

### Task 5: Client activity tracker (pure + hook)

**Files:**
- Create: `apps/web/src/lib/patron-activity-tracker.ts`
- Create: `apps/web/src/lib/patron-activity-tracker.test.ts`
- Create: `apps/web/src/hooks/use-patron-activity-tracker.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/patron-activity-tracker.test.ts
import { describe, expect, test } from "bun:test";
import { derivePatronActivityState } from "./patron-activity-tracker";

describe("derivePatronActivityState", () => {
	const now = 1_000_000;
	const fiveMin = 5 * 60 * 1000;

	test("hidden document is away", () => {
		expect(
			derivePatronActivityState({
				nowMs: now,
				lastInputAtMs: now,
				documentHidden: true,
			}),
		).toBe("away");
	});

	test("idle 5 min on visible tab is away", () => {
		expect(
			derivePatronActivityState({
				nowMs: now,
				lastInputAtMs: now - fiveMin,
				documentHidden: false,
			}),
		).toBe("away");
	});

	test("recent input on visible tab is active", () => {
		expect(
			derivePatronActivityState({
				nowMs: now,
				lastInputAtMs: now - 60_000,
				documentHidden: false,
			}),
		).toBe("active");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/lib/patron-activity-tracker.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/lib/patron-activity-tracker.ts
export type PatronActivityState = "active" | "away";

export const PATRON_AFK_IDLE_MS = 5 * 60 * 1000;
export const PATRON_ACTIVITY_INPUT_THROTTLE_MS = 30_000;

export function derivePatronActivityState(input: {
	nowMs: number;
	lastInputAtMs: number;
	documentHidden: boolean;
}): PatronActivityState {
	if (input.documentHidden) return "away";
	if (input.nowMs - input.lastInputAtMs >= PATRON_AFK_IDLE_MS) return "away";
	return "active";
}
```

```ts
// apps/web/src/hooks/use-patron-activity-tracker.ts
"use client";

import { useEffect, useRef, useState } from "react";
import {
	derivePatronActivityState,
	PATRON_ACTIVITY_INPUT_THROTTLE_MS,
	type PatronActivityState,
} from "@/lib/patron-activity-tracker";

export function usePatronActivityTracker(enabled = true): PatronActivityState {
	const lastInputRef = useRef(Date.now());
	const [activityState, setActivityState] = useState<PatronActivityState>("active");
	const lastSentRef = useRef<PatronActivityState>("active");

	const recompute = () => {
		const next = derivePatronActivityState({
			nowMs: Date.now(),
			lastInputAtMs: lastInputRef.current,
			documentHidden: typeof document !== "undefined" ? document.hidden : false,
		});
		setActivityState(next);
		return next;
	};

	useEffect(() => {
		if (!enabled) return;

		let throttleTimer: ReturnType<typeof setTimeout> | null = null;
		const bumpInput = () => {
			lastInputRef.current = Date.now();
			if (throttleTimer) return;
			throttleTimer = setTimeout(() => {
				throttleTimer = null;
				recompute();
			}, PATRON_ACTIVITY_INPUT_THROTTLE_MS);
			recompute();
		};

		const onVisibility = () => recompute();
		const events = ["mousemove", "pointerdown", "keydown", "scroll", "touchstart"] as const;
		for (const event of events) {
			window.addEventListener(event, bumpInput, { passive: true });
		}
		document.addEventListener("visibilitychange", onVisibility);
		const interval = setInterval(recompute, 30_000);
		recompute();

		return () => {
			for (const event of events) {
				window.removeEventListener(event, bumpInput);
			}
			document.removeEventListener("visibilitychange", onVisibility);
			clearInterval(interval);
			if (throttleTimer) clearTimeout(throttleTimer);
		};
	}, [enabled]);

	// Expose flip detection for heartbeat callers via ref callback pattern in provider
	useEffect(() => {
		lastSentRef.current = activityState;
	}, [activityState]);

	return activityState;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun test src/lib/patron-activity-tracker.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/patron-activity-tracker.ts apps/web/src/lib/patron-activity-tracker.test.ts apps/web/src/hooks/use-patron-activity-tracker.ts
git commit -m "feat(web): patron AFK activity tracker hook"
```

---

### Task 6: Client fetch + providers send `activityState`

**Files:**
- Modify: `apps/web/src/lib/fetch-patron-online.ts`
- Modify: `apps/web/src/lib/fetch-listing-presence.ts`
- Modify: `apps/web/src/components/realtime/patron-online-provider.tsx`
- Modify: `apps/web/src/hooks/use-listing-presence.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/fetch-patron-online.test.ts (create if missing)
import { describe, expect, test } from "bun:test";
import { normalizePatronPresenceSnapshot } from "./fetch-patron-online";

test("normalizePatronPresenceSnapshot maps presence rows", () => {
	const map = normalizePatronPresenceSnapshot({
		presence: [
			{ handle: "Ada", state: "away" },
			{ handle: "bob", state: "active" },
		],
	});
	expect(map.get("ada")).toBe("away");
	expect(map.get("bob")).toBe("active");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/lib/fetch-patron-online.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

- `touchPatronAppPresenceClient(activityState?: PatronActivityState)` — include in JSON body.
- `touchListingPresenceClient(roomId, activityState?)` — same.
- Replace `PatronOnlineSnapshot.onlineHandles` with `presence: { handle, state }[]`.
- Add `normalizePatronPresenceSnapshot` → `Map<string, PatronActivityState>`.
- `PatronOnlineProvider`:
  - Call `usePatronActivityTracker(active)`.
  - Pass `activityState` into every heartbeat.
  - On `activityState` change (useEffect comparing prev), fire immediate `touchPatronAppPresenceClient`.
  - Store `presenceByHandle` map; expose `getPresenceState(handle)` returning `"active" | "away" | null`.
- `use-listing-presence.ts`: accept `activityState` from shared context or duplicate hook call — **prefer React context** `PatronActivityContext` exported from same module as tracker to avoid double listeners.

- [ ] **Step 4: Run tests**

Run: `cd apps/web && bun test src/lib/fetch-patron-online.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/fetch-patron-online.ts apps/web/src/lib/fetch-listing-presence.ts apps/web/src/components/realtime/patron-online-provider.tsx apps/web/src/hooks/use-listing-presence.ts
git commit -m "feat(web): send activityState on presence heartbeats"
```

---

### Task 7: `PatronOnlineDot` green/orange + micro-pop

**Files:**
- Modify: `apps/web/src/components/profile/patron-online-dot.tsx`
- Create: `apps/web/src/components/profile/patron-online-dot.test.ts`

- [ ] **Step 1: Write the failing test**

Use `@testing-library/react` if available, else pure class map test:

```ts
import { describe, expect, test } from "bun:test";
import { presenceDotSurfaceClass } from "./patron-online-dot";

test("active uses emerald", () => {
	expect(presenceDotSurfaceClass("active")).toContain("emerald");
});
test("away uses desert-orange", () => {
	expect(presenceDotSurfaceClass("away")).toContain("desert-orange");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/components/profile/patron-online-dot.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

- Replace `visible: boolean` with `presenceState: "active" | "away" | null`.
- Extract `presenceDotSurfaceClass(state)`.
- Keep mount/unmount `AnimatePresence` when `presenceState` goes null ↔ non-null.
- On `presenceState` change while mounted, `animate={{ scale: [1, 1.12, 1] }}` with ~180ms spring when `!reducedMotion`.
- Crossfade color via `animate` or conditional class on same `motion.span` (stable key `patron-online-dot`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun test src/components/profile/patron-online-dot.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/profile/patron-online-dot.tsx apps/web/src/components/profile/patron-online-dot.test.ts
git commit -m "feat(web): orange away dot with micro-pop animation"
```

---

### Task 8: Portrait + listing presence surfaces

**Files:**
- Modify: `apps/web/src/components/profile/patron-portrait-with-metal-tier.tsx`
- Modify: `apps/web/src/components/movie/listing-presence-row.tsx`
- Modify: `apps/web/src/components/movie/listing-presence-drawer.tsx`
- Modify: `apps/web/src/lib/fetch-listing-presence.ts` (types: `presenceState` not `isOnlineNow`)

- [ ] **Step 1: Write the failing test**

Update `listing-presence-copy.test.ts` or add assertion that SR label includes `away` when `presenceState === "away"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/lib/listing-presence-copy.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

- `usePatronOnlineStatus` → `usePatronPresenceState(handle)` returning `"active" | "away" | null`.
- `PatronOnlineDot` labels: `online now` vs `away`.
- Listing row/drawer: `showOnlineStatus={true}`; pass `presenceState={patron.presenceState}` directly to dot (listing snapshot already has state — skip global batch for row chips to avoid stale mismatch).
- For portraits using global provider, use `usePatronPresenceState`.

- [ ] **Step 4: Run targeted tests**

Run: `cd apps/web && bun test src/lib/listing-presence-copy.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/profile/patron-portrait-with-metal-tier.tsx apps/web/src/components/movie/listing-presence-row.tsx apps/web/src/components/movie/listing-presence-drawer.tsx apps/web/src/lib/fetch-listing-presence.ts
git commit -m "feat(web): wire presenceState to portraits and listing presence"
```

---

### Task 9: Full verification + docs

**Files:**
- Modify: `.cursor/scratchpad.md`
- Modify: `AGENTS.md` (one bullet under realtime if needed)

- [ ] **Step 1: Run server presence tests**

Run: `cd apps/server && bun test src/lib/presence-activity.test.ts src/lib/listing-presence.test.ts src/lib/patron-presence.test.ts src/routes/realtime-presence.test.ts`  
Expected: all PASS

- [ ] **Step 2: Run web presence tests**

Run: `cd apps/web && bun test src/lib/patron-activity-tracker.test.ts src/components/profile/patron-online-dot.test.ts src/lib/listing-presence-copy.test.ts`  
Expected: all PASS

- [ ] **Step 3: Manual QA checklist**

1. Tab away → orange dot for other patron within ~25s (or immediate if they heartbeat on flip).
2. 5 min idle → orange.
3. Mouse move → green micro-pop.
4. `prefers-reduced-motion` → no scale animation.
5. Listing corner pill + drawer dots match.

- [ ] **Step 4: Update scratchpad milestone**

Mark AFK plan ready / Task 1 pending human `go`.

- [ ] **Step 5: Commit**

```bash
git add .cursor/scratchpad.md AGENTS.md
git commit -m "docs: track presence AFK implementation progress"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| AFK = hidden OR 5 min idle | Task 5 |
| Global all PatronOnlineDot | Tasks 6–8 |
| activityState on POST heartbeat | Tasks 2, 4, 6 |
| Redis HASH `sense:presence:activity` | Tasks 1–2 |
| GET `/online` returns `presence[]` | Task 4 |
| Listing `presenceState` on rows | Task 3 |
| Green / orange colors | Task 7 |
| Micro-pop on state change | Task 7 |
| Privacy unchanged | Task 4 (existing tests extended) |
| Missing state → active | Tasks 1, 3, 4 |

## Human verification gate

After **Task 9**, Executor stops and asks Planner/human to verify manual QA before marking feature shipped.
