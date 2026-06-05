# What's New Dialog — Design

**Date:** 2026-06-05  
**Status:** Approved  
**App:** `apps/web` (Next.js)

## Context

Sense ships frequent UI and feature updates. Patrons who are already signed in
should see a **one-time per release** carousel dialog when they enter the
authenticated app — not on the marketing landing page or auth routes.

Reference: Cursor-style update modal — hero headline, short copy, optional
preview image, primary CTA; adapted to Sense tokens (`bg-card`, flat surfaces,
no borders/rings).

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Audience | Signed-in patrons only | `(app)/layout` already requires session; no value for signed-out |
| Surface | `(app)` routes via `AppShell` | Excludes `/`, `/sign-in`, `/onboarding` |
| Content source | In-repo manifest (`whats-new-releases.ts`) | Type-safe, reviewable, no network |
| Release bump | Manual `release.id` string | Control exactly when dialog changes |
| Persistence | `localStorage` keyed by `userId` | No migration; one key per patron |
| Layout | Multi-slide carousel; **same hero layout every slide** | Title, 1–2 sentences, optional image, optional CTA |
| Motion | `transitions-dev` modal tokens + motion slide cross-fade | Matches existing dialogs; reduced-motion safe |
| Delay | ~400ms after mount | Lets lobby paint first |

## Content model

```ts
type WhatsNewSlide = {
  title: string;
  description: string;
  image?: { src: string; alt: string };
  cta?: { label: string; href: string };
};

type WhatsNewRelease = {
  id: string;
  slides: WhatsNewSlide[];
};
```

Bump `id` when shipping new dialog copy. If `slides` is empty, dialog is disabled.

## UI

- Centered modal: `max-w-lg sm:max-w-xl`, `rounded-[2rem]`, `bg-card`, `APP_MODAL_OVERLAY_CLASS` scrim.
- Per slide: optional image (`rounded-xl`, subtle outline), `text-balance` title, `text-pretty` body, optional inverted CTA pill.
- Chrome: ghost **X** (40×40), dot stepper, **Back** / **Next** / **Got it** on last slide.
- Dismiss + mark seen: close button, **Got it**, or CTA navigation.

## Files

| File | Role |
|------|------|
| `lib/whats-new-releases.ts` | Current release manifest |
| `lib/whats-new-seen.ts` | localStorage helpers |
| `components/app/whats-new-dialog.tsx` | Carousel modal |
| `components/app/whats-new-dialog-root.tsx` | Eligibility + delay |
| `components/app/app-shell.tsx` | Mount root |
| `packages/ui/src/styles/globals.css` | `.t-modal` + `--modal-*` tokens |

## Out of scope (v1)

- Server-side persistence / cross-device sync
- Settings “show again”
- Admin UI or remote CMS
- Signed-out or landing-page display

## Test plan

1. Signed in → visit `/home` → dialog appears once after brief delay.
2. Close or complete carousel → refresh → no dialog.
3. Bump `release.id` in manifest → dialog appears again.
4. `prefers-reduced-motion: reduce` → no slide blur/translate.
5. Landing `/` with session redirects to `/home` — dialog only in app shell.
