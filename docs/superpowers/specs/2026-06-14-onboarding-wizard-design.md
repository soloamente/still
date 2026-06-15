# Sense — Animated onboarding wizard design

**Status:** Plan ready — see `docs/superpowers/plans/2026-06-14-onboarding-wizard.md` (2026-06-14)  
**Date:** 2026-06-14  
**Parent:** [2026-05-29-sense-product-roadmap-design.md](./2026-05-29-sense-product-roadmap-design.md) (Section 14 — Onboarding v2)  
**Approach:** **1 — Single animated wizard on `/onboarding`**  
**Reference:** External flashcard-app onboarding shell (step transitions, `useMeasure` height spring, live profile preview) adapted for Sense taste seeding.

## Summary

Replace the current minimal onboarding v2 (`taste → bio → favorites → done`) with a **full identity wizard** plus **taste seeding after identity**, using the reference project’s motion system and live profile preview. Sign-up slimmed to **email + password only**; handle and display name move into onboarding.

**North star:** A new patron finishes onboarding feeling “this profile is actually me” — with a seeded taste signature before first `/home` visit — without being forced to rate films they haven’t seen.

## Brainstorm decisions (locked)

| Topic | Decision |
|-------|----------|
| Structure | **B** — Full identity wizard in onboarding (not sign-up) |
| Taste placement | **A** — After identity: prompt → avatar → name → handle → bio → verify → quick-rate → favorites → done |
| Quick-rate UX | **A** — Editorial pool + **Haven’t seen** per title + search-added films; **≥8 rated** to continue |
| Email gate | Hard interstitial **before quick-rate** — ratings/logs require verified email (`assertEmailVerified` on public logs) |
| Implementation | **Approach 1** — Single `/onboarding` client wizard, subcomponents split by step |
| Motion | `motion/react` + `react-use-measure`; **200ms** cap; `useReducedMotion` → instant |
| Skip | Step 0 **Maybe later** → abbreviated name + handle only → `markOnboarded` → `/home` (no taste) |

## Goals

1. **Identity first** — Avatar, display name, `@handle`, bio with live miniature profile preview.
2. **Taste seeding** — ≥8 ratings from a mix of editorial pool and search; skipped titles don’t count.
3. **No bogus ratings** — Patrons never need to score films they haven’t watched.
4. **Verify before logs** — Email verification gate blocks taste steps until `emailVerified === true`.
5. **Motion parity** — Directional step slides, height spring, preview zoom/focus animations from reference code.
6. **Roadmap alignment** — Preserve onboarding v2 outcomes: diary logs, `favoriteMovieIds`, taste signature recompute, `onboarding.completed` event.

## Non-goals (v1)

- “Study goals” / generic intent chips from the reference app.
- Moving taste seeding to first `/home` session (deferred CTA).
- Split routes (`/onboarding/taste`) — single page only.
- Onboarding banner customization (Settings later).
- TV quick-rate in onboarding (films only, same as current v2 pool).

---

## 1. Flow, gates & sign-up

### Entry routes

| Stage | Route | Gate |
|-------|-------|------|
| Sign up | `/sign-up` | Email + password only |
| Sign in (no handle) | `/sign-in` → `/onboarding` | Same wizard |
| Onboarding | `/onboarding` | Session required; redirect `/home` if `onboardedAt` set |
| App shell | `(app)/layout` | Redirect `/onboarding` if `!profile.handle` |

### Sign-up change

**Before:** name + handle + email + password → `PATCH /api/profiles/me` bootstrap on success.  
**After:** email + password only → redirect `/onboarding` (no profile write). OAuth sign-up still pre-fills `displayName` from provider `session.user.name`.

### Wizard steps

| # | Step | Required | Notes |
|---|------|----------|-------|
| 0 | Welcome prompt | — | “Set up now” / “Maybe later” |
| 1 | Avatar | Optional | Stage file locally; upload at finish |
| 2 | Display name | Yes | Pre-fill OAuth / email name |
| 3 | Handle | Yes | Live `GET /api/profiles/check-handle/:handle` |
| 4 | Bio | Optional | Max 600 chars |
| — | **Email verification** | Yes (before taste) | Blocking interstitial if `!emailVerified` |
| 5 | Quick-rate | ≥8 rated | Pool + Haven’t seen + search |
| 6 | Favorites | ≥1 | Up to 8 `favoriteMovieIds` |
| 7 | Done | — | Taste headline + redirect `/home` |

### “Maybe later”

