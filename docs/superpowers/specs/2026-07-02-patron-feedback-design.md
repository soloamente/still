# Sense — Patron Feedback Design

**Status:** Approved (brainstorm 2026-07-02)  
**Date:** 2026-07-02  
**Approach:** **A — Dedicated feedback tables** (ticket + patron-visible replies + internal staff notes)  
**Track:** Staff tooling / patron support

## Summary

Signed-in patrons can send product feedback from the **account menu** — categorized as **Bug · Idea · Other** — via a **compose dialog**. They can review past submissions and staff replies in a **feedback drawer** (**My feedback**). Staff read and triage tickets on **`/staff`** in a new **Feedback** panel: **owner/admin/support** can view; **owner/admin** can change status, add **internal notes**, and **reply** to the patron. Replies trigger an in-app **`feedback.replied`** notification that deep-links into the thread drawer.

**North star:** A lightweight in-app feedback loop — patrons report issues and ideas without leaving Sense; the team triages from the existing staff panel without a third-party tool.

## Brainstorm decisions (locked)

| Topic | Decision |
|-------|----------|
| Categories | **Bug · Idea · Other** (picker on submit) |
| Entry point | Account menu — **Send feedback** row |
| Patron compose UI | **Dialog** (no route change) |
| Patron history UI | **Drawer** — list + thread detail |
| Staff workflow | Triage (status) + **internal notes** + **patron-visible reply** |
| Patron history | **My feedback** list + notification deep-links into thread |
| Staff view access | **Owner, admin, support** |
| Staff reply/status access | **Owner, admin only** |
| Patron follow-ups | **Out of scope v1** — one-shot submit; staff replies only |
| Attachments / screenshots | **Out of scope v1** |
| Email notifications | **Out of scope v1** — in-app only |

## Problem

The account menu previously exposed generic “Give feedback” / “Request feature” links; those were removed. There is no in-app channel for patrons to report bugs or suggest improvements, and no staff inbox on `/staff` to read them. Future **Devoted-tier** “direct feedback channel” (private Discord-style) is a separate, premium feature — this spec covers the **platform-wide MVP** available to all signed-in patrons.

## Goals

1. **Submit** — Low-friction feedback from anywhere in the app (account menu dialog).
2. **Triage** — Staff panel lists open tickets with category, submitter, and optional page context.
3. **Respond** — Owner/admin can reply; patron sees reply in drawer and gets a notification.
4. **Organize** — Status lifecycle (`open` → `resolved` / `dismissed`) and internal staff notes (never leaked to patron API).

## Non-goals (v1)

- Patron follow-up messages in an existing thread.
- File or screenshot attachments.
- Email or push notifications.
- Integration with Linear, Canny, or Discord.
- Pro/Devoted-only gating (all signed-in patrons may submit).
- Staff unread-count badge on `/staff` nav (optional polish; not required for v1).
- `product_event` instrumentation (may add in a follow-up if needed).

---

## Architecture

### Approach comparison (chosen: #A)

| # | Approach | Verdict |
|---|----------|---------|
| **A** | **Dedicated tables** (`patron_feedback`, `patron_feedback_reply`, `patron_feedback_staff_note`) | **Chosen** — safe internal notes, clear permissions, mirrors quote submission queue |
| B | Single `message` table with `kind` enum | Rejected — easy to leak `staff_note` rows if a filter is missed |
| C | Forward to external tool (Linear/Canny) | Rejected — does not satisfy “see on `/staff`” requirement |

### Data model

#### `patron_feedback` (ticket)

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | `fb_` prefix via `makeId` |
| `userId` | text FK → `user.id` | Submitter; `onDelete: cascade` |
| `category` | enum | `bug` \| `idea` \| `other` |
| `body` | text | Initial message; min 10, max 2000 chars |
| `pageUrl` | text nullable | Path + query captured at submit (e.g. `/movies/550?view=quotes`) |
| `status` | enum | `open` \| `resolved` \| `dismissed`; default `open` |
| `lastStaffReplyAt` | timestamp nullable | Set when staff posts a patron-visible reply |
| `patronLastReadAt` | timestamp nullable | Updated when patron opens thread |
| `resolvedAt` | timestamp nullable | Set on resolve/dismiss |
| `resolvedByUserId` | text FK nullable | Staff actor |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

Indexes: `(userId, createdAt DESC)`, `(status, createdAt DESC)`.

#### `patron_feedback_reply` (patron-visible)

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `feedbackId` | text FK → `patron_feedback.id` | `onDelete: cascade` |
| `authorId` | text FK → `user.id` | Staff member |
| `body` | text | Max 2000 chars |
| `createdAt` | timestamp | |

