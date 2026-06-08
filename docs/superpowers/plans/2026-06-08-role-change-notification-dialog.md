# Role-Change Notification Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an owner changes a user's staff role, show that user a modal on next app load (celebratory for promotions, informational for demotions) with a pill of their new role, and record the change in the notifications inbox.

**Architecture:** The existing `POST /api/staff/users/:id/role` endpoint inserts a `staff.role_changed` notification (direction derived by comparing role rank). A web host (`RoleChangeDialogRoot`, mounted in app-shell) fetches the latest unread role-change notification on load and shows a presentational dialog modeled on the existing What's-New dialog; dismissing marks the notification read. The notification also renders in the inbox.

**Tech Stack:** Bun, Elysia, Drizzle (Postgres/Neon), better-auth admin plugin, Next.js 16 App Router, Eden client (`@still/api-client`), `motion`, `bun test`.

**Spec:** `docs/superpowers/specs/2026-06-08-role-change-notification-dialog-design.md`

---

## File Structure

**Create:**
- `apps/server/src/lib/role-change-notification.ts` — pure direction/content helpers + `notifyRoleChanged` writer
- `apps/server/src/lib/role-change-notification.test.ts` — unit tests for the pure helpers
- `apps/server/src/routes/notifications.test.ts` — test for the new `role-change` endpoint
- `apps/web/src/lib/staff-role-labels.ts` — role label map + `roleWithArticle`
- `apps/web/src/lib/role-change-dialog-copy.ts` — pure dialog copy builder
- `apps/web/src/lib/role-change-dialog-copy.test.ts` — unit tests for the copy builder
- `apps/web/src/components/staff/role-badge-pill.tsx` — the role pill (avatar replacement)
- `apps/web/src/components/staff/role-change-dialog.tsx` — the modal (presentational)
- `apps/web/src/components/staff/role-change-dialog-root.tsx` — the host (data + open/dismiss)

**Modify:**
- `apps/server/src/routes/staff.ts` — call `notifyRoleChanged` in the role endpoint
- `apps/server/src/routes/notifications.ts` — add `GET /role-change`
- `apps/web/src/components/app/app-shell.tsx` — mount `<RoleChangeDialogRoot />`
- `apps/web/src/components/notifications/notifications-list.tsx` — inbox icon for the new kind
- `apps/web/src/components/notifications/notifications-dropdown-panel.tsx` — inbox icon for the new kind

---

## Task 1: Server — role-change direction & content helpers

Pure, DB-free logic plus a thin writer. The pure functions are the tested units.

**Files:**
- Create: `apps/server/src/lib/role-change-notification.ts`
- Test: `apps/server/src/lib/role-change-notification.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/server/src/lib/role-change-notification.test.ts
import { describe, expect, it } from "bun:test";
import {
  roleChangeDirection,
  roleChangeNotificationContent,
} from "./role-change-notification";

describe("roleChangeDirection", () => {
  it("returns promoted when rank increases", () => {
    expect(roleChangeDirection("user", "moderator")).toBe("promoted");
    expect(roleChangeDirection("support", "admin")).toBe("promoted");
    expect(roleChangeDirection("moderator", "owner")).toBe("promoted");
  });
  it("returns demoted when rank decreases", () => {
    expect(roleChangeDirection("admin", "support")).toBe("demoted");
    expect(roleChangeDirection("moderator", "user")).toBe("demoted");
  });
  it("returns null when rank is unchanged", () => {
    expect(roleChangeDirection("admin", "admin")).toBeNull();
    expect(roleChangeDirection("user", "user")).toBeNull();
  });
});

describe("roleChangeNotificationContent", () => {
  it("celebrates a promotion with the new role label", () => {
    const c = roleChangeNotificationContent("promoted", "moderator");
    expect(c.title).toBe("You're now a Moderator");
    expect(c.body).toBe("You've got new staff permissions on Still.");
  });
  it("uses the right article for admin and owner", () => {
    expect(roleChangeNotificationContent("promoted", "admin").title).toBe(
      "You're now an Admin",
    );
    expect(roleChangeNotificationContent("promoted", "owner").title).toBe(
      "You're now the Owner",
    );
  });
  it("informs on a demotion to a lower staff role", () => {
    const c = roleChangeNotificationContent("demoted", "support");
    expect(c.title).toBe("Your role has changed");
    expect(c.body).toBe(
      "You're now a Support — some staff tools are no longer available.",
    );
  });
  it("informs on a demotion to a regular member", () => {
    const c = roleChangeNotificationContent("demoted", "user");
    expect(c.title).toBe("Your role has changed");
    expect(c.body).toBe("You no longer have staff access.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/lib/role-change-notification.test.ts`
