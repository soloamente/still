# Presence Online Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add online-now badges to listing presence (row + drawer) with a dedicated privacy setting that defaults to friends-only.

**Architecture:** Keep existing Redis heartbeat + SSE presence transport. Add a dedicated preference key (`preferences.privacy.presenceVisibility`) and perform server-side filtering so only eligible patrons are returned as identified rows. UI renders a compact green-dot indicator from the filtered snapshot payload.

**Tech Stack:** Elysia routes/libs, Drizzle + profile/follow data, Next.js App Router, React client components, Bun tests.

---

### Task 1: Presence visibility preference contract

**Files:**
- Modify: `packages/env/src/server.ts`
- Modify: `packages/env/src/web.ts`
- Modify: `apps/server/src/lib/profile-media.ts` (or existing preference helpers file if more appropriate)
- Test: `apps/server/src/lib/profile-media.test.ts` (or equivalent preference-helper test file)

**Step 1: Write the failing test**

- Add tests that assert:
  - missing `preferences.privacy.presenceVisibility` resolves to `"friends"`
  - explicit `"public"` resolves to `"public"`
  - invalid value falls back to `"friends"`

**Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/lib/profile-media.test.ts`  
Expected: FAIL for missing parser/default logic.

**Step 3: Write minimal implementation**

- Add a typed resolver for presence visibility (friends/public + default fallback).
- Keep the helper pure and reusable by routes/queries.

**Step 4: Run test to verify it passes**

Run: `cd apps/server && bun test src/lib/profile-media.test.ts`  
Expected: PASS.

---

### Task 2: Server snapshot filtering by visibility

**Files:**
- Modify: `apps/server/src/lib/listing-presence.ts`
- Test: `apps/server/src/lib/listing-presence.test.ts`

**Step 1: Write the failing test**

- Add tests covering:
  - `friends` visibility returns identified patron only to mutual/friend viewer
  - `public` visibility returns identified patron to non-friend viewer
  - non-eligible viewer still sees count-only behavior

**Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/lib/listing-presence.test.ts`  
Expected: FAIL on missing preference-based filter.

**Step 3: Write minimal implementation**

- Extend snapshot query logic to read each active patron’s presence visibility.
- Filter `viewingPatrons` server-side based on relation + visibility setting.
- Add `isOnlineNow: true` to returned patron rows (additive field).

**Step 4: Run test to verify it passes**

Run: `cd apps/server && bun test src/lib/listing-presence.test.ts`  
Expected: PASS.

---

### Task 3: Presence API contract coverage

**Files:**
- Modify: `apps/server/src/routes/realtime-presence.ts`
- Test: `apps/server/src/routes/realtime-presence.test.ts`

**Step 1: Write the failing test**

- Add route tests that verify response filtering behavior for friends/public visibility scenarios.

**Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/routes/realtime-presence.test.ts`  
Expected: FAIL due to outdated snapshot payload/logic.

**Step 3: Write minimal implementation**

- Ensure `GET /api/realtime/presence` returns filtered patron rows with `isOnlineNow`.
- Keep POST/DELETE behavior unchanged.

**Step 4: Run test to verify it passes**

Run: `cd apps/server && bun test src/routes/realtime-presence.test.ts`  
Expected: PASS.

---

### Task 4: Settings Privacy control

**Files:**
- Modify: `apps/web/src/app/(app)/me/settings/data/page.tsx` (if privacy settings are elsewhere, use the existing privacy route/component)
- Modify: existing settings form + save action files used by privacy controls
- Test: relevant settings tests (or add focused unit test where coverage exists)

**Step 1: Write the failing test**

- Add/extend test for privacy settings payload to include `presenceVisibility`.
- Assert default UI selection is Friends only.

**Step 2: Run test to verify it fails**

Run: targeted settings test command for this area.  
Expected: FAIL because control/persistence is not wired.

**Step 3: Write minimal implementation**

- Add Privacy UI control:
  - Label: `Who can see when I’m online on title pages?`
  - Options: `Friends only`, `Public`
- Persist to `preferences.privacy.presenceVisibility`.

**Step 4: Run test to verify it passes**

Run: targeted settings test command for this area.  
Expected: PASS.

---

### Task 5: Row + drawer online badges

**Files:**
- Modify: `apps/web/src/components/movie/listing-presence-row.tsx`
- Modify: `apps/web/src/components/movie/movie-detail-engagement-drawer-rows.tsx` (or the drawer row file that renders presence patrons)
- Modify: `apps/web/src/lib/fetch-listing-presence.ts`
- Test: `apps/web/src/lib/listing-presence-copy.test.ts` and/or component tests for presence row/drawer

**Step 1: Write the failing test**

- Add component tests for:
  - green dot shown for patrons marked online
  - screen-reader text includes online-now context
  - both row and drawer render status marker

**Step 2: Run test to verify it fails**

Run: targeted web tests for presence row/drawer.  
Expected: FAIL because badge rendering doesn’t exist.

**Step 3: Write minimal implementation**

- Extend typed presence patron model with `isOnlineNow`.
- Render small green dot on patron avatars in:
  - compact presence row
  - drawer rows
- Add `sr-only` text for accessibility.

**Step 4: Run test to verify it passes**

Run: targeted web tests for presence row/drawer.  
Expected: PASS.

---

### Task 6: End-to-end verification and docs updates

**Files:**
- Modify: `.cursor/scratchpad.md`
- Modify: `AGENTS.md`
- Optional: `docs/superpowers/specs/2026-06-16-presence-online-visibility-design.md` (only if wording needs correction post-implementation)

**Step 1: Run full relevant tests**

Run:
- `cd apps/server && bun test src/lib/listing-presence.test.ts src/routes/realtime-presence.test.ts`
- `cd apps/web && bun test` (or targeted test set used in this repo for presence components)

Expected: PASS.

**Step 2: Manual QA pass**

- Verify friends-only default behavior across two accounts.
- Verify switching to public exposes identified online badges to non-friend viewer.
- Verify count-only fallback still works when identity is not eligible.

**Step 3: Update project tracking docs**

- Mark plan progress in scratchpad.
- Add concise implementation note to AGENTS learnings/state if needed.

---

## Manual QA checklist

1. Account A + Account B are friends/mutuals, both on same title: A sees B with green dot.
2. Account C (not friend) on same title:
   - B set to Friends only: C does not see B identity badge.
   - B set to Public: C sees B identity badge.
3. Drawer rows and compact row both show matching online-dot behavior.
4. Changing setting in Privacy takes effect on subsequent snapshot refresh without app restart.
5. Signed-out behavior remains unchanged (no identified presence).