Index: `(feedbackId, createdAt ASC)`.

#### `patron_feedback_staff_note` (internal only)

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `feedbackId` | text FK → `patron_feedback.id` | `onDelete: cascade` |
| `authorId` | text FK → `user.id` | Staff member |
| `body` | text | Max 2000 chars |
| `createdAt` | timestamp | |

Index: `(feedbackId, createdAt ASC)`.

**Migration:** Register in `packages/db/src/migrations/meta/_journal.json` before `bun run db:migrate`.

---

## Permissions

Extend better-auth `statement` with:

```ts
feedback: ["read", "reply"]
```

| Role | `feedback:read` | `feedback:reply` |
|------|-----------------|------------------|
| owner | ✓ | ✓ |
| admin | ✓ | ✓ |
| support | ✓ | — |
| moderator | — | — |
| user | — | — |

- **`feedback:read`** — `GET /api/staff/feedback` and `GET /api/staff/feedback/:id` (includes staff notes).
- **`feedback:reply`** — `POST` reply, `POST` note, `PATCH` status.

Patron routes require a signed-in session only; patrons may only read their own tickets.

---

## API

### Patron (`/api/feedback`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/` | Create ticket. Body: `{ category, body, pageUrl? }`. Rate limit **10 / 24h / user**. |
| `GET` | `/` | List caller's tickets (newest first). Excludes staff notes. |
| `GET` | `/:id` | Ticket + `replies[]`. 404 if not owner. No staff notes. |
| `PATCH` | `/:id/read` | Set `patronLastReadAt = now()`. 404 if not owner. |

Validation:
- `category` required enum.
- `body` trimmed, length 10–2000.
- `pageUrl` optional; if present, must start with `/` and max 500 chars (reject absolute URLs).

### Staff (`/api/staff/feedback`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/` | `feedback:read` | List tickets. Query: `status?`, `category?`, `limit?` (default 50). |
| `GET` | `/:id` | `feedback:read` | Full detail: ticket, `replies[]`, `staffNotes[]`, submitter profile snippet. |
| `POST` | `/:id/reply` | `feedback:reply` | Body: `{ body }`. Creates reply, updates `lastStaffReplyAt`, sends notification. |
| `POST` | `/:id/notes` | `feedback:reply` | Body: `{ body }`. Appends internal note only. |
| `PATCH` | `/:id/status` | `feedback:reply` | Body: `{ status: "open" \| "resolved" \| "dismissed" }`. Sets `resolvedAt` / `resolvedByUserId` when leaving `open`. **No patron notification** on status-only change. |

---

## Notifications

### Kind: `feedback.replied`

Register in `NOTIFICATION_KIND_REGISTRY`:

| Field | Value |
|-------|-------|
| `id` | `feedback.replied` |
| `label` | Feedback replies |
| `description` | When the Sense team replies to feedback you sent. |
| `defaultEnabled` | `true` |
| `requiresOptIn` | `false` |

On staff `POST /api/staff/feedback/:id/reply`:

- Insert `notification` for submitter `userId`.
- `title`: `Sense replied to your feedback`
- `body`: first ~120 chars of reply (ellipsis if truncated)
- `payload`: `{ feedbackId, href: "/home?feedback=<id>" }`
- Publish realtime inbox event (existing `publishRealtimeEvent` pattern).

### Deep link

Extend `notificationPayloadHref` (web) to recognize `payload.feedbackId` or `href` with `?feedback=<id>`.

`FeedbackDrawerProvider` in `(app)/layout.tsx`:

- On mount and on `searchParams` change, if `feedback=<id>` present → open drawer to thread view for that id → strip query param via `router.replace` (preserve other params).
- Same provider handles **My feedback** menu open (list view, no query param).

---

## Patron UI

### Account menu (`app-user-account-menu.tsx`)

Add two rows in the Settings group (above Staff when visible):

1. **Send feedback** — opens `FeedbackComposeDialog`.
2. **My feedback** — opens `FeedbackDrawer` in list mode.

Use existing menu item classes (`accountMenuItemOnBackgroundClassName`). Icon: Lucide `MessageSquare` or Nucleo equivalent at `size-5`.

Mirror rows in `mobile-you-sheet.tsx` for parity.

### `FeedbackComposeDialog`

- Modal overlay: `APP_MODAL_OVERLAY_CLASS` (`z-[250]`).
- Category: `SegmentedPillToolbar` — **Bug · Idea · Other**.
- Textarea: required, `minLength` 10, `maxLength` 2000, placeholder varies by category (optional copy tweak).
- Silent `pageUrl` capture from `usePathname()` + `useSearchParams()`.
- Small muted line: `From: /movies/550` when URL present.
- Submit → `POST /api/feedback` → success message → close.
- Button disabled while pending; toast on error only.

