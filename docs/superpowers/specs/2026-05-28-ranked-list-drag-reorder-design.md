# Ranked List Drag Reorder Design

Date: 2026-05-28  
Status: Approved for planning  
Scope: Ranked list detail page drag-and-drop ordering

## Background and Motivation

Ranked lists currently display position labels but do not support direct reordering on the list detail page. Users expect to click and drag posters to set rank order quickly, especially for top-N style lists where placement is the core value.

This design adds direct drag reorder on ranked list detail pages with immediate persistence, optimistic UI, and undo support.

## Confirmed Product Decisions

- Reordering happens directly on `/lists/[id]` (not edit modal only).
- Reordering is allowed for list owners and collaborative editors.
- Save behavior is auto-save on drop plus undo toast.

## Goals

- Make ranked list ordering feel immediate and tactile.
- Persist ranking changes without requiring an explicit save button.
- Provide a safe rollback path via undo and failure rollback.
- Preserve existing non-ranked and read-only list behavior.

## Non-Goals

- Keyboard-first sortable interactions in this phase.
- Reordering for non-ranked lists.
- Changes to list lobby ordering or list creation flows.
- New moderation or permissions model.

## User Experience

### Entry Conditions

Drag reorder UI is enabled only when all are true:

- `isRanked === true`
- user is signed in
- user can edit (`owner || isCollaborative`)

Otherwise, the existing static poster grid remains unchanged.

### Interaction Model

- User presses and drags a poster tile.
- Nearby tiles animate into preview positions while dragging.
- On drop, the local order updates immediately (optimistic update).
- A save request starts automatically.
- On success, show a subtle toast: `Ranking updated` with `Undo`.
- On undo, previous order is restored locally and persisted to server.

### Failure Handling

- If save fails, UI reverts to the previous order automatically.
- Error toast appears with concise copy (for example: `Couldn’t update ranking`).
- Additional drag attempts are blocked while a reorder request is in flight.

## Technical Design

## API Changes (Server)

Add a new endpoint in `apps/server/src/routes/lists.ts`:

- `POST /api/lists/:id/reorder`

Request body:

- `itemIds: string[]` representing complete ordered `listItem.id` sequence

Server behavior:

- Authenticate user.
- Check edit permission using existing policy (`owner || isCollaborative`).
- Reject favorites system list.
- Validate all provided item ids belong to `:id` and cover the exact current item set.
- Update `position` in one transaction with normalized 0..N-1 ordering.
- Return canonical ordered list items (or the updated list payload subset needed by web).

Validation rules:

- Empty arrays are allowed only if the list has no items.
- Duplicates are rejected.
- Partial sets are rejected.
- Unknown item ids are rejected.

## Web Changes

### Fetch Helper

In `apps/web/src/lib/still-api-fetch.ts`, add:

- `postListReorder(listId: string, itemIds: string[])`

Helper contract:

- `POST` JSON body to `/api/lists/:id/reorder`
- return `{ ok, status, data, error }` in the same shape style used by existing mutation helpers

### Component Structure

- Keep `ListDetailFilmsGrid` as presentational static grid.
- Add a client component for sortable ranked mode (for example `RankedListReorderGrid`).
- In `apps/web/src/app/(app)/lists/[id]/page.tsx`, choose between static grid and reorder grid using editability + ranked gating.

### Reorder State

Client state requirements:

- `rows`: current optimistic order
- `isSaving`: mutation in flight guard
- `previousOrderRef`: last committed order for undo and rollback
- `pendingUndoToken` or equivalent guard to avoid stale undo actions

Drop flow:

1. Compute next order.
2. Set optimistic UI.
3. Persist via `postListReorder`.
4. On success, update committed snapshot and show undo toast.
5. On error, restore committed snapshot and show error toast.

Undo flow:

1. Restore previous snapshot locally.
2. Persist previous snapshot via `postListReorder`.
3. If undo persistence fails, return to latest server-known snapshot and show error toast.

## Data Integrity and Concurrency

- Server canonicalizes positions after each reorder.
- Client sends full order arrays to avoid index drift.
- While saving, additional drags are ignored to avoid race collisions.
- If server returns canonical order differing from client expectation, client adopts server order.

## Accessibility and Input

Phase 1:

- Pointer drag interaction only.
- Preserve click-to-open poster behavior when user is not dragging.
- Ensure draggable surfaces maintain adequate hit area and visible motion cues.

Phase 2 (future):

- Keyboard reorder shortcuts and aria-live announcements.

## Testing Strategy

## Server Tests

- allows reorder for owner
- allows reorder for collaborative editor
- rejects unauthorized user
- rejects favorites system list
- rejects partial/duplicate/foreign item ids
- persists deterministic normalized positions

## Web Tests

- ranked editable list renders reorder grid
- non-ranked or read-only lists render static grid
- drop triggers optimistic reorder and API call
- failed save rolls UI back
- undo restores previous order and persists it

## Rollout Plan

1. Ship API endpoint + tests.
2. Ship web reorder UI behind existing permission/ranked gates.
3. Verify on owner and collaborative accounts.
4. Validate non-ranked and read-only list pages remain unchanged.

## Success Criteria

- Users can drag posters on ranked list pages to reorder rank.
- New order persists on refresh.
- Undo works from toast after a successful reorder.
- Unauthorized users cannot reorder.
- Non-ranked list detail pages retain current behavior.

## Risks and Mitigations

- Risk: drag gesture conflicts with click navigation.  
  Mitigation: movement threshold before drag activation; normal click if no drag delta.

- Risk: fast repeated drags create race conditions.  
  Mitigation: in-flight save guard plus canonical server response adoption.

- Risk: mixed movie/TV rows produce unstable keys.  
  Mitigation: use stable `listItem.id` for draggable identity and persisted order.