Expected: FAIL — `Cannot find module './role-change-notification'`.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/server/src/lib/role-change-notification.ts
import { db, notification } from "@still/db";

import { makeId } from "./cuid";
import { rankOf } from "./staff-rank";

export type RoleChangeDirection = "promoted" | "demoted";

/** Display labels for the role string stored on `user.role`. */
const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  moderator: "Moderator",
  support: "Support",
  user: "Member",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? "Member";
}

/** "the Owner" / "an Admin" / "a Moderator". */
export function roleWithArticle(role: string): string {
  const label = roleLabel(role);
  if (role === "owner") return `the ${label}`;
  if (role === "admin") return `an ${label}`;
  return `a ${label}`;
}

/** Compare rank; null when unchanged (no notification should be sent). */
export function roleChangeDirection(
  previousRole: string,
  newRole: string,
): RoleChangeDirection | null {
  const prev = rankOf(previousRole);
  const next = rankOf(newRole);
  if (next > prev) return "promoted";
  if (next < prev) return "demoted";
  return null;
}

/** Inbox title/body for the stored notification row. */
export function roleChangeNotificationContent(
  direction: RoleChangeDirection,
  newRole: string,
): { title: string; body: string } {
  if (direction === "promoted") {
    return {
      title: `You're now ${roleWithArticle(newRole)}`,
      body: "You've got new staff permissions on Still.",
    };
  }
  if (newRole === "user") {
    return {
      title: "Your role has changed",
      body: "You no longer have staff access.",
    };
  }
  return {
    title: "Your role has changed",
    body: `You're now ${roleWithArticle(newRole)} — some staff tools are no longer available.`,
  };
}

export interface NotifyRoleChangeInput {
  userId: string;
  previousRole: string;
  newRole: string;
}

/**
 * Insert a `staff.role_changed` notification when the rank actually changed.
 * Inserted directly (not via deliverNotification) so this account-level event
 * is always delivered, bypassing the user-toggleable preference gate. Never
 * throws — a notification failure must not break the role change.
 */
