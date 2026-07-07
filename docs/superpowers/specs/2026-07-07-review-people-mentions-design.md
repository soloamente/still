# Review & comment mentions — films (#), cast/crew & patrons (@)

**Status:** Approved (brainstorm 2026-07-07; human **go**)  
**Date:** 2026-07-07  
**Scope:** Inline mentions in review bodies and review comments — `#` for films/TV, `@` for TMDb people and Sense patrons; patron inbox notifications (SN.9.1)  
**Out of scope (v1):** List/post/log comments; notifying cast/crew (non-users); push/email delivery; TV reviews (reviews remain movie-only; `listingContext` is extensible)

## Summary

Reviews already support inline film/TV tags via `@` → stored as `@[Title](/movies|tv/id)` markdown links with a composer typeahead and reader rendering (`ReviewListingMentionTextarea`, `ReviewBodyWithMentions`). Comments use plain text with no mention support.

This spec **splits triggers**, adds **cast/crew and patron mentions**, extends the same UX to **review comments**, and ships **patron @ notifications** deferred from SN.9.

## Confirmed decisions (human)

| Topic | Decision |
|--------|----------|
| Film/TV trigger | **`#`** — migrate legacy `@` listing tokens on edit save |
| People trigger | **`@`** — TMDb cast/crew and Sense patrons |
| `@` default | Cast/crew; **auto-detect patrons** from handle-like typing (no tabs) |
| Cast context | **Title-first** — when review/comment is on a film, show that title's cast/crew before global people search |
| Patron `@` notify | **Yes** — inbox row + deep link to review/comment |
| Surfaces | Review composer **and** review comment compose + edit |
| Architecture | **Unified mention layer** (extend existing listing-mentions module + shared textarea) |

## Problem

1. Patrons cannot tag directors, actors, or collaborators inline in review prose — only films/TV.
2. Comments cannot reference titles or people with tappable links.
3. `@` is overloaded (films today; patrons in social apps) — splitting `#` / `@` clarifies intent.
4. SN.9.1 patron `@mention` notifications were deferred; product now ready to ship.

## Goals

