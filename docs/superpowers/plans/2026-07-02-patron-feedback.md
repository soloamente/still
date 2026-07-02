# Patron Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven execution (one task per subagent; human `go` between tasks) or executing-plans for batch runs.

**Goal:** Ship in-app patron feedback (Bug · Idea · Other) with account-menu compose dialog, history drawer, staff triage panel on `/staff`, and `feedback.replied` inbox notifications.

**Architecture:** Three dedicated Postgres tables (`patron_feedback`, `patron_feedback_reply`, `patron_feedback_staff_note`); patron API at `/api/feedback`; staff API at `/api/staff/feedback` gated by new `feedback:read` / `feedback:reply` permissions; web shell via `FeedbackDrawerProvider` + compose dialog wired into account menu.

**Tech Stack:** Drizzle + Postgres migration `0038`, Better Auth access control (`@still/auth`), Elysia routes (`apps/server`), Eden `api` client (`apps/web`), `DetailVaulSheet` / `APP_MODAL_OVERLAY_CLASS`, `deliverNotification` + SSE inbox.

**Spec:** `docs/superpowers/specs/2026-07-02-patron-feedback-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/db/src/schema/feedback.ts` | Enums + three tables |
| `packages/db/src/migrations/0038_patron_feedback.sql` | SQL migration |
| `packages/db/src/migrations/meta/_journal.json` | Register migration |
| `packages/db/src/schema/index.ts` | Re-export feedback schema |
| `packages/auth/src/permissions.ts` | `feedback: ["read", "reply"]` on roles |
| `packages/auth/src/permission-summary.ts` | Labels for staff UI |
| `packages/auth/src/permissions.test.ts` | Matrix tests for feedback perms |
| `apps/server/src/context.ts` | Extend `Resource` union with `"feedback"` |
| `apps/server/src/lib/patron-feedback.ts` | Validation, CRUD, notification on reply |
| `apps/server/src/lib/patron-feedback.test.ts` | Unit tests (validation, href, unread) |
| `apps/server/src/routes/feedback.ts` | Patron `/api/feedback` routes |
| `apps/server/src/routes/feedback.test.ts` | Route tests (mock lib) |
| `apps/server/src/routes/staff-feedback.ts` | Staff `/api/staff/feedback` routes |
| `apps/server/src/routes/staff-feedback.test.ts` | Permission + reply tests |
| `apps/server/src/server/app.ts` | `.use(feedbackRoute)` |
| `apps/server/src/routes/staff.ts` | `.use(staffFeedbackRoute)` or import chain |
| `apps/server/src/lib/notification-delivery.ts` | Register `feedback.replied` kind |
| `apps/web/src/lib/feedback-notification-href.ts` | `buildFeedbackNotificationHref` |
| `apps/web/src/lib/notification-href.ts` | Wire feedback deep links |
| `apps/web/src/lib/notification-href.test.ts` | Href tests |
| `apps/web/src/components/feedback/feedback-compose-dialog.tsx` | Submit dialog |
| `apps/web/src/components/feedback/feedback-drawer.tsx` | List + thread drawer |
| `apps/web/src/components/feedback/feedback-drawer-provider.tsx` | Context + `?feedback=` handler |
| `apps/web/src/components/staff/staff-feedback-panel.tsx` | Staff inbox UI |
| `apps/web/src/components/app/app-user-account-menu.tsx` | Menu rows |
| `apps/web/src/components/app/mobile-you-sheet.tsx` | Mobile parity |
| `apps/web/src/app/(app)/layout.tsx` | Mount `FeedbackDrawerProvider` |
| `apps/web/src/app/(app)/staff/page.tsx` | Mount `StaffFeedbackPanel` |

---

### Task 1: Database schema and migration

**Files:**
- Create: `packages/db/src/schema/feedback.ts`
- Create: `packages/db/src/migrations/0038_patron_feedback.sql`
- Modify: `packages/db/src/migrations/meta/_journal.json`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create schema file**

