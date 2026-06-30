# Self Presence Dot (Online / Away) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the signed-in viewer their own green/orange presence dot on every portrait surface (server mirror state) and prepend themselves to listing presence when alone on a title page.

**Architecture:** Extend existing `GET /online` batch resolution and listing presence snapshots to include the viewer when heartbeat-active — bypassing privacy/`isPrivate` for self only. Remove the client-side `viewerHandleKey` filter; register the viewer handle proactively in `PatronOnlineProvider`. Self screen-reader labels use second-person copy.

**Tech Stack:** Elysia, Drizzle/Neon, Upstash Redis, Next.js client components, Bun tests.

**Spec:** [`docs/superpowers/specs/2026-06-30-presence-self-view-design.md`](../specs/2026-06-30-presence-self-view-design.md)

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/server/src/lib/patron-presence.ts` | `appendViewerSelfPresence` helper; wire into resolve functions; viewer handle lookup for private profiles |
| `apps/server/src/lib/patron-presence.test.ts` | Self inclusion tests for append helper |
| `apps/server/src/lib/listing-presence.ts` | `fetchViewerSelfPatronInRoom`; prepend self in snapshot getters |
| `apps/server/src/lib/listing-presence.test.ts` | Alone-with-self snapshot tests (pure compose where DB absent) |
| `apps/server/src/routes/realtime-presence.test.ts` | Optional `/online` integration assert for self row |
| `apps/web/src/lib/listing-presence-copy.ts` | Self SR labels; alone-with-self display resolver |
| `apps/web/src/lib/listing-presence-copy.test.ts` | Label + resolver tests |
| `apps/web/src/components/realtime/patron-online-provider.tsx` | Remove self filter; register viewer handle; expose `viewerHandle` on context |
| `apps/web/src/components/profile/patron-portrait-with-metal-tier.tsx` | Pass `perspective: "self"` to label helper |
| `apps/web/src/components/movie/listing-presence-row.tsx` | Alone aria label when `viewerCount === 0` with self in stack |

---

### Task 1: Server — append viewer self to `/online` presence batch

**Files:**
- Modify: `apps/server/src/lib/patron-presence.ts`
- Test: `apps/server/src/lib/patron-presence.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `apps/server/src/lib/patron-presence.test.ts`:

```ts
import { appendViewerSelfPresence } from "./patron-presence";

describe("appendViewerSelfPresence", () => {
	const VIEWER = "viewer_1";

	test("appends self when handle requested and active", () => {
		const result = appendViewerSelfPresence({
			viewerId: VIEWER,
			viewerHandle: "MeUser",
			requestedHandles: ["meuser", "friend"],
			activeUserIds: new Set([VIEWER]),
			activityByUserId: new Map([[VIEWER, "away"]]),
			presence: [],
		});
		expect(result).toEqual([{ handle: "meuser", state: "away" }]);
	});

	test("skips self when handle not in requested batch", () => {
		const result = appendViewerSelfPresence({
			viewerId: VIEWER,
			viewerHandle: "meuser",
			requestedHandles: ["friend"],
			activeUserIds: new Set([VIEWER]),
			activityByUserId: new Map(),
			presence: [],
		});
		expect(result).toEqual([]);
	});

	test("skips self when not heartbeat-active", () => {
		const result = appendViewerSelfPresence({
			viewerId: VIEWER,
			viewerHandle: "meuser",
			requestedHandles: ["meuser"],
			activeUserIds: new Set(),
			activityByUserId: new Map(),
			presence: [],
		});
		expect(result).toEqual([]);
	});

	test("does not duplicate when already present", () => {
		const result = appendViewerSelfPresence({
			viewerId: VIEWER,
			viewerHandle: "meuser",
			requestedHandles: ["meuser"],
			activeUserIds: new Set([VIEWER]),
			activityByUserId: new Map([[VIEWER, "active"]]),
			presence: [{ handle: "meuser", state: "active" }],
		});
		expect(result).toEqual([{ handle: "meuser", state: "active" }]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/lib/patron-presence.test.ts`  
Expected: FAIL — `appendViewerSelfPresence` not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `apps/server/src/lib/patron-presence.ts`:

```ts
export function appendViewerSelfPresence(input: {
	viewerId: string;
	viewerHandle: string | null | undefined;
	requestedHandles: readonly string[];
	activeUserIds: ReadonlySet<string>;
	activityByUserId: ReadonlyMap<string, PatronActivityState>;
	presence: VisiblePatronPresence[];
}): VisiblePatronPresence[] {
	const handle = input.viewerHandle?.trim().toLowerCase();
	if (!handle) return input.presence;
	if (!input.requestedHandles.includes(handle)) return input.presence;
	if (!input.activeUserIds.has(input.viewerId)) return input.presence;
	if (input.presence.some((row) => row.handle === handle)) {
		return input.presence;
	}
	return [
		...input.presence,
		{
			handle,
			state: input.activityByUserId.get(input.viewerId) ?? "active",
		},
	];
}
```

