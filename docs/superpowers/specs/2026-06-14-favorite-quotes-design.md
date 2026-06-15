# Sense — Favorite Quotes Design

**Status:** Approved (brainstorm 2026-06-14)  
**Date:** 2026-06-14  
**Parent:** [2026-06-13-letterboxd-pillars-roadmap-design.md](./2026-06-13-letterboxd-pillars-roadmap-design.md)  
**Approach:** **2 — Catalog + submissions split** (published quotes vs patron moderation queue)  
**Track:** Social / Ritual (film page completeness + taste identity)

## Summary

Patrons can browse **dialogue quotes** on movie and TV detail pages, **upvote** community favorites, and **save** lines to a personal collection. The catalog is seeded from a **pluggable external movie-quote API**, enriched by **staff**, and extended via **patron submissions** that staff **approve or reject** — with an **in-app notification** on resolution.

Saved quotes default to **private**; patrons opt in to **public** visibility per quote or for their whole collection. A dedicated **`/quotes` lobby** plus a **profile summary strip** surface the collection. Title detail gains a top-level **Quotes** tab alongside About, Community, and Streaming.

**North star:** Quotes become a lightweight taste signal — memorable lines patrons curate and share, without competing with reviews or diary.

## Brainstorm decisions (locked)

| Topic | Decision |
|-------|----------|
| Catalog source | **Hybrid** — external API + staff + approved patron submissions |
| Patron submit | Request → staff queue → approve/reject → **notification** |
| Personal collection | **`/quotes` lobby** + **profile summary** (latest public + link to all) |
| Title detail IA | **Dedicated Quotes tab** — About · Community · Quotes · Streaming |
| TV scope | **Per episode** — Season + Episode selects; timestamp within episode runtime |
| Save visibility | **Default private**; opt-in public per save or whole collection |
| External seed (v1) | **Dedicated movie-quote API** via env-gated adapter (provider TBD at implementation) |
| Showcase pin | **Deferred v1.1** — do not extend `showcase_items` in MVP |

## Problem

Sense has rich patron **reviews** (editorial quote styling) but no **canonical dialogue quotes** per title — no timestamps, no community ranking, no personal “lines I love” collection. Letterboxd-class completeness and taste identity both benefit from memorable dialogue as a first-class, low-friction artifact distinct from long-form reviews.

## Goals

1. **Discover** — Quotes tab on film/TV detail, sorted by upvotes by default.
2. **Collect** — Save quotes to `/quotes`; optional public sharing on profile.
3. **Contribute** — Submit new quotes; staff moderates; submitter notified.
4. **Seed** — Import from external API mapped to `tmdbId` (and TV season/episode when provider supplies it).
5. **Instrument** — `product_event` for save, upvote, submit, moderation outcomes.

## Non-goals (MVP)

- Pinning a quote in the 4-slot profile **showcase** (v1.1).
- OG/share cards for individual quotes.
- In-app playback jump-to-timestamp (no owned player).
- Fuzzy dedup between near-duplicate patron submissions and catalog.
- Email notifications (in-app only, matching existing notification patterns).

---

## Architecture

### Approach comparison (chosen: #2)

| # | Approach | Verdict |
|---|----------|---------|
| 1 | Single `listing_quote` table with status enum | Rejected — mixes public catalog and moderation queue |
| **2** | **`listing_quote` + `quote_submission`** | **Chosen** — clean public reads, staff queue, import upserts |
| 3 | System list kind `quotes` | Rejected — timestamps, upvotes, TV scope, moderation do not fit lists |

### Data model

#### `listing_quote` (published catalog)

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | uuid |
| `movieId` | int FK nullable | XOR with `tvId` |
| `tvId` | int FK nullable | |
| `seasonNumber` | smallint nullable | Required when `tvId` set |
| `episodeNumber` | smallint nullable | Required when `tvId` set |
| `body` | text | Quote text; max 500 chars |
| `speaker` | text nullable | Character name |
| `timestampMs` | int nullable | Ms from start of film or episode |
| `source` | enum | `external_api` \| `staff` \| `patron` |
| `submittedByUserId` | text FK nullable | Set when `source = patron` |
| `externalProvider` | text nullable | e.g. provider slug |
| `externalId` | text nullable | Dedup key for import |
| `upvoteCount` | int | Denormalized; default 0 |
| `publishedAt` | timestamptz | |
| `createdAt` | timestamptz | |

**Constraints:**

- Check: exactly one of `movieId`, `tvId`.
- Check: if `tvId` then `seasonNumber` and `episodeNumber` NOT NULL.
- Unique: `(externalProvider, externalId)` where both non-null.
- Index: `(movieId, upvoteCount DESC)`, `(tvId, seasonNumber, episodeNumber, upvoteCount DESC)`.

#### `listing_quote_upvote`

| Column | Type |
|--------|------|
| `userId` | text FK |
| `quoteId` | text FK → `listing_quote.id` |
| `createdAt` | timestamptz |

Unique `(userId, quoteId)`. Toggle via POST (insert/delete).