```ts
// packages/db/src/schema/feedback.ts
import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const patronFeedbackCategory = pgEnum("patron_feedback_category", [
  "bug",
  "idea",
  "other",
]);
export type PatronFeedbackCategory =
  (typeof patronFeedbackCategory.enumValues)[number];

export const patronFeedbackStatus = pgEnum("patron_feedback_status", [
  "open",
  "resolved",
  "dismissed",
]);
export type PatronFeedbackStatus =
  (typeof patronFeedbackStatus.enumValues)[number];

export const patronFeedback = pgTable(
  "patron_feedback",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    category: patronFeedbackCategory("category").notNull(),
    body: text("body").notNull(),
    pageUrl: text("page_url"),
    status: patronFeedbackStatus("status").default("open").notNull(),
    lastStaffReplyAt: timestamp("last_staff_reply_at", { withTimezone: true }),
    patronLastReadAt: timestamp("patron_last_read_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByUserId: text("resolved_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("patron_feedback_user_created_idx").on(table.userId, table.createdAt),
    index("patron_feedback_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);

export const patronFeedbackReply = pgTable(
  "patron_feedback_reply",
  {
    id: text("id").primaryKey(),
    feedbackId: text("feedback_id")
      .notNull()
      .references(() => patronFeedback.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("patron_feedback_reply_feedback_idx").on(
      table.feedbackId,
      table.createdAt,
    ),
  ],
);

export const patronFeedbackStaffNote = pgTable(
  "patron_feedback_staff_note",
  {
    id: text("id").primaryKey(),
    feedbackId: text("feedback_id")
      .notNull()
      .references(() => patronFeedback.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("patron_feedback_staff_note_feedback_idx").on(
      table.feedbackId,
      table.createdAt,
    ),
  ],
);

export const patronFeedbackRelations = relations(patronFeedback, ({ one, many }) => ({
  user: one(user, { fields: [patronFeedback.userId], references: [user.id] }),
  replies: many(patronFeedbackReply),
  staffNotes: many(patronFeedbackStaffNote),
}));
```

- [ ] **Step 2: Create SQL migration `0038_patron_feedback.sql`**

Use `CREATE TYPE` for both enums, then three `CREATE TABLE` statements matching the schema above.

- [ ] **Step 3: Append journal entry** (idx 38, tag `0038_patron_feedback`)

- [ ] **Step 4: Export from `packages/db/src/schema/index.ts`**

```ts
export * from "./feedback";
```

- [ ] **Step 5: Run migration**

```bash
cd packages/db && bun run db:migrate
```

Expected: migration applies without error.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/feedback.ts packages/db/src/migrations/0038_patron_feedback.sql packages/db/src/migrations/meta/_journal.json packages/db/src/schema/index.ts
git commit -m "feat(db): add patron feedback tables"
```

---

### Task 2: Auth permissions

**Files:**
- Modify: `packages/auth/src/permissions.ts`
- Modify: `packages/auth/src/permission-summary.ts`
- Modify: `packages/auth/src/permissions.test.ts`
- Modify: `apps/server/src/context.ts`

- [ ] **Step 1: Extend `statement` and roles**

```ts
// permissions.ts — add to statement
feedback: ["read", "reply"],

// owner + admin
feedback: ["read", "reply"],

// support
feedback: ["read"],

// moderator + user
feedback: [],  // via empty role arrays on user resource pattern
```

For `moderator` and `user`, omit `feedback` key (same as today for audit on moderator).

- [ ] **Step 2: Add permission-summary labels** (`ACTION_LABELS` / resource group for Feedback)

- [ ] **Step 3: Add tests**

```ts
it("owner and admin can read and reply to feedback", () => {
  expect(roles.owner.authorize({ feedback: ["read"] }).success).toBe(true);
  expect(roles.owner.authorize({ feedback: ["reply"] }).success).toBe(true);
  expect(roles.admin.authorize({ feedback: ["reply"] }).success).toBe(true);
});

it("support can read feedback but not reply", () => {
  expect(roles.support.authorize({ feedback: ["read"] }).success).toBe(true);
  expect(roles.support.authorize({ feedback: ["reply"] } as never).success).toBe(false);
});

