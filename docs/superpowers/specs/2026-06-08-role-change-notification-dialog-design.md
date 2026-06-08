# Role-Change Notification Dialog — Design

**Date:** 2026-06-08
**Status:** Approved (brainstorming) — ready for implementation plan
**Builds on:** `2026-06-07-staff-roles-permissions-design.md` (staff roles & the `/api/staff/users/:id/role` endpoint).

## Goal

When an owner changes a user's role, notify that user with a modal dialog the next
time they open the app. Promotions show a celebratory dialog; demotions show an
informational one. In place of an avatar, the dialog shows a **pill with the user's new
role**. The change also lands in the notifications inbox.

## Decisions (from brainstorming)

- **Scope:** every rank change shows a dialog — promotions (celebratory tone) and
  demotions, including demotion to `user` (informational tone). Direction is derived by
  comparing rank; equal rank is a no-op.
- **Timing:** next app load (no real-time/WebSocket). A role-change notification is
  created server-side; a web host detects the latest unread one and shows the dialog.
- **Inbox:** the role change also appears as an inbox item (with a dedicated icon). The
  notification's `readAt` is the single "seen" flag — dismissing the dialog marks it read.
- **Delivery:** role-change notifications are always delivered (an account-level event),
  bypassing the user-toggleable notification-preferences gate.
- **Modal coexistence:** the role-change dialog and the What's-New dialog are independent
  (no explicit priority). Role changes are rare enough that overlap is acceptable.

## Architecture Overview

```
owner sets role ──▶ /api/staff/users/:id/role (existing)
                      │ after setRole + audit:
                      ▼
                  notifyRoleChanged(userId, previousRole, newRole)
                      │ rank compare → promoted | demoted | (no-op)
                      ▼
                  insert notification(kind="staff.role_changed",
                      payload={ newRole, previousRole, direction })

web app load ──▶ RoleChangeDialogRoot (in app-shell)
                  │ GET /api/notifications/role-change → latest unread or null
                  ▼
                  RoleChangeDialog (open) ── dismiss ──▶ POST /api/notifications/:id/read
```

## Server

### a) `notifyRoleChanged` helper (`apps/server/src/lib/notification-delivery.ts`)

```
notifyRoleChanged({ userId, previousRole, newRole }): Promise<void>
```

- Compute direction with the existing `rankOf` from `apps/server/src/lib/staff-rank.ts`:
  `rankOf(newRole) > rankOf(previousRole)` → `"promoted"`; `<` → `"demoted"`; equal →
  return without inserting (no-op).
- Insert a `notification` row **directly** (not via `deliverNotification`, so it bypasses
  the preference gate and is always delivered). Fields:
  - `kind`: `"staff.role_changed"`
  - `title` / `body`: by direction (server provides human-readable text so the inbox row
    is meaningful without extra client lookups; see Copy).
  - `payload`: `{ newRole, previousRole, direction }`