#### `listing_quote_save`

| Column | Type |
|--------|------|
| `id` | text PK |
| `userId` | text FK |
| `quoteId` | text FK |
| `visibility` | `content_visibility` | Default **`private`** |
| `savedAt` | timestamptz |

Unique `(userId, quoteId)`.

#### `quote_submission` (moderation queue)

| Column | Type |
|--------|------|
| `id` | text PK |
| `userId` | text FK (submitter) |
| Same content fields as `listing_quote` | | Pending payload |
| `status` | enum | `pending` \| `approved` \| `rejected` |
| `staffNote` | text nullable | Shown to submitter on reject |
| `reviewedByUserId` | text FK nullable |
| `reviewedAt` | timestamptz nullable |
| `resolvedQuoteId` | text FK nullable | Set on approve |
| `createdAt` | timestamptz |

**Rate limit:** max **5 submissions / patron / 24h** (configurable).

### External API adapter

```typescript
/** Pluggable provider — selected via env QUOTE_API_PROVIDER + credentials. */
interface QuoteProvider {
  /** Fetch quotes for a TMDb movie id. */
  fetchMovieQuotes(tmdbMovieId: number): Promise<NormalizedQuote[]>;
  /** Optional — when provider supports TV episode granularity. */
  fetchTvEpisodeQuotes?(
    tmdbTvId: number,
    season: number,
    episode: number,
  ): Promise<NormalizedQuote[]>;
}

type NormalizedQuote = {
  externalId: string;
  body: string;
  speaker?: string;
  timestampMs?: number;
  seasonNumber?: number;
  episodeNumber?: number;
};
```

**Import job** (`apps/server/src/jobs/quote-import.ts` or lib module):

- Upsert by `(externalProvider, externalId)`.
- Never overwrite rows where `source IN ('staff', 'patron')`.
- Log skip/fail counts; respect provider rate limits.
- **Provider selection** is an implementation task — validate licensing before merge. Cornell Movie-Dialogs Corpus is **not** suitable (no playback timestamps). Prefer a commercial REST provider with `tmdbId` mapping.

---

## API surface

### Public (catalog)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/movies/:id/quotes` | Query: `sort=upvotes\|newest`, `limit`, `cursor` |
| GET | `/api/tv/:id/quotes` | Query: **`season`**, **`episode`** (required), `sort`, pagination |
| GET | `/api/quotes/:id` | Single quote + title metadata |

Response shape (list item):

```typescript
type ListingQuoteItem = {
  id: string;
  body: string;
  speaker: string | null;
  timestampMs: number | null;
  timestampLabel: string | null; // "01:23:45" derived server-side
  upvoteCount: number;
  viewerHasUpvoted?: boolean; // when signed in
  viewerHasSaved?: boolean;
  seasonNumber?: number;
  episodeNumber?: number;
};
```

### Patron (auth required)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/quotes/:id/upvote` | Toggle upvote |
| POST | `/api/quotes/:id/save` | Body: optional `visibility` (default `private`) |
| PATCH | `/api/quotes/saves/:id` | Update visibility |
| DELETE | `/api/quotes/saves/:id` | Remove from collection |
| POST | `/api/quotes/submit` | Creates `quote_submission` status `pending` |
| GET | `/api/me/quotes/saved` | Lobby `/quotes`; filter `visibility`, `kind=movie\|tv` |
| PATCH | `/api/me/quotes/collection-visibility` | Bulk default for “make all public” opt-in |

### Profile (visitor-safe)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/profiles/:handle/quotes` | **Public saves only**; 404 private profile |

