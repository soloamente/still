# Search Dialog Tagged Query — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a token-based search bar to `HomeStickySearch` so users can Tab-commit studio/media/lists pills (studio shows logo) and search free text against those filters—e.g. A24 + Films + “marty”.

**Architecture:** Pure tag logic lives in `search-query-tags.ts`; UI in isolated `SearchTokenField` client component; debounced fetching in `useStructuredCatalogSearch` orchestrating existing TMDb proxies plus new list search and `company` on movie search. `home-sticky-search.tsx` wires state and result modes without growing past ~900 lines (extract result rows if needed).

**Tech Stack:** Next.js App Router (client leaf), Elysia (`apps/server`), TMDb v3, Tailwind v4 tokens (`bg-card` / `bg-background`), `motion/react` for pill enter/exit, existing `useSearchDialogStudios` for studio metadata.

**Spec:** `docs/superpowers/specs/2026-05-20-search-dialog-tagged-query-design.md`

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/src/lib/search-query-tags.ts` | Create | Types, `rankTagSuggestions`, `applyTag`, serialize/parse recents |
| `apps/web/src/lib/search-query-tags.test.ts` | Create | Pure-function tests (Bun) |
| `apps/web/src/components/home/search-token-field.tsx` | Create | Pills + input + ghost + suggestion list |
| `apps/web/src/components/home/search-tag-pill.tsx` | Create | Single pill (studio logo / media / lists) |
| `apps/web/src/lib/use-structured-catalog-search.ts` | Create | Debounced API orchestration from structured query |
| `apps/web/src/lib/still-api-fetch.ts` | Modify | `fetchMoviesSearch` + `company`; add `fetchListsSearch` |
| `apps/server/src/routes/movies.ts` | Modify | `GET /search?company=` filter |
| `apps/server/src/routes/lists.ts` | Modify | `GET /search` auth, own lists |
| `apps/web/src/components/home/home-sticky-search.tsx` | Modify | Replace plain input; wire hook + list results |
| `apps/web/src/components/home/search-dialog-list-results.tsx` | Create | List result rows for lists mode |
| `.cursor/scratchpad.md` | Modify | Track B / executor status (per repo workflow) |

---

## Phase 1 — Tag model + token field (studio & media)

### Task 1: Tag types and suggestion engine

**Files:**
- Create: `apps/web/src/lib/search-query-tags.ts`
- Create: `apps/web/src/lib/search-query-tags.test.ts`

- [ ] **Step 1: Add types and media/studio matchers**

```ts
// apps/web/src/lib/search-query-tags.ts
import type { SearchDialogStudio } from "@/lib/search-dialog-studios";

export type SearchTag =
  | { kind: "studio"; id: number; name: string; logoUrl: string | null }
  | { kind: "media"; listingKind: "movie" | "tv" }
  | { kind: "lists" };

export type TagSuggestion =
  | { kind: "studio"; id: number; name: string; logoUrl: string | null; label: string }
  | { kind: "media"; listingKind: "movie" | "tv"; label: string }
  | { kind: "lists"; label: string };

const MEDIA_MOVIE = ["movie", "movies", "film", "films"] as const;
const MEDIA_TV = ["tv", "show", "shows"] as const;

export function deriveSearchState(tags: SearchTag[]) {
  const studio = tags.find((t): t is Extract<SearchTag, { kind: "studio" }> => t.kind === "studio");
  const media = tags.find((t): t is Extract<SearchTag, { kind: "media" }> => t.kind === "media");
  const lists = tags.some((t) => t.kind === "lists");
  return {
    studioId: studio?.id ?? null,
    listingKind: (media?.listingKind ?? "movie") as "movie" | "tv",
    resultMode: lists ? ("lists" as const) : ("catalogue" as const),
  };
}