Wire into `resolveVisiblePresenceForViewer` and `resolveVisiblePresenceFromOccupancy` **after** `pickVisiblePresenceForViewer`:

```ts
// Lookup viewer handle when private profile excluded from rows query.
const viewerProfileRow = await db
	.select({ handle: profile.handle })
	.from(profile)
	.where(and(eq(profile.userId, viewerId), isNotNull(profile.handle)))
	.limit(1);

const presence = pickVisiblePresenceForViewer(/* ... */);

return appendViewerSelfPresence({
	viewerId,
	viewerHandle: viewerProfileRow[0]?.handle ?? null,
	requestedHandles: handles,
	activeUserIds,
	activityByUserId,
	presence,
});
```

Apply the same append block in `resolveVisiblePresenceFromOccupancy` (reuse handle from rows if viewer row exists, else same DB lookup).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && bun test src/lib/patron-presence.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/patron-presence.ts apps/server/src/lib/patron-presence.test.ts
git commit -m "feat(presence): include viewer self in online batch resolution"
```

---

### Task 2: Server — prepend viewer to listing presence snapshot

**Files:**
- Modify: `apps/server/src/lib/listing-presence.ts`
- Test: `apps/server/src/lib/listing-presence.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `apps/server/src/lib/listing-presence.test.ts`:

```ts
import { prependViewerSelfToViewingPatrons } from "./listing-presence";

describe("prependViewerSelfToViewingPatrons", () => {
	const selfPatron = {
		userId: "usr_viewer",
		handle: "viewer",
		displayName: "Viewer",
		image: null,
		avatarIsAnimated: false,
		diaryMetalTier: null,
		presenceState: "active" as const,
	};

	const otherPatron = {
		userId: "usr_friend",
		handle: "friend",
		displayName: "Friend",
		image: null,
		avatarIsAnimated: false,
		diaryMetalTier: null,
		presenceState: "away" as const,
	};

	test("prepends self before others", () => {
		expect(
			prependViewerSelfToViewingPatrons(selfPatron, [otherPatron], 8),
		).toEqual([selfPatron, otherPatron]);
	});

	test("returns others only when self is null", () => {
		expect(prependViewerSelfToViewingPatrons(null, [otherPatron], 8)).toEqual([
			otherPatron,
		]);
	});

	test("respects limit including self", () => {
		const patrons = Array.from({ length: 8 }, (_, i) => ({
			...otherPatron,
			userId: `usr_${i}`,
			handle: `friend_${i}`,
		}));
		const result = prependViewerSelfToViewingPatrons(selfPatron, patrons, 8);
		expect(result).toHaveLength(8);
		expect(result[0]).toEqual(selfPatron);
	});
});
```

Update existing snapshot test expectation comment — after wiring, `getListingPresenceSnapshot` alone case will include self when DB returns viewer row (integration/manual); pure prepend helper covers compose logic.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/lib/listing-presence.test.ts -t prependViewerSelfToViewingPatrons`  
Expected: FAIL — export not found.

- [ ] **Step 3: Write minimal implementation**

Add to `apps/server/src/lib/listing-presence.ts`:

```ts
/** Prepend viewer to visible patrons; self counts toward limit. */
export function prependViewerSelfToViewingPatrons(
	viewerSelf: ListingPresenceViewingPatron | null,
	others: ListingPresenceViewingPatron[],
	limit: number = LISTING_PRESENCE_MUTUAL_FETCH_LIMIT,
): ListingPresenceViewingPatron[] {
	if (!viewerSelf) return others.slice(0, limit);
	return [viewerSelf, ...others].slice(0, limit);
}

