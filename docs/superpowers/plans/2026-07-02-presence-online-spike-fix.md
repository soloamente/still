# Presence `/online` spike fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the `PatronOnlineProvider` feedback loop that caused runaway `GET /api/realtime/presence/online` polling, with a server rate limit safety net.

**Architecture:** Store presence in a ref with a version counter for portrait re-renders; keep context callbacks stable; coalesce in-flight fetches; shallow-compare snapshots before bumping version; rate-limit GET `/online` at 12/min/user.

**Tech Stack:** React 19, Bun test, Elysia, existing `hit()` rate limiter

**Spec:** [`docs/superpowers/specs/2026-07-02-presence-online-spike-fix-design.md`](../specs/2026-07-02-presence-online-spike-fix-design.md)

---

### Task 1: Presence snapshot equality helper

**Files:**
- Modify: `apps/web/src/lib/patron-online-presence.ts`
- Create: `apps/web/src/lib/patron-online-presence.test.ts`

- [ ] **Step 1: Write failing tests** for `arePatronPresenceMapsEqual`
- [ ] **Step 2: Implement helper**
- [ ] **Step 3: Run** `bun test apps/web/src/lib/patron-online-presence.test.ts`

### Task 2: Coalesced refresh scheduler

**Files:**
- Create: `apps/web/src/lib/patron-online-refresh-scheduler.ts`
- Create: `apps/web/src/lib/patron-online-refresh-scheduler.test.ts`

- [ ] **Step 1: Write failing tests** for in-flight dedupe + trailing pending run
- [ ] **Step 2: Implement** `createPatronOnlineRefreshScheduler`
- [ ] **Step 3: Run** `bun test apps/web/src/lib/patron-online-refresh-scheduler.test.ts`

### Task 3: PatronOnlineProvider loop fix

**Files:**
- Modify: `apps/web/src/components/realtime/patron-online-provider.tsx`

- [ ] **Step 1:** Ref + version pattern; stable `getPresenceState` / `registerHandle`
- [ ] **Step 2:** Wire refresh scheduler; remove heartbeat + queueMicrotask storms
- [ ] **Step 3:** Split version context for portrait hooks; fix effect deps

### Task 4: Server rate limit

**Files:**
- Modify: `apps/server/src/routes/realtime-presence.ts`
- Modify: `apps/server/src/routes/realtime-presence.test.ts`

- [ ] **Step 1: Write failing test** for 429 on GET `/online`
- [ ] **Step 2: Add** `hit(\`presence-online:${user.id}\`, { limit: 12, windowMs: 60_000 })`
- [ ] **Step 3: Run** `bun test apps/server/src/routes/realtime-presence.test.ts`

### Task 5: Verify

- [ ] Run targeted test files
- [ ] `graphify update .`