export function rankTagSuggestions(
  token: string,
  studios: SearchDialogStudio[],
  existingTags: SearchTag[],
): TagSuggestion[] {
  const q = token.trim().toLowerCase();
  if (!q) return [];
  const hasStudio = existingTags.some((t) => t.kind === "studio");
  const hasMedia = existingTags.some((t) => t.kind === "media");
  const hasLists = existingTags.some((t) => t.kind === "lists");
  const out: TagSuggestion[] = [];

  if (!hasLists) {
    for (const s of studios) {
      const name = s.name.toLowerCase();
      const short = name.split(/\s+/)[0] ?? name;
      if (name.startsWith(q) || short.startsWith(q)) {
        out.push({ kind: "studio", id: s.id, name: s.name, logoUrl: s.logoUrl, label: s.name });
      }
    }
    if (!hasMedia) {
      if (MEDIA_MOVIE.some((w) => w.startsWith(q)))
        out.push({ kind: "media", listingKind: "movie", label: "Films" });
      if (MEDIA_TV.some((w) => w.startsWith(q)))
        out.push({ kind: "media", listingKind: "tv", label: "TV shows" });
    }
    if (["list", "lists"].some((w) => w.startsWith(q)))
      out.push({ kind: "lists", label: "Lists" });
  }

  return out.slice(0, 6);
}

export function suggestionToTag(s: TagSuggestion): SearchTag {
  if (s.kind === "studio")
    return { kind: "studio", id: s.id, name: s.name, logoUrl: s.logoUrl };
  if (s.kind === "media") return { kind: "media", listingKind: s.listingKind };
  return { kind: "lists" };
}

export function upsertTag(tags: SearchTag[], next: SearchTag): SearchTag[] {
  const without = tags.filter((t) => {
    if (next.kind === "studio" && t.kind === "studio") return false;
    if (next.kind === "media" && t.kind === "media") return false;
    if (next.kind === "lists") return t.kind !== "lists" && t.kind !== "media" && t.kind !== "studio";
    return true;
  });
  if (next.kind === "lists") return [next];
  return [...without.filter((t) => t.kind !== "lists"), next];
}
```

- [ ] **Step 2: Add Bun tests for suggestion ranking**

```ts
// apps/web/src/lib/search-query-tags.test.ts
import { describe, expect, test } from "bun:test";
import { rankTagSuggestions, upsertTag, deriveSearchState } from "./search-query-tags";