| From | Behavior |
|------|----------|
| Step 0 | Abbreviated path: **name → handle only** → `PATCH { handle, displayName, markOnboarded: true }` → `/home`. Skips avatar, bio, taste, favorites. |
| Steps 1–4 (optional) | Secondary “Finish later” link — same abbreviated finish when name + handle valid. |

Abbreviated path must still create `profile.handle` so `(app)/layout` gate passes.

### Email verification gate

- **Placement:** Between bio (step 4) and quick-rate (step 5).
- **Allowed without verify:** Identity steps 0–4, `PATCH /api/profiles/me` with private profile (handle, displayName, bio) per [2026-06-10-resend-auth-email-design.md](./2026-06-10-resend-auth-email-design.md).
- **Blocked without verify:** `POST /api/logs` when effective visibility is public; taste and favorites steps.
- **UI:** Resend (`authClient.sendVerificationEmail`, `callbackURL: "/onboarding"`), “I’ve verified” (`router.refresh()`), flat `bg-card` strip copy.
- **Defensive:** If `EMAIL_VERIFICATION_REQUIRED` on log POST, toast + return to verify step.

### Quick-rate rules

- Editorial pool: `ONBOARDING_QUICK_RATE_TMDB_IDS` (~12 titles), loaded via `GET /api/movies/:id`.
- Per title: score chips **6–10** (stored tenths via `logRatingToStored`) **or** **Haven’t seen** (excluded from count).
- Search adds titles to a “Rated” shelf with same controls.
- Continue when `ratedCount >= 8` (pool + search combined).
- Skipped pool titles remain visible but marked skipped.

---

## 2. Layout, motion & live preview

### Page shell

- **Outside `(app)`** — no `AppShell` / `MobileTabBar` (same as today).
- Full viewport `bg-background`; inner `bg-card rounded-3xl` panel.
- **Desktop (`lg+`):** Wizard left `w-[400px] shrink-0`; preview right (~640px card).
- **Mobile:** Single column; compact sticky preview strip (avatar + name + handle) above wizard; **hidden during taste step** (step 5).

### Motion (Track B.6)

| Mechanism | Detail |
|-----------|--------|
| Library | `motion/react` only — remove `framer-motion` import from onboarding |
| Step slide | `AnimatePresence mode="popLayout"`; variants `±110%` x + opacity |
| Height | `react-use-measure` on step ref → parent `motion.div` height spring |
| Duration | **200ms** default; **0ms** when `useReducedMotion()` |
| Dependency | Add `react-use-measure` to `apps/web` |

### Live preview panel

Read-only miniature profile card (not full `ProfilePatronHeader`):

- Banner gradient placeholder (accent `#c45c26` fallback).
- Portrait (staged avatar preview or skeleton).
- Display name + `@handle` with per-letter `motion.span` reveal.
- Bio block with “BIO” label stagger.
- Favorites poster row (step 6+).
- Taste signature headline (step 7).

**Per-step focus** (scale / translate on preview):

| Step | Preview focus |
|------|----------------|
| 0 | Skeleton profile, ~1.05 scale |
| 1 | Zoom portrait ~1.8× |
| 2 | Name full opacity, letter animation |
| 3 | Handle row emphasized |
| 4 | Bio block full opacity |
| 5 | Preview hidden — counter in wizard only |
| 6 | Favorites row animates in |
| 7 | Taste headline fade-in |

Desktop edge scrims: `bg-gradient-to-* from-card` (no borders/shadows on preview chrome).

### Taste step layout

- Grid `grid-cols-2 sm:grid-cols-3`: poster, title, score chips, **Haven’t seen**.
- Debounced search (`fetchMoviesSearch`, 220ms) — reuse current onboarding pattern.
- Horizontal “Rated” shelf for pool + search titles.
- `{ratedCount} / 8 rated` with `tabular-nums`.

### Component files

```
apps/web/src/components/onboarding/
  onboarding-wizard.tsx
  onboarding-step-shell.tsx
  onboarding-preview-panel.tsx
  onboarding-letter-reveal.tsx
  onboarding-steps/
    welcome-step.tsx
    avatar-step.tsx
    name-step.tsx
    handle-step.tsx
    bio-step.tsx
    verify-email-step.tsx
    taste-step.tsx
    favorites-step.tsx
    done-step.tsx
```

Replace `onboarding-flow.tsx` (delete or re-export from wizard entry).

---

## 3. Data flow, API & finish behavior

### Client state