| Interaction | Target behaviour |
|-------------|------------------|
| Type `#` in review or comment | Film/TV typeahead (same UX as today's `@` picker); inserts `#[Title](/movies\|tv/id)` |
| Type `@` with listing context | Title cast/crew rail first; typing filters rail then widens to `GET /api/people/search` |
| Type `@handle`-like text | Profile search via `GET /api/profiles/search`; inserts `@[Display Name](/profile/handle)` |
| Read any mention surface | Name + outbound arrow link; no visible `#` or `@` prefix |
| Legacy reviews | Old `@[Title](/movies\|tv/id)` still renders; rewritten to `#` on PATCH save |
| Patron tagged in body or comment | Inbox notification when pref enabled; deep link opens review reader (+ comment anchor when applicable) |

## Non-goals (v1)

- `@` or `#` in list comments, post comments, or diary notes
- Notifying TMDb people (not Sense accounts)
- Rich embed cards for mentions (inline link only, matching current film tags)
- Server-side body normalization on every POST (client stores tokens; server parses for notifications only)
- Full-text search or mention index table

## Token grammar

All tokens are lightweight markdown links embedded in `review.body` and `comment.body`.

| Kind | Trigger | Stored token | Route |
|------|---------|--------------|-------|
| Film/TV (new) | `#` | `#[Dune: Part Two](/movies/9664)` | `/movies/:tmdbId` or `/tv/:tmdbId` |
| Film/TV (legacy) | `@` (read-only) | `@[Dune: Part Two](/movies/9664)` | same — parser accepts both |
| Cast/crew | `@` | `@[Timothée Chalamet](/people/1190663)` | `/people/:tmdbPersonId` |
| Patron | `@` | `@[Jane Doe](/profile/jane_doe)` | `/profile/:handle` |

**Label rules:** Strip `[` `]` from display names before storage (same as listing mentions today).

**Disambiguation at parse time:** Path segment determines kind — `/movies/`, `/tv/`, `/people/`, `/profile/` — not the trigger character. Legacy `@` + `/movies|tv/` paths remain listing mentions.

## Migration (no DB migration)

1. **Read path:** Parser accepts both `@[Title](/movies|tv/id)` and `#[Title](/movies|tv/id)`.
2. **Write path (PATCH):** When review or comment body is saved, rewrite legacy listing tokens from `@` → `#`.
3. **Never-edited rows:** Continue rendering via dual parser indefinitely.

## Architecture

### Module layout (web)

Rename / extend `apps/web/src/lib/review-listing-mentions.ts` → **`content-mentions.ts`** (keep re-exports from old path during transition if needed):

| Export | Responsibility |
|--------|----------------|
| `parseBodyWithMentions(body)` | Returns discriminated parts: `text` \| `listing` \| `person` \| `patron` |
| `formatListingMention`, `formatPersonMention`, `formatPatronMention` | Serialize picker selections |
| `getActiveListingMentionQuery(body, cursor)` | `#` trigger detection |
| `getActivePeopleMentionQuery(body, cursor)` | `@` trigger detection |
| `insertListingMention`, `insertPersonMention`, `insertPatronMention` | Textarea insertion helpers |
| `isPatronMentionQuery(query)` | Handle-like heuristic for profile vs people search |
| `migrateLegacyListingMentions(body)` | `@` listing → `#` listing rewrite on save |

Rename **`ReviewListingMentionTextarea`** → **`MentionTextarea`**:

```ts
type MentionTextareaProps = {
  id: string;
  value: string;
  onChange: (next: string) => void;
  listingContext?: { kind: "movie" | "tv"; tmdbId: number } | null;
  placeholder?: string;
  // …existing textarea props
};
```

Rename / extend **`ReviewBodyWithMentions`** → **`BodyWithMentions`** (export alias `ReviewBodyWithMentions` for call-site stability).

### Hooks

| Hook | API |
|------|-----|
| `useListingMentionSearch` | Unchanged — `#` picker |
| `usePeopleMentionSearch` | `{ query, listingContext }` → title credits filtered + `fetchPeopleSearch` |
| `usePatronMentionSearch` | Wraps `fetchProfilesSearch` (existing ⌘K people fetch) |

**Title credits source:** Prefer credits already on movie detail payload when composer/drawer is open; fallback `GET /api/movies/:id` credits slice (cached server-side). Cap contextual rail at **12** rows before search widens.

**Patron query heuristic:** After trimming a leading `@`, if query matches `/^[a-z0-9_]{1,30}$/i` with no spaces → patron search; else people search with title context.

### Surfaces to wire

| Surface | Composer | Renderer |
|---------|----------|----------|
| `review-composer.tsx` | `MentionTextarea` + `listingContext` from `movieId` | n/a |
| `comments-thread.tsx` (compose + edit) | `MentionTextarea` + `listingContext` from parent review | `BodyWithMentions` on comment body |
| `review-detail-sheet.tsx` | Pass `listingContext` into `CommentsThread` | Already uses mention renderer for review body |
| `review-card.tsx`, carousel, `ActivityItem` | n/a | `BodyWithMentions` |

**Placeholder copy:** `"Use # for films and @ for people"` on review body and comment fields.

### Picker UX

- Reuse existing caret-anchored popover, scroll fades, keyboard ↑↓ Enter Esc, `ListingMentionPickerRow` pattern.
- Add **`PersonMentionPickerRow`** (headshot, name, department · known-for via `castCrewMetaLine`).
- Add **`PatronMentionPickerRow`** (portrait via `PatronPortraitAvatar`, display name, `@handle`).
- Only one picker open at a time (`#` and `@` triggers are mutually exclusive by character).

## Notifications (SN.9.1)

### New kind

Add to `NOTIFICATION_KIND_REGISTRY`:

| id | label | default |
|----|-------|---------|
| `mention.in_review_or_comment` | Mentions | **on** |

Settings UI: one toggle in existing Notifications section (same pattern as `comment.on_review`).

### Delivery

New helper **`extractPatronMentionsFromBody(body): string[]`** — unique handles from `/profile/:handle` tokens.

Call after successful:

- `POST /api/reviews`, `PATCH /api/reviews/:id`
- `POST /api/comments`, `PATCH /api/comments/:id` (review parent only in v1)

For each handle:

1. Resolve `profile` by handle; skip if missing, private, or same as actor.
2. `deliverNotification({ kind: "mention.in_review_or_comment", userId, payload, actorUserId })`.
3. **Dedupe:** max one notification per `(mentionedUserId, reviewId, actorUserId)` per **24 hours** (edits do not spam).

**Payload:**

```ts
{
  reviewId: string;
  commentId?: string;
  movieId: number;
  listingTitle?: string;
  actorHandle?: string;
  href: string; // movieReviewNotificationHref + optional &comment=
}
```

**Deep link:** Reuse `movieReviewNotificationHref(movieId, reviewId)`; append `&comment=:commentId` when mention is in a comment (reader scrolls to comment — add anchor support if not present).

Inbox copy (example): **"@actor mentioned you in a review of Dune: Part Two"** or **"… in a comment on …"**.

## Server changes

| File | Change |
|------|--------|
| `notification-delivery.ts` | Register `mention.in_review_or_comment` |
| `lib/content-mention-notify.ts` (new) | Parse body, resolve handles, dedupe, deliver |
| `routes/reviews.ts` | Hook notify after create/update |
| `routes/comments.ts` | Hook notify after create/update on review comments |
| Web notification prefs + inbox row icon/href | New kind |

No schema migration.

## Error handling

| Case | Behaviour |
|------|-----------|
| Unknown handle at write time | Token still stored; no notification |
| Private profile mentioned | Token renders for author; notification skipped |
| Self-mention | No notification |
| People search empty | Picker shows empty state; no insert |
| Credits fetch fails | Fall back to global people search only |

## Testing

| Area | Tests |
|------|-------|
| `content-mentions.ts` | Parse all token kinds; legacy `@` listings; migration rewrite; insert helpers |
| `isPatronMentionQuery` | Handle vs name boundary cases |
| `content-mention-notify.ts` | Extract handles, dedupe, self-skip, private skip |
| `notification-delivery.ts` | New kind default on; pref off skips |
| `comments.test.ts` / reviews | Notify hook invoked on body with patron token |

## Implementation order (for planning skill)

1. **`content-mentions.ts`** — parser, formatters, migration, unit tests  
2. **`BodyWithMentions`** — render all kinds; swap call sites  
3. **`MentionTextarea`** — `#` picker (migrate from `@` listing trigger)  
4. **`@` picker** — title credits + people + patron search hooks  
5. **Review composer** — wire `MentionTextarea`  
6. **Comments thread** — compose + edit + render + `listingContext` prop  
7. **Server notify** — kind registry, extract helper, review/comment hooks, tests  
8. **Settings + inbox** — toggle label, icon, href  
9. Manual QA checklist  

## Success criteria

1. `#Dune` in a review inserts a tappable film tag; legacy `@Dune` films still render.
2. `@Tim` on a Dune review surfaces cast from Dune before global results.
3. `@jane_doe` in a comment inserts a patron link and sends one inbox notification.
4. Comment edit rewrites legacy film `@` tokens to `#`.
5. Mention toggle off in Settings suppresses new mention notifications.
6. All existing `review-listing-mentions.test.ts` behaviours preserved or migrated.

## Spec self-review

- [x] No TBD placeholders  
- [x] Token grammar consistent with path-based disambiguation (legacy `@` listings safe)  
- [x] Scope bounded to review + review comments; TV reviews noted as future  
- [x] Notification dedupe and self-skip explicit  
- [x] Reuses existing APIs (`/api/people/search`, `/api/profiles/search`, movie credits cache)  
- [x] Single implementation plan scope — no decomposition needed  

---

**Next step after human spec review:** invoke `writing-plans` → `docs/superpowers/plans/2026-07-07-review-people-mentions-plan.md`.
