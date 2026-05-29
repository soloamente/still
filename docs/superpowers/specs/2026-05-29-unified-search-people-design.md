# Unified ⌘K Search + People Discovery

**Status:** Approved (brainstorm 2026-05-29; human **yes**)  
**Date:** 2026-05-29  
**Scope:** One global search dialog (`CatalogSearchDialogRoot`), patron profile search, retirement of the legacy `cmdk` command palette  
**Out of scope (v1):** Restoring `/search` as a page, TMDb cast/crew person search in the same dialog, a dedicated “friends” graph product, search recent entries for patrons (optional v1.1), `?openSearch=` deep links

## Summary

Still has **two search surfaces** with mismatched promises:

| Shortcut | UI | Reality today |
|----------|-----|----------------|
| **⌘K** | `CatalogSearchDialogRoot` / `HomeStickySearch` | Films, TV, studios, genres, lists — **no people** |
| **⌘⇧K** | `CommandPaletteRoot` (`cmdk`) | Nav shortcuts + TMDb films only; placeholder claims “people, lists, friends” |

The standalone **`/search`** route was retired (redirect → `/home`). Patrons cannot discover **`@handle`** profiles from search.

This spec **unifies on ⌘K**: merge launcher shortcuts into the catalog dialog, add **People** search over **public profiles** with **following / mutual-first ranking**, show **follow suggestions** when the query is empty (signed in), and **remove** the second palette.

## Confirmed decisions (human)

| Topic | Decision |
|--------|----------|
| Search surface | **D** — single unified **⌘K** catalog dialog |
| People discoverability | **A** — any patron with **`profile.isPrivate = false`** |
| Ranking | **C** — **following first**, then **mutual** (`isMutual`), then other public matches |
| Empty query (signed in) | **D** — include **`/api/follows/suggestions`** rail when not typing |
| “Friends” | **Not v1** — use following + mutual boost only; separate friends product later |
| `/search` page | Stays **retired** (`retired-catalogue-redirect.ts` → `/home`) |

## Problem

1. **Misleading UX** — cmdk placeholder promises people/lists/friends; only films + “Go to” work.
2. **Split mental model** — ⌘K vs ⌘⇧K; nav search button opens catalog, shift-shortcut opens a different UI.
3. **No API** — server has `GET /api/profiles/:handle` (exact) and `check-handle`, not typeahead search.
4. **Social discovery gap** — feed links use `@handle`, but finding new patrons means leaving the app or guessing URLs.

## Goals

| Interaction | Target behaviour |
|-------------|------------------|
| **⌘K** anywhere | Opens **one** anchored catalog dialog (existing animation / anchor rules) |
| Type a name or `@handle` | **People** section with following/mutual matches first, then other public profiles (max **8**) |
| Empty query, signed in | **Suggested people** (follow suggestions) + **Go to** shortcuts + existing browse preview |
| Empty query, signed out | **Go to** + catalogue preview only (no people suggestions or search) |
| Pick a person | Navigate to `/profile/[handle]`, close dialog |
| **⌘⇧K** | **Removed** — no second palette |
| Private profiles | **Never** listed (viewer’s own profile not searchable here — use account menu) |

## Non-goals (v1)

- TMDb **person** entities (`/people/[id]`) in the same search results
- Full-text search across review bodies or diary notes
- Blocking or rate-limiting beyond sensible `limit` + debounce
- Replacing **HomeStickySearch** pill on `/home` (same component; extended behaviour)

## Architecture

### Component tree (target)

```
AppShell
  CatalogSearchDialogRoot          ← only global search UI
    SearchTokenField + results
    ├─ SearchDialogGoToGroup       ← from command-palette NAV_SHORTCUTS
    ├─ SearchDialogPeopleSuggestions (empty query, signed in)
    ├─ SearchDialogPeopleResults   ← GET /api/profiles/search
    ├─ Films / TV / Lists / Studios (existing)
    └─ …

REMOVED:
  CommandPaletteRoot
  useCommandPalette store
  ⌘⇧K listener in app-nav.tsx
```

### API: `GET /api/profiles/search`

**Query:** `q` (required, min 1 char after trim), `limit` (optional, default **8**, max **20**).

**Auth:** Optional. When a session exists, each row includes `relationship`:

| `relationship` | Meaning |
|----------------|---------|
| `following` | Viewer follows this user (`isMutual` may be true) |
| `mutual` | Viewer follows and `follow.isMutual` (sort tier above non-mutual following) |
| `none` | Public profile, no follow row |

**Filters:**

