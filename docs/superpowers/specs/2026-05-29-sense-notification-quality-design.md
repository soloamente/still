# Sense — Notification quality filter (SN.9)

**Status:** Approved — implemented 2026-05-29 (SN.9 Executor)  
**Date:** 2026-05-29  
**Parent:** [`2026-05-29-sense-product-roadmap-design.md`](./2026-05-29-sense-product-roadmap-design.md) §1.8, [`sense-media-platform-strategy.md`](../../../sense-media-platform-strategy.md) Section 8  
**Track:** Tier 1 (launch-adjacent polish; ships before SN.10 List quality)

## Summary

Centralize **when** Sense creates inbox rows: a single server delivery helper, **type defaults** aligned with “fewer, high-signal,” and **Settings toggles** under `profile.preferences`. Add missing **comment** and **import** notifications; gate **review likes** behind an opt-in **mutual-follow** rule; stop noisy **`achievement.unlocked`** inbox rows (badges only). **@mentions** deferred to SN.9.1.

## Decisions (brainstorm lock-in)

| Topic | Decision |
|-------|----------|
| Scope | **C** — policy + Settings + new high-signal types |
| Achievements | **B** — inbox = `badge.awarded` (prestige-gated) only; no `achievement.unlocked` rows |
| Comments | **B** — notify review owner on any comment; notify `replyToId` target when set |
| Mentions | **Defer** — no `@handle` parse in SN.9 |
| Letterboxd import | **Dedicated** `import.completed` when `imported > 0`; suppress badge inbox row for that import run |
| Review likes | **Mutual** — default **off**; when enabled, notify only if liker ↔ author mutually follow |

## Approaches considered

### 1. Ad-hoc gates at each `insert(notification)` (status quo extended)

Each route checks prefs inline. **Rejected:** drift, duplicate logic, easy to miss a call site.

### 2. Central delivery helper + kind registry (recommended)

`shouldDeliverNotification(userId, kind, context)` + `deliverNotification({...})` reads merged prefs (per-kind override + global mute). All producers call one module. **Chosen.**

### 3. Outbox / queue worker

Enqueue notification intents; worker applies policy. **Deferred:** no scale need; adds latency and ops surface for pre-launch.

## Architecture

### Server module (`apps/server/src/lib/notification-delivery.ts`)

Responsibilities:

1. **Kind registry** — `NotificationKind` union, human labels for Settings, `defaultEnabled: boolean`, optional `requiresOptIn: boolean` (likes).
2. **Preference read** — `readNotificationPrefs(profile.preferences)` → `Record<kind, boolean>` with defaults from registry.
3. **Policy** — `shouldDeliver(userId, kind, ctx?)` — false when kind disabled; for `review.liked`, also require `ctx.isMutual === true`.
4. **Deliver** — if allowed, `db.insert(notification)` with stable `id: makeId("ntf")`; no-op otherwise (no error to caller).

**Context object** (`NotificationDeliveryContext`) examples:

- `review.liked`: `{ reviewAuthorId, likerId, reviewId }` → server loads mutual follow bit once.
- `comment.*`: `{ recipientUserId, ... }` — caller computes recipients; policy only checks prefs + “don’t notify self.”

### Preference storage

Nested under existing JSON:

```ts
preferences.notifications = {
  "follow.created": true,
  "comment.on_review": true,
  "comment.replied": true,
  "badge.awarded": true,
  "import.completed": true,
  "taste.challenge": true,
  "challenge.completed": true,
  "review.liked": false,  // opt-in default
  "chat.message": true,
  "tv.new_episode": true,
}
```

- **PATCH** `/api/profiles/me` (existing shallow merge) — web sends only changed keys.
- Shared constants in `apps/web/src/lib/notification-preferences.ts` (mirror server).

### Notification kinds (SN.9)

| Kind | Default | Producer change |
|------|---------|-----------------|
| `follow.created` | on | `follows.ts` → delivery helper |
| `comment.on_review` | on | **new** — `comments.ts` when `parentType === "review"` |
| `comment.replied` | on | **new** — `comments.ts` when `replyToId` set |
| `badge.awarded` | on | `badge-evaluator.ts` → helper |
| `import.completed` | on | **new** — `import.ts` after successful import |
| `taste.challenge` | on | `taste.ts` → helper |
| `challenge.completed` | on | `completionist-challenge-sync.ts` → helper |
| `chat.message` | on | `chat.ts` → helper |
| `tv.new_episode` | on | `tv-new-episode-sync.ts` → helper |
| `review.liked` | **off** | **new** — `reviews.ts` on like insert |
| `achievement.unlocked` | — | **remove** inserts |