export async function fetchViewerSelfPatronInRoom(
	viewerId: string,
	activeUserIds: string[],
	redis: ListingPresenceRedis | null = null,
	activityOverride?: ReadonlyMap<string, PatronActivityState>,
): Promise<ListingPresenceViewingPatron | null> {
	if (!activeUserIds.includes(viewerId)) return null;

	const rows = await db
		.select({
			userId: profile.userId,
			handle: profile.handle,
			displayName: profile.displayName,
			name: user.name,
			image: user.image,
			preferences: profile.preferences,
		})
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.where(and(eq(profile.userId, viewerId), isNotNull(profile.handle)))
		.limit(1);

	const row = rows[0];
	const handle = row?.handle?.trim();
	if (!row || !handle) return null;

	const logCounts = await fetchDiaryLogCountsForUserIds([viewerId]);
	const activityByUserId =
		activityOverride ??
		(redis && typeof redis.hget === "function"
			? await readActivityStatesForUserIds({ hget: redis.hget }, [viewerId])
			: new Map<string, PatronActivityState>());

	return {
		userId: row.userId,
		handle,
		displayName: row.displayName?.trim() || row.name?.trim() || handle,
		image: row.image,
		avatarIsAnimated: readAvatarIsAnimatedPref(row.preferences),
		diaryMetalTier: resolveDiaryMetalTier(logCounts.get(viewerId) ?? 0),
		presenceState: activityByUserId.get(viewerId) ?? "active",
	};
}
```

Update `getListingPresenceSnapshot` and `getListingPresenceSnapshotFromOccupancy`:

```ts
const others = await fetchViewingPatronsInRoom(/* unchanged args */);
const viewerSelf = await fetchViewerSelfPatronInRoom(
	viewerId,
	activeUserIds,
	redis, // or null + activityOverride for DO path
	activityOverride,
);
const viewingPatrons = prependViewerSelfToViewingPatrons(
	viewerSelf,
	others,
	LISTING_PRESENCE_MUTUAL_FETCH_LIMIT,
);
return { viewerCount, viewingPatrons };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && bun test src/lib/listing-presence.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/listing-presence.ts apps/server/src/lib/listing-presence.test.ts
git commit -m "feat(presence): prepend viewer to listing presence snapshot"
```

---

### Task 3: Web — self SR labels and alone-with-self display resolver

**Files:**
- Modify: `apps/web/src/lib/listing-presence-copy.ts`
- Test: `apps/web/src/lib/listing-presence-copy.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/lib/listing-presence-copy.test.ts`:

```ts
describe("formatPatronPresenceDotLabel self perspective", () => {
	test("active self label", () => {
		expect(
			formatPatronPresenceDotLabel("me", "active", { perspective: "self" }),
		).toBe("You are online now");
	});

	test("away self label", () => {
		expect(
			formatPatronPresenceDotLabel("me", "away", { perspective: "self" }),
		).toBe("You are away");
	});
});

describe("resolveListingPresenceRowDisplay alone with self", () => {
	const selfPatron = {
		userId: "usr_me",
		handle: "me",
		displayName: "Me",
		image: null,
		avatarIsAnimated: false,
		diaryMetalTier: null,
		presenceState: "active" as const,
	};

	test("returns display when only self is viewing", () => {
		expect(
			resolveListingPresenceRowDisplay({
				viewerCount: 0,
				viewingPatrons: [selfPatron],
			}),
		).toEqual({
			visibleViewingPatrons: [selfPatron],
			viewingMoreCount: 0,
			unidentifiedCount: 0,
			countLine: "",
		});
	});
});
```

Update existing test `"returns null when viewer is alone on the title"` — keep asserting `null` for `{ viewerCount: 0, viewingPatrons: [] }` (unsigned / not in room).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun test src/lib/listing-presence-copy.test.ts`  
Expected: FAIL — wrong labels / resolver returns null.

- [ ] **Step 3: Write minimal implementation**

In `apps/web/src/lib/listing-presence-copy.ts`:

```ts
export function formatPatronPresenceDotLabel(
	handle: string,
	state: "active" | "away",
	opts?: { perspective?: "self" | "other" },
): string {
	if (opts?.perspective === "self") {
		return state === "active" ? "You are online now" : "You are away";
	}
	return state === "active" ? `@${handle} online now` : `@${handle} away`;
}
```

Update `resolveListingPresenceRowDisplay`:

```ts
export function resolveListingPresenceRowDisplay(
	snapshot: ListingPresenceSnapshot,
): ListingPresenceRowDisplay | null {
	const { viewerCount, viewingPatrons } = snapshot;

	// Show corner stack when self alone (viewerCount 0 but self in viewingPatrons).
	if (viewerCount <= 0 && viewingPatrons.length === 0) return null;

	// ... rest unchanged; countLine only when viewerCount > 0
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun test src/lib/listing-presence-copy.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/listing-presence-copy.ts apps/web/src/lib/listing-presence-copy.test.ts
git commit -m "feat(presence): self SR labels and alone-with-self row display"
```

---

### Task 4: Web — PatronOnlineProvider self visibility

**Files:**
- Modify: `apps/web/src/components/realtime/patron-online-provider.tsx`

- [ ] **Step 1: Remove self filter from `getPresenceState`**