export async function notifyRoleChanged(
  input: NotifyRoleChangeInput,
): Promise<void> {
  try {
    const direction = roleChangeDirection(input.previousRole, input.newRole);
    if (!direction) return;
    const content = roleChangeNotificationContent(direction, input.newRole);
    await db.insert(notification).values({
      id: makeId("ntf"),
      userId: input.userId,
      kind: "staff.role_changed",
      title: content.title,
      body: content.body,
      payload: {
        direction,
        newRole: input.newRole,
        previousRole: input.previousRole,
      },
    });
  } catch (err) {
    console.error("[role-change-notification]", err);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && bun test src/lib/role-change-notification.test.ts`
Expected: PASS (4 describe blocks).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/role-change-notification.ts apps/server/src/lib/role-change-notification.test.ts
git commit -m "feat(server): add role-change notification direction/content helpers"
```

---

## Task 2: Server — fire the notification from the role endpoint

**Files:**
- Modify: `apps/server/src/routes/staff.ts`

- [ ] **Step 1: Add the import**

At the top of `apps/server/src/routes/staff.ts`, with the other `../lib/*` imports:

```typescript
import { notifyRoleChanged } from "../lib/role-change-notification";
```

- [ ] **Step 2: Call it after the audit write in the role handler**

In the `POST /users/:id/role` handler, immediately after the existing
`await writeAuditLog({ ... action: "user.set-role" ... });` and before `return { ok: true };`, add:

```typescript
      await notifyRoleChanged({
        userId: params.id,
        previousRole: target.role ?? "user",
        newRole: body.role,
      });
```

(`target.role` is already selected earlier in the handler; `body.role` is the new role.)

- [ ] **Step 3: Verify existing staff tests still pass**

Run: `cd apps/server && bun test src/routes/staff.test.ts`
Expected: PASS (13 tests). The staff test mocks `@still/db`; the new `db.insert(notification)` call inside `notifyRoleChanged` runs against that mock. If the mock's `db.insert(...).values(...)` chain doesn't support an unknown table, the demotion/role tests may error — if so, make the mock's `insert().values()` a no-op that resolves (mirror how it already handles audit-log inserts). Adjust the mock minimally so it tolerates the extra insert; do not weaken existing assertions.

- [ ] **Step 4: Typecheck**

Run from repo root: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit 2>&1 | rg "routes/staff"`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/staff.ts apps/server/src/routes/staff.test.ts
git commit -m "feat(server): notify users when their staff role changes"
```

---

## Task 3: Server — `GET /api/notifications/role-change`

**Files:**
- Modify: `apps/server/src/routes/notifications.ts`
- Test: `apps/server/src/routes/notifications.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/server/src/routes/notifications.test.ts
import { describe, expect, it, mock } from "bun:test";
import { Elysia } from "elysia";

type Notif = {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
};

const state: { notifs: Notif[] } = { notifs: [] };

// Minimal thenable select builder that models
// .select().from().where().orderBy().limit() and resolves to filtered rows.
function makeDb() {
  return {
    select() {
      return {
        from() {
          return this;
        },
        where() {
          return this;
        },
        orderBy() {
          return this;
        },
        limit(_n: number) {
          // The route filters kind === staff.role_changed AND readAt null.
          const rows = state.notifs
            .filter((n) => n.kind === "staff.role_changed" && n.readAt === null)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, _n);
          return Promise.resolve(rows);
        },
      };
    },
  };
}

mock.module("@still/db", () => ({
  db: makeDb(),
  notification: { id: "id", userId: "userId", kind: "kind", readAt: "readAt", createdAt: "createdAt" },
  badge: {},
  profile: {},
}));

mock.module("@still/auth", () => ({
  auth: {
    api: {
      getSession: async ({ headers }: { headers: Headers }) => {
        const id = headers.get("x-user-id");
        return id ? { session: { id: `s-${id}` }, user: { id } } : null;
      },
    },
    handler: () => new Response("ok"),
  },
}));

const { notificationsRoute } = await import("./notifications");

function call(path: string, userId?: string) {
  const headers: Record<string, string> = {};
  if (userId) headers["x-user-id"] = userId;
  return new Elysia()
    .use(notificationsRoute)
    .handle(new Request(`http://localhost${path}`, { headers }));
}

describe("GET /api/notifications/role-change", () => {
  it("401 when signed out", async () => {
    state.notifs = [];
    const res = await call("/api/notifications/role-change");
    expect(res.status).toBe(401);
  });

  it("returns the latest unread role-change notification", async () => {
    state.notifs = [
      {
        id: "ntf-old",
        userId: "u1",
        kind: "staff.role_changed",
        title: "old",
        body: null,
        payload: { direction: "promoted", newRole: "support" },
        readAt: null,
        createdAt: new Date("2026-06-01"),
      },
      {
        id: "ntf-new",
        userId: "u1",
        kind: "staff.role_changed",
        title: "new",
        body: null,
        payload: { direction: "promoted", newRole: "moderator" },
        readAt: null,
        createdAt: new Date("2026-06-05"),
      },
    ];
    const res = await call("/api/notifications/role-change", "u1");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { notification: { id: string } | null };
    expect(json.notification?.id).toBe("ntf-new");
  });

  it("returns null when none are unread", async () => {
    state.notifs = [
      {
        id: "ntf-read",
        userId: "u1",
        kind: "staff.role_changed",
        title: "x",
        body: null,
        payload: {},
        readAt: new Date(),
        createdAt: new Date(),
      },
    ];
    const res = await call("/api/notifications/role-change", "u1");
    const json = (await res.json()) as { notification: unknown };
    expect(json.notification).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/routes/notifications.test.ts`
Expected: FAIL — the `role-change` route 404s (returns no `notification` field) or the import shape differs. (If the mock's table-object shape needs tweaking to satisfy drizzle calls, adjust it; the assertions are what matter.)

- [ ] **Step 3: Add the endpoint**

In `apps/server/src/routes/notifications.ts`, add `and`, `desc`, `eq`, `isNull` are already imported. Add this route to the `notificationsRoute` chain (after the existing `.get("/unread-count", ...)` is fine):

```typescript
	.get("/role-change", async ({ user, status }) => {
		if (!user) return status(401, "Sign in");
		const [row] = await db
			.select()
			.from(notification)
			.where(
				and(
					eq(notification.userId, user.id),
					eq(notification.kind, "staff.role_changed"),
					isNull(notification.readAt),
				),
			)
			.orderBy(desc(notification.createdAt))
			.limit(1);
		return { notification: row ?? null };
	})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && bun test src/routes/notifications.test.ts`
Expected: PASS (3 cases).

- [ ] **Step 5: Typecheck**

Run from repo root: `./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit 2>&1 | rg "routes/notifications"`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/notifications.ts apps/server/src/routes/notifications.test.ts
git commit -m "feat(server): add GET /api/notifications/role-change endpoint"
```

---

## Task 4: Web — role labels & dialog copy (pure)

**Files:**
- Create: `apps/web/src/lib/staff-role-labels.ts`
- Create: `apps/web/src/lib/role-change-dialog-copy.ts`
- Test: `apps/web/src/lib/role-change-dialog-copy.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/role-change-dialog-copy.test.ts
import { describe, expect, it } from "bun:test";
import { roleChangeDialogCopy } from "./role-change-dialog-copy";

describe("roleChangeDialogCopy", () => {
  it("celebrates a promotion and offers the staff panel", () => {
    const c = roleChangeDialogCopy("promoted", "moderator");
    expect(c.title).toBe("It's official!");
    expect(c.headline).toBe("You're now a Moderator");
    expect(c.subtext).toBe("You've got new staff permissions on Still.");
    expect(c.pillLabel).toBe("Moderator");
    expect(c.showStaffPanelCta).toBe(true);
  });

  it("uses the right article for admin and owner", () => {
    expect(roleChangeDialogCopy("promoted", "admin").headline).toBe(
      "You're now an Admin",
    );
    expect(roleChangeDialogCopy("promoted", "owner").headline).toBe(
      "You're now the Owner",
    );
  });

  it("informs on a demotion to a lower staff role (no staff CTA)", () => {
    const c = roleChangeDialogCopy("demoted", "support");
    expect(c.title).toBe("Your role has changed");
    expect(c.headline).toBe("You're now a Support");
    expect(c.subtext).toBe("Some staff tools are no longer available to you.");
    expect(c.pillLabel).toBe("Support");
    expect(c.showStaffPanelCta).toBe(false);
  });

  it("informs on a demotion to a regular member", () => {
    const c = roleChangeDialogCopy("demoted", "user");
    expect(c.title).toBe("Your role has changed");
    expect(c.headline).toBe("You no longer have staff access.");
    expect(c.subtext).toBe("");
    expect(c.pillLabel).toBe("Member");
    expect(c.showStaffPanelCta).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:/Users/adgv/Documents/Projects/still" && cd apps/web && bun test src/lib/role-change-dialog-copy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the label map**

```typescript
// apps/web/src/lib/staff-role-labels.ts
/** apps/web cannot import @still/auth, so role labels live here locally. */
export const STAFF_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  moderator: "Moderator",
  support: "Support",
  user: "Member",
};

export function roleLabel(role: string): string {
  return STAFF_ROLE_LABELS[role] ?? "Member";
}

/** "the Owner" / "an Admin" / "a Moderator". */
export function roleWithArticle(role: string): string {
  const label = roleLabel(role);
  if (role === "owner") return `the ${label}`;
  if (role === "admin") return `an ${label}`;
  return `a ${label}`;
}
```

- [ ] **Step 4: Write the copy builder**

```typescript
// apps/web/src/lib/role-change-dialog-copy.ts
import { roleLabel, roleWithArticle } from "@/lib/staff-role-labels";

export type RoleChangeDirection = "promoted" | "demoted";

export interface RoleChangeDialogCopy {
  title: string;
  headline: string;
  subtext: string;
  pillLabel: string;
  showStaffPanelCta: boolean;
}

export function roleChangeDialogCopy(
  direction: RoleChangeDirection,
  newRole: string,
): RoleChangeDialogCopy {
  const pillLabel = roleLabel(newRole);
  if (direction === "promoted") {
    return {
      title: "It's official!",
      headline: `You're now ${roleWithArticle(newRole)}`,
      subtext: "You've got new staff permissions on Still.",
      pillLabel,
      showStaffPanelCta: true,
    };
  }
  if (newRole === "user") {
    return {
      title: "Your role has changed",
      headline: "You no longer have staff access.",
      subtext: "",
      pillLabel,
      showStaffPanelCta: false,
    };
  }
  return {
    title: "Your role has changed",
    headline: `You're now ${roleWithArticle(newRole)}`,
    subtext: "Some staff tools are no longer available to you.",
    pillLabel,
    showStaffPanelCta: false,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && bun test src/lib/role-change-dialog-copy.test.ts`
Expected: PASS (4 cases).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/staff-role-labels.ts apps/web/src/lib/role-change-dialog-copy.ts apps/web/src/lib/role-change-dialog-copy.test.ts
git commit -m "feat(web): add role labels and role-change dialog copy"
```

---

## Task 5: Web — the pill and the dialog

**Files:**
- Create: `apps/web/src/components/staff/role-badge-pill.tsx`
- Create: `apps/web/src/components/staff/role-change-dialog.tsx`

- [ ] **Step 1: Create the role pill**

```tsx
// apps/web/src/components/staff/role-badge-pill.tsx
import { cn } from "@still/ui/lib/utils";

/** Tier tint: owner/admin stronger, others neutral. Avatar replacement. */
const TIER_CLASS: Record<string, string> = {
  owner: "bg-foreground text-background",
  admin: "bg-foreground text-background",
  moderator: "bg-background text-foreground",
  support: "bg-background text-muted-foreground",
  user: "bg-background text-muted-foreground",
};

export function RoleBadgePill({
  role,
  label,
}: {
  role: string;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-9 items-center rounded-full px-5 py-2 font-semibold text-base tracking-tight",
        TIER_CLASS[role] ?? TIER_CLASS.user,
      )}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Create the dialog (modeled on whats-new-dialog.tsx)**

```tsx
// apps/web/src/components/staff/role-change-dialog.tsx
"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { RoleBadgePill } from "@/components/staff/role-badge-pill";
import { APP_MODAL_OVERLAY_CLASS } from "@/lib/app-modal-layer";
import {
  type RoleChangeDirection,
  roleChangeDialogCopy,
} from "@/lib/role-change-dialog-copy";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;

export function RoleChangeDialog({
  open,
  direction,
  newRole,
  onDismiss,
}: {
  open: boolean;
  direction: RoleChangeDirection;
  newRole: string;
  onDismiss: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const descriptionId = useId();
  const [mounted, setMounted] = useState(false);
  const copy = roleChangeDialogCopy(direction, newRole);

  const handleDismiss = useCallback(() => onDismiss(), [onDismiss]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleDismiss]);

  const backdropTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: "easeOut" as const };
  const panelTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.25, ease: PANEL_EASE };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="role-change-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={backdropTransition}
          aria-hidden
          className={cn(APP_MODAL_OVERLAY_CLASS, "place-items-center px-4 py-8")}
          onClick={handleDismiss}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={panelTransition}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "t-modal relative flex w-full max-w-md flex-col items-center overflow-hidden rounded-[2rem] bg-card px-6 pt-12 pb-10 text-center text-foreground sm:px-8",
              "is-open",
            )}
          >
            <div className="absolute top-3 right-3 z-10 sm:top-4 sm:right-4">
              <Button
                type="button"
                variant="ghost"
                size="icon-pill"
                onClick={handleDismiss}
                aria-label="Close"
                className="min-h-10 min-w-10 text-muted-foreground"
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>

            <div className="mb-6">
              <RoleBadgePill role={newRole} label={copy.pillLabel} />
            </div>

            <h2
              id={titleId}
              className="text-balance font-semibold text-2xl tracking-tight"
            >
              {copy.title}
            </h2>
            <p
              id={descriptionId}
              className="mt-1 text-balance font-semibold text-foreground text-xl tracking-tight"
            >
              {copy.headline}
            </p>
            {copy.subtext ? (
              <p className="mt-3 max-w-prose text-pretty text-muted-foreground text-sm leading-relaxed">
                {copy.subtext}
              </p>
            ) : null}

            <div className="mt-7 flex w-full flex-col items-center gap-2">
              <Button
                type="button"
                variant="default"
                size="pill"
                onClick={handleDismiss}
                className="min-h-11 w-full max-w-xs rounded-full bg-foreground font-semibold text-background"
              >
                Got it
              </Button>
              {copy.showStaffPanelCta ? (
                <Link
                  href="/staff"
                  onClick={handleDismiss}
                  className="inline-flex min-h-9 items-center rounded-full px-3 py-1 font-medium text-muted-foreground text-sm underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  Open staff panel
                </Link>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
```

- [ ] **Step 3: Typecheck**

Run from repo root (in-app tsc is a decoy):
`./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit 2>&1 | rg "role-change-dialog|role-badge-pill"`
Expected: no output. If `size="icon-pill"`/`size="pill"` or `APP_MODAL_OVERLAY_CLASS` import paths differ, fix to match `apps/web/src/components/app/whats-new-dialog.tsx` (the reference uses exactly these).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/staff/role-badge-pill.tsx apps/web/src/components/staff/role-change-dialog.tsx
git commit -m "feat(web): add role-change dialog and role pill"
```

---

## Task 6: Web — the host and app-shell mount

**Files:**
- Create: `apps/web/src/components/staff/role-change-dialog-root.tsx`
- Modify: `apps/web/src/components/app/app-shell.tsx`

- [ ] **Step 1: Create the host**

```tsx
// apps/web/src/components/staff/role-change-dialog-root.tsx
"use client";

import { useCallback, useEffect, useState } from "react";

import { RoleChangeDialog } from "@/components/staff/role-change-dialog";
import { api } from "@/lib/api";
import type { RoleChangeDirection } from "@/lib/role-change-dialog-copy";

const OPEN_DELAY_MS = 500;

type Pending = {
  id: string;
  direction: RoleChangeDirection;
  newRole: string;
};

/** Shows the role-change dialog once when the user has an unread role change. */
export function RoleChangeDialogRoot() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.api.notifications["role-change"].get();
        if (cancelled || res.error) return;
        const row = res.data?.notification;
        if (!row) return;
        const payload = (row.payload ?? {}) as Record<string, unknown>;
        const direction = payload.direction;
        const newRole = payload.newRole;
        if (
          (direction !== "promoted" && direction !== "demoted") ||
          typeof newRole !== "string"
        ) {
          return;
        }
        setPending({ id: row.id, direction, newRole });
        window.setTimeout(() => {
          if (!cancelled) setOpen(true);
        }, OPEN_DELAY_MS);
      } catch {
        // Non-fatal — it can surface next load.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    const id = pending?.id;
    if (id) {
      void api.api.notifications({ id }).read.post();
    }
  }, [pending]);

  if (!pending) return null;

  return (
    <RoleChangeDialog
      open={open}
      direction={pending.direction}
      newRole={pending.newRole}
      onDismiss={dismiss}
    />
  );
}
```

Note: verify the Eden accessor shapes against the codebase. The GET path segment
`role-change` contains a hyphen, so it must be bracket-indexed: `api.api.notifications["role-change"].get()`. The read mutation mirrors the existing call used by `staff-users-tab.tsx`/`notifications-list.tsx` (`POST /api/notifications/:id/read`) — confirm whether the project calls it as `api.api.notifications({ id }).read.post()` or via the `postNotificationRead` helper in `apps/web/src/lib/still-api-fetch.ts`, and use whichever the codebase already uses. If `postNotificationRead(id)` exists, prefer it.

- [ ] **Step 2: Mount it in app-shell**

In `apps/web/src/components/app/app-shell.tsx`, add the import near the other app imports:

```typescript
import { RoleChangeDialogRoot } from "@/components/staff/role-change-dialog-root";
```

and render it right after the existing `<WhatsNewDialogRoot userId={user.id} />` line:

```tsx
			<WhatsNewDialogRoot userId={user.id} />
			<RoleChangeDialogRoot />
```

- [ ] **Step 3: Typecheck**

Run from repo root:
`./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit 2>&1 | rg "role-change-dialog-root|app-shell"`
Expected: no output. If the Eden accessor shape is wrong, fix it against a real example (see note above), then re-run.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/staff/role-change-dialog-root.tsx apps/web/src/components/app/app-shell.tsx
git commit -m "feat(web): mount role-change dialog host in app shell"
```

---

## Task 7: Web — inbox icon for the new kind

**Files:**
- Modify: `apps/web/src/components/notifications/notifications-list.tsx`
- Modify: `apps/web/src/components/notifications/notifications-dropdown-panel.tsx`

- [ ] **Step 1: Add the icon to `notifications-list.tsx`**

In `apps/web/src/components/notifications/notifications-list.tsx`, add `ShieldCheck` to the
existing `lucide-react` import, and add a case at the TOP of `iconForKind` (before the
generic returns):

```typescript
	if (kind === "staff.role_changed") return ShieldCheck;
```

- [ ] **Step 2: Add the icon to `notifications-dropdown-panel.tsx`**

In `apps/web/src/components/notifications/notifications-dropdown-panel.tsx`, add `ShieldCheck`
to the `lucide-react` import and the same case at the top of its `iconForKind`:

```typescript
	if (kind === "staff.role_changed") return ShieldCheck;
```

- [ ] **Step 3: Typecheck**

Run from repo root:
`./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit 2>&1 | rg "notifications-list|notifications-dropdown-panel"`
Expected: no output.

Note: the role-change notification has no `payload.href`, so it renders as a non-navigational
inbox row (its `title`/`body` come from the server). This is intended — no href handling is
needed. (Verify `notificationPayloadHref`/`withNavigationHints` simply return undefined/no-href
for this kind, which they already do since there's no matching branch.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/notifications/notifications-list.tsx apps/web/src/components/notifications/notifications-dropdown-panel.tsx
git commit -m "feat(web): show an icon for role-change notifications in the inbox"
```

---

## Task 8: Verification pass

- [ ] **Step 1: Server tests**

Run: `cd apps/server && bun test`
Expected: PASS (existing 417 + new role-change-notification + notifications role-change tests; no regressions).

- [ ] **Step 2: Web copy tests**

Run: `cd apps/web && bun test src/lib/role-change-dialog-copy.test.ts`
Expected: PASS.

- [ ] **Step 3: Typecheck server + web (no new errors vs baseline)**

Run from repo root:
```
./node_modules/.bin/tsc -p apps/server/tsconfig.json --noEmit 2>&1 | rg "role-change|notifications\.ts|routes/staff"
./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit 2>&1 | rg "role-change|role-badge|staff-role-labels|app-shell|notifications-"
```
Expected: no output from either (no new errors in touched files). The repo has a known
baseline of unrelated tsc errors — ignore those.

- [ ] **Step 4: Final commit (if any fixups)**

```bash
git add -A
git commit -m "chore: role-change dialog verification fixups"
```

---

## Self-Review Notes (coverage map)

- Direction by rank (promoted/demoted/no-op) → Task 1 (`roleChangeDirection`).
- Always-delivered `staff.role_changed` notification, bypassing prefs → Task 1 (`notifyRoleChanged` direct insert).
- Fire on role change → Task 2 (hook in staff role endpoint).
- `GET /api/notifications/role-change` (latest unread or null) → Task 3.
- Dialog modeled on whats-new, role pill instead of avatar, two tones → Tasks 4 (copy) + 5 (pill + dialog).
- Host fetch + open + dismiss-marks-read, mounted in app-shell → Task 6.
- Inbox icon for the new kind (both list + dropdown) → Task 7.
- Inbox `readAt` as the single seen flag (dismiss reuses `POST /:id/read`) → Task 6.
- Copy per direction (promotion/demotion-to-staff/demotion-to-user) → Tasks 1 & 4 (tested).
- Verification → Task 8.

**Out of scope (per spec):** real-time/WebSocket delivery, notifying the acting owner, a preferences toggle, lateral/no-op changes.
