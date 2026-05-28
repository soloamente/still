# Ranked List Drag Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable direct drag-and-drop ranking on ranked list detail pages, with auto-save on drop, undo support, and strict server-side permission/data validation.

**Architecture:** Add a dedicated bulk reorder API (`POST /api/lists/:id/reorder`) that accepts full ordered `listItem.id` arrays and persists canonical positions transactionally. On the web side, render a sortable client grid only for ranked+editable lists, apply optimistic updates on drop, auto-save immediately, and expose undo that restores and re-persists the previous snapshot.

**Tech Stack:** Elysia routes + Drizzle transactions (`apps/server`), Next.js client components (`apps/web`), fetch mutation helpers, Vitest tests, Bun build/test commands.

**Spec:** `docs/superpowers/specs/2026-05-28-ranked-list-drag-reorder-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/server/src/routes/lists.ts` | Add reorder endpoint, auth/permission checks, payload validation, transactional position updates |
| `apps/server/src/routes/lists.test.ts` (or existing route test file) | Endpoint tests for auth/validation/position persistence |
| `apps/web/src/lib/still-api-fetch.ts` | `postListReorder(listId, itemIds)` helper |
| `apps/web/src/components/list/ranked-list-reorder-grid.tsx` | Client sortable ranked grid with optimistic save + undo |
| `apps/web/src/components/list/list-detail-films-grid.tsx` | Keep static presentation path unchanged |
| `apps/web/src/app/(app)/lists/[id]/page.tsx` | Gate and render reorder vs static grid |
| `apps/web/src/components/list/ranked-list-reorder-grid.test.tsx` (or nearest test target) | UI mutation/rollback/undo behavior tests |

---

### Task 1: Server API contract and validation (TDD)

**Files:**
- Modify: `apps/server/src/routes/lists.ts`
- Test: `apps/server/src/routes/lists.test.ts` (or repo-equivalent route test file)

- [ ] **Step 1: Write failing server tests for `/api/lists/:id/reorder`**

Test cases:
- owner can reorder
- collaborative editor can reorder
- unauthorized user is rejected
- favorites system list is rejected
- duplicate ids rejected
- partial id set rejected
- foreign id rejected

- [ ] **Step 2: Run tests to verify failures**

Run: `cd apps/server && bun test src/routes/lists.test.ts`

Expected: FAIL for missing route/handler behavior.

- [ ] **Step 3: Add typed route body and endpoint**

```ts
type ReorderListItemsBody = { itemIds: string[] };

.post(
  "/:id/reorder",
  async ({ params, body: rawBody, user, status }) => {
    // auth + permission + favorites guard + validation + transaction
  },
  {
    params: t.Object({ id: t.String() }),
    body: t.Object({ itemIds: t.Array(t.String()) }),
  },
)
```

- [ ] **Step 4: Implement strict payload validation**

Rules:
- `itemIds` must match exact list item set for `listId`
- no duplicates
- no unknown ids
- empty allowed only if list has no items

- [ ] **Step 5: Run tests to verify pass**

Run: `cd apps/server && bun test src/routes/lists.test.ts`

Expected: PASS for all new reorder tests.

---

### Task 2: Transactional position persistence

**Files:**
- Modify: `apps/server/src/routes/lists.ts`

- [ ] **Step 1: Implement transactional update**

Transaction logic:
1. Load current items for `listId`.
2. Validate full set against `itemIds`.
3. Update each `listItem.position` to index in `itemIds`.
4. Return canonical ordered items by `position ASC, addedAt ASC`.

- [ ] **Step 2: Keep position normalization deterministic**

Set positions to `0..N-1` exactly, no sparse or duplicate positions.

- [ ] **Step 3: Add inline error logging context**

If transaction throws, log `[lists/reorder]` plus `listId` and caller `user.id` to aid debugging.

- [ ] **Step 4: Re-run route tests**

Run: `cd apps/server && bun test src/routes/lists.test.ts`

Expected: PASS; deterministic order assertions hold.

---

### Task 3: Web fetch helper for reorder mutation

**Files:**
- Modify: `apps/web/src/lib/still-api-fetch.ts`

- [ ] **Step 1: Add helper with existing mutation return shape**

```ts
export async function postListReorder(listId: string, itemIds: string[]) {
  const response = await fetch(
    new URL(`/api/lists/${encodeURIComponent(listId)}/reorder`, stillApiOrigin()),
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ itemIds }),
    },
  );
  const data = await parseJsonBlob(response);
  return {
    ok: response.ok,
    status: response.status,
    data: response.ok ? data : null,
    error: response.ok ? null : { status: response.status, raw: data },
  };
}
```