### Staff

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/quotes/submissions` | Query `status=pending` (default) |
| POST | `/api/quotes/submissions/:id/approve` | Creates `listing_quote`, links `resolvedQuoteId`, notifies |
| POST | `/api/quotes/submissions/:id/reject` | Body: optional `staffNote`, notifies |

Permissions: same staff gate as Journal panel (`staff` routes + permission matrix).

### Notifications

New kinds (migration + payload schema):

| Kind | Trigger | Deep link |
|------|---------|-----------|
| `quote.submission.approved` | Staff approve | Title detail **Quotes tab** (`/movies/:id?tab=quotes` or `/tv/:id?tab=quotes&season=&episode=`) |
| `quote.submission.rejected` | Staff reject | Notifications inbox; payload includes `staffNote` when set |

Reuse `notificationPayloadHref` pattern for title + tab deep links.

---

## UI / UX

### Title detail — top bar tabs

Extend `MovieDetailTopBar` from **About · Streaming** to:

**About · Community · Quotes · Streaming**

- **About** — current About body minus Community explore tabs (cast, awards, synopsis, etc.).
- **Community** — current Reviews + Lists (+ following ratings) explore surface.
- **Quotes** — new panel (see below).
- **Streaming** — unchanged.

Both panels stay mounted after first paint (same instant-switch pattern as About/Streaming). URL sync via `?tab=quotes`; TV quotes also sync `season` + `episode` query params.

### Quotes tab content

- **Movies:** list sorted by upvotes (default) or newest; chip toggle if needed later — MVP one sort.
- **TV:** leading **Season** + **Episode** selects (`StillPopoverSelect` / same capped scroll scrim as Quick Log); list scoped to selection.
- **Quote row:** body (editorial typography), speaker muted, timestamp `HH:MM:SS` when present, upvote count tabular-nums.
- **Actions:** Upvote (toggle), Save (bookmark — default private; first save opens optional visibility picker or Settings-style pills).
- **Empty state:** “No quotes yet” + **Suggest a quote** CTA.
- **Footer CTA:** **Suggest a quote** → sheet form (body required, speaker optional, timestamp optional, TV season/episode required on TV).

### Suggest-a-quote sheet

Fields:

- Quote text (required, max 500)
- Speaker (optional)
- Timestamp `HH:MM:SS` (optional)
- TV: season + episode selects (required)

Submit → toast “Submitted for review” → closes sheet. No optimistic catalog insert.

### `/quotes` lobby

- Route: `apps/web/src/app/(app)/quotes/page.tsx`
- `HomeStickyChrome` parity with diary/watchlist/lists.
- Grid or vertical list: poster thumb, title link, quote excerpt, timestamp, visibility chip (owner only).
- Filters: All · Movies · TV; sort Latest saved.
- Empty: prompt to browse titles and save from Quotes tab.

### Profile summary

- Strip under taste/showcase area: **Recent quotes** — up to **3** public saves for visitors; owner sees latest 3 regardless of visibility with visibility pills.
- **View all** → `/quotes` (owner) or public subset URL.
- Do **not** add a full profile tab in MVP unless strip feels too thin — ship strip first.

### Staff panel

- New **`StaffQuotesPanel`** on `/staff` (mirror `StaffJournalPanel` layout).
- Pending queue table: submitter, title, quote preview, timestamp, approve/reject.
- Reject: optional note textarea.
- Approve: one-click create catalog row.

### Motion (transitions-dev)

| Interaction | Transition |
|-------------|------------|
| Save toggle | **Icon swap** (`t-icon-swap`) bookmark outline ↔ filled |
| Upvote count change | **Number pop-in** (`t-number-pop-in`) on count only |
| Staff approve | Light **success check** (`t-success-check`) + toast |

All snippets include `prefers-reduced-motion` guards per transitions-dev skill.

---

## Error handling

| Case | Behavior |
|------|----------|
| Submit while rate-limited | 429 + friendly copy |
| Duplicate save | Idempotent 200 |
| Approve submission for deleted title | 400; staff sees TMDb cache miss hint |
| Import provider down | Job logs error; catalog serves patron/staff quotes only |
| Private profile | `GET /profiles/:handle/quotes` → 404 |
| TV quotes without season/episode | 400 on API; UI disables list until both selected |

---

## Testing

**Server (bun:test):**

- XOR movie/tv constraint on `listing_quote`
- Submit → approve creates catalog row + notification payload
- Submit → reject includes `staffNote` in notification
- Upvote toggle idempotency
- Save default visibility `private`
- Public profile quotes excludes private saves
- Import upsert dedup by `externalId`; no overwrite of patron/staff rows

**Web:**

- Timestamp formatting helper unit tests
- Quotes tab TV: changing season resets episode when invalid

**Manual QA:**

- Full flow: submit → staff approve → notification tap → Quotes tab
- `/quotes` lobby after save/remove
- Profile strip public vs owner view

---

## Instrumentation

Register `product_event` kinds (migration):

| Kind | When |
|------|------|
| `quote_upvote` | Toggle on |
| `quote_save` | First save |
| `quote_unsave` | Remove save |
| `quote_submit` | Patron submission created |
| `quote_submission_approved` | Staff approve (server) |
| `quote_submission_rejected` | Staff reject (server) |

---

## Rollout

1. **Wave 0** — migration + API catalog/upvote/save (read-only UI stub).
2. **Wave 1** — Quotes tab + submit + staff panel + notifications.
3. **Wave 2** — `/quotes` lobby + profile strip + import job behind env flag.
4. **Wave 3 (v1.1)** — showcase quote slot; OG quote card.

**Feature flag:** `QUOTE_IMPORT_ENABLED` env for import job only; UI ships with empty states when catalog sparse.

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| No licensed quote API with timestamps | Adapter abstraction; staff backfill; patron submit primary for gaps |
| Spam submissions | Rate limit + staff queue only |
| Detail tab proliferation | Keep four tabs max; Community extracted from About scroll |
| Profile perf | Strip capped at 3; `/quotes` paginated |

---

## References (codebase)

- Staff moderation pattern: `apps/web/src/components/staff/staff-journal-panel.tsx`
- Notifications deep link: `apps/web/src/lib/notification-href.ts`
- Detail top tabs: `apps/web/src/components/movie/movie-detail-top-bar.tsx`
- TV season/episode pickers: Quick Log / `tv-log-scope-picker.tsx`
- Visibility enum: migration `0016` `content_visibility`
- Review upvote pattern: `POST /api/reviews/:id/like`