it("moderator has no feedback access", () => {
  expect(roles.moderator.authorize({ feedback: ["read"] } as never).success).toBe(false);
});
```

- [ ] **Step 4: Update `context.ts`**

```ts
type Resource = "user" | "content" | "audit" | "feedback";
```

- [ ] **Step 5: Run tests**

```bash
cd packages/auth && bun test src/permissions.test.ts
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(auth): add feedback read/reply permissions"
```

---

### Task 3: Server lib — validation and helpers

**Files:**
- Create: `apps/server/src/lib/patron-feedback.ts`
- Create: `apps/server/src/lib/patron-feedback.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, test } from "bun:test";
import {
  buildFeedbackNotificationHref,
  parsePatronFeedbackInput,
  isFeedbackUnread,
} from "./patron-feedback";

describe("parsePatronFeedbackInput", () => {
  test("accepts valid bug report", () => {
    const out = parsePatronFeedbackInput({
      category: "bug",
      body: "  The slider is broken on mobile  ",
      pageUrl: "/movies/550",
    });
    expect(out.category).toBe("bug");
    expect(out.body).toBe("The slider is broken on mobile");
    expect(out.pageUrl).toBe("/movies/550");
  });

  test("rejects short body", () => {
    expect(() =>
      parsePatronFeedbackInput({ category: "idea", body: "short" }),
    ).toThrow();
  });

  test("rejects absolute pageUrl", () => {
    expect(() =>
      parsePatronFeedbackInput({
        category: "other",
        body: "Something is wrong here",
        pageUrl: "https://evil.com",
      }),
    ).toThrow();
  });
});

describe("buildFeedbackNotificationHref", () => {
  test("returns home deep link", () => {
    expect(buildFeedbackNotificationHref("fb_abc")).toBe("/home?feedback=fb_abc");
  });
});