**Deduping comments:** If review owner === reply target, send **one** row (`comment.replied` preferred copy: “replied to your comment on …”). If commenter is recipient, send nothing.

**Import + badge:** On Letterboxd import with `imported > 0`:

1. Insert `import.completed` (title/body with counts; `href: /profile/{handle}` or `/diary`).
2. Call `awardBadgeToUser(..., { suppressInbox: true })` or equivalent so `prestige_diaries_merged` still persists without `badge.awarded` row.

### Review like copy (when enabled + mutual)

- Kind: `review.liked`
- Title: `{displayName} liked your review`
- Payload: `fromUserId`, `reviewId`, `href` → review permalink (existing review route)
- Rate limit: reuse comment rate bucket or cap 1 notification per (reviewId, likerId) per 24h optional — **v1: no dedupe** beyond unlike removing future pings (only fires on insert)

### Navigation hints

Extend `withNavigationHints` in `notifications.ts` for:

- `comment.on_review` / `comment.replied` → review URL from `payload.reviewId`
- `import.completed` → profile or diary
- `review.liked` → review URL

### Web — Settings (`settings-form.tsx`)

New section **Notifications** (after Theme or before Import):

- One row per kind (label + short hint + switch).
- **Review likes** row copy: “Only when you follow each other” subtext.
- Load/save via existing profile PATCH; optimistic toast on save.

### Web — Comments (`comments-thread.tsx`)

- **Reply** control per row → sets composer state `replyToId` + placeholder “Reply to @handle…”
- Submit includes `replyToId` when set.
- Flat render unchanged (no tree required).

### Web — Inbox (`notifications-list.tsx`)

- Icons: `MessageCircle` for `comment.*`, `Heart` or `Bell` for `review.liked`, `Download` or `Bell` for `import.completed`.
- Remove dead `achievement.` icon path over time (legacy rows may still exist).

## Error handling

- Delivery helper **never throws** for policy skip (callers assume fire-and-forget).
- DB insert failures: log `[notification-delivery]` + `console.error`; do not fail parent HTTP request (comment post, like, follow still succeed).
- Invalid preference keys ignored; unknown kinds default to registry.

## Testing

| Area | Tests |
|------|--------|
| `notification-delivery.ts` | defaults, per-kind off, mutual like gate, self-skip |
| `comments` route | owner notified; reply target notified; dedupe; self-comment silent |
| `import` route | `import.completed` when imported > 0; no badge inbox when suppressed |
| `reviews` like | no row when pref off; no row when not mutual; row when mutual + on |
| Web prefs | parse/merge helpers (mirror catalog prefs pattern) |

## Out of scope (SN.9)

- `@mention` parsing and `comment.mentioned` kind (**SN.9.1**)
- Push/email delivery
- Inbox ranking algorithm (chronological stays)
- List/post comment notifications (parent types exist; only **review** in v1)
- Batching (“3 people liked your review”)

## Success criteria

1. New patron default inbox excludes generic likes and achievement spam.
2. Comment on a review notifies the author; reply notifies parent commenter (with dedupe).
3. Letterboxd import shows one clear **import completed** row; no double badge ping.
4. Settings toggles persist and immediately affect **new** notifications (existing rows unchanged).
5. All `insert(notification)` call sites route through delivery helper (grep audit).

## Implementation order (for planning skill)

1. Server: registry + prefs reader + delivery helper + tests  
2. Migrate call sites; remove `achievement.unlocked` inserts  
3. Comments notify + Reply UI  
4. Import completed + suppress badge inbox on import  
5. Review like + mutual check  
6. Settings UI + web pref helpers  
7. Inbox icons/hrefs + manual QA checklist  

## Spec self-review

- [x] No TBD placeholders  
- [x] Consistent with roadmap §1.8 and strategy “remove generic like noise”  
- [x] Achievements vs badges contradiction resolved (B)  
- [x] Import dedicated vs badge duplicate resolved  
- [x] Scope bounded (review comments only; mentions deferred)  

---

**Next step after approval:** invoke `writing-plans` → `docs/superpowers/plans/2026-05-29-sense-notification-quality-plan.md` (Executor: one scratchpad task at a time).