```ts
type WizardStep =
  | "welcome"
  | "avatar"
  | "name"
  | "handle"
  | "bio"
  | "verify"
  | "taste"
  | "favorites"
  | "done";

// Key fields: displayName, handle, bio, avatarFile, avatarPreviewUrl,
// tasteRatings, tasteSkipped, tasteSearchAdds, favorites, direction, step
```

### Server touchpoints

| Moment | API | Notes |
|--------|-----|-------|
| Handle → Continue | `PATCH /api/profiles/me` | `{ handle, displayName }` — creates row; no `markOnboarded` |
| Bio → Continue | `PATCH /api/profiles/me` | `{ bio }` optional |
| Verify step | `sendVerificationEmail` + refresh | No profile write |
| Abbreviated skip | `PATCH /api/profiles/me` | `{ handle, displayName, markOnboarded: true }` |
| Finish | See sequence below | Requires verified email |

**Avatar:** Staged on step 1; uploaded at finish via `uploadProfileMeAsset("/api/profiles/me/avatar", file)` after profile row exists. Requires `POST /api/profiles/me/avatar` (Next proxy `app/api/profiles/me/avatar/route.ts`).

### Finish sequence (favorites → done)

1. Upload avatar if staged.
2. For each `tasteRatings` entry:
   ```ts
   POST /api/logs {
     movieId,
     rating,
     watchedAt: ISO now,
     visibility: "private",
     watchVenue: "streaming",
   }
   ```
3. `PATCH /api/profiles/me { handle, displayName, bio?, favoriteMovieIds, markOnboarded: true }`
4. `POST /api/profiles/me/recompute-taste-signature` → headline for done step
5. Show step 7 ~900ms → `router.replace("/home")` + `router.refresh()`
6. Server records `onboarding.completed` when `onboardedAt` first set (existing)

On failure: toast, re-enable submit, remain on favorites step.

### Error handling

| Error | UX |
|-------|-----|
| Handle taken / invalid | Inline; block Continue |
| `EMAIL_VERIFICATION_REQUIRED` | Verify step + `EMAIL_VERIFICATION_TOAST` |
| `BLOB_UNCONFIGURED` | Toast with server hint |
| Log POST failure | Toast “Couldn't save ratings” |
| `429` | Toast “Slow down” |

---

## 4. Migration & cleanup

| File / area | Action |
|-------------|--------|
| `sign-up-form.tsx` | Remove name + handle fields and post-sign-up `PATCH` |
| `onboarding-flow.tsx` | Replace with wizard module |
| `onboarding/page.tsx` | Pass `session` + optional existing profile fields; gate `onboardedAt` |
| `onboarding-quick-rate-pool.ts` | Keep; used by taste step |
| `AGENTS.md` | No change until shipped |

**Existing patrons:** Unaffected — `onboardedAt` already set bypasses wizard.

**Returning patrons without handle:** Rare (legacy); full wizard applies.

---

## 5. Testing

| File | Covers |
|------|--------|
| `onboarding-taste-state.test.ts` | Rated count excludes skipped; ≥8 gate |
| `onboarding-handle-validation.test.ts` | `HANDLE_RE` client parity |
| `onboarding-finish-order.test.ts` | Mocked API call order |

**Manual QA checklist**

1. Sign up (unverified) → identity steps succeed → verify gate blocks taste.
2. Resend + verify link → refresh → quick-rate unlocks.
3. Skip 4 pool films, search + rate 8 others → continue enabled.
4. Full finish → `/home`, taste signature visible on profile.
5. Step 0 “Maybe later” → name + handle → `/home` without logs.
6. `useReducedMotion` → no slide/spring animation.
7. Mobile: preview strip hidden on taste step; inputs ≥16px (no iOS zoom).

---

## 6. Success criteria

- [ ] Sign-up is email + password only; profile handle created in onboarding.
- [ ] Wizard uses `motion/react` + `useMeasure` height spring + directional steps.
- [ ] Live preview updates per step on desktop; mobile strip on identity steps.
- [ ] Email verification required before quick-rate; resend + refresh works.
- [ ] Quick-rate: Haven’t seen + search; ≥8 rated required; no forced pool ratings.
- [ ] Finish creates private diary logs, favorites, `markOnboarded`, taste recompute.
- [ ] “Maybe later” abbreviated path lands on `/home` with valid handle.
- [ ] `onboarding.completed` product event still fires once.
- [ ] Unit tests for taste count and finish order pass.

---

## 7. Open follow-ups (post-v1)

- Surface `favoriteMovieIds` on profile hero (pillar 1 — showcase strip).
- Optional onboarding TV titles in quick-rate pool.
- Tighten comments/likes verify gate (noted in email design as follow-up).
