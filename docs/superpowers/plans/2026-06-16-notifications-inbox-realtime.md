# Global Notifications Inbox (Realtime Badge) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Inbox unread state updates live on all nav surfaces without opening the bell dropdown.

**Architecture:** `NotificationsInboxProvider` in `(app)` layout owns fetch, SSE invalidation, and 60s safety poll. UI surfaces consume `useNotificationsInbox()`.

**Tech Stack:** Next.js App Router, `@still/realtime` SSE, Eden `api.api.notifications`

**Spec:** [`docs/superpowers/specs/2026-06-16-notifications-inbox-realtime-design.md`](../specs/2026-06-16-notifications-inbox-realtime-design.md)

---

## Status: Shipped (2026-06-16)

- [x] `NotificationsInboxProvider` + poll helpers
- [x] `NotificationsBellMenu` shared dropdown
- [x] `HomeNotificationsMenu` refactor
- [x] `NotificationsBellCompact` on movie/TV detail + profile top bars
- [x] `MobileTabBar` unread dot on Inbox
- [x] `/notifications` live list via `NotificationsListLive`
- [x] Provider wraps `AppShell` (includes mobile tab bar)
- [x] Unit tests for poll helpers + existing live bridge test

## Env checklist

Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `apps/web/.env.local` (same values as `apps/server/.env`) for local SSE push.
