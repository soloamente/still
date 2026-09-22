# Sense — Today on Sense (Home habit layer)

**Status:** Draft for human review (brainstorm locked 2026-09-23)  
**Date:** 2026-09-23  
**Topic:** Stateful Home “Today” module — pick, weekly pulse, one friend signal, instant watch + optional category ratings, minimal reciprocal recommend  
**Related:**  
- [`2026-05-29-sense-product-roadmap-design.md`](./2026-05-29-sense-product-roadmap-design.md)  
- [`2026-06-11-taste-for-you-algorithm-v2-design.md`](./2026-06-11-taste-for-you-algorithm-v2-design.md)  
- [`2026-07-01-home-taste-hero-consumed-exclusion-design.md`](./2026-07-01-home-taste-hero-consumed-exclusion-design.md)  
- [`2026-06-13-letterboxd-pillars-roadmap-design.md`](./2026-06-13-letterboxd-pillars-roadmap-design.md) (post-log ritual)

## Summary

**Today on Sense** is a calm, high-signal layer at the top of signed-in `/home`. It answers three questions without becoming an infinite social feed:

1. **What should I watch?** — one personalized **Today Pick** (reuse the existing taste-hero presentation).  
2. **What changed in my week?** — compact **Your week** card.  
3. **Who can I share with?** — one real **From your circle** card + **Recommend back**.

Title detail stays canonical for “is this the title for me?” with a quiet continuity cue. Discovery shelves (Popular, Latest, Upcoming, venue, Movies/TV/Community) remain **below** Today.

This is **slice 1** of a larger habit/social program. Watchlist decision engine, full friend-activity feeds, diary ritual polish beyond the week card, lists/quotes social depth, nav IA, and monetization moments are **out of scope** here.

## Locked decisions (brainstorm)

| Topic | Decision |
|-------|----------|
| Program scope | Slice 1 only — Today + minimal recommend + category ratings in watch-log |
| Architecture | **A + selective C** — `TodayOnSense` shell reuses taste-hero **presentation**; parallel Suspense streams; no blocking aggregate `GET /api/today` |
| Placement | Top of `/home` main content, under sticky chrome, **before** browse/watchlist/activity |
| Pick behavior | Shell owns **complete** / **Pick another**; no legacy auto-swap after watch |
| Supporting row | Exactly two cards: **Your week** · **From your circle** |
| Friend activity | One real event or honest invite empty — never fabricate |
| Watched from Home | Instant diary save + Undo; venue **unset** unless user chooses; optional overall then collapsed categories |
| Category ratings | Real optional dims in watch-log (Home + Quick Log); not on title hero; not in Today payload |
| Detail continuity | Small **Today’s pick** + same reason line; normal title actions only; Back restores Home scroll |
| Recommend back | Vaul bottom sheet; recipient preselected; ≤3 actions; measurable loop |
| Monetization / alerts / feeds | Deferred (no streaming-alert row, multi-item feed, or streak challenges in Today row) |

## Problem

Home helps patrons browse but does not create a strong daily habit. The taste hero discovers titles, yet completion silently rotates, there is no “since I logged” week pulse on Home, friend activity is buried in Community, and there is no reciprocal recommend loop. A noisy feed would fight Sense’s calm, poster-forward identity.

## Goals / non-goals

**Goals**
- One Home module that guides the next watch, weekly progress, and one social exchange.
- Instant watched → optional rate → explicit next pick.
- Minimal reciprocal recommend with privacy-safe notifications and instrumentation.
- Optional category ratings without slowing the core log.
- Preserve existing for-you scoring, diary, Quick Log, and detail shells.

**Non-goals (v1)**
- Infinite friend feed or multi-card social stack on Home.
- Streaming-availability / continue-TV / unfinished-list cards in the supporting row.
- Special Today-only action on movie detail (e.g. dedicated Recommend on hero).
- Rewriting Movies browse or nav IA.
- Paywalled Today core; upgrade prompts as banners.
- Fake or seeded “friend” activity in production.

## Journey split

| Surface | Question | Owns |
|---------|----------|------|
| **Today on Sense** (`/home`) | What should I do next? | Pick, week, circle, pick completion |
| **Movie / TV detail** | Is this the title for me? | Artwork, synopsis, runtime, scores, streaming, normal log/watchlist actions |
| **Movies browse shelves** | What else is out there? | Popular / Latest / Upcoming / venue — unchanged below Today |

Opening the pick must **not** complete or rotate it. Logging from detail marks Home pick **complete**; the patron must tap **Pick another** on Home.

## Architecture

### Composition

