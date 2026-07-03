# Review spoiler preview masking (app-wide)

## Problem

Reviews tagged `containsSpoilers` are masked on movie/TV detail (carousel + reader sheet) but **preview copy leaks** on Community Activity and other feed-style surfaces that render `review.body` (and sometimes `review.title`) before opening the reader.

## Goal

Apply the same spoiler rules everywhere review preview copy appears outside the reader sheet.

## Masking rules

Reuse `shouldMaskReviewSpoilers` (`apps/web/src/lib/review-spoiler-mask.ts`):

- Mask when `containsSpoilers && !hasWatchedMovie && !isOwnReview && !revealed`
- **Own review** — never masked
- **Any diary log** for the film — unmasked (`useViewerHasWatchedMovie`)
- **Signed-out** — not watched → masked until tap-to-reveal
- Reveal is **per preview instance** (local state, not persisted)

## What is masked

The **preview content block**: review title, body, and voice attachment. Visible without masking: patron byline, listing title/poster, rating, likes/comments, navigation affordances.

## Surfaces in scope

| Surface | Component |
|--------|-----------|
| Community → Activity | `activity-item.tsx` |
| Community → Reviews | `review-card.tsx` |
| Viral reviews rail | `home-viral-reviews-rail.tsx` |
| Profile reviews tab | `profile-reviews-panel.tsx` |
| Pinned signature reviews | `profile-pinned-review-card.tsx` |
| Engagement drawer (Watched) | `movie-detail-engagement-drawer-rows.tsx` |
| Movie detail carousel | Already masked — keep behavior; optional dedupe later |

**Out of scope:** Reader sheet (guarded), members ledger (poster-only), friend rail snippets (no body).

## Architecture

**Approach A — shared client wrapper**

`ReviewSpoilerPreview` composes:

- `useViewerHasWatchedMovie(movieId)`
- Session check for `isOwnReview`
- Local `revealed` state
- Existing `ReviewSpoilerGuard` (blur + CTA tokens)

`ReviewSpoilerGuard` uses a **`div` with `role="button"`** (not `<button>`) so masked previews can live inside card-level buttons without invalid nesting.

## Data plumbing

Ensure `containsSpoilers` is typed and mapped on:

- Activity feed `ReviewPayload`
- `HomeCommunityReviewRow` / `mapCommunityReviewRow`
- Profile review normalizer (`fetch-profile-reviews-client.ts`)
- Listing engagement watch review (`listing-engagement-query.ts` + client types)

API already persists and returns `containsSpoilers` on review rows; feed activity returns full review objects.

## Interaction

- **Feed rows / cards:** tap blurred block → reveal inline; rest of card/“Read review” opens reader (reader re-applies guard).
- **Spoiler guard click** uses `stopPropagation` so parent card buttons do not fire on reveal.

## Testing

- Existing unit tests for `shouldMaskReviewSpoilers`
- Manual: spoiler review on Activity + Reviews + profile as non-watcher → blurred; after log or reveal → visible

## Non-goals (v1)

- Server-side body redaction in API responses
- TV review previews (movie-only reviews today on activity)