Delete the `viewerHandleKey` early return:

```ts
// BEFORE
if (!handle || handle === viewerHandleKey) return null;

// AFTER
if (!handle) return null;
```

- [ ] **Step 2: Expose `viewerHandle` on context**

```ts
type PatronOnlineContextValue = {
	registerHandle: (handle: string) => () => void;
	isOnline: (handle: string | null | undefined) => boolean;
	getPresenceState: (
		handle: string | null | undefined,
	) => "active" | "away" | null;
	viewerHandle: string | null;
};

// In provider value:
viewerHandle: viewerHandleKey,

export function useViewerHandleForPresence(): string | null {
	return useContext(PatronOnlineContext)?.viewerHandle ?? null;
}
```

- [ ] **Step 3: Register viewer handle on mount**

```ts
useEffect(() => {
	if (!viewerHandleKey) return;
	return registerHandle(viewerHandleKey);
}, [registerHandle, viewerHandleKey]);
```

- [ ] **Step 4: Manual smoke**

Run dev server; open account menu — within ~30s poll, green dot should appear on your avatar (requires server Task 1 deployed locally).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/realtime/patron-online-provider.tsx
git commit -m "feat(presence): show viewer own dot via batch lookup"
```

---

### Task 5: Web — portrait self labels + listing row aria

**Files:**
- Modify: `apps/web/src/components/profile/patron-portrait-with-metal-tier.tsx`
- Modify: `apps/web/src/components/movie/listing-presence-row.tsx`

- [ ] **Step 1: Portrait self perspective**

In `patron-portrait-with-metal-tier.tsx`:

```ts
import {
	usePatronPresenceState,
	useViewerHandleForPresence,
} from "@/components/realtime/patron-online-provider";
import { normalizePatronOnlineHandle } from "@/lib/patron-online-presence";

// inside component:
const viewerHandle = useViewerHandleForPresence();
const isViewerSelf =
	Boolean(handle) &&
	Boolean(viewerHandle) &&
	normalizePatronOnlineHandle(handle!) === viewerHandle;

const dotLabel =
	resolvedPresenceState && handle
		? formatPatronPresenceDotLabel(handle, resolvedPresenceState, {
				perspective: isViewerSelf ? "self" : "other",
			})
		: "";
```

- [ ] **Step 2: Listing row alone aria**

In `listing-presence-row.tsx`:

```ts
const isAloneWithSelf =
	snapshot.viewerCount === 0 && snapshot.viewingPatrons.length > 0;

// aria-label on <section>:
aria-label={
	isAloneWithSelf
		? "You are viewing this title"
		: occupancyLabel
			? `Other patrons viewing this title: ${occupancyLabel}`
			: "Other patrons viewing this title"
}
```

- [ ] **Step 3: Run web tests**

Run: `cd apps/web && bun test src/lib/listing-presence-copy.test.ts`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/profile/patron-portrait-with-metal-tier.tsx apps/web/src/components/movie/listing-presence-row.tsx
git commit -m "feat(presence): self dot labels on portraits and listing alone aria"
```

---

### Task 6: Manual QA + graphify update

- [ ] **Step 1: Run server tests**

Run: `cd apps/server && bun test src/lib/patron-presence.test.ts src/lib/listing-presence.test.ts src/routes/realtime-presence.test.ts`  
Expected: PASS

- [ ] **Step 2: Manual QA checklist (from spec)**

1. Signed in — account menu avatar shows green dot within one poll cycle.
2. Switch tab away — dot turns orange within ~25s.
3. Return and interact — green again after server catches up.
4. Movie detail alone — corner shows your avatar + dot, no count line.
5. Friend opens same title — count line appears; your avatar stays in stack.
6. VoiceOver on self portrait — “You are online now” / “You are away”.

- [ ] **Step 3: Update graph**

Run: `graphify update .` (if available in environment)

- [ ] **Step 4: Final commit if any fixups**

```bash
git add -A
git commit -m "fix(presence): self-view QA fixups"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Self in `/online` batch (server mirror) | Task 1 |
| Private profile self handle lookup | Task 1 |
| Listing prepend self; viewerCount others-only | Task 2 |
| Remove client self filter + register handle | Task 4 |
| Self SR labels | Task 3, Task 5 |
| Alone on title — avatar only, no count line | Task 3, Task 5 |
| Drawer parity (self in viewingPatrons) | Task 2 (no drawer code change) |
| Motion unchanged | No task — existing `PatronOnlineDot` |

## Out of scope (do not implement)

- Local activity tracker as UI source for self
- User setting to hide self dot
- Signed-out self dot