```text
TodayOnSense (shell)
├── Today Pick     ← taste-hero presentation (media, rationale, actions chrome)
├── Your week      ← compact card (independent Suspense)
└── From your circle ← compact card (independent Suspense)
```

Mobile stacks in that order. Supporting cards share roughly equal height.

### Ownership

| Concern | Owner |
|---------|--------|
| Pick presentation | Reused `HomeTasteMatchedHero` UI (or extracted presentational subtree) |
| Pick completion / Pick another / no silent rotate after watch | `TodayOnSense` shell |
| Week stats | Server data layer → RSC stream |
| Circle one-shot + invite empty | Server data layer → RSC stream |
| Instant log, undo, overall + category ratings | Existing watch-log / Quick Log (+ shared inline rating UI) |
| Recommend back sheet | Shared recommend mutation flow |

### Loading

- Three **independent** Suspense boundaries: pick · week · circle.
- Each has loading, empty, and error UI.
- RSC calls server libs directly for reads.
- HTTP APIs only for client mutations (log, undo, rate, categories, dismiss/not interested, pick-another, recommend).
- Circle latency must not block the pick (and vice versa).

### Relationship to legacy taste hero

- Reuse **visual** and for-you queue presentation.
- **Do not** reuse legacy auto-swap-after-consume as the completion policy for Today.
- After **Not interested**, preference is recorded and the shell may advance to the next candidate immediately (distinct from post-watch, which requires **Pick another**).
- After **watchlist** or **watched**, treat pick as **complete** until **Pick another**.

## Product UX

### Today Pick

- Cinematic band: backdrop/trailer when available, title logo, taste rationale (“Because you gravitate toward…”), poster rail for queue alternates.
- Actions when not logged: **Add to watchlist** · **Watched** · **Not interested**.
- Cold start / below taste threshold: honest empty; week and circle still render independently.

#### Watched from Home

1. Persist diary log **immediately** (watched date = today; **venue unset** unless later chosen; respect patron default visibility).
2. If already logged → action is **Log a rewatch** (new entry; do not mutate prior).
3. Keep title visible; show **Added to your diary** + brief **Undo** (deletes that just-created log).
4. Inline **How was it?** — overall 0–10 with **Save rating** / **Skip**; **Rate by category · Optional** collapsed beneath.
5. Refresh **Your week** live.
6. Enter **complete** state; show **Pick another** / **Get another pick** — do not auto-rotate.

#### Watchlist / Not interested

- Watchlist: existing add; pick becomes complete; **Pick another** to continue.
- Not interested: existing forever-dismiss; advance to next candidate per shell policy (immediate replacement allowed).

### Your week

- Copy example: “2 titles logged · 1 rated” plus quiet seven-day progress marks.
- Week window = patron timezone calendar week.
- Action: **Open diary** if any activity; **Log a title** if empty.
- Empty: “Your week starts with one log.”
- Calm tone only — no guilt for low volume.

### From your circle

- Exactly **one** recent visible event from followed patrons (prefer watched + rating + short review excerpt when available).
- Layout: avatar · name · poster · title · score · excerpt.
- Primary action: **Recommend back**.
- Empty / no follows / all events privacy-filtered: “Invite someone who knows what you’d love.” → Invite & earn. Never invent activity. Do not tease “1 hidden.”

### Movie detail continuity

- When opened from the active Today pick: small **Today’s pick** label + the **same** one-line reason as Home.
- Cue is session/navigation-scoped (query or short-lived client flag) — not a permanent “this title is forever a Today pick” DB flag required for v1.
- Reuse normal title actions only (watchlist, watched/rewatch, rating in watch-log). **No** Today-specific Recommend on detail.
- **Back** restores `/home` Today module and scroll position (lobby scroll-restore patterns).

### Recommend back

Bottom sheet (Vaul), not a page or chat. Recipient already selected.

1. **Pick a title** — “What should {name} watch next?” Three real suggestions from the sender’s highly rated titles and/or lists + **Search titles**. Show **Already watched** only if the recipient’s viewing activity is visible to the sender.
2. **Confirm** — Poster + title; optional reason when a real connection exists (“Because you liked…”); optional note (never required). Sensitive titles: confirm before send.
3. **Send to {name}** — Sheet closes; circle card confirms **Recommendation sent**.

**Recipient notification**
- Copy: “{sender} thinks you’d like {title}” (+ reason when present).
- Actions: **Add to watchlist** · **Recommend something back**.
- Sensitive: omit title/poster from notification **previews**; recipient still reaches the title under their own prefs via deep link.

### Category ratings (watch-log only)

