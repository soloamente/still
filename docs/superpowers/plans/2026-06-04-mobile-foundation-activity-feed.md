# Mobile Foundation + Activity Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the boilerplate in `apps/native` with a 5-tab app shell and a fully working Activity feed (Home) backed by a typed Eden + TanStack Query data layer.

**Architecture:** Expo Router drives a `(tabs)` shell (Home · Search · ＋Log · Inbox · You); only Home is real, the other four are stubs. A shared Eden client (`@still/api-client`) forwards the better-auth Expo session cookie; TanStack Query wraps it with `useInfiniteQuery` for cursor-paginated infinite scroll. Pure, testable logic (parsing, pagination cursor, poster URLs, time-ago) is isolated from React Native so it runs under `bun:test`.

**Tech Stack:** Expo Router, React Native, TanStack Query, `@elysiajs/eden` (via `@still/api-client`), better-auth Expo client, HeroUI Native + uniwind (Tailwind), expo-image, `bun:test`.

---

## Background for the implementer

- The server feed endpoints already exist: `GET /api/feed` (signed-in, following-based, cursor-paginated via `before`) and `GET /api/feed/discover` (signed-out, trending). Both return `{ items: { kind, at, payload }[] }` where `kind` ∈ `log | review | list | divergence`. Query params: `limit` (string, signed-in only), `before` (ISO string, signed-in only), `period` (`week|month|year|all`), `tz` (IANA string).
- The Eden client is created with `createClient({ baseURL, fetcher? })` from `@still/api-client`; it returns a `treaty<App>` client. Route `/api/feed` maps to `client.api.feed.get(...)`, `/api/feed/discover` maps to `client.api.feed.discover.get(...)`. Each call returns `{ data, error, status }`.
- The better-auth Expo client (`apps/native/lib/auth-client.ts`) exposes `authClient.getCookie()` (string) and `authClient.useSession()`. React Native fetch has no cookie jar, so the session cookie must be injected manually on every request.
- `EXPO_PUBLIC_SERVER_URL` (in `apps/native/.env`) points at `http://localhost:3000` (the Elysia server).
- Tests run with `bun:test` from the repo root (e.g. `bun test apps/native/features/feed/feed-pagination.test.ts`). Keep pure-logic modules free of any `react-native`/`expo` imports so they run without a simulator.
- **Phase 1 deliberately excludes:** detail navigation (cards don't navigate), mutations (likes/comments are display-only), and the Search/＋Log/Inbox/You screens (stubs only).

## File structure

```
apps/native/
  package.json                         # MODIFY: add deps
  app/
    _layout.tsx                        # MODIFY: add QueryClientProvider; point initialRouteName at (tabs)
    (tabs)/
      _layout.tsx                      # CREATE: 5-tab bar
      index.tsx                        # CREATE: Home → <ActivityFeedScreen/>
      search.tsx                       # CREATE: stub
      log.tsx                          # CREATE: stub
      inbox.tsx                        # CREATE: stub
      you.tsx                          # CREATE: stub
    (drawer)/                          # DELETE entire folder
    modal.tsx                          # keep
  lib/
    api.ts                             # CREATE: Eden client + cookie fetcher
    query-client.ts                    # CREATE: QueryClient + provider
  features/feed/
    tmdb-poster-url.ts                 # CREATE (pure) + test
    format-time-ago.ts                 # CREATE (pure) + test
    activity-feed-types.ts             # CREATE (pure) + test
    feed-pagination.ts                 # CREATE (pure) + test
    use-activity-feed.ts               # CREATE: useInfiniteQuery hook
    activity-feed-screen.tsx           # CREATE: list + states
    cards/
      activity-log-card.tsx            # CREATE
      activity-review-card.tsx         # CREATE
      activity-list-card.tsx           # CREATE
      activity-divergence-card.tsx     # CREATE
      activity-card.tsx                # CREATE: kind → card switch
  components/ui/
    avatar.tsx                         # CREATE
    poster.tsx                         # CREATE
    stars.tsx                          # CREATE
    feed-skeleton.tsx                  # CREATE
```

---

## Task 1: Add dependencies

**Files:**
- Modify: `apps/native/package.json`

- [ ] **Step 1: Add the three runtime deps**

Edit `apps/native/package.json` `dependencies` (keep alphabetical-ish ordering with the existing entries) to add:

```jsonc
"@tanstack/react-query": "^5.62.7",
"expo-image": "~55.0.0",
```

(`@tanstack/react-form` is already present and unrelated; do not touch it. Leave `expo-image` to be version-aligned by expo in the next step.)

- [ ] **Step 2: Install and let Expo align native module versions**

Run:
```bash
cd apps/native && bun install && bunx expo install expo-image
```
Expected: install completes; `expo install` pins `expo-image` to the SDK-55-compatible version and rewrites the version in `package.json`.

- [ ] **Step 3: Commit**

```bash
git add apps/native/package.json ../../bun.lock
git commit -m "build(native): add tanstack-query and expo-image"
```

---

## Task 2: Pure helper — TMDB poster URL (TDD)

**Files:**
- Create: `apps/native/features/feed/tmdb-poster-url.ts`
- Test: `apps/native/features/feed/tmdb-poster-url.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/native/features/feed/tmdb-poster-url.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { tmdbPosterUrlFromPath } from "./tmdb-poster-url";

describe("tmdbPosterUrlFromPath", () => {
  test("builds an absolute URL from a TMDb path", () => {
    expect(tmdbPosterUrlFromPath("/abc.jpg")).toBe(
      "https://image.tmdb.org/t/p/w185/abc.jpg",
    );
  });
  test("adds a leading slash when missing", () => {
    expect(tmdbPosterUrlFromPath("abc.jpg")).toBe(
      "https://image.tmdb.org/t/p/w185/abc.jpg",
    );
  });
  test("honors an explicit size", () => {
    expect(tmdbPosterUrlFromPath("/abc.jpg", "w342")).toBe(
      "https://image.tmdb.org/t/p/w342/abc.jpg",
    );
  });
  test("passes through absolute URLs untouched", () => {
    expect(tmdbPosterUrlFromPath("https://example.com/x.png")).toBe(
      "https://example.com/x.png",
    );
  });
  test("returns null for empty/nullish", () => {
    expect(tmdbPosterUrlFromPath(null)).toBeNull();
    expect(tmdbPosterUrlFromPath("")).toBeNull();
    expect(tmdbPosterUrlFromPath(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/native/features/feed/tmdb-poster-url.test.ts`
Expected: FAIL — `Cannot find module './tmdb-poster-url'`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/native/features/feed/tmdb-poster-url.ts`:

```ts
/** TMDb still path → absolute poster URL. Ported from apps/web. */
export function tmdbPosterUrlFromPath(
  path: string | null | undefined,
  size: "w185" | "w342" | "w780" = "w185",
): string | null {
  if (!path?.length) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const fragment = path.startsWith("/") ? path : `/${path}`;
  return `https://image.tmdb.org/t/p/${size}${fragment}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/native/features/feed/tmdb-poster-url.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/native/features/feed/tmdb-poster-url.ts apps/native/features/feed/tmdb-poster-url.test.ts
git commit -m "feat(native): tmdb poster url helper"
```

---

## Task 3: Pure helper — time-ago label (TDD)

**Files:**
- Create: `apps/native/features/feed/format-time-ago.ts`
- Test: `apps/native/features/feed/format-time-ago.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/native/features/feed/format-time-ago.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { formatTimeAgo } from "./format-time-ago";

const NOW = new Date("2026-06-04T12:00:00.000Z").getTime();

describe("formatTimeAgo", () => {
  test("seconds → 'just now'", () => {
    expect(formatTimeAgo(new Date(NOW - 10_000).toISOString(), NOW)).toBe("just now");
  });
  test("minutes", () => {
    expect(formatTimeAgo(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe("5m");
  });
  test("hours", () => {
    expect(formatTimeAgo(new Date(NOW - 3 * 3_600_000).toISOString(), NOW)).toBe("3h");
  });
  test("days", () => {
    expect(formatTimeAgo(new Date(NOW - 2 * 86_400_000).toISOString(), NOW)).toBe("2d");
  });
  test("weeks", () => {
    expect(formatTimeAgo(new Date(NOW - 14 * 86_400_000).toISOString(), NOW)).toBe("2w");
  });
  test("future or invalid → 'just now'", () => {
    expect(formatTimeAgo(new Date(NOW + 60_000).toISOString(), NOW)).toBe("just now");
    expect(formatTimeAgo("not-a-date", NOW)).toBe("just now");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/native/features/feed/format-time-ago.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `apps/native/features/feed/format-time-ago.ts`:

```ts
/** Compact relative time ("5m", "3h", "2d", "2w") for feed bylines. */
export function formatTimeAgo(value: string | Date, now: number = Date.now()): string {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(ms)) return "just now";
  const diff = now - ms;
  if (diff < 45_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 52) return `${weeks}w`;
  return `${Math.floor(days / 365)}y`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/native/features/feed/format-time-ago.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/native/features/feed/format-time-ago.ts apps/native/features/feed/format-time-ago.test.ts
git commit -m "feat(native): compact time-ago helper"
```

---

## Task 4: Feed types + parsing (TDD)

**Files:**
- Create: `apps/native/features/feed/activity-feed-types.ts`
- Test: `apps/native/features/feed/activity-feed-types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/native/features/feed/activity-feed-types.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  activityRowKey,
  coerceActivityTimestamp,
  parseFeedApiActivityItems,
} from "./activity-feed-types";

describe("parseFeedApiActivityItems", () => {
  test("keeps only known kinds and coerces timestamps", () => {
    const out = parseFeedApiActivityItems({
      items: [
        { kind: "log", at: "2026-06-04T10:00:00.000Z", payload: { log: { id: "L1" } } },
        { kind: "bogus", at: "2026-06-04T09:00:00.000Z", payload: {} },
        { kind: "review", at: new Date("2026-06-04T08:00:00.000Z"), payload: { review: { id: "R1" } } },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0].kind).toBe("log");
    expect(out[1].at).toBe("2026-06-04T08:00:00.000Z");
  });
  test("handles null / missing items", () => {
    expect(parseFeedApiActivityItems(null)).toEqual([]);
    expect(parseFeedApiActivityItems(undefined)).toEqual([]);
    expect(parseFeedApiActivityItems({})).toEqual([]);
  });
});

describe("activityRowKey", () => {
  test("uses entity id per kind", () => {
    expect(activityRowKey({ kind: "log", at: "x", payload: { log: { id: "L1" } } })).toBe("log:L1");
    expect(activityRowKey({ kind: "review", at: "x", payload: { review: { id: "R1" } } })).toBe("review:R1");
    expect(activityRowKey({ kind: "list", at: "x", payload: { list: { id: "S1" } } })).toBe("list:S1");
  });
  test("divergence keys off media id", () => {
    expect(activityRowKey({ kind: "divergence", at: "x", payload: { movieId: 42 } })).toBe("divergence:m:42");
    expect(activityRowKey({ kind: "divergence", at: "x", payload: { tvId: 7 } })).toBe("divergence:t:7");
  });
  test("falls back to kind:at when id missing", () => {
    expect(activityRowKey({ kind: "log", at: "T", payload: {} })).toBe("log:T");
  });
});

describe("coerceActivityTimestamp", () => {
  test("Date → ISO, string passthrough, else now", () => {
    expect(coerceActivityTimestamp(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01-01T00:00:00.000Z");
    expect(coerceActivityTimestamp("2026-02-02")).toBe("2026-02-02");
    expect(typeof coerceActivityTimestamp(123)).toBe("string");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/native/features/feed/activity-feed-types.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `apps/native/features/feed/activity-feed-types.ts` (types ported from `apps/web/src/components/feed/activity-item.tsx` and parse logic from `apps/web/src/lib/home-community-activity.ts`):

```ts
export type ActivityKind = "log" | "review" | "list" | "divergence";

export type ActivityItem = {
  kind: ActivityKind;
  at: string;
  payload: unknown;
};

export type FeedPerson = {
  user: { id: string; name: string; image: string | null } | null;
  profile: { handle: string; displayName: string } | null;
};

export type FeedMedia = { tmdbId: number; title: string; posterPath: string | null } | null;

export type LogPayload = FeedPerson & {
  log: {
    id: string;
    watchedAt: string;
    rating: number | null;
    liked: boolean;
    rewatch: boolean;
    note: string | null;
  };
  movie: FeedMedia;
  tv?: FeedMedia;
};

export type ReviewPayload = FeedPerson & {
  review: {
    id: string;
    title: string | null;
    body: string;
    rating: number | null;
    likesCount: number;
    commentsCount: number;
    publishedAt: string;
  };
  movie: FeedMedia;
};

export type ListPayload = FeedPerson & {
  list: {
    id: string;
    title: string;
    description: string | null;
    itemsCount: number;
    coverMovieIds: number[];
    coverPosterPaths?: (string | null)[];
    coverImageUrl?: string | null;
    updatedAt: string;
  };
};

export function patronName(person: FeedPerson): string {
  return person.profile?.displayName ?? person.user?.name ?? "Someone";
}

export function patronHandle(person: FeedPerson): string {
  return person.profile?.handle ?? person.user?.id ?? "user";
}

export function coerceActivityTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

export function parseFeedApiActivityItems(
  payload: { items?: { kind: string; at: string | Date; payload: unknown }[] } | null | undefined,
): ActivityItem[] {
  const raw = payload?.items ?? [];
  return raw
    .filter(
      (item): item is { kind: ActivityKind; at: string | Date; payload: unknown } =>
        item.kind === "log" ||
        item.kind === "review" ||
        item.kind === "list" ||
        item.kind === "divergence",
    )
    .map((item) => ({
      kind: item.kind,
      at: coerceActivityTimestamp(item.at),
      payload: item.payload,
    }));
}

export function activityRowKey(item: ActivityItem): string {
  const pl = item.payload as Record<string, unknown>;
  if (item.kind === "log" && pl.log && typeof pl.log === "object" && "id" in pl.log) {
    return `log:${(pl.log as { id: string }).id}`;
  }
  if (item.kind === "review" && pl.review && typeof pl.review === "object" && "id" in pl.review) {
    return `review:${(pl.review as { id: string }).id}`;
  }
  if (item.kind === "list" && pl.list && typeof pl.list === "object" && "id" in pl.list) {
    return `list:${(pl.list as { id: string }).id}`;
  }
  if (item.kind === "divergence") {
    const mediaId =
      typeof pl.movieId === "number"
        ? `m:${pl.movieId}`
        : typeof pl.tvId === "number"
          ? `t:${pl.tvId}`
          : "unknown";
    return `divergence:${mediaId}`;
  }
  return `${item.kind}:${item.at}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/native/features/feed/activity-feed-types.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/native/features/feed/activity-feed-types.ts apps/native/features/feed/activity-feed-types.test.ts
git commit -m "feat(native): activity feed types + parsing"
```

---

## Task 5: Pagination cursor + timezone helpers (TDD)

**Files:**
- Create: `apps/native/features/feed/feed-pagination.ts`
- Test: `apps/native/features/feed/feed-pagination.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/native/features/feed/feed-pagination.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { FEED_PAGE_SIZE, getDeviceTimeZone, nextBeforeCursor } from "./feed-pagination";
import type { ActivityItem } from "./activity-feed-types";

function page(n: number): ActivityItem[] {
  return Array.from({ length: n }, (_, i) => ({
    kind: "log" as const,
    at: `2026-06-04T${String(10 + i).padStart(2, "0")}:00:00.000Z`,
    payload: {},
  }));
}

describe("nextBeforeCursor", () => {
  test("full page → last item's `at`", () => {
    const full = page(FEED_PAGE_SIZE);
    expect(nextBeforeCursor(full)).toBe(full[full.length - 1].at);
  });
  test("partial page → undefined (end of feed)", () => {
    expect(nextBeforeCursor(page(3))).toBeUndefined();
  });
  test("empty page → undefined", () => {
    expect(nextBeforeCursor([])).toBeUndefined();
  });
});

describe("getDeviceTimeZone", () => {
  test("returns a non-empty string", () => {
    expect(getDeviceTimeZone().length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test apps/native/features/feed/feed-pagination.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `apps/native/features/feed/feed-pagination.ts`:

```ts
import type { ActivityItem } from "./activity-feed-types";

/** Matches the server/web COMMUNITY_ACTIVITY_LIMIT. */
export const FEED_PAGE_SIZE = 40;

/**
 * Cursor for the next `/api/feed` page: the oldest item's `at`. Returns
 * `undefined` when the last page was short, meaning we've reached the end.
 */
export function nextBeforeCursor(lastPage: ActivityItem[]): string | undefined {
  if (lastPage.length < FEED_PAGE_SIZE) return undefined;
  return lastPage[lastPage.length - 1]?.at;
}

export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test apps/native/features/feed/feed-pagination.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/native/features/feed/feed-pagination.ts apps/native/features/feed/feed-pagination.test.ts
git commit -m "feat(native): feed pagination cursor + tz helper"
```

---

## Task 6: Eden API client with auth cookie

**Files:**
- Create: `apps/native/lib/api.ts`

- [ ] **Step 1: Create the client**

Create `apps/native/lib/api.ts`:

```ts
import { createClient } from "@still/api-client";
import { env } from "@still/env/native";

import { authClient } from "@/lib/auth-client";

/**
 * React Native has no cookie jar, so we inject the better-auth session cookie
 * (kept in SecureStore by the Expo plugin) onto every request.
 */
const cookieFetcher: typeof fetch = (input, init) => {
  const cookie = authClient.getCookie();
  const headers = new Headers(init?.headers);
  if (cookie) headers.set("Cookie", cookie);
  return fetch(input, { ...init, headers });
};

export const api = createClient({
  baseURL: env.EXPO_PUBLIC_SERVER_URL,
  fetcher: cookieFetcher,
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/native && bunx tsc --noEmit`
Expected: no errors from `lib/api.ts`. (Expo-router generated route types may warn until Task 8 adds the screens; those are unrelated to this file.)

- [ ] **Step 3: Commit**

```bash
git add apps/native/lib/api.ts
git commit -m "feat(native): eden api client with session-cookie fetcher"
```

---

## Task 7: TanStack Query client + provider

**Files:**
- Create: `apps/native/lib/query-client.ts`
- Modify: `apps/native/app/_layout.tsx`

- [ ] **Step 1: Create the query client + provider**

Create `apps/native/lib/query-client.ts`:

```ts
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createElement } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function AppQueryProvider({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}
```

- [ ] **Step 2: Wire the provider + retarget initial route in the root layout**

Modify `apps/native/app/_layout.tsx`. Add the import and wrap the tree, and change `initialRouteName` from `"(drawer)"` to `"(tabs)"`. Replace the file contents with:

```tsx
import "@/global.css";
import { Stack } from "expo-router";
import { HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AppThemeProvider } from "@/contexts/app-theme-context";
import { AppQueryProvider } from "@/lib/query-client";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

function StackLayout() {
  return (
    <Stack screenOptions={{}}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ title: "Modal", presentation: "modal" }} />
    </Stack>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <AppQueryProvider>
          <AppThemeProvider>
            <HeroUINativeProvider>
              <StackLayout />
            </HeroUINativeProvider>
          </AppThemeProvider>
        </AppQueryProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/native/lib/query-client.ts apps/native/app/_layout.tsx
git commit -m "feat(native): tanstack query provider + (tabs) root route"
```

---

## Task 8: Replace drawer with 5-tab shell + stub screens

**Files:**
- Delete: `apps/native/app/(drawer)/` (entire folder)
- Create: `apps/native/app/(tabs)/_layout.tsx`
- Create: `apps/native/app/(tabs)/index.tsx` (temporary placeholder; replaced in Task 13)
- Create: `apps/native/app/(tabs)/search.tsx`, `log.tsx`, `inbox.tsx`, `you.tsx`

- [ ] **Step 1: Delete the drawer boilerplate**

Run:
```bash
git rm -r "apps/native/app/(drawer)"
```
Expected: removes `(drawer)/_layout.tsx`, `(drawer)/index.tsx`, `(drawer)/(tabs)/*`.

- [ ] **Step 2: Create a reusable stub screen and the four stubs**

Create `apps/native/app/(tabs)/search.tsx`:

```tsx
import { Text, View } from "react-native";

export default function SearchScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-base text-muted-foreground">Search — coming soon</Text>
    </View>
  );
}
```

Create `apps/native/app/(tabs)/log.tsx` (same body, label "Log a film — coming soon"):

```tsx
import { Text, View } from "react-native";

export default function LogScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-base text-muted-foreground">Log a film — coming soon</Text>
    </View>
  );
}
```

Create `apps/native/app/(tabs)/inbox.tsx`:

```tsx
import { Text, View } from "react-native";

export default function InboxScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-base text-muted-foreground">Inbox — coming soon</Text>
    </View>
  );
}
```

Create `apps/native/app/(tabs)/you.tsx`:

```tsx
import { Text, View } from "react-native";

export default function YouScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-base text-muted-foreground">Your profile — coming soon</Text>
    </View>
  );
}
```

- [ ] **Step 3: Create a temporary Home placeholder**

Create `apps/native/app/(tabs)/index.tsx` (replaced by the real feed in Task 13):

```tsx
import { Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-base text-muted-foreground">Activity feed</Text>
    </View>
  );
}
```

- [ ] **Step 4: Create the 5-tab bar**

Create `apps/native/app/(tabs)/_layout.tsx`. The ＋Log tab uses a larger centered icon. Adapted from the deleted `(drawer)/(tabs)/_layout.tsx` color pattern:

```tsx
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useThemeColor } from "heroui-native";

export default function TabLayout() {
  const foreground = useThemeColor("foreground");
  const background = useThemeColor("background");
  const accent = useThemeColor("accent");

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: foreground,
        tabBarInactiveTintColor: `${foreground}80`,
        tabBarStyle: { backgroundColor: background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: "Log",
          tabBarIcon: ({ size }) => (
            <Ionicons name="add-circle" size={size + 14} color={accent} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: "You",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
```

> If `useThemeColor("accent")` throws because the token name differs, fall back to a literal `"#e0b341"` for the ＋Log color. Verify the available token names in `node_modules/heroui-native` theme types if needed.

- [ ] **Step 5: Verify in Expo Go**

Run from repo root: `bun dev:native`
Expected: app boots to a 5-tab bar (Home · Search · ＋Log · Inbox · You); each tab shows its placeholder; the ＋Log icon is larger and accent-colored. No red error screen.

- [ ] **Step 6: Commit**

```bash
git add "apps/native/app/(tabs)"
git commit -m "feat(native): 5-tab shell with stub screens, drop drawer"
```

---

## Task 9: Design-system primitive — Avatar

**Files:**
- Create: `apps/native/components/ui/avatar.tsx`

- [ ] **Step 1: Implement Avatar**

Create `apps/native/components/ui/avatar.tsx`:

```tsx
import { Image } from "expo-image";
import { Text, View } from "react-native";

export function Avatar({
  uri,
  name,
  size = 28,
}: {
  uri: string | null | undefined;
  name: string;
  size?: number;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        transition={150}
      />
    );
  }
  return (
    <View
      className="items-center justify-center bg-muted"
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      <Text className="font-semibold text-foreground" style={{ fontSize: size * 0.45 }}>
        {initial}
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/native/components/ui/avatar.tsx
git commit -m "feat(native): Avatar primitive"
```

---

## Task 10: Design-system primitives — Poster + Stars

**Files:**
- Create: `apps/native/components/ui/poster.tsx`
- Create: `apps/native/components/ui/stars.tsx`

- [ ] **Step 1: Implement Poster**

Create `apps/native/components/ui/poster.tsx`:

```tsx
import { Image } from "expo-image";
import { View } from "react-native";

import { tmdbPosterUrlFromPath } from "@/features/feed/tmdb-poster-url";

export function Poster({
  path,
  width = 58,
}: {
  path: string | null | undefined;
  width?: number;
}) {
  const height = Math.round(width * 1.5);
  const uri = tmdbPosterUrlFromPath(path, "w342");
  if (!uri) {
    return (
      <View
        className="bg-muted"
        style={{ width, height, borderRadius: 8 }}
      />
    );
  }
  return (
    <Image
      source={{ uri }}
      style={{ width, height, borderRadius: 8 }}
      contentFit="cover"
      transition={150}
    />
  );
}
```

- [ ] **Step 2: Implement Stars**

Create `apps/native/components/ui/stars.tsx`. Server ratings are on a 0–10 scale; render as 5 stars (rating / 2) with half-star support:

```tsx
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { useThemeColor } from "heroui-native";

export function Stars({ rating }: { rating: number | null | undefined }) {
  const accent = useThemeColor("accent");
  if (rating == null) return null;
  const outOfFive = Math.max(0, Math.min(5, rating / 2));
  const full = Math.floor(outOfFive);
  const half = outOfFive - full >= 0.5;
  return (
    <View className="flex-row" style={{ gap: 1 }}>
      {Array.from({ length: 5 }, (_, i) => {
        const name = i < full ? "star" : i === full && half ? "star-half" : "star-outline";
        return <Ionicons key={i} name={name} size={13} color={accent} />;
      })}
    </View>
  );
}
```

> If `useThemeColor("accent")` is unavailable, use the literal `"#e0b341"`.

- [ ] **Step 3: Commit**

```bash
git add apps/native/components/ui/poster.tsx apps/native/components/ui/stars.tsx
git commit -m "feat(native): Poster + Stars primitives"
```

---

## Task 11: Design-system primitive — feed skeleton

**Files:**
- Create: `apps/native/components/ui/feed-skeleton.tsx`

- [ ] **Step 1: Implement the skeleton**

Create `apps/native/components/ui/feed-skeleton.tsx`:

```tsx
import { View } from "react-native";

function SkeletonCard() {
  return (
    <View className="mb-3 rounded-2xl border border-border bg-card p-3">
      <View className="mb-3 flex-row items-center" style={{ gap: 8 }}>
        <View className="bg-muted" style={{ width: 24, height: 24, borderRadius: 12 }} />
        <View className="bg-muted" style={{ width: 120, height: 10, borderRadius: 4 }} />
      </View>
      <View className="flex-row" style={{ gap: 12 }}>
        <View className="bg-muted" style={{ width: 58, height: 87, borderRadius: 8 }} />
        <View style={{ flex: 1, gap: 8 }}>
          <View className="bg-muted" style={{ width: "70%", height: 12, borderRadius: 4 }} />
          <View className="bg-muted" style={{ width: "40%", height: 10, borderRadius: 4 }} />
        </View>
      </View>
    </View>
  );
}

export function FeedSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View className="px-3 pt-2">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/native/components/ui/feed-skeleton.tsx
git commit -m "feat(native): feed skeleton primitive"
```

---

## Task 12: Rich card components

**Files:**
- Create: `apps/native/features/feed/cards/activity-log-card.tsx`
- Create: `apps/native/features/feed/cards/activity-review-card.tsx`
- Create: `apps/native/features/feed/cards/activity-list-card.tsx`
- Create: `apps/native/features/feed/cards/activity-divergence-card.tsx`
- Create: `apps/native/features/feed/cards/activity-card.tsx`

- [ ] **Step 1: Shared card chrome — log card**

Create `apps/native/features/feed/cards/activity-log-card.tsx`:

```tsx
import { Text, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Poster } from "@/components/ui/poster";
import { Stars } from "@/components/ui/stars";
import { formatTimeAgo } from "@/features/feed/format-time-ago";
import { type LogPayload, patronName } from "@/features/feed/activity-feed-types";

export function ActivityLogCard({ payload, at }: { payload: LogPayload; at: string }) {
  const media = payload.movie ?? payload.tv ?? null;
  return (
    <View className="mb-3 rounded-2xl border border-border bg-card p-3">
      <View className="mb-2.5 flex-row items-center" style={{ gap: 8 }}>
        <Avatar uri={payload.user?.image} name={patronName(payload)} />
        <Text className="text-foreground" style={{ fontSize: 12.5 }}>
          <Text className="font-bold">{patronName(payload)}</Text>
          <Text className="text-muted-foreground"> rated · {formatTimeAgo(at)}</Text>
        </Text>
      </View>
      <View className="flex-row" style={{ gap: 12 }}>
        <Poster path={media?.posterPath} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text className="font-bold text-foreground" numberOfLines={2} style={{ fontSize: 14 }}>
            {media?.title ?? "Untitled"}
          </Text>
          <Stars rating={payload.log.rating} />
          <View className="flex-row" style={{ gap: 8 }}>
            {payload.log.liked ? (
              <Text className="text-muted-foreground" style={{ fontSize: 11 }}>♥ liked</Text>
            ) : null}
            {payload.log.rewatch ? (
              <Text className="text-muted-foreground" style={{ fontSize: 11 }}>↺ rewatch</Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Review card**

Create `apps/native/features/feed/cards/activity-review-card.tsx`:

```tsx
import { Text, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Poster } from "@/components/ui/poster";
import { formatTimeAgo } from "@/features/feed/format-time-ago";
import { type ReviewPayload, patronName } from "@/features/feed/activity-feed-types";

export function ActivityReviewCard({ payload, at }: { payload: ReviewPayload; at: string }) {
  return (
    <View className="mb-3 rounded-2xl border border-border bg-card p-3">
      <View className="mb-2.5 flex-row items-center" style={{ gap: 8 }}>
        <Avatar uri={payload.user?.image} name={patronName(payload)} />
        <Text className="text-foreground" style={{ fontSize: 12.5 }}>
          <Text className="font-bold">{patronName(payload)}</Text>
          <Text className="text-muted-foreground"> reviewed · {formatTimeAgo(at)}</Text>
        </Text>
      </View>
      <View className="flex-row" style={{ gap: 12 }}>
        <Poster path={payload.movie?.posterPath} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text className="font-bold text-foreground" numberOfLines={2} style={{ fontSize: 14 }}>
            {payload.movie?.title ?? payload.review.title ?? "Untitled"}
          </Text>
          <Text className="text-muted-foreground" numberOfLines={3} style={{ fontSize: 11.5, fontStyle: "italic" }}>
            {payload.review.body}
          </Text>
        </View>
      </View>
      <View className="mt-2.5 flex-row" style={{ gap: 16 }}>
        <Text className="text-muted-foreground" style={{ fontSize: 11 }}>♥ {payload.review.likesCount}</Text>
        <Text className="text-muted-foreground" style={{ fontSize: 11 }}>💬 {payload.review.commentsCount}</Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 3: List card**

Create `apps/native/features/feed/cards/activity-list-card.tsx`:

```tsx
import { Text, View } from "react-native";

import { Avatar } from "@/components/ui/avatar";
import { Poster } from "@/components/ui/poster";
import { formatTimeAgo } from "@/features/feed/format-time-ago";
import { type ListPayload, patronName } from "@/features/feed/activity-feed-types";

export function ActivityListCard({ payload, at }: { payload: ListPayload; at: string }) {
  const covers = (payload.list.coverPosterPaths ?? []).slice(0, 4);
  return (
    <View className="mb-3 rounded-2xl border border-border bg-card p-3">
      <View className="mb-2.5 flex-row items-center" style={{ gap: 8 }}>
        <Avatar uri={payload.user?.image} name={patronName(payload)} />
        <Text className="text-foreground" style={{ fontSize: 12.5 }}>
          <Text className="font-bold">{patronName(payload)}</Text>
          <Text className="text-muted-foreground"> made a list · {formatTimeAgo(at)}</Text>
        </Text>
      </View>
      <Text className="mb-2 font-bold text-foreground" style={{ fontSize: 14 }}>
        {payload.list.title}
      </Text>
      <View className="flex-row" style={{ gap: 6 }}>
        {covers.length > 0 ? (
          covers.map((path, i) => <Poster key={i} path={path} width={44} />)
        ) : (
          <View className="bg-muted" style={{ width: 44, height: 66, borderRadius: 8 }} />
        )}
      </View>
      <Text className="mt-2 text-muted-foreground" style={{ fontSize: 11 }}>
        {payload.list.itemsCount} films
      </Text>
    </View>
  );
}
```

- [ ] **Step 4: Divergence card**

Create `apps/native/features/feed/cards/activity-divergence-card.tsx`. Render only when the payload looks like a divergence row; otherwise return null (mirrors the web guard):

```tsx
import { Text, View } from "react-native";

type DivergencePayload = {
  movieId?: number;
  tvId?: number;
  title?: string;
  posterPath?: string | null;
  viewerRating?: number | null;
  peerRating?: number | null;
};

function isDivergence(payload: unknown): payload is DivergencePayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    ("movieId" in payload || "tvId" in payload)
  );
}

export function ActivityDivergenceCard({ payload }: { payload: unknown }) {
  if (!isDivergence(payload)) return null;
  return (
    <View className="mb-3 rounded-2xl border border-border bg-card p-3">
      <Text className="mb-1 text-muted-foreground" style={{ fontSize: 11 }}>
        Taste divergence
      </Text>
      <Text className="font-bold text-foreground" style={{ fontSize: 14 }}>
        {payload.title ?? "A title you both rated"}
      </Text>
      <View className="mt-2 flex-row" style={{ gap: 16 }}>
        <Text className="text-foreground" style={{ fontSize: 12 }}>
          You: {payload.viewerRating ?? "—"}
        </Text>
        <Text className="text-muted-foreground" style={{ fontSize: 12 }}>
          Them: {payload.peerRating ?? "—"}
        </Text>
      </View>
    </View>
  );
}
```

> The divergence payload shape is not fully specified in the web types; the guard + optional fields keep it safe. If the real shape differs once observed on-device, refine `DivergencePayload` then.

- [ ] **Step 5: Card switch**

Create `apps/native/features/feed/cards/activity-card.tsx`:

```tsx
import type {
  ActivityItem,
  ListPayload,
  LogPayload,
  ReviewPayload,
} from "@/features/feed/activity-feed-types";

import { ActivityDivergenceCard } from "./activity-divergence-card";
import { ActivityListCard } from "./activity-list-card";
import { ActivityLogCard } from "./activity-log-card";
import { ActivityReviewCard } from "./activity-review-card";

export function ActivityCard({ item }: { item: ActivityItem }) {
  switch (item.kind) {
    case "log":
      return <ActivityLogCard payload={item.payload as LogPayload} at={item.at} />;
    case "review":
      return <ActivityReviewCard payload={item.payload as ReviewPayload} at={item.at} />;
    case "list":
      return <ActivityListCard payload={item.payload as ListPayload} at={item.at} />;
    case "divergence":
      return <ActivityDivergenceCard payload={item.payload} />;
    default:
      return null;
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/native/features/feed/cards
git commit -m "feat(native): rich activity cards per kind"
```

---

## Task 13: useActivityFeed hook + feed screen + wire Home

**Files:**
- Create: `apps/native/features/feed/use-activity-feed.ts`
- Create: `apps/native/features/feed/activity-feed-screen.tsx`
- Modify: `apps/native/app/(tabs)/index.tsx`

- [ ] **Step 1: Create the data hook**

Create `apps/native/features/feed/use-activity-feed.ts`:

```ts
import { useInfiniteQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

import { type ActivityItem, parseFeedApiActivityItems } from "./activity-feed-types";
import { FEED_PAGE_SIZE, getDeviceTimeZone, nextBeforeCursor } from "./feed-pagination";

/** Phase 1 default window — see spec "Open considerations". */
const FEED_PERIOD = "all" as const;

export function useActivityFeed() {
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session?.user);

  return useInfiniteQuery<ActivityItem[], Error>({
    queryKey: ["activity-feed", signedIn],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const tz = getDeviceTimeZone();
      if (signedIn) {
        const res = await api.api.feed.get({
          query: {
            limit: String(FEED_PAGE_SIZE),
            period: FEED_PERIOD,
            tz,
            ...(pageParam ? { before: pageParam as string } : {}),
          },
        });
        if (res.error) throw new Error("Failed to load feed");
        return parseFeedApiActivityItems(res.data);
      }
      const res = await api.api.feed.discover.get({
        query: { period: FEED_PERIOD, tz },
      });
      if (res.error) throw new Error("Failed to load feed");
      return parseFeedApiActivityItems(res.data);
    },
    getNextPageParam: (lastPage) => (signedIn ? nextBeforeCursor(lastPage) : undefined),
  });
}
```

> If `api.api.feed.get` / `api.api.feed.discover.get` don't resolve as typed methods, confirm the treaty path mapping by reading `packages/api-client/src/index.ts` and the server route prefixes (`/api/feed`, `/api/feed/discover`). The path segments mirror the URL.

- [ ] **Step 2: Create the feed screen with all states**

Create `apps/native/features/feed/activity-feed-screen.tsx`:

```tsx
import { useCallback } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useThemeColor } from "heroui-native";

import { FeedSkeleton } from "@/components/ui/feed-skeleton";

import { ActivityCard } from "./cards/activity-card";
import { type ActivityItem, activityRowKey } from "./activity-feed-types";
import { useActivityFeed } from "./use-activity-feed";

export function ActivityFeedScreen() {
  const foreground = useThemeColor("foreground");
  const {
    data,
    isPending,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useActivityFeed();

  const items: ActivityItem[] = data?.pages.flat() ?? [];

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isPending) {
    return (
      <View className="flex-1 bg-background">
        <FeedSkeleton />
      </View>
    );
  }

  if (isError && items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Text className="mb-3 text-center text-muted-foreground">
          Couldn't load your feed.
        </Text>
        <Pressable
          className="rounded-full border border-border px-5 py-2"
          onPress={() => refetch()}
        >
          <Text className="text-foreground">Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Text className="text-center text-muted-foreground">
          Follow people to fill your feed.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 24 }}
      data={items}
      keyExtractor={(item) => activityRowKey(item)}
      renderItem={({ item }) => <ActivityCard item={item} />}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={foreground} />
      }
      ListFooterComponent={
        isFetchingNextPage ? (
          <View className="py-4">
            <ActivityIndicator color={foreground} />
          </View>
        ) : null
      }
    />
  );
}
```

- [ ] **Step 3: Wire Home to the feed screen**

Replace `apps/native/app/(tabs)/index.tsx` with:

```tsx
import { SafeAreaView } from "react-native-safe-area-context";

import { ActivityFeedScreen } from "@/features/feed/activity-feed-screen";

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ActivityFeedScreen />
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/native && bunx tsc --noEmit`
Expected: no errors. (If treaty query typing complains about the conditional `before` spread, adjust to always pass `before` only when defined as shown; do not introduce `any`.)

- [ ] **Step 5: Commit**

```bash
git add apps/native/features/feed/use-activity-feed.ts apps/native/features/feed/activity-feed-screen.tsx "apps/native/app/(tabs)/index.tsx"
git commit -m "feat(native): activity feed screen wired to Home"
```

---

## Task 14: Full test run + manual smoke pass

**Files:**
- Create: `apps/native/features/feed/SMOKE.md`

- [ ] **Step 1: Run the full native unit suite**

Run from repo root: `bun test apps/native/features/feed/`
Expected: all suites pass (tmdb-poster-url, format-time-ago, activity-feed-types, feed-pagination).

- [ ] **Step 2: Document the manual smoke checklist**

Create `apps/native/features/feed/SMOKE.md`:

```markdown
# Activity feed — manual smoke checklist (Phase 1)

Prereqs: server running (`bun dev:server`), DB seeded, Expo Go on device/simulator.
Run: `bun dev:native`.

## Signed-out
- [ ] Launch app → Home shows discover feed cards (reviews + lists), no crash.
- [ ] Pull-to-refresh re-fetches without error.
- [ ] No infinite-scroll spinner appears (discover is single-page).

## Signed-in
- [ ] Sign in → Home shows personalized feed.
- [ ] Scroll to bottom → footer spinner appears and the next page appends.
- [ ] Pull-to-refresh resets to the first page.
- [ ] Mixed kinds render correctly: log (poster + stars + liked/rewatch),
      review (quote + like/comment counts), list (cover strip + count),
      divergence (you vs them) — or divergence absent if none in feed.

## States
- [ ] With server stopped, first load shows "Tap to retry"; tapping after
      restarting the server loads the feed.
- [ ] A brand-new account with no follows shows the "Follow people" empty state.

## Navigation
- [ ] All 5 tabs switch; Search / Log / Inbox / You show "coming soon".
- [ ] The +Log tab icon is larger and accent-colored.
```

- [ ] **Step 3: Walk the checklist on device**

Run `bun dev:server` (one terminal) and `bun dev:native` (another), open Expo Go, and tick each box. Fix any defects found (re-running the relevant task's verification) before committing.

- [ ] **Step 4: Commit**

```bash
git add apps/native/features/feed/SMOKE.md
git commit -m "docs(native): activity feed smoke checklist"
```

---

## Done — Phase 1 complete

The native app now has the 5-tab shell, the Eden + TanStack Query data layer, the design-system baseline, and a fully working Activity feed. The next phase picks up a new vertical (Search, Log, detail screens, …) reusing `lib/api.ts`, `lib/query-client.ts`, `components/ui/*`, and the `features/<name>/` pattern established here.
```