### `FeedbackDrawer` (`DetailVaulSheet`)

**List mode**
- Header: “My feedback”
- Rows: category chip, status badge (`open` / `resolved` / `dismissed`), body preview (2 lines), relative time.
- Unread dot when `lastStaffReplyAt > patronLastReadAt` (or `patronLastReadAt` is null and replies exist).
- Empty state: “No feedback yet” + CTA to open compose dialog.

**Thread mode** (back chevron to list)
- Category + status header.
- Initial message (patron) with timestamp.
- Staff replies with staff display name (not email).
- `pageUrl` as link when present (“Submitted from …”).
- On open: `PATCH /api/feedback/:id/read`.

---

## Staff UI

### `StaffFeedbackPanel` on `/staff/page.tsx`

Placed after `StaffQuotesPanel`, before `StaffAuditTab`.

**Toolbar**
- Status filter: `SegmentedPillToolbar` — **Open · Resolved · Dismissed · All** (default Open).
- Category filter: **All · Bug · Idea · Other**.

**List rows**
- Category chip, status, body excerpt (~120 chars), `@handle` + display name, `createdAt`, optional `pageUrl` link.

**Expanded detail** (accordion or inline expand — match `StaffQuotesPanel` pattern)
- Full body, submitter link to `/profile/[handle]`, page URL.
- **Replies** thread (patron-visible history).
- **Staff notes** list (amber/muted “Internal” label).
- If `feedback:reply`:
  - Reply textarea + **Send reply** button.
  - Note textarea + **Add note** button.
  - Status buttons: **Resolve**, **Dismiss**, **Reopen** (when not open).
- If read-only (support): detail without action forms.

---

## Rate limiting

| Endpoint | Limit |
|----------|-------|
| `POST /api/feedback` | 10 creates per user per 24h |

Use existing `hit()` from `apps/server/src/lib/rate-limit.ts`. Return `429` with clear message.

---

## Error handling

| Case | Behavior |
|------|----------|
| Unsigned patron | Menu rows hidden or compose returns 401 |
| Patron reads another user's ticket | 404 (do not leak existence) |
| Support attempts reply | 403 |
| Rate limited | 429 + toast |
| Empty body / too short | 400 validation error |
| Staff reply on dismissed ticket | Allowed (reopen not required); status unchanged unless staff acts |

---

## Testing

### Server (`apps/server`)

- `patron-feedback.test.ts`: create, list own, 404 cross-user, rate limit, reply creates notification, staff notes excluded from patron GET, permission matrix (support read-only, moderator 403).
- Register route tests after any `mock.module` ordering constraints.

### Web (`apps/web`)

- `notification-href.test.ts`: `feedbackId` / `?feedback=` resolves.
- Optional: shallow render test for unread dot logic.

---

## File map (implementation reference)

| Area | Files |
|------|-------|
| DB schema | `packages/db/src/schema/feedback.ts`, export from schema index |
| Migration | `packages/db/src/migrations/00XX_patron_feedback.sql` |
| Auth | `packages/auth/src/permissions.ts`, `permission-summary.ts` |
| Server lib | `apps/server/src/lib/patron-feedback.ts` |
| Server routes | `apps/server/src/routes/feedback.ts`, extend `staff.ts` or `staff-feedback.ts` |
| Notifications | `apps/server/src/lib/notification-delivery.ts` |
| Web lib | `apps/web/src/lib/notification-href.ts`, `apps/web/src/lib/feedback-events.ts` (optional) |
| Web components | `feedback-compose-dialog.tsx`, `feedback-drawer.tsx`, `feedback-drawer-provider.tsx` |
| Staff | `staff-feedback-panel.tsx` |
| Shell | `app-user-account-menu.tsx`, `mobile-you-sheet.tsx`, `(app)/layout.tsx` |

---

## Relationship to future Devoted feature

The plan catalogue lists **“Direct feedback channel to team”** (Devoted tier) as a separate, Discord-like premium channel. This MVP:

- Does **not** gate submission on subscription tier.
- Does **not** block a future Devoted-only channel — that can add priority routing, faster SLA, or a separate inbox later.
- Uses distinct notification kind and UI copy (“Sense replied to your feedback”) suitable for all patrons.

---

## Success criteria

1. Signed-in patron can submit categorized feedback from account menu in &lt; 30 seconds.
2. Owner/admin sees new ticket on `/staff` within one refresh.
3. Staff reply appears in patron drawer and triggers inbox notification.
4. Support can read tickets but receives 403 on reply/note/status endpoints.
5. Patron API never returns `patron_feedback_staff_note` rows.