- Never throws to the caller (mirror `deliverNotification`'s try/catch + console.error),
  so a notification failure can't break the role change.

### b) Hook into the role endpoint (`apps/server/src/routes/staff.ts`)

In `POST /users/:id/role`, after the existing `auth.api.setRole` + `writeAuditLog`, call
`await notifyRoleChanged({ userId: params.id, previousRole: target.role, newRole: body.role })`.
`target.role` (the prior role) is already loaded in the handler.

### c) Endpoint: latest unread role change (`apps/server/src/routes/notifications.ts`)

`GET /api/notifications/role-change` (uses the shared `context`, requires sign-in):
- Query the newest `notification` for the current user where `kind = "staff.role_changed"`
  and `readAt IS NULL`, ordered by `createdAt desc`, limit 1.
- Return `{ notification: { id, payload, title, body, createdAt } }` or `{ notification: null }`.
- Dismissal reuses the existing `POST /api/notifications/:id/read`.

## Web

### a) `RoleChangeDialog` (`apps/web/src/components/staff/role-change-dialog.tsx`)

Presentational modal, props `{ open, direction, newRole, previousRole, onDismiss }`. No
network calls (independently testable).

- Follows `apps/web/src/components/app/whats-new-dialog.tsx` visual pattern: `createPortal`
  to `document.body`, `APP_MODAL_OVERLAY_CLASS` backdrop, `rounded-[2rem] bg-card` panel,
  `motion`/`useReducedMotion` entrance, close on Esc / backdrop click / X button,
  `role="dialog"` + `aria-modal` + labelled/described ids, body-scroll lock while open.
- In place of the avatar: a **role pill** (`RoleBadgePill`) centered at the top showing the
  new role label, tinted by tier.
- Tone switches on `direction`.

### b) `RoleChangeDialogRoot` (`apps/web/src/components/staff/role-change-dialog-root.tsx`)

Client host mounted in `apps/web/src/components/app/app-shell.tsx` next to
`<WhatsNewDialogRoot userId={user.id} />`.

- On mount: `GET /api/notifications/role-change` via the `api` client. If a row is
  returned, read `payload.direction` / `payload.newRole` / `payload.previousRole` and open
  the dialog (a small open-delay mirrors the What's-New root).
- On dismiss: `POST /api/notifications/:id/read` with the returned id, then close. Failures
  are non-fatal (the dialog still closes; it may reappear next load).
- Renders `null` when there's nothing to show.

### c) Role labels & pill (`apps/web/src/lib/staff-role-labels.ts` + the pill component)

- Local label map (apps/web can't import `@still/auth`): `owner→"Owner"`, `admin→"Admin"`,
  `moderator→"Moderator"`, `support→"Support"`, `user→"Member"`.
- `RoleBadgePill`: rounded pill (`rounded-full`, `font-medium`, `bg-background` base)
  showing the label, tinted by tier (owner/admin stronger; support/member neutral).
  Reused inside the dialog; kept small and self-contained.

### d) Inbox rendering (`apps/web/src/components/notifications/notifications-list.tsx`,
and `notifications-dropdown-panel.tsx` if it has its own icon map)

- Add a `staff.role_changed` case to `iconForKind` (lucide `ShieldCheck` or `UserCog`).
- Href: none for demotions; for promotions to a staff role → `/staff`. Handled in
  `notification-href.ts` (`notificationPayloadHref`) and/or `withNavigationHints` in the
  notifications route. `title`/`body` come from the server row, so the inbox item is
  readable with no extra payload.

## Copy

Role label in the pill comes from the label map. `{role}` below = the new role's article +
label (e.g. "a Moderator", "an Admin", "the Owner").

- **Promotion (to a staff role):**
  - Title: **"It's official!"**
  - Headline: **"You're now {role}"** (pill shows the role)
  - Subtext: "You've got new staff permissions on Still."
  - Primary CTA: **"Got it"** (dismiss) · Secondary: **"Open staff panel"** → `/staff`
- **Demotion to a lower staff role:**
  - Title: **"Your role has changed"**
  - Headline: **"You're now {role}"** (pill)
  - Subtext: "Some staff tools are no longer available to you."
  - Primary CTA: **"Got it"**
- **Demotion to `user` (staff removed):**
  - Title: **"Your role has changed"**
  - Headline: pill **"Member"** + "You no longer have staff access."
  - Primary CTA: **"Got it"**

Server `title`/`body` for the inbox mirror these (e.g. title "You're now a Moderator" /
"Your role has changed"; body a short line). The richer headline/subtext live in the
dialog; the inbox shows the server title/body.

## Testing

- **Server:** `notifyRoleChanged` — promotion inserts with `direction: "promoted"`;
  demotion with `"demoted"`; equal rank inserts nothing (no-op); payload carries
  `newRole`/`previousRole`. `GET /api/notifications/role-change` returns only the latest
  unread `staff.role_changed` (ignores read ones and other kinds), and `null` when none.
- **Web:** `RoleChangeDialog` renders the correct tone, copy, and pill label for each
  direction (promotion / demotion-to-staff / demotion-to-user), props-driven, no network.

## Out of Scope

- Real-time delivery (WebSocket push of role changes).
- Notifying the acting owner or other staff.
- A preferences toggle for role-change notifications (intentionally always-on).
- Lateral/no-op role changes (no distinct rank → no dialog).