**Surfaces:** Home post-watch **How was it?** and title-page Quick Log / post-log celebration. Not on the title hero. Not part of Today RSC payload.

**Dimensions (fixed, one at a time):** Plot · Characters · Writing · Acting · Visuals · Sound · Enjoyment.

- Same 0–10 slider as overall; progress “N of 7”; per-category **Skip**; **Done** anytime (partial OK).
- Skipped categories are omitted — never stored as zero.
- Suggested overall = mean of rated categories only.
  - If overall unset → offer suggestion (editable).
  - If overall set → preserve; allow explicit switch to suggestion.
- Closing/skipping categories never undoes the already-saved log.

## Data model

### Reuse
- Taste for-you scoring + dismiss (`taste_dismissed_movie`, existing exclude rules).
- `log` for diary entries (visibility, watchedAt, rating tenths).
- Follow graph + existing activity/review visibility for circle.
- Notification delivery + prefs registry.

### New / extend

**Category ratings on `log`**
- Structured map of optional category → tenths (0–100), same scale as overall `log.rating`.
- Only keys the patron rated; skipped keys absent.

**`title_recommendation` (name may match repo conventions)**
- `id`, `senderUserId`, `recipientUserId`
- Exactly one of `movieId` / `tvId`
- Optional `reasonCode` (e.g. same_mood, because_you_liked, hidden_gem, watch_together, you_would_love)
- Optional free-text `note` (short)
- `createdAt`
- Status / timestamps for funnel: sent → opened → accepted (watchlisted) → answered (recommend back)
- Privacy flags as needed for sensitive-send handling

No blocking `today` aggregate table required for v1. Pick completion may be client/session state keyed to the active spotlight id, reconciled with consumed events.

## Privacy

- Circle card respects follow relationships, content visibility, and adult/sensitive preferences for **both** actor and viewer.
- Recommend suggestions must not leak private lists or private diary titles into notifications or public surfaces.
- Sensitive send: warn sender; scrub preview artwork/title in notification chrome.
- Week card is the viewer’s own stats only.
- Never fabricate social proof.

## Instrumentation

| Event | When |
|-------|------|
| `today.viewed` | Today module impressed |
| `today.pick.viewed` | Pick impressed |
| `today.pick.action` | watched / watchlist / not_interested / pick_another / undo |
| `today.week.viewed` / `today.week.action` | Week card |
| `today.circle.viewed` / `today.circle.action` | recommend_back / invite |
| Existing log / rate events | Instant log, overall rating |
| `rating.category_saved` / `rating.category_skipped` / `rating.suggestion_applied` | Category flow |
| `recommendation.sent` / `opened` / `accepted` / `answered` | Reciprocal loop |

**Outcomes to watch:** first meaningful action per session; watch→rate rate; recommend response rate; 7-day return to Home with Today interaction.

## Quality requirements

Every new surface: loading, empty, error, responsive layout, keyboard access, SR labels, contrast, poster alt text, fast images, no layout shift, clear success/undo. Prefer existing design tokens and Vaul/sheet patterns — no second visual language.

## Testing

- Shell states: active → logged (+ undo) → complete → pick another; watchlist complete; not interested advance.
- Week pulse in patron TZ; empty copy; live update after log.
- Circle: one visible event; privacy filter → invite; sheet preselects recipient.
- Recommend: three suggestions; already-watched only when visible; sensitive warn + preview scrub; funnel events.
- Categories: skip ≠ zero; suggestion math; partial Done; log survives skip.
- Detail: cue only from Today deep link; Back restores scroll; logging does not auto-rotate Home pick.

## Success criteria

Patrons experience: *Sense helps me decide what to watch, remember this week, and share with someone I care about* — without an empty social feed, a generic catalogue wall, or a subscription gate on the core loop.

## Later slices (explicitly out of this spec)

2. Richer friend activity cards / event-type primary actions beyond one watched signal.  
3. Full recommend ranking polish (shared titles, list picks as dedicated slots).  
4. Watchlist decision engine (Watch tonight, Now available modes).  
5. Diary weekly pulse / Wrapped-adjacent ritual beyond the Home week card.  
6. Lists & quotes social value; notifications grouping; Community cold-start; nav IA; natural monetization moments; deeper privacy controls.

## Open implementation notes (non-blocking)

- Exact reason-code enum and suggestion ranking weights — plan-time details; UX above is locked.
- Whether diary edit surfaces show category ratings in the same milestone or immediately after — prefer same shared component when cheap; not a ship blocker for Home + Quick Log.
- TV as Today Pick — v1 may remain **movies-first** (matches current taste hero); TV continue-watching stays on `browse=tv` unless a follow-up extends for-you to TV.
