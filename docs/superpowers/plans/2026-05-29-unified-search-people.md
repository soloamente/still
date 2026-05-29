# Unified ⌘K Search + People Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One global ⌘K catalog search dialog with patron discovery (public profiles, following-first ranking), follow suggestions on empty query, and removal of the legacy cmdk command palette.

**Architecture:** Add `GET /api/profiles/search` before the profiles catch-all route; client debounced fetch + People results group inside `CatalogSearchDialogRoot`; move nav shortcuts from `command-palette.tsx` into shared go-to module; delete palette from shell.

**Tech stack:** Elysia + Drizzle (server), Next.js App Router client components, existing `CatalogSearchDialogRoot` / `PatronPortraitAvatar`, `motion/react` (not `framer-motion`).

**Spec:** [2026-05-29-unified-search-people-design.md](../specs/2026-05-29-unified-search-people-design.md)

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/server/src/routes/profiles.ts` | `GET /search` handler |
| `apps/server/src/routes/profiles.search.test.ts` | API ranking + privacy tests |
| `apps/web/src/lib/profile-search-query.ts` | `normalizeProfileSearchQuery`, types |
| `apps/web/src/lib/profile-search-query.test.ts` | Unit tests |
| `apps/web/src/lib/still-api-fetch.ts` | `fetchProfileSearch` |
| `apps/web/src/lib/use-profile-search.ts` | Debounced hook |
| `apps/web/src/lib/search-go-to-shortcuts.ts` | `SEARCH_GO_TO_SHORTCUTS` |
| `apps/web/src/components/home/search-dialog-people-results.tsx` | People hit rows |
| `apps/web/src/components/home/search-dialog-people-suggestions.tsx` | Follow suggestions rail |
| `apps/web/src/components/home/home-sticky-search.tsx` | Wire groups + placeholder |
| `apps/web/src/components/app/app-shell.tsx` | Remove `CommandPaletteRoot` |
| `apps/web/src/components/app/app-nav.tsx` | Remove ⌘⇧K + `useCommandPalette` |
| `apps/web/src/components/app/command-palette.tsx` | **Delete** after shortcut extraction |

---

### Task 1: Profile search query helper

**Files:**
- Create: `apps/web/src/lib/profile-search-query.ts`
- Create: `apps/web/src/lib/profile-search-query.test.ts`

- [ ] **Step 1:** Write tests for `normalizeProfileSearchQuery` — strips leading `@`, trims, returns `""` for whitespace-only.
- [ ] **Step 2:** Implement helper; export `ProfileSearchHit` type matching API row.
- [ ] **Step 3:** Run `bun test apps/web/src/lib/profile-search-query.test.ts`.

---

### Task 2: Server `GET /api/profiles/search`

**Files:**
- Modify: `apps/server/src/routes/profiles.ts` (register **before** `/:handle`)
- Create: `apps/server/src/routes/profiles.search.test.ts`

- [ ] **Step 1:** Write failing tests: private profile excluded; following ranks above `none`; mutual ranks above non-mutual following; viewer excluded from own results; empty `q` → 400.
- [ ] **Step 2:** Implement handler — join `profile` + `user`, optional `follow` for viewer, `ilike` on handle/displayName, sort tiers, `limit` clamp 1–20 default 8.
- [ ] **Step 3:** Run server tests; fix until green.

---

### Task 3: Client fetch + hook

**Files:**
- Modify: `apps/web/src/lib/still-api-fetch.ts`
- Create: `apps/web/src/lib/use-profile-search.ts`

- [ ] **Step 1:** Add `fetchProfileSearch(q, { signal })` using query string `q`.
- [ ] **Step 2:** Add `useProfileSearch(query, { enabled })` — 220ms debounce, abort prior request, `enabled` when normalized query length ≥ 1 and caller passes `signedIn` for people (or always for public search if spec changes; **signed-in only for v1** per spec).
- [ ] **Step 3:** Manual smoke in devtools — `fetchProfileSearch('test')` returns JSON.

---

### Task 4: Go-to shortcuts module

**Files:**
- Create: `apps/web/src/lib/search-go-to-shortcuts.ts`
- Modify: `apps/web/src/components/app/command-palette.tsx` (temporary — re-export or duplicate until Task 7)

- [ ] **Step 1:** Move `NAV_SHORTCUTS` constant to `search-go-to-shortcuts.ts` as `SEARCH_GO_TO_SHORTCUTS`; export `filterGoToShortcuts(query)`.
- [ ] **Step 2:** Update `command-palette.tsx` to import from shared module (keeps build green until deletion).

---

### Task 5: People results UI

**Files:**
- Create: `apps/web/src/components/home/search-dialog-people-results.tsx`
- Create: `apps/web/src/components/home/search-dialog-people-suggestions.tsx`

- [ ] **Step 1:** `SearchDialogPeopleResults` — props: `hits`, `loading`, `onSelect(handle)`; rows use `PatronPortraitAvatar`, display name, `@handle`, **Mutual** / **Following** labels; flat `bg-background` hover per feed row tokens (no borders).
- [ ] **Step 2:** `SearchDialogPeopleSuggestions` — fetch `/api/follows/suggestions` on mount when dialog open + signed in; skeleton while loading; same row chrome.
- [ ] **Step 3:** Visual check in Storybook or `/home` dialog (manual).

---

### Task 6: Wire into `CatalogSearchDialogRoot`

**Files:**
- Modify: `apps/web/src/components/home/home-sticky-search.tsx`

- [ ] **Step 1:** Import go-to filter, people components, `useProfileSearch`; accept `signedIn` + `viewerUserId` via props or session hook already available on shell.
- [ ] **Step 2:** When `query` empty + signed in — render suggestions + go-to + existing browse preview.
- [ ] **Step 3:** When `query` non-empty — render go-to (filtered), people (if signed in), then existing catalogue/list results; hide empty groups.
- [ ] **Step 4:** Update pill + dialog placeholder to `Films, TV, @people, lists…`.
- [ ] **Step 5:** `onSelect` profile → `router.push`, `recordHomeSearchRecent` optional skip for v1.

---

### Task 7: Retire command palette

**Files:**
- Modify: `apps/web/src/components/app/app-shell.tsx`
- Modify: `apps/web/src/components/app/app-nav.tsx`
- Delete: `apps/web/src/components/app/command-palette.tsx`

- [ ] **Step 1:** Remove `CommandPaletteRoot` from `app-shell.tsx`.
- [ ] **Step 2:** Remove `useCommandPalette`, ⌘⇧K `useEffect` from `app-nav.tsx`; ensure nav search button still calls `requestCatalogSearch`.
- [ ] **Step 3:** Delete `command-palette.tsx`; grep for `useCommandPalette` / `command-palette` — zero hits.
- [ ] **Step 4:** `bun run build --filter=web` passes.

---

### Task 8: QA + docs

- [ ] **Manual:** ⌘K on `/home`, `/diary`, `/movies/[id]` — people search, suggestions, go-to shortcuts.
- [ ] **Manual:** ⌘⇧K does not open a second dialog.
- [ ] **Manual:** Signed out — no people section; films/TV still work.
- [ ] **Manual:** `/search` bookmark → `/home` (unchanged).
- [ ] Update `AGENTS.md` one line: unified ⌘K search includes `@people` (public profiles, following-first); cmdk palette removed.
- [ ] Scratchpad: note US.1 unified search approved.

---

## Human verification gate

Reply **`ok`** when:

1. People you **follow** rank above strangers for the same query.
2. **Suggested for you** shows when the field is empty (signed in).
3. Only **one** search UI (⌘K).

---

## Optional v1.1 (do not block v1)

- `recordHomeSearchRecent` for patron handles
- `/home?openSearch=1&q=` deep link
- TMDb person search group