describe("rankTagSuggestions", () => {
  test("matches a24 studio", () => {
    const s = rankTagSuggestions("a24", [{ id: 41077, name: "A24", logoUrl: null }], []);
    expect(s[0]?.kind).toBe("studio");
  });
  test("lists tag excludes studio suggestions", () => {
    const s = rankTagSuggestions("a24", [{ id: 1, name: "A24", logoUrl: null }], [{ kind: "lists" }]);
    expect(s.length).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd apps/web && bun test src/lib/search-query-tags.test.ts`  
Expected: PASS (2 tests)

- [ ] **Step 4: Commit** (only if user requested commits)

```bash
git add apps/web/src/lib/search-query-tags.ts apps/web/src/lib/search-query-tags.test.ts
git commit -m "feat(web): add search query tag types and suggestion ranking"
```

---

### Task 2: Search tag pill component

**Files:**
- Create: `apps/web/src/components/home/search-tag-pill.tsx`

- [ ] **Step 1: Implement pill with remove button**

```tsx
"use client";

import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import { X } from "lucide-react";
import type { SearchTag } from "@/lib/search-query-tags";

export function SearchTagPill({
  tag,
  onRemove,
}: {
  tag: SearchTag;
  onRemove: () => void;
}) {
  const label =
    tag.kind === "studio" ? tag.name : tag.kind === "media" ? (tag.listingKind === "movie" ? "Films" : "TV shows") : "Lists";

  return (
    <span
      className={cn(
        "inline-flex h-8 max-w-[9rem] shrink-0 items-center gap-1.5 rounded-full bg-background py-1 pr-1 pl-1.5 shadow-sm",
      )}
    >
      {tag.kind === "studio" && tag.logoUrl ? (
        <Image src={tag.logoUrl} alt="" width={20} height={20} className="size-5 shrink-0 object-contain" unoptimized />
      ) : null}
      <span className="truncate font-medium text-xs">{label}</span>
      <button
        type="button"
        aria-label={`Remove ${label} filter`}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground [@media(hover:hover)]:hover:bg-foreground/10 [@media(hover:hover)]:hover:text-foreground"
        onClick={onRemove}
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}
```

- [ ] **Step 2: Visual check** — open Storybook N/A; skip to Task 3 integration.

---

### Task 3: SearchTokenField component

**Files:**
- Create: `apps/web/src/components/home/search-token-field.tsx`

- [ ] **Step 1: Build compound input**

Props:

```ts
export type SearchTokenFieldProps = {
  tags: SearchTag[];
  onTagsChange: (tags: SearchTag[]) => void;
  inputValue: string;
  onInputValueChange: (v: string) => void;
  studios: SearchDialogStudio[];
  onSubmit?: () => void;
  inputId: string;
  placeholder?: string;
};
```

Behavior:
- Flex row: pills + growing `<input>` (`min-w-[4rem] flex-1`, `text-base`, `bg-transparent`, no border).
- `rankTagSuggestions(inputValue, studios, tags)` → suggestion panel below when `suggestions.length > 0`.
- **Tab** / **Enter** (panel open): `upsertTag(tags, suggestionToTag(top))`, clear input.
- **Backspace** on empty input: pop last tag.
- **Escape**: close panel (local `suggestionsOpen` state).
- Ghost: if top suggestion label extends token, render muted suffix after input (absolute in wrapper) — optional “Tab” kbd hint `hidden sm:inline`.
- Suggestion row: studio rows show logo; min-h-11; `DETAIL_CANVAS_ON_CARD_HOVER_CLASS` on rows.
- `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` pointing at listbox id.

- [ ] **Step 2: Wire reduced motion** — pill `AnimatePresence` only when `!reduceMotion`; opacity-only enter 120ms.

- [ ] **Step 3: Manual test**

1. `bun run dev:web` + `bun run dev:server`  
2. Temporarily render `<SearchTokenField />` in dialog or integrate in Task 4.  
3. Type `a24` → Tab → pill with logo; type `mov` → Tab → Films pill; Backspace removes Films.

---

### Task 4: Integrate token field into HomeStickySearch (no new APIs yet)

**Files:**
- Modify: `apps/web/src/components/home/home-sticky-search.tsx`

- [ ] **Step 1: Replace `draft` string state**

```ts
const [tags, setTags] = useState<SearchTag[]>([]);
const [freeText, setFreeText] = useState("");
const { studios } = useSearchDialogStudios(dialogOpen);
const { listingKind: derivedKind, resultMode } = deriveSearchState(tags);
const searchListingKind = tags.some((t) => t.kind === "media")
  ? derivedKind
  : searchListingKindState; // keep existing useState as fallback when no media pill
```

- [ ] **Step 2: Replace form input with `SearchTokenField`**

Keep `Search` icon in form row; pass `inputId="home-sticky-search-dialog-input"`.

- [ ] **Step 3: Bridge to existing search**

Until Phase 2 hook exists:

```ts
const draft = freeText; // for useCatalogTextSearch
const isEmptyDraft = tags.length === 0 && !freeText.trim();
```

Hide Films/TV fieldset when `tags.some(t => t.kind === 'media')`.

- [ ] **Step 4: Hide studio rail when studio pill present**

`browseCategory === "movies" && !tags.some(t => t.kind === "studio")` for `SearchDialogStudioRail`.

- [ ] **Step 5: Manual regression**

- Plain text search still works.  
- Empty browse unchanged.  
- Studio rail still works when no studio pill.

- [ ] **Step 6: Update `.cursor/scratchpad.md`** — note Phase 1 complete; human verify.

**Phase 1 exit criteria:** Pills + Tab + Backspace; media pill hides Films/TV toggle; no API changes required.

---

## Phase 2 — Combined studio + title search

### Task 5: Server — movie search with `company`

**Files:**
- Modify: `apps/server/src/routes/movies.ts`
- Modify: `apps/server/src/lib/tmdb.ts` (only if extending `TmdbMovieSummary`)

- [ ] **Step 1: Parse `company` query param**

In `/search` handler after `searchMovies`:

```ts
const companyRaw = query.company?.trim();
const companyId =
  companyRaw && Number.isFinite(Number(companyRaw))
    ? Math.floor(Number(companyRaw))
    : null;

let rows = data.results;
if (companyId) {
  // TMDb /search/movie often omits company_ids on summary rows — fetch ids from raw JSON if present:
  rows = rows.filter((m) => {
    const ids = (m as { production_company_ids?: number[] }).production_company_ids;
    if (Array.isArray(ids)) return ids.includes(companyId);
    return true; // keep row if unknown; client discover fallback handles empty feel
  });
  if (rows.length === 0 && q.length >= 2) {
    const disc = await tmdbApi.discoverMovies(1, { withCompanies: companyId, sortBy: "popularity.desc", language });
    const ql = q.toLowerCase();
    rows = disc.results.filter((m) => m.title.toLowerCase().includes(ql)).slice(0, 20);
  }
}
```

Add to query schema: `company: t.Optional(t.String())`.

- [ ] **Step 2: Manual API test**

`curl "http://localhost:3000/api/movies/search?q=marty&company=41077"` (with auth cookie if needed) — expect filtered rows.

---

### Task 6: Client fetch + structured search hook

**Files:**
- Modify: `apps/web/src/lib/still-api-fetch.ts`
- Create: `apps/web/src/lib/use-structured-catalog-search.ts`

- [ ] **Step 1: Extend `fetchMoviesSearch`**

```ts
export async function fetchMoviesSearch(
  qRaw: string,
  init?: Pick<RequestInit, "signal"> & { companyId?: number },
) {
  const url = new URL("/api/movies/search", env.NEXT_PUBLIC_SERVER_URL);
  url.searchParams.set("q", qRaw.trim());
  const cid = init?.companyId;
  if (cid !== undefined && Number.isFinite(cid) && cid > 0)
    url.searchParams.set("company", String(Math.floor(cid)));
  // ...existing fetch
}
```

- [ ] **Step 2: Implement `useStructuredCatalogSearch`**

```ts
export function useStructuredCatalogSearch(
  tags: SearchTag[],
  freeText: string,
  enabled: boolean,
) {
  const { studioId, listingKind, resultMode } = deriveSearchState(tags);
  const q = freeText.trim();
  // lists mode → defer to Phase 3
  // studio only, !q → fetchMoviesDiscover(1, { companyId: studioId })
  // q + movie → fetchMoviesSearch(q, { companyId: studioId ?? undefined })
  // q + tv → fetchTvSearch(q) — ignore studioId (TV+studio not combined in v1)
  // no tags → return null so parent uses useCatalogTextSearch
}
```

Return `{ results, loading, setupHint, usesStructured: boolean }`.

- [ ] **Step 3: Wire `home-sticky-search.tsx`**

When `tags.length > 0 || resultMode === 'catalogue' with studio`:

```ts
const structured = useStructuredCatalogSearch(tags, freeText, dialogOpen && !isEmptyDraft);
const hits = structured.usesStructured ? structured.results : searchResults;
```

- [ ] **Step 4: Manual test — A24 + marty**

Open search → `a24` Tab → `marty` → see *Marty Supreme* or relevant A24 titles within ~300ms after debounce.

**Phase 2 exit criteria:** Spec flow #1 passes.

---

## Phase 3 — Lists tag + API

### Task 7: `GET /api/lists/search`

**Files:**
- Modify: `apps/server/src/routes/lists.ts`

- [ ] **Step 1: Add route before `/me` or after**

```ts
.get(
  "/search",
  async ({ user, status, query }) => {
    if (!user) return status(401, "Sign in");
    const q = (query.q ?? "").trim();
    const limit = Math.min(Number(query.limit ?? 20), 40);
    const rows = await db
      .select()
      .from(list)
      .where(
        q
          ? and(eq(list.userId, user.id), sql`lower(${list.title}) like ${`%${q.toLowerCase()}%`}`)
          : eq(list.userId, user.id),
      )
      .orderBy(desc(list.updatedAt))
      .limit(limit);
    return withCoverPosterPaths(rows);
  },
  { query: t.Object({ q: t.Optional(t.String()), limit: t.Optional(t.String()) }) },
)
```

Place **above** `/:id` dynamic routes if any conflict.

- [ ] **Step 2: `fetchListsSearch` in `still-api-fetch.ts`**

- [ ] **Step 3: Extend `useStructuredCatalogSearch` for `resultMode === 'lists'`**

Handle 401 → `needsSignIn: true`.

---

### Task 8: List results UI

**Files:**
- Create: `apps/web/src/components/home/search-dialog-list-results.tsx`
- Modify: `apps/web/src/components/home/home-sticky-search.tsx`

- [ ] **Step 1: Row component**

Reuse patterns from `add-to-list-picker.tsx` / `list-row-strip.tsx`: cover poster, title, film count if available.

- [ ] **Step 2: Render when `resultMode === 'lists'`**

Replace poster grid with list rows; navigate to `/lists/[id]` on click.

- [ ] **Step 3: Guest empty state**

`Sign in to search your lists` + link to `/sign-in` if 401.

**Phase 3 exit criteria:** Spec manual tests #3 and lists-only tag.

---

## Phase 4 — Recents + a11y

### Task 9: Serialize tagged queries in recents

**Files:**
- Modify: `apps/web/src/lib/search-query-tags.ts`
- Modify: `apps/web/src/components/home/home-sticky-search.tsx`

- [ ] **Step 1: Add `serializeStructuredQuery` / `parseRecentStructuredQuery`**

Format: `A24 · Films · marty` (middle dot separator). Parser maps known studio names via studios list.

- [ ] **Step 2: `recordRecentSearchQuery` stores serialized string; chip click restores tags + freeText**

- [ ] **Step 3: Manual test** — recent chip restores pills.

---

### Task 10: Accessibility pass

**Files:**
- Modify: `apps/web/src/components/home/search-token-field.tsx`

- [ ] **Step 1: Verify**

- Each pill remove has `aria-label`  
- Input `aria-describedby` for Tab hint  
- Results region `aria-live="polite"` (already on column)  
- Focus trap does not break dialog close  
- 44px suggestion rows  

- [ ] **Step 2: Studio + TV constraint copy** (if user sets TV + studio pill): subtle hint under bar “Studios filter Films only” — only if both present.

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Token field + Tab pills | 1–4 |
| Studio logo on pill | 2 |
| Media tag hides toggle | 4 |
| Lists own-only | 7–8 |
| `company` + text search | 5–6 |
| Empty browse unchanged | 4 (`isEmptyDraft`) |
| No rings on pills | 2 |
| Recents | 9 |
| a11y | 10 |
| TV + studio limitation | 6, 10 |

No TBD placeholders remain in task steps.

---

## Manual test checklist (full feature)

- [ ] `a24` → Tab → logo pill → `marty` → A24 film results  
- [ ] `mov` → Tab → Films → TV toggle hidden  
- [ ] `lists` → Tab → own lists (signed in)  
- [ ] Signed out + lists → sign-in message  
- [ ] No tags/text → empty browse + studio rail  
- [ ] Recent chip restores tags  
- [ ] `prefers-reduced-motion`: no jank  

---

## Executor notes

- Import motion from `motion/react`, not `framer-motion`.  
- Match `SearchDialogStudioRail` tokens (`bg-background`, `shadow-sm`).  
- One task at a time per repo Planner/Executor workflow; human verifies after Phase 1–3.  
- Do not commit unless user asks.
