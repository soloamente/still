# Mobile Bottom Navbar — Design

**Date:** 2026-06-04
**Status:** Approved design, pending implementation plan
**App:** `apps/web` (Next.js)

## Context

The web app's navigation today is **top-anchored**: `HomeStickyChrome` on the
lobby pages (`/home`, `/diary`, `/lists`, `/watchlist`) and per-page top bars
elsewhere (profile, movie/list detail, achievements, notifications, news,
settings). A floating bottom-bar component (`AppNav`, `src/components/app/app-nav.tsx`)
exists but is **dead code** — it is never rendered (only referenced in comments;
its docstring in `app-shell.tsx` is stale).

On a phone, top-anchored nav is hard to reach one-handed, and logging a film —
the core daily action — has no prominent entry point. This adds a **phone-only
bottom tab bar** with an elevated center **Log** button, while leaving the
desktop experience completely unchanged.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Tabs | Home · Search · **＋Log** · Inbox · You | Utility-first; mirrors the native app being built; keeps the bar to durable destinations. |
| Breakpoint | Mobile bar `< md` (768px); desktop chrome `≥ md` | Thumb bar for phones + small tablets; desktop untouched. |
| Center button | Opens the existing quick-log sheet (`useQuickLog().open()`) | The sheet already has a search-first "what did you watch?" mode — no new logging flow needed. |
| "You" tab | Opens a hub **bottom sheet** | One tap to every long-tail destination (diary, watchlist, lists, news, chat, achievements, settings, profile, theme, sign out). |
| "Inbox" tab | `/notifications` only | Simplest, non-breaking; chat lives in the You hub. |
| Integration | New self-contained component, `md:hidden`; delete dead `AppNav` | Zero risk to desktop; removes the stale component it replaces. |

## Scope

**In scope**
- New `MobileTabBar` (5 slots + elevated center Log), mounted globally, `< md` only.
- New `MobileYouSheet` (hub bottom sheet) for long-tail destinations.
- Trim redundant global icons from `HomeStickyChrome` on mobile only (`md:` restores them on desktop).
- Bump mobile bottom content padding so the fixed bar never overlaps content.
- Delete dead `AppNav`; refresh the stale `AppShell` navigation docstring.

**Out of scope**
- Any desktop (`≥ md`) layout or behavior change.
- A combined notifications+chat "inbox" screen (Inbox = `/notifications`).
- New logging UI (reuse the existing quick-log sheet).
- Changing per-page top bars (movie/profile/etc.) — they stay as-is on all sizes.

## Architecture

```
apps/web/src/components/app/
  mobile-tab-bar.tsx        # CREATE — bottom bar: 5 slots + elevated center Log
  mobile-you-sheet.tsx      # CREATE — "You" hub bottom sheet
  app-shell.tsx             # MODIFY — mount <MobileTabBar/>; refresh docstring
  app-nav.tsx               # DELETE — dead code (NavUserAvatar moves, see below)
  home-sticky-chrome.tsx    # (in components/home/) MODIFY — hide global cluster < md
```

- **`NavUserAvatar`** currently lives in `app-nav.tsx` and is imported by
  `home-sticky-chrome.tsx`. Before deleting `app-nav.tsx`, move `NavUserAvatar`
  to a small shared module (e.g. `src/components/app/nav-user-avatar.tsx`) and
  update its importers, so deleting `AppNav` breaks nothing.

## MobileTabBar — detail

- Floating pill, bottom-anchored, matching `design.md` floating-pill chrome and
  Aker tokens (reuse the classes the dead `AppNav` used):
  `bg-surface-raised/72`, `backdrop-blur-xl`, `border border-white/6`,
  `rounded-full`, `shadow-[0_10px_36px_rgba(6,6,10,0.42)]`.
- `pointer-events-none` fixed wrapper + `pointer-events-auto` pill; `md:hidden`.
- Safe-area aware: `mb-[max(0.75rem,env(safe-area-inset-bottom))]`.
- **Slots:**
  - **Home** — `Link` to `/home`.
  - **Search** — button calling `useCatalogSearchDialog().requestOpen()` (same dialog as ⌘K).
  - **＋Log (center, elevated)** — accent circle (`bg-accent`, negative top margin
    lift, accent glow shadow), log glyph, `aria-label="Log a film"`. Tapping calls
    `useQuickLog.getState().open()`.
  - **Inbox** — `Link` to `/notifications`.
  - **You** — button opening `MobileYouSheet`.
- Each non-center tab: icon + 10px label, `min-h-11 min-w-11` tap target.
- Active state reuses the AppNav pattern: `nav-active-pip` accent indicator
  (`layoutId`) + `text-foreground` when active, else `text-muted-foreground`.
- Active matcher (extract as a pure function for testing):
  `isActive(pathname, href) = pathname === href || (href !== "/home" && pathname.startsWith(href + "/"))`.

## MobileYouSheet — detail

- Bottom sheet built with `motion/react`, following the existing
  `patron-watch-ledger-drawer` / `quick-log-sheet` pattern (no generic Drawer
  primitive exists in `@still/ui`). Backdrop + slide-up panel, close on backdrop
  tap and `Esc`, focus moved into the sheet on open and restored on close,
  `motion-reduce` respected.
- Contents (reuse `accountMenuItemClassName` rhythm and `AccountMenuThemePicker`):
  - Identity header (avatar, name, `@handle`) + **View profile** → `/profile/[handle]`.
  - Destinations not in the bar: **Diary, Watchlist, Lists, News, Chat, Achievements**.
  - **Settings** (`/me/settings`), theme picker, **Log out** (`authClient`).
- Destination list defined as a typed array (testable).

## HomeStickyChrome trim (mobile only)

- Hide the right-side global cluster — watchlist/lists/diary shortcut links, the
  notifications bell, and the account avatar/menu — with `hidden md:flex` (or
  equivalent) so they only show `≥ md`. The bottom bar owns these on mobile.
- **Keep** on mobile: the browse tabs (Movies/TV/Community) and the search field —
  these are lobby controls, not global nav.
- Desktop (`≥ md`) rendering is byte-for-byte unchanged.

## Spacing / overlap

- The fixed bar must never cover content or empty-states. Add mobile-only bottom
  padding that clears the bar height + safe area on the scroll container
  (`#main-content` or the app content wrapper), e.g. a `pb-[…] md:pb-0` utility
  sized to the pill height + `env(safe-area-inset-bottom)`. Desktop reserve
  (current 10px) is unchanged.

## Error / edge handling

- No threads/notifications/etc. is irrelevant to the bar (pure navigation).
- `useQuickLog().open()` with no args is already the supported "log anything"
  entry point; if it ever fails the sheet owns its own error UI.
- Reduced motion: active-pip and sheet transitions honor `useReducedMotion`.

## Testing

- **Unit (`bun:test`, pure functions):** the `isActive` route matcher (home vs
  prefixed routes vs unrelated) and the You-hub destination list shape.
- **Manual / preview verification:** at 375px — bar visible, center Log opens the
  quick-log sheet, Search opens the catalog dialog, Inbox routes to
  `/notifications`, You opens the hub with all destinations, no content overlap;
  at ≥768px — bar hidden, `HomeStickyChrome` and all desktop chrome identical to
  before. Use the running web preview (same loop as the responsiveness pass).

## Open considerations (non-blocking)

- Exact pill height / center-button lift values — tune visually in preview.
- Whether the active-pip `layoutId` should be shared with the desktop nav (it is
  not, since desktop nav is the top chrome — keep a distinct `layoutId`).