describe("isFeedbackUnread", () => {
  test("unread when staff replied after patron read", () => {
    expect(
      isFeedbackUnread({
        lastStaffReplyAt: new Date("2026-01-02"),
        patronLastReadAt: new Date("2026-01-01"),
      }),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/server && bun test src/lib/patron-feedback.test.ts
```

- [ ] **Step 3: Implement lib**

Key exports:
- `PATRON_FEEDBACK_RATE_LIMIT = 10`, `PATRON_FEEDBACK_RATE_WINDOW_MS = 86_400_000`
- `parsePatronFeedbackInput(raw)` — trim body, length 10–2000, validate category enum, `pageUrl` optional starting with `/`, max 500
- `buildFeedbackNotificationHref(feedbackId: string)`
- `isFeedbackUnread({ lastStaffReplyAt, patronLastReadAt })`
- `createPatronFeedback({ userId, input })` → `{ feedbackId }`
- `listPatronFeedbackForUser(userId)`
- `getPatronFeedbackForUser({ userId, feedbackId })` → ticket + replies (no staff notes); 404 path when wrong owner
- `markPatronFeedbackRead({ userId, feedbackId })`
- `listStaffFeedback({ status?, category?, limit? })` — join profile for submitter handle
- `getStaffFeedbackDetail(feedbackId)` — ticket + replies + staffNotes + submitter
- `addStaffFeedbackReply({ feedbackId, authorId, body })` — insert reply, set `lastStaffReplyAt`, `deliverNotification` with kind `feedback.replied`
- `addStaffFeedbackNote({ feedbackId, authorId, body })`
- `updatePatronFeedbackStatus({ feedbackId, status, actorId })` — set `resolvedAt` / `resolvedByUserId` when not `open`

Use `makeId("fb")` for tickets, `makeId("fbr")` for replies, `makeId("fbn")` for notes.

Notification on reply:

```ts
await deliverNotification({
  userId: ticket.userId,
  kind: "feedback.replied",
  title: "Sense replied to your feedback",
  body: body.trim().slice(0, 120) + (body.trim().length > 120 ? "…" : ""),
  payload: {
    feedbackId: ticket.id,
    href: buildFeedbackNotificationHref(ticket.id),
  },
  context: { actorUserId: authorId },
});
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(server): patron feedback domain lib"
```

---

### Task 4: Patron API routes

**Files:**
- Create: `apps/server/src/routes/feedback.ts`
- Create: `apps/server/src/routes/feedback.test.ts`
- Modify: `apps/server/src/server/app.ts`

- [ ] **Step 1: Write route tests (mock lib)**

```ts
test("POST /api/feedback requires sign-in", async () => {
  const res = await call("/api/feedback", { method: "POST", body: { category: "bug", body: "Ten chars!!" } });
  expect(res.status).toBe(401);
});

test("POST /api/feedback returns 429 when rate limited", async () => {
  // mock hit() to return { ok: false }
  const res = await call("/api/feedback", { method: "POST", userId: "u1", body: { category: "bug", body: "Ten chars!!" } });
  expect(res.status).toBe(429);
});
```

- [ ] **Step 2: Implement `feedbackRoute`**

```ts
export const feedbackRoute = new Elysia({ prefix: "/api/feedback", tags: ["feedback"] })
  .use(context)
  .post("/", async ({ user, body, status }) => {
    if (!user) return status(401, "Sign in");
    if (!hit(`feedback:${user.id}`, { limit: PATRON_FEEDBACK_RATE_LIMIT, windowMs: PATRON_FEEDBACK_RATE_WINDOW_MS }).ok) {
      return status(429, "Feedback limit reached — try again tomorrow");
    }
    try {
      parsePatronFeedbackInput(body);
    } catch (e) {
      return status(400, e instanceof Error ? e.message : String(e));
    }
    const result = await createPatronFeedback({ userId: user.id, input: body });
    return { feedbackId: result.feedbackId, status: "open" as const };
  }, { body: t.Object({
    category: t.Union([t.Literal("bug"), t.Literal("idea"), t.Literal("other")]),
    body: t.String({ minLength: 1, maxLength: 2000 }),
    pageUrl: t.Optional(t.Union([t.String({ maxLength: 500 }), t.Null()])),
  }) })
  .get("/", async ({ user, status }) => {
    if (!user) return status(401, "Sign in");
    const items = await listPatronFeedbackForUser(user.id);
    return { items };
  })
  .get("/:id", async ({ user, params, status }) => {
    if (!user) return status(401, "Sign in");
    const row = await getPatronFeedbackForUser({ userId: user.id, feedbackId: params.id });
    if (!row) return status(404, "Not found");
    return row;
  })
  .patch("/:id/read", async ({ user, params, status }) => {
    if (!user) return status(401, "Sign in");
    const ok = await markPatronFeedbackRead({ userId: user.id, feedbackId: params.id });
    if (!ok) return status(404, "Not found");
    return { ok: true };
  });
```

- [ ] **Step 3: Register in `app.ts`**

```ts
import { feedbackRoute } from "../routes/feedback";
// ...
.use(feedbackRoute)
```

- [ ] **Step 4: Run tests**

```bash
cd apps/server && bun test src/routes/feedback.test.ts
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(server): patron feedback API routes"
```

---

### Task 5: Staff API routes + notification kind

**Files:**
- Create: `apps/server/src/routes/staff-feedback.ts`
- Create: `apps/server/src/routes/staff-feedback.test.ts`
- Modify: `apps/server/src/routes/staff.ts`
- Modify: `apps/server/src/lib/notification-delivery.ts`

- [ ] **Step 1: Register notification kind**

```ts
{
  id: "feedback.replied",
  label: "Feedback replies",
  description: "When the Sense team replies to feedback you sent.",
  defaultEnabled: true,
  requiresOptIn: false,
},
```

- [ ] **Step 2: Write staff route tests**

```ts
test("GET /api/staff/feedback requires feedback:read", async () => { /* moderator → 403 */ });
test("POST /api/staff/feedback/:id/reply requires feedback:reply", async () => { /* support → 403, admin → 200 */ });
test("staff reply triggers deliverNotification", async () => { /* mock deliverNotification */ });
```

- [ ] **Step 3: Implement `staffFeedbackRoute`**

Prefix: `/api/staff/feedback` — mount via `.use(staffFeedbackRoute)` at end of `staffRoute` chain (or merge into `staff.ts` if preferred).

Each handler wraps `requirePermission` with `forbidden()` helper pattern from `staff.ts`.

- [ ] **Step 4: Run tests**

```bash
cd apps/server && bun test src/routes/staff-feedback.test.ts src/lib/notification-delivery.test.ts
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(server): staff feedback routes and notification kind"
```

---

### Task 6: Web notification deep links

**Files:**
- Create: `apps/web/src/lib/feedback-notification-href.ts`
- Modify: `apps/web/src/lib/notification-href.ts`
- Modify: `apps/web/src/lib/notification-href.test.ts`

- [ ] **Step 1: Add failing test**

```ts
test("feedbackId in payload resolves to home deep link", () => {
  expect(
    notificationPayloadHref({ feedbackId: "fb_1", href: "/home?feedback=fb_1" }),
  ).toBe("/home?feedback=fb_1");
});
```

- [ ] **Step 2: Implement**

```ts
// feedback-notification-href.ts
export function buildFeedbackNotificationHref(feedbackId: string): string {
  return `/home?feedback=${encodeURIComponent(feedbackId)}`;
}

export function feedbackIdFromNotificationPayload(
  payload: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!payload) return undefined;
  const id = payload.feedbackId;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}
```

In `notificationPayloadHref`, after quote href check:

```ts
const feedbackId = feedbackIdFromNotificationPayload(payload);
if (feedbackId) return buildFeedbackNotificationHref(feedbackId);
```

- [ ] **Step 3: Run test**

```bash
cd apps/web && bun test src/lib/notification-href.test.ts
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): feedback notification deep links"
```

---

### Task 7: Patron UI — provider, dialog, drawer

**Files:**
- Create: `apps/web/src/components/feedback/feedback-drawer-provider.tsx`
- Create: `apps/web/src/components/feedback/feedback-compose-dialog.tsx`
- Create: `apps/web/src/components/feedback/feedback-drawer.tsx`
- Modify: `apps/web/src/app/(app)/layout.tsx`

- [ ] **Step 1: `FeedbackDrawerProvider`**

Context API:
- `openCompose()` — opens dialog
- `openFeedbackList()` — opens drawer in list mode
- `openFeedbackThread(feedbackId: string)` — opens drawer in thread mode

On mount, read `useSearchParams().get("feedback")`:
- If set → `openFeedbackThread(id)` then `router.replace` stripping only `feedback` param (preserve others).

Wrap signed-in `(app)` children in layout.

- [ ] **Step 2: `FeedbackComposeDialog`**

- `Dialog` with `APP_MODAL_OVERLAY_CLASS`
- `SegmentedPillToolbar` for category
- `Textarea` min 10 / max 2000
- Capture `pageUrl` from `usePathname()` + `useSearchParams()` → `` `${pathname}${search ? `?${search}` : ""}` ``
- Submit via `stillApiFetch` or `api.api.feedback.post()` (match quotes pattern)
- Success: brief inline “Thanks” then `onOpenChange(false)`

- [ ] **Step 3: `FeedbackDrawer`**

Use `DetailVaulSheet` like `quote-suggest-sheet.tsx`:
- **List mode:** fetch `GET /api/feedback`, map rows with unread dot via `isFeedbackUnread` logic (client-side compare timestamps)
- **Thread mode:** fetch `GET /api/feedback/:id`, on open call `PATCH .../read`
- Back button list ← thread
- Empty state CTA → `openCompose()`

- [ ] **Step 4: Manual smoke**

1. Sign in → account menu → Send feedback → submit
2. My feedback → see row
3. (After staff reply in Task 8) thread shows reply

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): patron feedback dialog and drawer"
```

---

### Task 8: Account menu + mobile sheet

**Files:**
- Modify: `apps/web/src/components/app/app-user-account-menu.tsx`
- Modify: `apps/web/src/components/app/mobile-you-sheet.tsx`

- [ ] **Step 1: Import `useFeedbackDrawer()` from provider**

Add rows above Staff (when staff):

```tsx
<DropdownMenuItem
  className={accountMenuItemOnBackgroundClassName}
  onClick={() => openCompose()}
>
  <MessageSquare className="size-5 shrink-0 opacity-80" aria-hidden />
  Send feedback
</DropdownMenuItem>
<DropdownMenuItem
  className={accountMenuItemOnBackgroundClassName}
  onClick={() => openFeedbackList()}
>
  <MessageSquare className="size-5 shrink-0 opacity-80" aria-hidden />
  My feedback
</DropdownMenuItem>
```

Only render when `session` is signed in (menu already requires user).

- [ ] **Step 2: Mirror in `mobile-you-sheet.tsx`**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(web): account menu feedback entry points"
```

---

### Task 9: Staff feedback panel

**Files:**
- Create: `apps/web/src/components/staff/staff-feedback-panel.tsx`
- Modify: `apps/web/src/app/(app)/staff/page.tsx`

- [ ] **Step 1: Build panel** (follow `staff-quotes-panel.tsx` structure)

- Section heading: **Feedback**
- Status toolbar: Open · Resolved · Dismissed · All
- Category toolbar: All · Bug · Idea · Other
- Fetch `api.api.staff.feedback.get({ query: { status, category } })`
- Expandable rows → detail with replies, internal notes (amber “Internal” label), action forms

Pass `canReply` from session role (`owner` | `admin` only):

```ts
const canReply = role === "owner" || role === "admin";
```

Hide reply/note/status forms when `!canReply`.

- [ ] **Step 2: Wire into staff page**

```tsx
<StaffQuotesPanel />
<StaffFeedbackPanel currentRole={role} />
{canReadAudit ? <StaffAuditTab /> : null}
```

- [ ] **Step 3: Manual smoke on `/staff`**

- Submit feedback as patron → appears in staff Open filter
- Admin reply → patron notification + drawer thread
- Support login → can read, 403 on reply (UI disabled)

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): staff feedback panel"
```

---

### Task 10: Changelog + graphify

**Files:**
- Modify: `apps/web/src/lib/product-changelog.ts` (if shipping to patrons — optional for internal staff tool)

- [ ] **Step 1: Add changelog entry** for “Send feedback” in account menu (brief)

- [ ] **Step 2: Run full test suites**

```bash
cd apps/server && bun test src/lib/patron-feedback.test.ts src/routes/feedback.test.ts src/routes/staff-feedback.test.ts
cd apps/web && bun test src/lib/notification-href.test.ts
cd packages/auth && bun test src/permissions.test.ts
```

- [ ] **Step 3: Update graph**

```bash
graphify update .
```

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: changelog and graphify for patron feedback"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Bug · Idea · Other categories | 3, 7 |
| Account menu Send feedback | 8 |
| Compose dialog | 7 |
| My feedback drawer | 7, 8 |
| Staff panel on `/staff` | 9 |
| Triage status | 3, 5, 9 |
| Internal staff notes | 3, 5, 9 |
| Patron-visible replies | 3, 5, 7 |
| `feedback.replied` notification | 3, 5, 6 |
| `?feedback=` deep link | 6, 7 |
| Permissions matrix | 2, 5, 9 |
| Rate limit 10/24h | 3, 4 |
| Staff notes excluded from patron GET | 3, 4 |
| Mobile account sheet parity | 8 |

---

## Manual test plan

1. Patron submits bug from `/movies/[id]` → `pageUrl` preserved on staff row.
2. Support views ticket on `/staff` — no reply button.
3. Admin sends reply — patron gets inbox notification; tap opens thread; unread dot clears.
4. Admin resolves ticket — status updates; no new notification.
5. Admin adds internal note — not visible in patron drawer API response.
6. 11th submission in 24h → 429 toast.
7. Patron B cannot `GET` patron A's ticket (404).