- `profile.isPrivate = false`
- Exclude viewer’s own `userId` when signed in
- Match `handle` or `displayName` (case-insensitive): prefix preferred, then substring for tokens ≥ 2 chars

**Sort (stable):**

1. Relationship tier: `mutual` → `following` (non-mutual) → `none`
2. Handle prefix match before display-name-only match
3. Shorter handle / alphabetical tie-break

**Response row:**

```ts
{
  userId: string;
  handle: string;
  displayName: string;
  image: string | null; // raw user.image; web uses PatronPortraitAvatar proxy
  relationship: "mutual" | "following" | "none";
}
```

**Errors:** `400` if `q` empty; `401` not required for anonymous search of public profiles.

Register route **before** `GET /:handle` in `profiles.ts` (same ordering constraint as `/me`).

### Web fetch layer

- `fetchProfileSearch(q, { signal })` in `still-api-fetch.ts`
- `useProfileSearch(query, { enabled })` — debounce **220ms**, abort in-flight (mirror cmdk film search)
- Strip leading `@` from query before API call; UI may show `@` in results

### People UI

**`SearchDialogPeopleResults`**

- Row: `PatronPortraitAvatar` + display name + `@handle`
- Micro-label: **Mutual** or **Following** when applicable (muted text, no extra chrome)
- `onSelect` → `router.push(/profile/${handle})`, close dialog
- Skeleton: reuse `SearchDialogListSkeleton` or a slim 3-row variant

**`SearchDialogPeopleSuggestions`**

- Heading: **Suggested for you**
- Data: existing `GET /api/follows/suggestions` (signed in only)
- Same row component; `onSelect` → profile

**`SearchDialogGoToGroup`**

- Move `NAV_SHORTCUTS` from `command-palette.tsx` into a shared module `search-go-to-shortcuts.ts`
- Client-filter labels when `query` non-empty (same as today’s cmdk)

### Dialog orchestration (`home-sticky-search.tsx`)

Result groups render in order when non-empty:

1. **Go to** (if shortcuts match)
2. **People** (if `peopleQuery` active and signed in — or allow signed-out public search per goal table: signed-out **no** people)
3. **Lists** (existing)
4. **Films / TV** (existing)

Empty state when query non-empty and all groups empty: existing copy + TMDB setup hint.

Placeholder: **`Films, TV, @people, lists…`**

### Keyboard

| Key | Action |
|-----|--------|
| **⌘K / Ctrl+K** | Open catalog search (unchanged) |
| **⌘⇧K** | **Unbound** (remove listener) |

### `/search` redirect

No change: `retired-catalogue-redirect.ts` keeps `/search` → `/home`. Document in spec only.

## Friends (future note)

Today **`follow.isMutual`** is the only “closer than follow” signal. A future **friends** feature may define mutual follows, explicit friend requests, or chat/DM eligibility. v1 search **must not** label rows “Friend” — use **Mutual** / **Following** only.

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Dialog height / complexity | Hide empty groups; cap people at 8 |
| SQL performance on large user base | `limit` + index on `profile.handle`; ILIKE with prefix when possible |
| Signed-out confusion | No people block when logged out |
| Stale cmdk muscle memory | No alias for ⌘⇧K in v1 (optional changelog note) |
| Avatar privacy | Use `profilePatronAvatarImageUrl(handle)` only |

## Testing

| Layer | Cases |
|-------|--------|
| API | Private excluded; following ranks above none; mutual above non-mutual following; `@` stripped; self excluded |
| Web unit | `normalizeProfileSearchQuery` strips `@`; go-to filter |
| Manual | ⌘K from `/home`, `/diary`, `/movies/[id]`; search partial handle; open suggested profile; confirm ⌘⇧K does nothing |

## Files (expected touch)

| Area | Files |
|------|--------|
| Server | `apps/server/src/routes/profiles.ts`, `profiles.search.test.ts` (new) |
| Web lib | `still-api-fetch.ts`, `use-profile-search.ts` (new), `search-go-to-shortcuts.ts` (new) |
| Web UI | `home-sticky-search.tsx`, `search-dialog-people-results.tsx` (new), `search-dialog-people-suggestions.tsx` (new) |
| Remove | `command-palette.tsx` usage from `app-shell.tsx`, `app-nav.tsx` |
| Docs | This spec; implementation plan |

## Success criteria

1. Patron can ⌘K, type `@` or a display name, and reach a **public** profile in ≤2 keystrokes after results load.
2. Accounts they **follow** appear above strangers with the same substring match.
3. No second search dialog; cmdk palette code path removed from app shell.
4. Placeholder and empty states do not promise unimplemented features.