- [ ] **Step 2: Add short helper comment explaining endpoint contract**

- [ ] **Step 3: Typecheck web package**

Run: `cd apps/web && bun run check-types`

Expected: PASS.

---

### Task 4: Client reorder component (pointer drag only, phase 1)

**Files:**
- Create: `apps/web/src/components/list/ranked-list-reorder-grid.tsx`
- Modify: `apps/web/src/components/list/list-detail-films-grid.tsx` (only shared display props if needed)

- [ ] **Step 1: Write failing UI tests for reorder behavior**

Coverage:
- optimistic order changes on drop
- mutation called with full `itemIds` array
- failed mutation rolls back
- undo restores previous order and re-saves

- [ ] **Step 2: Run tests to verify failure**

Run: `cd apps/web && bun test src/components/list/ranked-list-reorder-grid.test.tsx`

Expected: FAIL because component does not exist yet.

- [ ] **Step 3: Implement sortable grid with stable draggable ids**

Use `listItem.id` as drag identity (never tmdb id/index).  
Keep poster tile visuals consistent with existing list detail grid.

- [ ] **Step 4: Implement optimistic save + in-flight lock**

State:
- `rows`
- `isSaving`
- `previousCommittedRowsRef`

Flow:
- reorder locally on drop
- call `postListReorder`
- rollback on error
- ignore drag while save in-flight

- [ ] **Step 5: Implement undo toast path**

On successful save:
- show `Ranking updated` toast with `Undo`
- undo resets `rows` to previous snapshot and re-calls `postListReorder`

- [ ] **Step 6: Re-run UI tests**

Run: `cd apps/web && bun test src/components/list/ranked-list-reorder-grid.test.tsx`

Expected: PASS.

---

### Task 5: Wire list detail page gating and render path

**Files:**
- Modify: `apps/web/src/app/(app)/lists/[id]/page.tsx`

- [ ] **Step 1: Derive `canReorderRankedList` gate**

`canReorderRankedList = data.isRanked && !!session?.user?.id && (isOwner || data.isCollaborative)`

- [ ] **Step 2: Render reorder component only under gate**

Branch:
- `canReorderRankedList` -> `RankedListReorderGrid`
- else -> existing `ListDetailFilmsGrid`

- [ ] **Step 3: Preserve non-ranked/read-only output**

Keep section titles/subtitles and static layout unchanged when gate is false.

- [ ] **Step 4: Run focused page tests (or nearest integration tests)**

Run: `cd apps/web && bun test src/app/(app)/lists/[id]/page.test.tsx`

Expected: PASS (or create minimal test coverage for branch selection if absent).

---

### Task 6: End-to-end verification commands

**Files:**
- Modify (if needed): test files touched in prior tasks

- [ ] **Step 1: Server tests**

Run: `cd apps/server && bun test src/routes/lists.test.ts`

Expected: PASS.

- [ ] **Step 2: Web tests**

Run: `cd apps/web && bun test src/components/list/ranked-list-reorder-grid.test.tsx`

Expected: PASS.

- [ ] **Step 3: Web build**

Run: `cd apps/web && bun run build`

Expected: PASS.  
If stale route typing appears, clear `.next` and retry per workspace guidance.

---

### Task 7: Manual QA checklist (human)

- [ ] Open a ranked list you own, drag a poster, confirm order updates immediately.
- [ ] Refresh page; confirm new order persists.
- [ ] Use undo toast; confirm order returns and persists after refresh.
- [ ] Trigger a forced API failure path (dev tools/network off), confirm rollback + error toast.
- [ ] Open same list as unauthorized viewer; confirm drag is unavailable.
- [ ] Open non-ranked list; confirm original static grid behavior is unchanged.

---

## Plan self-review (spec coverage)

| Spec requirement | Task |
|------------------|------|
| Direct drag on list detail page | 4, 5 |
| Owner + collaborator permission | 1, 5 |
| Auto-save on drop | 4 |
| Undo after save | 4 |
| Rollback on error | 4 |
| Bulk reorder API | 1, 2, 3 |
| Validation of exact item set | 1, 2 |
| Non-ranked/read-only unchanged | 5, 7 |
| Test coverage and verification | 1, 4, 6, 7 |

No placeholders remain.

---

## Executor handoff

Execute one task at a time. After each completed task, update `.cursor/scratchpad.md` Project Status Board and request human verification before advancing.
