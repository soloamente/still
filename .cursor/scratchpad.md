# Still — 70mm Cinematic Direction Plan

## What's New split dialog (2026-08-20) — EXECUTOR

**Status:** Shipped for human QA.  
**Scope:** One multi-step What's New (support-campaign split). Discord is **step 4**, not a separate campaign.

### Steps
1. Translate reviews  
2. Bug fixes throughout  
3. Small polish everywhere  
4. Discord activity for Pro  

### Done
- Release id `2026-08-20-translate-fixes-v4`
- `SENSE_SUPPORT_CAMPAIGN_ENABLED = false`
- Discord step: both body paragraphs + **What you unlock** inset card
- **See full release** only on last step, as `bg-background` pill
- Translate + Bug fixes steps thank **@jdc** (links to `/profile/jdc`)

### Manual QA
1. Clear `still:whats-new-seen:v1:{userId}` (or reload — v4 is a new id)
2. Steps 1–3: no changelog CTA; steps 1–2 show thanks to @jdc
3. Last step: Discord copy + card + **See full release** pill
4. No separate Discord-only campaign after Got it

Reply **`ok`** or list bugs / copy tweaks.

---

## Vercel cost optimization (2026-08-20) — EXECUTOR

**Status:** Code shipped (TMDb bypass + next.config harden). Dashboard steps below need human.

### Code done
- `isTmdbCdnUrl` + tests in `apps/web/src/lib/tmdb-poster-url.ts`
- `unoptimized` on high-volume TMDb `next/image` surfaces (`MoviePoster`, feed thumbs, hero/stills, tickets, etc.)
- Grid poster buckets `w780` → `w342` (diary/watchlist/lists/taste rail/profile filmography)
- `next.config.ts`: `minimumCacheTTL` 31d, removed `hostname: "**"`, restricted sizes/qualities/formats

### Observability ($2.44) — human dashboard
No `@vercel/analytics` / Speed Insights in app layouts. Events are project-level:
1. Vercel → Sense web project → **Usage → Observability** (confirm product: Observability Plus / Web Analytics / Speed Insights / drains)
2. Disable unused products or lower sampling; remove noisy log drains
3. Prefer Observability Free tier if Plus is on and unused

### Post-deploy verify
1. Usage → Image Optimization: transformations + cache writes should collapse within days
2. Edge Requests should drop with `/_next/image` traffic
3. Spot-check `/home` catalogue posters still sharp
4. Only if Function Invocations stay ~700K: audit presence heartbeats next

Reply **`ok`** after deploy + first usage check, or list regressions.

---

## Missing artwork morph placeholder (2026-08-20) — EXECUTOR

**Status:** Shipped for human QA.  
**Scope:** Empty TMDb posters + cast/crew headshots use morphing dot-field (`MissingArtworkPlaceholder`) instead of `ImageOff` / `UserRound`.

### Done
- `apps/web/src/components/media/missing-artwork-placeholder.tsx`
- `.missing-artwork*` in `packages/ui/src/styles/globals.css` (theme tokens + reduced motion)
- Wired: `movie-poster.tsx`, `person-credit-portrait.tsx`, `movie-detail-hero-media.tsx` empty frame

### Manual QA
1. Catalogue / diary tile with no poster — morph dots + “No poster” + title
2. Movie/TV cast arc or credits card with no headshot — **`bg-background`** + centered **No image** pill (Agentation fix 2026-08-20)
3. Detail hero with no poster
4. `prefers-reduced-motion` — static glow, readable label
5. Calm + dark themes — dots use foreground/muted tokens

Reply **`ok`** or list bugs.

---

## Settings membership card → Holo foil (2026-08-15) — PLANNER → ready for Executor

**QA note (2026-08-15):** Duotone polarity on PFP felt weird — softened (later flip, capped coverage, feathered mask, soft-light duo, circular tile). Awaiting re-check.

### Task 1 status (2026-08-15)
- Created `apps/web/src/lib/holo/engine.ts` (FOILS×10 from transcript paste; Sense `foilByKey` + `applyFoil(opts)`; no mediaUrl/Kamila)
- Created `apps/web/src/lib/holo/tier-print.ts` (still→brushed, attuned→holo, immersed→velvet, devoted→cosmos + PRINT constants)
- Tests: `bun test src/lib/holo/tier-print.test.ts src/lib/holo/engine.test.ts` → **5 pass**
- Follow settle test pumps frames after stiffness-1 step (speed decay) — plan's one-step `settled` was too strict for original Follow

### Task 2 status (2026-08-15)
- Added `@layer components` `.holo-*` block in `packages/ui/src/styles/globals.css` (~line 1787) after subscription-card-fx; left `.subscription-card-fx*` untouched
- Classes: card/body/foil×3/glare/smear/spot/noise/sheen/pattern/content/tile + polarity mask; GRAIN data-uri; edge inset box-shadows; `prefers-reduced-motion` → `.holo-card { transform: none }`
- No heart SVGs; braces balanced; `rg` finds holo-card/foil/tile

### Task 4 status (2026-08-15)
- Wired `MeSubscriptionIdentityCard`: hostRef + perspective only; Motion flip-only; two `HoloMembershipFace` + `useHoloCardLoop`
- Front: Sense wordmark + name/@handle/tier + `HoloMembershipTile` (no aura / CardTierChrome / CardFaceGlow)
- Back: billing UI inside Holo face; foil on both
- Back-face tilt: `useHoloCardLoop` inverts X for `faceRefs[index > 0]`
- Removed Motion pointer tilt + glow drop-shadow; left `.subscription-card-fx` CSS for Task 5
- Tests: `bun test src/lib/holo/` → **5 pass**; no commit

### Executor's Feedback or Assistance Requests (Holo Task 4)

**Ready for human QA** on `/me/settings/subscription`:
1. Foil lags with pointer on identity face
2. Flip → billing still responds to foil
3. Still / Attuned / Immersed / Devoted distinct print + foil
4. Portrait polarity at steep tilt
5. Reduced motion / soft GPU — settled, no busy rAF
6. Manage subscription still works

Reply **`ok`** or list bugs. Task 5 (dead CSS + edge polish) only after **`go`**.

---

## Auth `/sign-up` shell — better-interface + transitions-dev (2026-08-15) — EXECUTOR

**Mode:** Executor — A.1–A.5 shipped; awaiting human QA on A.3–A.5.  
**Trigger:** Agentation on `/sign-up` @ 2554×1386 — `<AuthRouteLayout>` / `<AuthPageShell>` `.relative` flex stack + `/better-interface` `/transitions-dev`.

### Scope

`AuthRouteLayout` + `AuthPageShell` + sign-up form path (shared shell also covers sign-in / forgot / reset). Boundary: not onboarding wizard, not landing marketing.

### Verdict (review)

**Needs changes** — no HIGH task-blockers that prevent account creation, but keyboard focus on auth inputs is a HIGH a11y miss; route swap motion is half-built dead code; guidelines copy is a dead claim.

### Findings (consolidated)

| # | Sev | Domain | Location | Issue |
| --- | --- | --- | --- | --- |
| 1 | HIGH | Accessibility | `auth-motion-field.tsx:7-8` | `focus:outline-none focus:ring-0` — focused email has `outline: none` + `boxShadow: none` (verified Runtime.evaluate) |
| 2 | MEDIUM | UI / transitions | `auth-page-shell.tsx` + `auth-route-slide.tsx` | Shared shell swaps title/form/footer instantly; `AuthRouteSlide` + `.t-page-slide` exist but are **unwired**; imports missing `@/lib/auth-route-order` |
| 3 | MEDIUM | Writing | `sign-up-form.tsx:131-134` | “agree to our community guidelines” is plain text — no href and no `/guidelines` (or similar) route in app |
| 4 | MEDIUM | Accessibility | `field.tsx` / `auth-motion-field.tsx` | `aria-invalid` set; errors not linked via `aria-describedby`; error `<p>` has no id/role |
| 5 | LOW | UI | `auth-submit-button.tsx:26,34` | Press scale `0.98` vs better-ui `0.96` |

### transitions-dev review (auth shell)

1. `auth-page-shell.tsx` convert-card body (title + children + footer) — **page side-by-side** (`08`) — wire existing `AuthRouteSlide`.
2. `auth-submit-button.tsx` spinner ↔ label — already Motion; optional **icon-swap** later (skip if Motion stays).
3. Invalid fields — optional **error-state-shake** (`12`) after focus + describedby land.
4. Skip: modal/dropdown/badge; first-load `auth-page-content-enter` already intentional (transform-only).

Run `transitions apply` on finding 2 after wiring.

### High-level tasks (Executor, one at a time)

1. **A.1** Focus-visible on auth inputs (token-friendly ring/shadow; keep no orange chrome).
2. **A.2** Wire `AuthRouteSlide` around shell `routeContent`; add `auth-route-order.ts`; honor reduced motion.
3. **A.3** Guidelines: link to a real page **or** rewrite copy so it doesn’t claim a missing policy.
4. **A.4** `aria-describedby` + stable error ids on `Field` / `AuthFieldErrors`.
5. **A.5** (optional) press scale `0.96`; error shake.

### Rejected

- Drop full-height `md` card / nested `.relative` — intentional half-bleed cinematic chrome.
- Replace CSS enter with Motion opacity — known mobile blank-page regression.
- Remove `shadow-lg` on auth card in this pass — floating convert panel, not lobby depth ladder.

### Project Status Board

- [x] A.1 Focus-visible auth inputs — theme-neutral `ring-foreground/35` (human ok)
- [x] A.2 Wire AuthRouteSlide + motion slide — human ok
- [x] A.3 Guidelines copy — dropped dead “community guidelines” claim; spoiler line kept
- [x] A.4 aria-describedby + `role="alert"` error ids on auth fields (sign-up Field + sign-in / forgot / reset)
- [x] A.5 Press scale `0.96` on AuthSubmitButton (skipped error-shake — optional)

### Executor's Feedback or Assistance Requests

**A.3–A.5 ready for QA:**
1. `/sign-up` footer — only “We don’t spoil films you haven’t logged.” (no guidelines claim)
2. Empty-submit or invalid email — input has `aria-describedby` → `#email-error` (etc.); error has `role="alert"`
3. Submit button press feels ~0.96 scale

Reply **ok** if the auth shell track is done, or notes.

---

## Landing hero: full-viewport spiral (2026-08-15) — EXECUTOR

**Mode:** Executor — shipped; awaiting visual QA on unsigned `/` `#scene` @ 2554×1386.  
**Trigger:** Agentation — spiral should be hero background for the whole first screen with headline on top.

### What shipped

- `LandingHero` is `min-h-dvh`, pulls under sticky nav (`-mt-[4.5rem]`), spiral absolute full-bleed + radial scrim.
- Type + CTAs sit `z-10` centered over the vortex; removed nested product well (`landing-hero-well.tsx` deleted).

### Density pass (2026-08-15)

- Spiral: `imageSize` 360, `spacing` 1.65 (~120 slots), `spread` 7.2, `sizeAttenuation` 1.2, `turns` 4.2.
- Poster feed cap **20**.

### Executor's Feedback or Assistance Requests

Hard-refresh `/` — posters should read denser and larger. Then **ok** or notes.

---

## Landing hero: Originkit Spiral Images (2026-08-15) — EXECUTOR

**Mode:** Executor — superseded by full-viewport spiral pass above.  
**Trigger:** Add Originkit `spiralimages` via CLI (`--prompt` + `ORIGINKIT_API_KEY` in shell only).

### What shipped

- CLI wrote `apps/web/src/components/originkit/ui/spiralimages.tsx` (added `"use client"` for App Router).
- `LandingHeroSpiral` maps popular posters → spiral `images`; reduced-motion sets `speed={0}`.
- Poster pick cap **14**. Biome ignores vendor `originkit/**`; `.originkit/` already gitignored.

### Executor's Feedback or Assistance Requests

Superseded — see full-viewport spiral section.

**Security:** API key was pasted in chat — rotate it on Originkit if this thread is shared; never commit the key.

---

## Agentation: Onboarding wizard layout (2026-08-14) — EXECUTOR

**Mode:** Executor — shipped; awaiting QA on `/onboarding` @ 1430×1384.  
**Trigger:** `.box-border > .mx-auto` — redesign `/transitions-dev` `/better-interface`.

### What shipped

- Inner card is no longer 50/50 auto-flex. Wizard rail is a fixed column; preview takes the rest.
- **2026-08-20:** Setup column is **45% / 50% at xl** of the card (not a fixed rem rail) so it balances the preview on ultrawide. Hard-refresh if HMR stalls. Taste ratings use shared `SenseTrackSlider` (same as crop zoom).
- Step changes use transitions.dev page-slide + card-resize height; continue labels text-swap; identity ↔ catalogue preview panel-reveals.
- Profile specimen is `bg-background` (no card-in-card). Copy and fields left-align on `lg`. Quiet progress meter on the rail.

### Executor's Feedback or Assistance Requests

Please refresh `/onboarding` at ~2554×1386 and confirm the setup column has enough width / inset. Reply **`ok`** or notes.

**Awaiting human verify (import `/home` leak):** favorites → import → must stay on `/onboarding` until **Enter Sense**. If an account was already grandfathered mid-wizard in an earlier session, use a fresh signup (or clear `onboarded_at`) to retest. Reply **`ok`** or notes.

**2026-08-20 import motion:** Live source stack uses transitions.dev **avatar-group-hover** (`useAvatarGroupHover` + `.t-avatar`); select mark uses **icon-swap**. Hover no longer washes tile into card. TV Time + all provider PNGs wired.

**2026-08-21 landing spiral posters:** Spiral used `crossOrigin=anonymous` which can fail TMDb loads in some privacy modes (colored / empty tiles). Removed CORS flag for display-only canvas; prefer `w342`; eased hero veil. Hard-refresh `/`.

**2026-08-20 follow-up:** Portrait step opens `ImageCropDialog` (same as Settings) so PC patrons can pan/zoom before confirm. Manual QA: pick image on `/onboarding` avatar step → crop dialog → drag/zoom → Apply → circular preview updates.

**Zoom slider redesign:** Native `<input type="range">` replaced with `ImageCropZoomSlider` (± pills + `bg-background` track + thumb, card-resize fill motion). Shared by Settings + onboarding crop.

**2026-08-20 taste search scroll cue:** Soft fades alone weren’t enough. Search list now (1) clips mid-row so the next hit peeks, (2) uses a denser bottom scrim, (3) shows a “More results” + chevron pill while `showFooterFade` is true. Shell is `overflow-hidden rounded-2xl` so bottom corners stay round; equal `p-2`; taller `max-h-64`.

**2026-08-20 taste/favorites preview scroll:** Desktop card is viewport-locked (`lg:h/max-h-[calc(100dvh-1.25rem)]`) so preview `overflow-y-auto` gets a height budget; panel reveal + grids use `h-full min-h-0`; `justify-safe-center` so overflow isn’t trapped.

**2026-08-20 taste continue gate copy:** Progress meta removed from step header; disabled Continue shows `N / 8 rated`, then swaps to `Continue` once the gate clears.

**2026-08-20 favorites empty state:** Centered preview empty with heart mark + title/body (motion enter); replaces lone muted paragraph.

**2026-08-20 favorites grid polish:** Single `LayoutGroup` (picks ↔ search morph), staggered empty/search enters, section gap layout, softer tile exit, pick count in section label. Reply **`ok`** or notes.

**2026-08-20 import-step `/home` leak (fix):** Completing favorites ran `markOnboarded` + server grandfather (diary/taste/favorites) unlocked `(app)` before import/Enter. Now: `runOnboardingFinish` saves without `markOnboarded`; Enter Sense patches `markOnboarded: true`; post-v3 gate/grandfather only unlocks on `onboardedAt` (pre-v3 handle still grandfathered). Manual QA: favorites → import picker → stay on `/onboarding` (BrandMark/refresh must not land on home) → Done → Enter → `/home`.

---

## Landing remake (2026-08-14) — PLANNER

**Mode:** Planner — brainstorming. Approach **2** locked. Presenting design sections; do not implement until spec is approved.  
**Trigger:** `/` `#scene` — remake the whole landing (`/better-interface` + `/transitions-dev`).

### Locked

- Full `/` remake (nav through footer). Signed-in still redirects to `/home`.
- Story: **identity → diary → community → convert**.
- Chrome: **hybrid** — one cinematic hero still, then Sense raised-card language (no decorative borders).
- Convert: **Create account + Sign in**.
- Structure: **four chapters, one specimen each** (Approach 2).
- Drop Mobbin glass nav, scroll-hijack poster theater, fade-up-on-scroll, fake “Contact” chapter.
- **Section 1 approved:** page map + nav (Taste · Diary · Community), `#scene` → `#taste` → `#diary` → `#community` → `#start` → footer.
- **Section 2 approved:** hero still (popular #1), identity copy, dual CTAs, peek of Taste.
- **Remaining design (human go):** chapter cards, convert, footer, motion, architecture — written into spec.
- **Spec approved.** Plan: `docs/superpowers/plans/2026-08-14-landing-page-remake.md` (Tasks 1–9). Do not implement until human picks Subagent-Driven or Inline and says **go**.
- Prefer **subagent-driven** (one task per subagent; human **go** between tasks).
- **Task 1 complete** (uncommitted): `pickLandingHeroBackdrop` + 2 tests. Review clean.
- **Task 7 complete** (uncommitted): convert band + quiet footer. Review clean.
- **Task 8 complete** (uncommitted): compose `/` — metadata, slim backdrop fetch, skip link, hero + three chapters + footer. Review Approved.
- **Amendment Task 1 complete** (uncommitted): `pickLandingHeroPosters` + 3 tests. Review clean.
- **Amendment Task 7 complete** (uncommitted): compose `/` — type hero + product tabs. Review clean. **Human visual QA** on unsigned `/` before Task 8 (delete unused theater).
- **Amendment Task 8 complete** (uncommitted): deleted 14 theater/chapter leftovers; keepers slimmed to Quick Log + ranks + used tokens. Review restored ranks `bg-muted/40` after a restyle miss. Review Approved. **Human visual QA** on unsigned `/` (spec §8). Amendment Tasks 1–8 shipped; no commit.

---

## Agentation: Compare feature icons (2026-08-14) — EXECUTOR

**Mode:** Executor — shipped; awaiting QA on `/pricing` `#compare` @ 2554×1386.  
**Trigger:** Sticky feature `th` — “put the icons for the features”.

### What shipped

- Compare feature rows use `PricingFeatureIcon` (same catalogue glyphs as the tier cards), locked to the title line with Coming soon under the name.

### Executor's Feedback or Assistance Requests

Scan the Compare feature column. Then **ok** or notes.

---

## Agentation: Compare rounded bottom (2026-08-14) — EXECUTOR

**Mode:** Executor — shipped; awaiting QA on `/pricing` `#compare` @ 2554×1386.  
**Trigger:** `td.px-3` — “rounded corners bottom”.

### What shipped

- Last feature row: tier cells `rounded-b-2xl`, sticky feature cell `rounded-bl-2xl` — matches the header caps so the Popular highlight isn’t square at the floor.

### Executor's Feedback or Assistance Requests

Scroll to the last Compare row (Popular column). Then **ok** or notes.

---

## Agentation: Compare hover blocks wheel (2026-08-14) — EXECUTOR

**Mode:** Executor — shipped; awaiting QA on `/pricing` `#compare`.  
**Trigger:** Hovering the compare card, scroll wheel no longer moves the page.

### What shipped

- Removed `data-lenis-prevent-wheel` from the compare matrix. That flag blocked Lenis while the table has no vertical overflow, so the wheel died. Horizontal pan still uses `overflow-x-auto` + Lenis `allowNestedScroll`.

### Executor's Feedback or Assistance Requests

Hover Compare and use the wheel — page should scroll. Then **ok** or notes.

---

## Agentation: FAQ close ≠ open (2026-08-14) — EXECUTOR

**Mode:** Executor — shipped; awaiting QA on `/pricing` `#questions`.  
**Trigger:** “What is Devoted?” close animation is not the same as open.

### What shipped

- FAQ height tween uses a **symmetric** `--resize-ease` so collapse isn’t the global ease-out (fast start / crawl to 0).
- Canvas well stays until `transitionend` (plus duration fallback) so close doesn’t snap the row off mid-tween.
- ResizeObserver ignores 0-height while clipped.

### Executor's Feedback or Assistance Requests

Open and close **What is Devoted?** (and another row). Motions should match. Then **ok** or notes.

---

## Agentation: Compare header rounded top (2026-08-14) — EXECUTOR

**Mode:** Executor — shipped; awaiting QA on `/pricing` `#compare` @ 2554×1386.  
**Trigger:** `th.min-w-[8.5rem]` — “rounded on top”.

### What shipped

- Compare table uses `border-separate border-spacing-0` so cell radius paints.
- Tier header cells get `rounded-t-2xl` (Popular `bg-background` cap is no longer square).
- Feature header gets `rounded-tl-2xl` to match the inner panel.

### Executor's Feedback or Assistance Requests

Scan the Compare header row — Popular column and first/last caps. Then **ok** or notes.

---

## Pricing Q&A + Other Plans restyle (2026-08-14) — EXECUTOR

**Mode:** Executor — shipped; awaiting QA on `/pricing` `#questions`.  
**Trigger:** Redesign pricing follow-through + add Q&A (`/transitions-dev` + `/better-interface`).

### What shipped

- **Questions** accordion below Compare: one open row, `.t-resize` height tween, plus/minus `.t-icon-swap`.
- FAQ copy in `pricing-faq.ts` + FAQPage JSON-LD on `/pricing`.
- Other Plans restyled to the same raised `bg-card` / concentric inner tiles; Lucide Gift/Tag → Nucleo ticket + people; underline CTAs → pills.

### Executor's Feedback or Assistance Requests

Scan `#questions` (open/close a few rows, keyboard) and the invite tiles. Then **ok** or notes.

---

## Agentation: Pricing compare scroll border (2026-08-14) — EXECUTOR

**Mode:** Executor — shipped; awaiting QA on `/pricing` `#compare` @ 2554×1386.  
**Trigger:** `PricingComparisonTable` scroll border — `/transitions-dev` + `/better-interface`.

### What shipped

- Dropped section `border-t` and every row `border-b` (group with space + `bg-card` panel).
- Horizontal clip uses lobby edge fades (`to-card/0`) and a sticky feature column fade instead of a hairline.
- Interval prices use `t-text-swap` / `useTextStateSwap`.
- Native scrollbar hidden; scrollport is keyboard-focusable.

### Executor's Feedback or Assistance Requests

Scan Compare plans at ultrawide and a narrow width (pan the matrix). Then **ok** or notes.

---

## Settings Save/Cancel + theme dirty (2026-08-14) — EXECUTOR

**Mode:** Executor — Task 1 shipped; awaiting human QA. Do not start Task 2 until **ok**.  
**Trigger:** Theme applies immediately but leave-guard fires with no Save/Cancel; Profile edits lose Save/Cancel after switching to Notifications.

### Background and Motivation

Two Settings bugs, same chrome:

1. **Appearance theme** applies on pick (`applyThemeSelection`) but stays in the settings form dirty set. Leave/back shows “unsaved settings” even though there is often no Save/Cancel. Account menu already persists theme on pick (`AccountMenuThemePicker`) — Settings should match.
2. **Save/Cancel vanish across sidebar tabs.** Edit Profile → Notifications: buttons gone; patron has to return to Profile to find them.

### Key Challenges and Analysis (root cause)

- `SettingsFormShell` lives in `settings/layout.tsx`, which is a **child** of `MeAccountRouteTransition`. On tab change the transition renders **two** trees (exit + enter), so **two** `SettingsFormProvider`s register bar actions.
- `useRegisterMeAccountBarActions` cleanup always `setActions(null)` on unmount. When the exit layer is removed, it **wipes** the surviving provider’s registration. The live provider does not re-run its effect, so the top bar stays empty while `settingsDirtyRef` / session draft still trip the leave dialog.
- Theme dirty: `dirty` includes `appTheme !== themeFromProfile`. Pick updates local state + live chrome but does **not** PATCH. `anyUnsaved()` is true; buttons only show if registration survived.

### Architecture decisions

- Keep one Save/Cancel in `MeAccountTopBar` for all `/me/settings/*` tabs (do not hunt the tab where the edit happened).
- Theme: persist-on-pick like the account menu; **exclude** from form dirty / draft / leave-guard. Other Appearance fields (e.g. grayscale portrait) stay batch-save.
- Fix registration with an **owner token** so an exiting duplicate cannot clear a newer registrant. Do not lift `SettingsFormShell` in this pass (draft hydration already restores field state).

### High-level Task Breakdown

#### Task 1: Bar actions survive tab slide

**Description:** Owner-token `setActions` so exit-layer unmount does not null the live Save/Cancel.

**Acceptance criteria:**
- [ ] Exiting registrant cleanup does not clear actions owned by a later registrant
- [ ] Edit Profile → Notifications: Save/Cancel stay in the top bar and still submit/reset the shared form
- [ ] Unit test covers the unmount-wipe race

**Verification:** Test for `useRegisterMeAccountBarActions` owner semantics; manual Profile edit → Notifications → Save.

**Files:** `me-account-bar-actions-context.tsx` + test

**Dependencies:** None

#### Task 2: Theme persist-on-pick, not unsaved

**Description:** Settings theme pick PATCHes immediately (same as account menu). Drop `appTheme` from dirty, draft read/write, and leave-guard. Failed persist reverts chrome + toast.

**Acceptance criteria:**
- [ ] Theme-only pick: no Save/Cancel, no leave dialog
- [ ] Theme + Profile name edit: leave dialog only for the name; Cancel does not revert the persisted theme
- [ ] Persist failure restores previous theme

**Verification:** Manual Appearance pick then back; combined with a Profile field edit.

**Files:** `me-appearance-settings.tsx`, `settings-form-context.tsx`, maybe `settings-section-panels.tsx`

**Dependencies:** Task 1 (so real unsaved fields still show the bar on every tab)

### Project Status Board

- [x] Task 1: Bar actions survive tab slide — code + tests; **awaiting human QA**
- [ ] Task 2: Theme persist-on-pick, not unsaved

### Executor's Feedback or Assistance Requests

Task 1 ready for QA. Please: edit a Profile field → Notifications (and another tab) → confirm Save/Cancel stay in the top bar and still save/discard. Then **ok** or notes.

QA follow-up (hydration on Appearance): selected theme tile now follows form `appTheme`, not `useTheme()` — next-themes was unset on SSR and live on the client (Calm vs last pick). Reload `/me/settings/appearance` should no longer throw a hydration recoverable error.

QA follow-up (Save stays active): after save, `dirty` still compared the form to the stale RSC `profile` (`router.refresh` only ran for pending media), so `canSave` stayed true. Now a committed snapshot is the baseline after save; top bar hides Save/Cancel unless dirty or saving.

`graphify` is not on PATH here — skipped `graphify update .`.

---

## Agentation: Settings Discord link status (2026-08-14) — EXECUTOR

**Mode:** Executor — shipped; awaiting QA on `/me/settings/profile` Discord @ 2554×1386.  
**Trigger:** Take inspiration from the Sync Status reference for Discord activity.

### What shipped

- Sense ↔ Discord connection card (`MeDiscordLinkStatus`): portrait + Discord mark, dotted rails, center status pill, footer check + copy, Connect in the trailing slot when idle.
- States: **Active** / **Connected** / **Setup** / **Not connected** via `discord-link-status.ts`.
- Inset `bg-card` on the settings `bg-background` panel — no decorative border. Toggle stays below the card. Disconnect is a quiet footer text action (same slot as Connect), not a standalone destructive pill.
- Pre-production funding strip and Pro lock unchanged.

### Executor's Feedback or Assistance Requests

Scan Discord activity at ultrawide: diagram should read like the reference (two endpoints, live pill, footer). Then **ok** or notes.

---

## Agentation: Settings Profile overlap (2026-08-14) — DONE

**Mode:** Planner — human **ok** on `/me/settings/profile` @ 2554×1386.  
**Trigger:** Identity `MeSettingsSection` **flex min** slides under photo + banner.

### What shipped

- `MeSettingsSection` is content-sized (`flex-none`) by default. `flex-1 min-h-0` in an auto-height column collapsed the Identity box so the name/bio card (and Privacy) painted under the overflowing banner + overlapping portrait.
- Profile Identity / Privacy / Discord pass `flex-none` explicitly. `fillFirst` pages still stretch the first child via `SettingsSectionPage`.
- Portrait still straddles the banner (`-mt-14`); that overlap is intentional.

### Planner verification

Human **ok** — Identity form sits below the banner/photo. This item is complete.

---

## Agentation: Settings Notifications (2026-08-14) — EXECUTOR

**Mode:** Executor — shipped; awaiting QA on `/me/settings/notifications` @ 2554×1386.  
**Trigger:** Notifications `flex min` + redesign.

### What shipped

- `fillFirst={false}`; **Social | Watching | Milestones** on `xl`.
- Groups live on `NOTIFICATION_KIND_SETTINGS` via `notificationSettingsSections()`.

---

## Agentation: Settings Catalogue (2026-08-14) — EXECUTOR

**Mode:** Executor — shipped; awaiting QA on `/me/settings/catalogue` @ 2554×1386.  
**Trigger:** Catalogue `flex min` + `/better-interface` + `/transitions-dev`.

### What shipped

- `fillFirst={false}`; **Streaming | Language** on `xl`, **Display** full-width under.
- Same outer `bg-background` cards.
- Select labels use **text-states-swap** via `useTextStateSwap`.

---

## Agentation: Settings Experience shell (2026-08-14) — EXECUTOR

**Mode:** Executor — shipped; awaiting human QA on `/me/settings/experience` @ 2554×1386.  
**Trigger:** `SettingsExperienceSection` **flex min** + `/better-interface`.

### What shipped

- `fillFirst={false}` so the reveal shell is content-sized (same as Profile / Data).
- Split **Motion & picture** | **Audio** on `xl`; stacked below.
- Nested audio uses inset `bg-background` (no `border-l`).

### Executor's Feedback or Assistance Requests

Scan Experience at ultrawide: two content-height columns, not one stretched featured slab. Then **ok** or notes.

---

## Agentation: Settings Data page shell (2026-08-14) — EXECUTOR

**Mode:** Executor — page-shell redesign shipped; awaiting human QA on `/me/settings/data` @ 2554×1386.  
**Trigger:** `SettingsSectionPage` / `MeAccountContentReveal` / `MeAccountRevealItem` **flex min** + `/better-interface` + `/transitions-dev`.

### What shipped (pass 2)

- `fillFirst={false}` now also drops `flex-1 min-h-0` on the reveal shell (not only the first child).
- Data page: ultrawide **imports | export + danger** grid; stacked on narrower viewports.
- Anilist how-to tightened; Export uses text-states-swap + panel-reveal; Danger stays quiet.

### Executor's Feedback or Assistance Requests

Scan `/me/settings/data` at ultrawide: the page column should be content-height (lobby canvas below, not an empty flex slab). Imports left, Export/Danger right. Then **ok** or notes.

---

## Agentation: Settings Data Letterboxd panel (2026-08-14) — EXECUTOR

**Mode:** Executor — redesign shipped; awaiting human QA on `/me/settings/data` @ 2554×1386.  
**Trigger:** Letterboxd `MeSettingsPanel` flex-min slab + `/better-interface` + `/transitions-dev`.

### Background and Motivation

Data page used `fillFirst` so the first block (Letterboxd) stretched to leftover lobby height. On ultrawide that read as an empty flex slab. How-to + six stacked file rows buried the dropzone.

### What shipped

- `SettingsDataSection` `fillFirst={false}` (same as Profile — content-sized sections).
- Settings layout: compact how-to → dropzone leading, 2-col file catalog beside it on `xl`.
- transitions-dev: **text-states-swap** on dropzone + Import label; **icon-swap** on file ticks; **panel-reveal** on last import.
- Import stays enabled until the request starts; empty submit focuses the inline hint.
- Onboarding variant stays stacked (wizard split pane).

### Executor's Feedback or Assistance Requests

Please scan `/me/settings/data` at ultrawide: Letterboxd should be content-height (not a tall empty card), dropzone left / files right, drag text swap, Import without files shows the hint. Then **ok** or notes.

---

## Onboarding import prompt (2026-08-13) — PLANNER

**Mode:** Planner / brainstorming — clarifying before design.  
**Trigger:** After account creation + setup, ask whether to import from elsewhere. Live source today: **Letterboxd** (`POST /api/import/letterboxd`, Settings → Data). Reference: split pane (copy + Back/Continue left; selectable source pills right).

### Background and Motivation

New patrons finish identity + taste + favorites, then land on **You made it** with no path to bring a Letterboxd diary in. Settings already has Letterboxd + Anilist importers; onboarding never offers them. Goal: a skippable post-setup step that matches the reference layout.

### Locked so far

| Topic | Decision |
| --- | --- |
| Live sources | Letterboxd + Anilist (existing Settings importers) |
| Extra rows | **B** — disabled **IMDb · Trakt · Serializd** (“Coming soon”). No TV Time. |
| Import timing | **A** — in-wizard: picker → existing upload UI → Done. Skip / no live pick → Done. |
| Source count | One **or both** live sources. Multi-select Letterboxd + Anilist; sequential uploads if two. Coming-soon rows stay disabled. |
| Who sees it | **A** — full setup only (after favorites). Abbreviated name+handle skip does not show import. |
| Implementation | **1** — new wizard steps `import` + `import-upload`; reuse Settings upload engines. |

### Extra sources (research, not built)

- **TV Time:** service shut down **15 Jul 2026**; only leftover GDPR/extension exports exist. High format mess (JSON zip, no stable CSV). Rescue audience only — not a living switcher.
- **Realistic next backends:** **IMDb** (official ratings/watchlist CSV), **Trakt** (official export zip/JSON — best TV+film). **Serializd** has an account export but no first-party API we already use.
- Building any of those is a **separate importer project**, not this onboarding step.

### Key Challenges and Analysis (draft)

- Wizard is already left copy + right preview; taste/favorites already swap the right pane for a grid — import can reuse that split.
- `runOnboardingFinish` currently fires on favorites **Complete setup** (`markOnboarded: true`) before Done. Import can sit between favorites and Done, or after Done, depending on skip/upload UX.
- Extra sources: show as disabled “soon” pills (reference look) vs hide until a real importer ships.
- transitions-dev **page side-by-side** fits step 1 ↔ step 2 (pick source → upload); existing wizard already slides with `motion/react`.

### Project Status Board

- [x] Clarify sources, skip, and whether upload happens in-wizard
- [x] Present approaches + architecture (user: **1**, **go**)
- [x] Spec drafted — `docs/superpowers/specs/2026-08-13-onboarding-import-design.md`
- [x] User approved spec (**go**)
- [x] Plan — `docs/superpowers/plans/2026-08-13-onboarding-import.md`
- [x] Execute T.1 (queue helper) — review clean
- [x] Execute T.2 (step graph) — review clean
- [x] Execute T.3 (Letterboxd panel extract) — review clean
- [x] Execute T.4 (Anilist panel extract) — review clean
- [x] Execute T.5 (source list + picker) — review clean
- [x] Execute T.6 (upload step) — review clean
- [x] Execute T.7 (wire wizard) — review clean (human **go**)
- [ ] Execute T.8 (human QA) — static pass; live ticks needed

### Executor's Feedback or Assistance Requests

**T.8 in progress.** Static checklist + smoke tests (11) pass. `graphify` still not on PATH. Live `/onboarding` walkthrough needs your ticks — see Executor note.

---

## Agentation: Profile section titles (2026-08-12) — PLANNER

**Mode:** Executor — T.1 shipped; awaiting human **`ok`** before T.2.  
**Triggers:** `/me/settings/profile` @ 2554×1386  
1. Discord block hard to parse without a title  
2. Privacy (and peers) description-only headers — **put titles** + **transitions-dev**

### Background and Motivation

Profile settings dropped in-panel “Discord activity” (D.3) and never set `MeSettingsSection` `title`, so ultrawide scans only mute blurbs. Patrons need clear **h2** landmarks; Discord especially.

### Key Challenges and Analysis

- `MeSettingsSection` already supports optional `title` + `description` — Profile never passes `title`.
- Sticky top bar already owns page **Profile** `h1` — section `h2`s are fine (same pattern as other lobbies).
- transitions-dev decision: static titles don’t swap text. Best fit = **text-states-swap** on Discord labels that *do* change (Connect ↔ Opening…; loading → Connected), reusing `me-subscription-identity-card` / `log-rating-slider` orchestration. CSS `.t-text-swap` already in `globals.css`.

### High-level Task Breakdown

- [x] T.1 Identity / Privacy / Discord: pass `title` + keep short `description` under each
- [ ] T.2 Discord: `t-text-swap` on CTA label + Connected status when text changes
- [ ] T.3 Human QA — scan titles at ultrawide; Connect / Connected motion; reduced-motion ok

### Project Status Board

- [x] T.1 Section titles — **awaiting human verify**
- [ ] T.2 Discord text-swap
- [ ] T.3 Human QA

### Proposed copy

| Section | Title | Description (under) |
| --- | --- | --- |
| Identity | Identity | Photo, public identity, and links on your page. |
| Privacy | Privacy & presence | Who can see your page, birthday, and online status. |
| Discord | Discord activity | Show what you’re listening to or playing on your profile. |

### Executor's Feedback or Assistance Requests

**T.1 done (2026-08-12).** Titles on Identity / Privacy / Discord. **One** status dot only in Discord panel: emerald pulse + **Connected**, muted static + **Not connected**. Reply **`ok`** for T.2, or what looks wrong.

---

## Agentation: Appearance save + search filters (2026-08-12) — PLANNER

**Mode:** Planner — awaiting **`go`** (or refine).  
**Triggers:**
1. `/me/settings/appearance` — Save/Cancel stay active after save (`MeAccountTopBar`)
2. `/home?search=…` — replace **Clear search** chip with **Filters** to refine results

### Background and Motivation

Two Agentation notes: appearance chrome still reads as dirty after a successful save; committed catalogue search hides the filter control behind a redundant Clear search chip (clear already lives on the sticky search ×).

### Key Challenges and Analysis

**A — Appearance Save stays active**

- Dirty is `useMemo` vs live `profile` prop (`settings-form-context.tsx`).
- Successful save calls `syncSettingsDirty(false)` + toast but **does not** `router.refresh()` unless media uploaded — so `profile.preferences` stays stale and `appTheme !== themeFromProfile` (etc.) keeps `canSave: true`.
- **Fix:** always `router.refresh()` after successful profile save (or optimistically rebase local baseline from saved prefs). Prefer refresh for consistency across all settings sections.

**B — Search lobby filters**

- `HomeCatalogViewModeToolbar` early-returns `HomeCatalogueSearchClearChipToolbar` when `catalogueSearchActive`.
- User wants the slider **Filters** control instead — clear remains on sticky pill × (dissolve).
- `mergeHomeCatalogFiltersIntoHref(currentHref, …)` already keeps `search=` if `currentHref` includes it.
- Search seed/load path (`loadCommittedCatalogueSearchSeeds` / `buildCatalogueSearchPlanFromCommit`) does **not** yet apply `?genre=` — must merge lobby genre into discover `genreIds` + `searchWaveKey`, else UI would be a no-op.

### High-level Task Breakdown

- [ ] S.1 Appearance: after successful save, refresh (or rebase) so `dirty` → false and Save/Cancel disable
- [ ] S.2 Search toolbar: show `CatalogueFiltersControl` instead of Clear search when `?search=` active
- [ ] S.3 Wire `?genre=` (and compatible monetization if shown) into committed-search plan + wave key + infinite load
- [ ] S.4 Human QA — appearance save; search + genre filter; sticky × still clears

### Project Status Board

- [ ] S.1 Appearance dirty after save
- [ ] S.2 Filters chip during search
- [ ] S.3 Search × genre wiring
- [ ] S.4 Human QA

### Executor's Feedback or Assistance Requests

Reply **`go`** to execute S.1 first (or **`go all`** for S.1→S.3 then QA). Clarify if search filters should be **genre-only** or full popover (genre + watch type).

---

## Sticky search clear dissolve (2026-08-12) — EXECUTOR

**Mode:** Executor — collapsed-only approach approved (`go`).  
**Trigger:** Agentation on `/home` → Transitions.dev **Input clear with dissolve**.  
**Skill:** `.agents/skills/transitions-dev/13-input-clear-dissolve.md`

### Background and Motivation

Clearing sticky catalogue search should dissolve typed/committed text (fly + blur + per-word streak) and drop the placeholder back in — not hard-cut to empty. Annotation targets the collapsed pill chrome (`HomeStickySearch` / clear `X`), not a separate marketing surface.

### Locked

| Topic | Choice |
| --- | --- |
| Scope | Collapsed sticky pill only (dialog clear deferred) |
| Dark glow | `screen` + white streaks; Lucid light → `multiply` |
| Reduced motion | Instant `router.replace` clear |

### High-level Task Breakdown

- [x] C.0 Lock scope (collapsed only)
- [x] C.1 Install `--clear-*` vars + `.t-clear*` CSS (+ light override)
- [x] C.2 Wire React orchestration on `HomeStickySearch` clear
- [x] C.3 Reduced-motion instant clear path
- [ ] C.4 Human QA

### Project Status Board

- [x] C.0 Scope lock
- [x] C.1 CSS tokens (`packages/ui/src/styles/globals.css`)
- [x] C.2 Clear orchestration (`input-clear-dissolve.ts` + `HomeStickySearch`)
- [x] C.3 Reduced motion
- [ ] C.4 Human QA — **awaiting**

### Executor's Feedback or Assistance Requests

**C.1–C.3 done (2026-08-12).** Hard-refresh `/home`, run a catalogue search so the pill shows a committed query, tap **Clear (×)**. Expect: text flies down + soft streak, placeholder drops in, then lobby restores without search. Also try Lucid light theme + OS reduced motion (should clear instantly). Reply **`ok`** or what looks wrong.

Unit tests: `apps/web/src/lib/input-clear-dissolve.test.ts` (3 pass).

---

## img-fx ImageGeneration (2026-08-12) — CANCELLED

**Status:** Cancelled (`nvm`). Replaced by **rotating TMDb stills** on taste hero when no trailer (`HomeTasteHeroStillsCarousel`).

---

## Taste hero still rotation (2026-08-12) — EXECUTOR

**Mode:** Executor — shipped per Agentation feedback on `/home?sort=popular`.  
**Behavior:** When the taste hero has **no background trailer** (missing, reduced-motion, or blocked), rotate different movie stills with blur cross-fade instead of a single static backdrop. Trailer path unchanged.

### Project Status Board

- [x] I.1 `HomeTasteHeroStillsCarousel` + `fetchMovieReviewStills`
- [x] I.2 Wire into `HomeTasteHeroMediaLayer`
- [x] I.3 Unit test + remove unused `img-fx` / `three`
- [ ] I.4 Human QA — titles without trailers on `/home` (Movies, signed in)

---

## Account menu MetalFx frozen (2026-08-12) — PLANNER

**Mode:** Planner — root cause investigated; awaiting **Executor `go`** (or Planner tweaks).  
**Trigger:** Upgrade-plan MetalFx in account menu shows metal chrome but does not animate (static frame).

### Background and Motivation

`AccountMenuUpgradePlanButton` mounts `metal-fx` while the account dropdown / You sheet is open (`effectActive={menuOpen}`). Patrons see the metallic ring but it stays still — should shimmer while the menu is open, with proximity reflection onto **View profile** on dark themes.

### Key Challenges and Analysis

**Root cause (revised after M.1 QA):** `metal-fx@1.0.4` sets inline `visibility: hidden` until first shader copy. That makes `IntersectionObserver` mark `inst.visible = false` and stop the shared RAF loop after painting one still frame. Glow/CSS chrome can still read as “shimmer / reflect.” CSS `!important` alone was not enough in practice (M.1 failed human QA).

**Fix (M.1b):** (1) Drop body portal + per-frame `setState` thrash — mount MetalFx inline. (2) Patch `metal-fx@1.0.4` so host stays `visibility: "visible"` (opacity-only hide) via `patches/metal-fx@1.0.4.patch`. (3) Keep `.account-menu-metal-fx { visibility: visible !important }` belt-and-suspenders.

### Project Status Board

- [x] M.1 IO visibility override (CSS) — insufficient alone
- [x] M.1b Inline mount + metal-fx patch (visibility always visible) — awaiting human QA
- [ ] M.2 Portal ref tracking — cancelled (portal removed)
- [ ] M.3 Human QA

### Executor's Feedback or Assistance Requests

**M.1b follow-up (2026-08-12):** Inline mount made MetalFx disappear — stuck at library `opacity: 0` when IO never got a first copy inside the Base UI popup. Restored **body portal** with **ref/DOM position sync** (no per-frame React remount), forced `opacity: 1 !important` + visibility on `.account-menu-metal-fx`, kept metal-fx patch. Hard-refresh and reopen account menu — Upgrade plan should show metal again; check whether the ring also flows. Reply **`ok`** or what you see.

---

## Discord activity — Pro funding announcement (2026-08-11)

**Mode:** Planner — brainstorm approved; spec written; awaiting human review of spec before writing-plans.  
**Trigger:** Announce Discord activity as Pro-funded (live progress); not free-for-all; production off until VPS.

### Background and Motivation

Discord profile activity is built but needs a paid VPS (Lanyard + presence guild) before production. The ask: show live progress of **paying Polar Pro** members toward a target, and unlock the feature for **all Pro** when ops enables production — not for Still, and not auto-on at the count alone. Keep the existing mobile/growth support campaign; add soft surfaces (Pricing, Settings) + What's New behind that campaign.

### Locked decisions

| Topic | Choice |
| --- | --- |
| Surfaces | Approach 1 — shared funding strip + public API; Pricing + Settings + What's New |
| Who gets it | All Pro when production on — **not** every patron |
| Pre-ship | Teaser + live progress + CTA; Connect off |
| Count | Paying Polar only (`active`/`past_due`); exclude override-only |
| Progress audience | Public (everyone on Pricing) |
| Unlock | Ops/env after VPS — progress informational |
| Support campaign | Unchanged |

**Spec:** `docs/superpowers/specs/2026-08-11-discord-activity-pro-funding-design.md`  
**Plan:** `docs/superpowers/plans/2026-08-11-discord-activity-pro-funding.md` (Tasks 1–10)  
**Execution:** Subagent-driven (option 1).  
**Task 1:** complete + review Approved (`discord_activity` Attuned key; uncommitted).  
**Task 2:** complete + review Approved (`DISCORD_ACTIVITY_PRO_TARGET` + helpers default 50; uncommitted).  
**Task 3:** complete + review Approved after `Number()` fix on count return (uncommitted).  
**Task 4:** complete + review Approved (public `/api/discord-activity/funding`; count-only cache; uncommitted).  
**Task 5:** complete + review Approved (Pro gates on status/finish-setup/DELETE/profile; OAuth UI gate deferred to Task 8; uncommitted).  
**Task 6:** complete + review Approved (funding strip + fetch/clamp; not mounted yet; uncommitted).  
**Task 7:** complete + review Approved (Pricing mount above tiers; uncommitted).  
**Task 8:** complete + review Approved (Settings 3-state + seed `discord_activity` planned; Human QA pending; uncommitted).  
**Task 9:** complete + review Approved (What's New + changelog **0.3.3**; support campaign untouched; uncommitted).  
**Task 10:** complete — automated tests green; final review **Ready** for human QA.  
**Local note:** funding API returns `productionEnabled: true` → funding strip hidden until you set `DISCORD_ACTIVITY_ENABLED=false` to preview teasers.  
**Next:** Human QA checklist (Pricing / Settings / support campaign); commit when asked.

---

## Liquid Morph on RadialToolkit (2026-08-12) — EXECUTOR

**Mode:** Executor — approach approved (`go`).  
**Trigger:** Morph fan on RMB radial (PlusMenu-style).

### Locked

Morph open fan; hub + orbit only; white fill; `contentBlur: 0`; inject via `liquid` slot; Motion fallback when gated.

### Project Status Board

- [x] R.1 RadialToolkit liquid slot API (`RadialToolkitLiquidSlot`)
- [x] R.2 Morph fan layout (hub + orbit `x`/`y` + double-rAF `fanOut`)
- [x] R.3 Web wiring — `useSenseRadialLiquidSlot` on catalogue / list lobby / list detail / profile filmography tiles
- [x] R.4 Human QA — **ok** (2026-08-12)
- [x] R.5 Style match PlusMenu — theme `card` pills, no blue aim wedge, orbit 64px, fan spring tuned
- [x] Move pills — **reverted** to `layoutId` chips (liquid Move too buggy); Radial Morph kept
- [x] R.6 Morph everywhere on RMB — `SenseRadialToolkit` wraps all poster call sites; bare `RadialToolkit` only inside that wrapper; Morph chrome when `liquid` slot present (no blue ring/wedge)

### Executor's Feedback or Assistance Requests

**Chip Move reverted (2026-08-12):** Human asked to keep chips as before — removed liquid-gooey Move from all pill rails. Chips use shared `layoutId` motion pills again (`SegmentedPillToolbar`, home browse/shortcuts, mobile tab bar). Radial Morph liquid unchanged. **DiaryVenueChips** restored to pre-edit layoutId In cinemas / At home + filters track (Agentation).

**Morph rail everywhere (2026-08-12):** Swapped catalogue / list lobby / list detail / profile filmography RMB menus to `SenseRadialToolkit`. Pending human QA: hold RMB on posters across `/home`, `/diary`, `/watchlist`, `/lists`, list detail, profile filmography — Morph fan only, no legacy blue ring. Reply **`ok`** when signed off.

**Fan speed (2026-08-12):** Human said open animation too slow → `LIQUID_FAN_TRANSITION` back to PlusMenu `bouncy` (320/17) and stagger `45 → 28` ms. Re-check RMB open feel; reply **`ok`** or ask for faster/slower.

**Search pill kbd (2026-08-12, Agentation):** Collapsed `HomeStickySearch` shows `⌘`/`Ctrl` + `K` kbd chips on the right (`sm+`, hidden while dialog open / committed search clear). Pending human QA on `/home`.

---

## Liquid gooey pill chrome (2026-08-12) — REVERTED for chips

**Mode:** Executor — Scope B Move on chips **reverted** (buggy end/content-load).  
**Package:** `liquid-gooey@0.1.0` remains for Radial Morph only.  
**Chips:** back to `layoutId` sliding `bg-card` pills.

---

## Subscription membership identity card (2026-08-12)

**Mode:** Executor — plan implemented.  
**Spec:** `docs/superpowers/specs/2026-08-12-subscription-identity-card-design.md`  
**UI:** `me-subscription-identity-card.tsx` + helpers in `subscription-identity-card.ts`  
**Wired:** `/me/settings/subscription` — identity stage + Invite & earn below.  
**Agentation (empty stage):** Stage is now a soft radial wash + `lg+` two-column layout (larger card + companion rail: plan name, tagline, status, flip, upgrades) so ultrawide (~2554×) doesn’t leave a lonely card in a void.  
**Glow rarity:** Specular + drop-shadow hue follows plan tier (Still silver → Attuned bronze → Immersed gold → Devoted magenta/cyan), aligned with avatar aura.  
**Per-plan chrome:** Still quiet hairline · Attuned bronze sheen · Immersed orbiting gold edge · Devoted iridescent aurora (+ rim spin). CSS in `globals.css`; live motion gated off soft GPU / reduced-motion.  
**Agentation:** Removed stage radial “white” wash (`card`/`foreground` blobs) — flat `bg-background` only; tier chrome stays on the card.  
**better-interface + transitions-dev (2026-08-12):** Hover-only shadow; Still chrome darkened; rail/card dedupe; flip label `t-text-swap`; live face status; Upgrade verb labels; press scale. Verdict was Needs changes → implemented.  
**Next:** Human QA on `/me/settings/subscription` (signed-in).

---

## Settings → Profile Discord block — better-interface (2026-08-12)

**Mode:** Planner — review only (awaiting **`b`** / **`go`** to execute).  
**Trigger:** Agentation on `MeDiscordConnect` `space-y-5` nest @ 2554×1386 — “design better /better-interface”.  
**Scope:** Discord section on `/me/settings/profile` (`MeSettingsSection` + `MeDiscordConnect` + funding strip). Identity/Privacy panels out of scope.

### better-interface review (mode: `full`)

**Stack:** Next App Router, Tailwind surface tokens, `MeSettingsPanel` / `MePreferenceToggle`, Lucide.  
**Boundary:** Source review of Discord settings states (loading / funding / Pro lock / connect / connected); rendered QA **Not verified**.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | `me-discord-connect.tsx` loading null; button labels; Finish setup alert | 1 finding |
| Layout | Nested `space-y-5`; section blurb vs in-panel title; funding `bg-card` in panel | 2 findings |
| Writing | Dual titles; Connect ID label; Connect row repeats blurb; “We couldn’t” | 2 findings |
| Typography | `text-sm` titles match Privacy rows | Clear |
| Colors | `bg-background` panel + funding `bg-card` inset | Clear |
| UI | Idle `t-icon-swap` empty slot gap on Connect | 1 finding (LOW) |

#### Findings

| # | Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | HIGH | Accessibility | `me-discord-connect.tsx:108` | `if (loading) return null` | Skeleton / `aria-busy` panel that keeps section height | Discord section vanishes on load → layout jump; no loading announcement |
| 2 | MEDIUM | Layout | `me-discord-connect.tsx:114–116` + `:225` | Outer `space-y-5` wrap + inner `space-y-5` connected stack | Single spacing owner (panel `space-y-6` like Privacy; inner stacks `space-y-3` / `gap` only) | Annotated nest `.space-y-5 > .space-y-5` doubles rhythm; uneven vs Privacy |
| 3 | MEDIUM | Writing | `settings-section-panels.tsx:241` + `me-discord-connect.tsx:215–221` | Section blurb + in-panel “Discord activity” + long body (+ Connect row repeats pitch) | One title owner: keep section description **or** in-panel title; Connect row = CTA only | Competing hierarchy; Connect duplicate copy |
| 4 | MEDIUM | Writing | `me-discord-connect.tsx:97–100` | `Connected (ID ${accountId})` | Patron-facing status (e.g. **Connected**) — no raw Discord ID | Settings should not surface opaque account IDs |
| 5 | LOW | UI | `me-discord-connect.tsx:312–324` | Idle Connect always reserves empty `t-icon-swap` `size-4` + `mr-2` | Hide idle icon slot (`data-state` / conditional width) or use a real idle glyph | Permanent blank gap before label |

#### Considered but rejected

| Location | Candidate | Rejected because |
| --- | --- | --- |
| Funding strip `bg-card` inside panel | Flatten strip to plain content | Strip is shared with Pricing; inset `bg-card` on `bg-background` matches intentional depth |
| Disconnect without confirm | Add confirm dialog | Reversible OAuth unlink; not account-deletion stakes |
| “We couldn’t add you…” | Rewrite without “we” | Tone OK for recoverable setup; lower priority than ID/copy hierarchy |

#### Verification

| Check | Result |
| --- | --- |
| Source: nested `space-y-5`, loading `null`, ID label | Passed |
| Rendered Discord states @ 2554× | **Not verified** (no signed-in browser pass this turn) |

**Verdict:** `Block` until loading null is fixed; then `Needs changes` for spacing + copy + ID.

### High-level Task Breakdown

1. **D.1 — Loading shell** — Never `return null`; show muted skeleton / `aria-busy` inside panel.  
2. **D.2 — Spacing** — One `space-y` owner; flatten nested `space-y-5`.  
3. **D.3 — Copy hierarchy** — Deduplicate section vs panel title; Connect row CTA-only; drop Discord ID from status.  
4. **D.4 — Connect icon slot** — No idle empty gap (optional with D.3).

### Project Status Board

- [x] D.1 Loading shell — pulse skeleton + `aria-busy` / sr-only; no `return null`
- [x] D.2 Spacing — wrap owns `space-y-6`; connected stack flattened (no nested `space-y-5`)
- [x] D.3 Copy — section blurb owns pitch; panel is CTA/status only; status **Connected** (no Discord ID); dropped `listAccounts` fetch
- [x] D.4 Connect icon idle gap — `DiscordActionSpinner` collapses to `size-0` when idle
- [ ] Human QA Discord block @ ~2554× + phone

### Executor's Feedback or Assistance Requests

**D.4 done — Discord redesign D.1–D.4 complete.** Please QA `/me/settings/profile` Discord section (loading skeleton, spacing, copy, Connect button with no idle gap). Reply **`ok`** when signed off.

---

## Settings → Profile — better-interface + transitions-dev (2026-08-12)

**Mode:** Executor — approach approved via **`execute`**; one task at a time.  
**Trigger:** Agentation on `/me/settings/profile` @ 2554×1324 — `MeSettingsPanel` (`min flex`) → “improve redesign /transitions-dev /better-interface”.  
**Scope:** `SettingsProfileSection` + `ProfileMediaCustomizer` + nested `MeDiscordConnect` (not whole MeAccountShell).

### Background and Motivation

Profile settings is a single stretched `MeSettingsPanel` that mixes identity fields, visibility, presence, and Discord. On ultrawide the flex-fill panel reads as empty chrome; Discord wraps a second `MeSettingsPanel` inside the first (card-in-card). Match the subscription-page pass: consolidate interface findings, then install only the lowest-overhead transitions-dev hooks that pay off.

### better-interface review (mode: `full`)

**Stack:** Next App Router, Tailwind tokens (`bg-card` / `bg-background`), `MeAccountShell`, `motion/react` reveal.  
**Boundary:** Source review of profile section components; rendered page **Not verified** (browser session redirected to `/sign-in`).

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | `settings-section-panels.tsx` birthday gate; form labels; visibility fieldset; Discord buttons | 1 finding |
| Layout | Panel nesting; `items-end` privacy stack; flex-1 stretch; Discord wrapper | 2 findings |
| Writing | Presence question title; unlabeled visibility; Discord cross-ref; Friends only | 2 findings |
| Typography | Labels `text-sm` / hints `text-xs`; `text-balance` on media help | Clear |
| Colors | `bg-card` controls on `bg-background` panel (intentional Mobbin) | Clear |
| UI | Enter stagger OK; pill rails already animated; nested surface chrome | 1 finding (via Layout) |

#### Findings

| # | Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | HIGH | Layout | `me-discord-connect.tsx:156–294` inside `settings-section-panels.tsx:94–209` | Discord always wraps `MeSettingsPanel` while already nested in the profile panel | Embed without a second panel (`variant="plain"` / no wrapper); Discord is a sibling section or inset group only | Card-in-card on `bg-card` lobby — same anti-pattern as Community feed rows |
| 2 | MEDIUM | Layout | `settings-section-panels.tsx:94–208` | One flex-1 panel: identity grid + `items-end` visibility + presence + Discord | Split: **Identity** panel (fields + bio) + **Privacy & presence** panel (labeled visibility, birthday show, online audience); Discord sibling section; stop right-aligning privacy | Ultrawide void + mixed jobs in one surface; grouping should be space + separate panels |
| 3 | MEDIUM | Writing | `settings-section-panels.tsx:193–202`, `me-discord-connect.tsx:200` | Presence titled “Who can see when I'm online?”; Discord quotes that question; visibility chips have no visible title | Title visibility **Profile visibility**; presence ON-state **Show online status to everyone** (off: Friends only); Discord refers to “online status” not the old question | Settings copy should name the ON state; visibility is unlabeled vs every other row |
| 4 | MEDIUM | Accessibility | `settings-section-panels.tsx:148–167` | Birthday show row uses `opacity-50` + `pointer-events-none` | Pass `disabled` into `MePreferenceToggle` (native `disabled` on both segment buttons + `aria-disabled` if needed); keep helper description | Opacity gate still leaves a focusable-looking control pattern; keyboard/AT need a true disabled state |
| 5 | LOW | UI | `me-discord-connect.tsx:283–290` | Spinner + label text swap with no enter/exit | Optional **icon-swap** on Connect / Opening… only if P.1–P.4 land clean | Polish; defer if scope creeps |

#### Considered but rejected

| Location | Candidate | Rejected because |
| --- | --- | --- |
| `me-form-field.tsx:12–13` | Restore focus rings on inputs | Intentional Mobbin flat controls; project convention |
| `MeProfileVisibilityToggle` | Add `t-text-swap` on Public/Private labels | `layoutId` pill already carries the state change; text-swap would double-animate |
| Presence “Friends only” | Rename to “People you follow” | Matches `presenceVisibility: friends` product term already shipped in Settings |

#### Verification

| Check | Result |
| --- | --- |
| Source structure of `SettingsProfileSection` + Discord nesting | Passed (nested panel confirmed) |
| Rendered `/me/settings/profile` @ 2554×1324 | **Not verified** — no signed-in browser session |
| Keyboard pass on birthday-disabled row | **Not verified** (needs runtime) |

**Verdict:** `Block` (HIGH nested panel) until P.1 lands; then `Needs changes` until P.2–P.4.

### transitions-dev review (profile scope)

1. `me-discord-connect.tsx` nested panel open states — looks like a surface growing inside a region → **panel-reveal** only if Discord stays expandable; prefer un-nesting first (no transition needed).
2. Privacy panel height when birthday unlocks — **card-resize** (`.t-resize`) on the privacy panel / birthday row.
3. Connect Discord idle ↔ loading icon — **icon-swap** (pair with finding #5).
4. Skip: modal/dropdown/badge (none new); page side-by-side (nav already route-transitions); success-check on Save (header-owned, out of annotation scope).

Run `transitions apply` on P.5 lines after structure lands.

### High-level Task Breakdown

1. **P.1 — Un-nest Discord** — `MeDiscordConnect` accepts embedded/plain mode (no `MeSettingsPanel`); profile mounts Discord as sibling `MeSettingsSection` (or plain inset under Privacy).  
   *Success:* No `MeSettingsPanel` descendant of another on `/me/settings/profile`.
2. **P.2 — Split Identity vs Privacy panels** — Identity = media + name/pronouns/location/website/DOB/bio; Privacy = visibility (titled) + birthday show + presence; full-width content-sized panels (no lonely `items-end`); first flex grow only if content fills.  
   *Success:* Two clear jobs; ultrawide doesn’t show a half-empty single slab.
3. **P.3 — Copy** — Visibility + presence titles; Discord cross-ref; keep Friends only.  
   *Success:* No question-as-title; Discord doesn’t quote a removed string.
4. **P.4 — Birthday toggle a11y** — `disabled` prop on `MePreferenceToggle`.  
   *Success:* Segment buttons not activatable without DOB; description still explains why.
5. **P.5 — transitions-dev** — `.t-resize` on privacy block when birthday row enables; optional icon-swap on Connect.  
   *Success:* Snippets + reduced-motion guards; no duplicate `:root` tokens.

### Project Status Board

- [x] P.1 Un-nest Discord — `MeDiscordConnect` `surface="plain"|"panel"`; profile mounts sibling section + one panel (no panel-in-panel)
- [x] P.2 Split Identity / Privacy panels — Identity (media + fields + bio); Privacy (titled visibility, birthday show, presence); Discord sibling; `fillFirst={false}` content-sized
- [x] P.3 Copy — presence ON-state title; Discord cross-ref to “online status”; Friends only kept
- [x] P.4 Birthday disabled state — `MePreferenceToggle` `disabled` prop; no opacity/`pointer-events` wrapper
- [x] P.5 transitions-dev — `.t-resize` on Privacy panel; icon-swap on Discord Connect / Finish setup; reused existing `--resize-*` / `--icon-swap-*` tokens
- [ ] Human QA signed-in @ ~2554× + phone

### Executor's Feedback or Assistance Requests

**P.5 done — please verify on `/me/settings/profile`:** Privacy panel has `t-resize`; Connect Discord / Finish setup use `t-icon-swap` for the spinner. Full Profile redesign (P.1–P.5) + `/me/settings` redirect ready for Human QA. Reply **`ok`** when signed off.

---

## MeAccountShell / Appearance — better-interface redesign (2026-08-12)

**Mode:** Executor (`execute` on consolidated review).  
**Scope:** `MeAccountShell` + Appearance (settings chrome shared across `/me/settings/*`).

### High-level Task Breakdown

1. **A.1 — Mobile nav** — Horizontal chip rail + edge fades below `lg`; vertical sticky rail on `lg+` (single DOM track / one `layoutId`).  
   *Success:* Narrow viewport first fold shows theme body sooner; nav scrolls horizontally.
2. **A.2 — Theme depth + selected** — Tiles `bg-card` (selected `bg-foreground/8` + dot cue); Pro badge `bg-background`.  
   *Success:* Tiles readable on `MeSettingsPanel`; active theme obvious.
3. **A.3 — Top bar + heading** — Section `h1` centered in top bar; drop duplicate section titles; back pill hover without `muted`.  
   *Success:* One page `h1` per settings route; Calm hover visible.

### Project Status Board — Appearance shell

- [~] A.1 Nav layout — **unchanged** vertical rail; section icons added (Lucide Data stroke matched)
- [x] A.2 Theme tiles + Pro badge — refined (taller swatch, concentric radius, hover wash)
- [x] A.3 Top bar h1 + hover — awaiting human QA
- [x] A.4 Full-height **MeSettingsPanel** — default on all settings sections (Catalogue + every route); multi-section pages grow the first block

### Executor's Feedback or Assistance Requests

Continued without reshaping the nav. Please QA `/me/settings/appearance` on your 2554px viewport + a phone width: icons, theme tiles, centered title, content not stretching edge-to-edge.

---

## Review translation — read reviews in other languages (2026-08-11)

**Mode:** Planner — brainstorming (awaiting design approval; no implementation yet).  
**Trigger:** "i need a way for users to be able to translate reviews in other languages".

### Background and Motivation

Sense is a social identity platform for taste, and the Community layer (reviews, activity, movie/TV detail carousels) mixes patrons from every language. A patron who writes in Japanese or Spanish is effectively invisible to readers who don't share the language: the review body renders as opaque text, so it can't earn likes, comments, or follows. Translation turns the whole Community corpus into readable signal instead of a per-language silo, which matters more the smaller the user base is.

Current state (explored 2026-08-11):

- `review.body` is a single `text` column in `packages/db/src/schema/activity.ts` — **no language column** anywhere on `review`.
- The full-read surface is `apps/web/src/components/review/review-detail-sheet.tsx` (Vaul drawer); previews live in `review-card.tsx`, `movie-detail-reviews-carousel.tsx`, `review-activity-copy.tsx`, `community-review-feed-row.tsx`, and two profile cards that render raw `{review.body}` without the mention parser.
- Bodies carry inline mention tokens (`#[Title](/movies/id)`, `@[Name](/people/id)`) parsed by `apps/web/src/lib/content-mentions.ts` — translation must not destroy them.
- There is **no i18n library and no AI/LLM dependency** in the repo. The only language plumbing is TMDb catalogue metadata (`resolveCatalogTmdbLanguage`, `TMDB_LANGUAGE_WHITELIST`), which is about posters/overviews, not user text.
- Reusable infrastructure exists for the server side: `apps/server/src/lib/rate-limit.ts` (`hit()`), `apps/server/src/lib/redis-cache.ts` (`cachedRead()`), and env validation in `packages/env/src/server.ts`.

### Key Challenges and Analysis

1. **Engine choice is the load-bearing decision** — nothing exists today, so this drives env vars, cost, offline/dev behaviour, and whether any server route is needed at all.
2. **Knowing when to offer it** — without a source-language signal we'd either show "Translate" on every review (noise) or detect language on read (cost). Storing detected language at publish time is the cheap fix.
3. **Mention + spoiler integrity** — translated text must round-trip mention tokens and still pass through `ReviewSpoilerGuard`.
4. **Surface scope** — full-read drawer only, or previews too? Previews are the discovery surface but multiply translation volume.
5. **Cost and abuse** — translation is metered; needs `hit()` rate limits plus a durable cache so a popular review is translated once, not once per reader.

### Approved approach (human, 2026-08-11 — spec doc skipped, straight to Executor)

| Decision | Choice |
| --- | --- |
| Engine | Server-side **LLM** behind a small swappable provider interface, Redis-cached |
| Source language | **Detected on publish/edit and stored** on `review.source_language` (free local detector) |
| Target language | **Browser locale by default**, overridable via a new patron preference |
| Surfaces (v1) | **Full-read review drawer only** (`review-detail-sheet.tsx`) — previews later |
| Persistence | **Postgres `review_translation` table** with Redis in front |

**Out of scope for v1:** preview surfaces (feed/carousel/profile cards), comment translation, auto-translate, translated pages for SEO.

**Non-negotiable constraint:** mention tokens (`#[Title](/movies/438631)`, `@[Name](/people/1032)`) must survive translation **verbatim** — label and link target both — or `content-mentions.ts` parsing and canonical title display break. Translated bodies still render through `ReviewBodyWithMentions` inside `ReviewSpoilerGuard`.

### High-level Task Breakdown (Executor, one task per `go`)

1. **T.1 — DB** — migration `0041_review_translation.sql` (`review.source_language` + `review_translation` table) + Drizzle schema + journal entry.  
   *Success:* journaled migration applies cleanly; `activity.ts` typechecks; unique `(review_id, target_language)`.
2. **T.2 — Detection** — `apps/server/src/lib/detect-language.ts` (`tinyld`), wire into `POST`/`PATCH /api/reviews`, one-off backfill script for existing rows.  
   *Success:* per-language fixtures pass; short/ambiguous text returns `null`; backfill fills legacy rows at zero API cost.
3. **T.3 — Provider** — `review-translation-provider.ts` interface + AI SDK implementation, optional env vars in `packages/env/src/server.ts`.  
   *Success:* unset env disables the feature cleanly (no boot crash, same pattern as Polar/Resend); prompt test proves mention tokens round-trip.
4. **T.4 — API** — `POST /api/reviews/:id/translate` (session required, visibility gate, `hit()` rate limit, same-language short-circuit → table → Redis → provider); `sourceLanguage` + `canTranslate` on `GET /api/reviews/:id`; `PATCH` invalidates.  
   *Success:* route tests cover same-language, cache hit, visibility 404, 429.
5. **T.5 — Web plumbing** — `review-translation-language.ts` resolution + `reviewTranslationLanguage` preference + Settings select (default Automatic).  
   *Success:* resolution unit test; preference persists.
6. **T.6 — Drawer UI** — `Translate to English` → `Translated from Japanese · Show original` in `review-detail-sheet.tsx`; `bg-background` pill on `bg-card`, no borders/rings; errors leave the original text in place.  
   *Success:* human QA on a foreign-language review.
7. **T.7 — Verify** — focused test run + human QA checklist.

## Movie detail Community tab — better-interface (2026-08-11)

**Mode:** Executor (`execute` on consolidated review).  
**Scope:** `/movies/[id]?view=community` stacked Community body (+ TV parity where shared).

### High-level Task Breakdown

1. **C.1 — Score on Community** — Pass community average / counts / engagement into `MovieDetailCommunityPanel` → compact `MovieDetailCommunityRatingHero` at top of stacked body; fix subtitle so it matches what’s on the tab.  
   *Success:* Community first fold shows score (when present) + chips when signed in; subtitle no longer lies.
2. **C.2 — Rail + spacing** — Soften review rail `min-h` for short rails; tighten `space-y-14` so Lists peek sooner.  
   *Success:* With a few reviews, Lists enter the first scroll without a full-viewport dead zone.
3. **C.3 — Empty reviews CTA** — Empty reviews match Lists empty pattern with Write a review action.  
   *Success:* 0 reviews shows orientation + CTA that opens the review composer.
4. **C.4 — Loading skeleton** — Community fallback mirrors stacked score → rail → lists (not old tablist/related).  
   *Success:* Suspense fallback shape matches shipped layout.
5. **C.5 — Lists polish** — Drop decorative `shadow-sm` on list tiles; fix system Favorites public description.  
   *Success:* No diary second-person blurb on others’ Favorites; flat canvas-on-card tiles.
6. **C.6 — Pasito a11y** — Review stepper tabs named by review, not “Step N”.  
   *Success:* Snapshot/SR labels include title or @handle.

### Project Status Board — Community tab

- [x] C.1 Score + chips + subtitle — awaiting human QA
- [x] C.2 Rail height + spacing — awaiting human QA
- [x] C.3 Empty reviews CTA — awaiting human QA
- [x] C.4 Loading skeleton — awaiting human QA
- [x] C.5 Favorites blurb + list shadow — awaiting human QA
- [x] C.6 Pasito review labels — awaiting human QA

### Executor progress — Community C.1–C.6 (2026-08-11)

- **C.1** — `MovieDetailCommunityPanel` / `TvDetailCommunityAsync` pass `communityAverage`, counts, engagement into stacked `MovieDetailExploreTabs`; compact `MovieDetailCommunityRatingHero` at top; subtitle now “Community score, reviews, and public lists…”.
- **C.2** — Review rail `min-h` softened to `min(22rem,50vh)`; stacked community stack `space-y-14` → `space-y-10`.
- **C.3** — Empty reviews uses Lists-style empty + **Write a review** → `useReviewComposer` (movies only when `movieId` + title present).
- **C.4** — `MovieDetailAboutBodyFallback` `variant="community"` mirrors score → rail → list tiles (no tablist/related).
- **C.5** — Dropped list-tile `shadow-sm`; Favorites create/repair clears second-person diary blurb; tile also hides that string if still in DB.
- **C.6** — `DetailArtworkPasitoStepper` patches Pasito `Step N` labels via `getStepLabel`; review rail passes `@handle` + title.

### Executor's Feedback or Assistance Requests

Please QA on `/movies/[id]?view=community` (signed-in): compact score + chips, Lists peek sooner, empty-review CTA if 0 reviews, Favorites tiles without diary blurb. Reply **ok** / issues. Planner should not mark complete until you confirm.

**Streaming prices (2026-08-11):** P.1–P.5 implemented gated. Add `STREAMING_AVAILABILITY_API_KEY` to `apps/server/.env`, restart API, set a catalogue watch region, open `/movies/[id]?view=streaming` — preferred-region Rent/Buy should show amounts (e.g. `$3.99`). Reply **ok** / issues. Without the key the tab correctly stays checkmark-only.

---

## Movie detail Streaming tab — better-interface (2026-08-11)

**Mode:** Executor (`go` on Approach A).  
**Trigger:** Agentation on `MovieDetailViewShell` body @ `/movies/1339713?view=streaming` (viewport 2554×1324) + `/better-interface`.  
**Scope boundary:** Streaming tab body only (`MovieDetailStreaming` + shell wrapper). Not About hero, Community, Quotes, or top-bar chrome beyond heading ownership when Streaming is active.

### Background and Motivation

Streaming is the “where can I watch this?” job on title detail. Live check on Obsession (~22 providers, long country lists): the tab never deep-links out, never surfaces the patron’s watch region, and (unlike Community) paints with **no page heading** while About’s `<h1>` is unmounted.

### Recommended approach (approve with `b`)

**Approach A — Actionable availability board (recommended)**  
Keep the provider rail; make country rows the action surface (JustWatch `row.link` when present); clarify Stream vs Rent vs Buy; pin/filter the patron’s catalogue watch region; restore a Streaming heading + tabpanel a11y; drop hairline table chrome for surface-depth grouping.

**Rejected for now:** full JustWatch embed; price pills (TMDb has none); deleting the provider rail.

### High-level Task Breakdown (post-`b`)

1. **S.1 — Heading + landmarks** — Visible Streaming section title (parity with Community) when About hero is unmounted.  
2. **S.2 — Actionable rows** — Wire `row.link` to JustWatch per country.  
3. **S.3 — Offer vocabulary** — Stream ≠ Rent ≠ Buy (don’t collapse flatrate+rent under “Watch”).  
4. **S.4 — Region first** — Pin/highlight or filter patron catalogue watch region.  
5. **S.5 — Provider tablist a11y** — Arrow-key roving + `aria-controls` / `tabpanel`.  
6. **S.6 — Surface chrome** — Replace `border-b` / `divide-y` / logo `shadow-sm` with spacing + raised tiles.  
7. **S.7 — Empty copy** — Patron-facing empty states without “TMDb sync” jargon.

### Project Status Board — Streaming tab

- [x] S.1 Heading + landmarks — human `ok`
- [x] S.2 Actionable JustWatch rows — human `ok`
- [x] S.3 Stream / Rent / Buy clarity — human `ok`
- [x] S.4 Watch-region personalization — human `ok`
- [x] S.5 Provider tablist keyboard — human `go`
- [x] S.6 Surface depth (no hairlines) — human `go`
- [x] S.7 Empty-state copy — awaiting human QA

### Executor progress — S.1 (2026-08-11)

- `MOVIE_DETAIL_SECTION.streaming` anchor added.
- `MovieDetailStreaming` wraps empty + filled bodies in `MovieDetailBodySection` (`h2` **Streaming** + subtitle).
- Shell uses `MOVIE_DETAIL_ABOUT_COLUMN_CLASSNAME` (Community/About column parity).
- Verified live: a11y tree shows `heading level 2: Streaming`.

### Executor progress — S.2 (2026-08-11)

- `CountryAvailabilityRow` — full-row `<a>` to TMDb `row.link` (JustWatch) when present; outbound arrow cue; hover via `DETAIL_CANVAS_ON_CARD_HOVER_CLASS`.
- Checkmarks stay visual; decorative under the row link so SR hears one action name.
- Footer: “Tap a country to open JustWatch…”.
- Verified live: 26 country links named `Open JustWatch for Apple TV Store in …`.

### Executor progress — S.3 (2026-08-11)

- Country table columns are **Stream · Rent · Buy** (flatrate / rent / buy mapped 1:1 — no combined Watch).
- Grid is `1fr auto auto auto` with slightly tighter column mins on narrow widths.

### Executor progress — S.4 (2026-08-11)

- Movie/TV detail RSC resolve `catalogWatchRegion` via cached `fetchMeProfile` + `readCatalogTmdbWatchRegionPref` (ISO2 only; `ALL`/unset → null).
- `orderCountryRowsByPreferredRegion` pins preferred country first; unit tests **3/3**.
- Preferred row: raised `bg-background` + **Your region** pill; missing-region status copy when the service doesn’t list that country.

### Executor progress — S.5 (2026-08-11)

- Provider rail: roving `tabIndex`, `aria-controls` → countries `role="tabpanel"`, Arrow/Home/End selection + focus + `scrollIntoView`.
- Verified: ArrowRight moves selection from Apple TV Store → next service; inactive tabs `tabIndex=-1`.

### Executor progress — S.6 (2026-08-11)

- Dropped provider logo `shadow-sm`, country header `border-b`, and list `divide-y`.
- Country rows use `gap-1` + rounded tiles; preferred region keeps raised `bg-background`.

### Executor progress — S.7 (2026-08-11)

- Empty states: title + editorial support line (Lists/reviews pattern).
- Theatrical: **Only in cinemas for now** / check-back at home.
- Generic: **No at-home options yet** / no TMDb “sync” jargon.
- Footer softens to “Tap a country for options…”.

### Executor's Feedback or Assistance Requests — Streaming

S.1–S.7 human closed via follow-on pricing request (2026-08-11).

---

## TV title score — average of seasons/episodes (2026-08-11)

**Mode:** Planner / brainstorming (Approach 1 approved via `go`; design sections in progress).  
**Trigger:** Agentation on Shows ledger — multiple season posters with separate ratings feel like “fake” show ratings; user wants product-wide derived title score.

### Decisions locked

- Scope: **product-wide** title score for a series (not ledger-only).
- Rated **whole-series** (`log_scope = show`) log(s) **win** — that average is the title score (no season roll-up).
- Else: episode ratings → season score → average seasons → show score.
- Within a scope unit, **average all rated logs** (rewatches included).
- Implementation approach: **shared pure resolver** on read (no materialize-on-write in v1).

### Design §1 — approved (`go`)

Resolver rules + v1 surfaces (community, following, profile/list captions, ledger series score vs season tile ratings).

### Design §3 — approved (`go`)

Edge cases, TDD fixtures, out of scope (no write materialize / no episode-count weights).

**Spec:** `docs/superpowers/specs/2026-08-11-tv-title-score-design.md` (committed).  
**Plan:** `docs/superpowers/plans/2026-08-11-tv-title-score.md` (committed).  
### Executor note — Reviews ranks follow button (2026-08-11)

Removed `MembersFollowButton` from Community Reviews/Likes/Lists rank rows for parity with Film/TV ranks. Deleted `members-follow-button.tsx`. Follow remains on profiles.

---


**Mode:** Executor (`go` on Approach A — E.1+E.2 shipped; awaiting E.3 human QA).  
**Trigger:** Agentation on `/home?browse=community&sort=ranks&rank=episodes` — “says I’ve seen 0 episodes even though I completed seasons / whole shows”.

### Background and Motivation

**Episodes** ranks previously counted only diary rows with `log_scope = 'episode'`. Completing a season writes `tv_watch_episode` progress **and** a **season** diary log (`log_scope = 'season'`). Whole-show Quick Logs are `log_scope = 'show'`. Those never entered the Episodes board, so patrons who binge via season-complete / show logs correctly showed **0** here while **Shows** ranks still counted them.

### Key Challenges and Analysis

1. AGENTS / previous SQL intentionally isolated Episodes as the episode-scope slice (`leaderboard-query.ts` `logScopeFilter`).
2. Patron mental model: “I’ve watched those episodes” after marking seasons complete — the UI copy (“0 episodes”) reads as life total watched, not “0 episode-scoped diary rows”.
3. Expanding counts needs a weight rule (season → N episodes from TMDb) and ledger UX so a season log doesn’t look like a single episode line.
4. Counting raw `tv_watch_episode` would mix progress into ranks and bypass diary `visibility` (ranks are public-diary-only today).

### Approved approach (human `go` 2026-08-11)

**Approach A — Weight season/show diary logs as episode equivalents**

- Episodes board `count` = sum of weights on **public** TV diary logs in the period:
  - `episode` → **1**
  - `season` → TMDb/`tv` cache **episode_count** for that season (≥1 fallback)
  - `show` → series **number_of_episodes** (or sum of season counts; ≥1 fallback)
- Dedup within period: **episode logs win for that season**; season log only counts when no episode logs for that `tvId+season` in window; show log suppressed when any season/episode exists for that title.
- Ledger lists underlying diary rows with season/show weight captions; count badge shows weighted total.
- **Shows** ranks stay unweighted log-row counts (unchanged).

### High-level Task Breakdown

1. **E.1** — Pure weight helper + dedupe rules + unit tests.  
2. **E.2** — `fetchLeaderboard` / ledger queries for `kind=episodes` use weighted sum.  
3. **E.3** — Human QA: season-complete → Episodes rank &gt; 0; Shows unchanged; no double-count with per-episode logs.

### Project Status Board — episode ranks

- [x] E.1 Weight helper + tests — `leaderboard-episode-weight.ts` (+ `.test.ts`)
- [x] E.2 Leaderboard + ledger SQL/service — `leaderboard-query.ts`; ledger captions in `patron-watch-ledger-poster-labels.ts`
- [ ] E.3 Human QA

### Executor progress (2026-08-11)

- Weighted SQL `sum(case…)` with `tv.tmdb_json` season/`number_of_episodes` lookups; EXISTS dedupe for season vs episode and show vs season/episode.
- Ledger returns `logScope` / `seasonNumber` / `episodeWeight`; poster caption e.g. **Season 2 · 10 episodes**.
- **Fix (Agentation):** period/lifetime ordinals group by TV **scope unit** (`season:N` / `episode:S:E` / `show`), not bare `tvId` — Squid Game S1 + S2 no longer read as “2nd this month”.
- **Fix (Agentation, Shows ledger):** poster captions always show **Whole series** / **Season N** / **S#E#** so duplicate series covers are distinguishable (not only when Episodes `episodeWeight` is set).

### Executor's Feedback or Assistance Requests

Please re-open your Episodes ledger for Squid Game seasons — each season tile should stand alone (no false rewatch / “Nth this month”). Reply **ok** / issues.

---


**Mode:** Executor (`go` on Approach A — recommended defaults).  
**Trigger:** “i want to have the prices of buy and rent” on movie detail Streaming.

### Background and Motivation

The Streaming tab now shows Stream · Rent · Buy as checkmarks. Patrons need **how much** to rent or buy, not only whether an offer exists. Today’s data path is TMDb `watch/providers` via JustWatch attribution — that payload has **provider presence only**, no `retail_price` / currency. Footer copy already admits checkmarks ≠ live prices.

### Key Challenges and Analysis

1. **TMDb cannot supply prices** — `TmdbWatchProviderRow` is id/name/logo only; no price fields in the API response we cache.
2. **JustWatch partner API** documents offers with price + currency + monetization type (rent/buy/flatrate) — licensed, stable, but needs partner access / cost.
3. **Unofficial JustWatch GraphQL** can return `retail_price` but is undocumented, may break, and is a ToS/risk choice for a shipping product — not recommended as the long-term source.
4. **Scale** — Showing prices for every country × every provider is expensive (N×M offers). Pinning to the patron’s **catalogue watch region** (S.4) makes v1 tractable: one country, many providers (or one selected provider × one country).
5. **Display** — Multiple qualities (SD/HD/4K) often mean multiple rent/buy prices; need a rule (cheapest HD, or “from $X”).

### Approved approach (human `go`, 2026-08-11)

**Approach A — Region-priced offers via Streaming Availability (movieofthenight)**

Locked defaults:

| Decision | Choice |
| --- | --- |
| Source | **Streaming Availability API** v4 (direct or RapidAPI) |
| Scope | **Patron catalogue watch region only** |
| Price rule | **Lowest HD** (then qhd/uhd, then SD) |
| Cache | Redis 12h via `cachedRead` |
| Degraded | No `STREAMING_AVAILABILITY_API_KEY` → checkmarks only |

**Rejected for now**

| Candidate | Why reject |
| --- | --- |
| B — Scrape unofficial JustWatch GraphQL from the web app | Fragile + ToS risk; breaks without notice |
| C — Prices for every country in the table | Cost/latency blow-up; table becomes a spreadsheet |
| D — Fake/static prices | Misleading |

### High-level Task Breakdown

1. **P.1 — Provider decision** — Streaming Availability + optional env.  
2. **P.2 — Server enrich** — `GET /api/movies|tv/:id/streaming-prices?region=XX`.  
3. **P.3 — Cache + rate limit** — Redis TTL + `hit()` 60/min.  
4. **P.4 — UI** — Rent/Buy show formatted price on preferred-region row.  
5. **P.5 — Copy** — Live-price footer when amounts shown.

### Project Status Board — streaming prices

- [x] P.1 Streaming Availability + env schema — **awaiting human API key**
- [x] P.2 Server enrich route + mapper — awaiting human QA with key
- [x] P.3 Redis cache + rate limit — awaiting human QA with key
- [x] P.4 UI prices on preferred-region row — awaiting human QA with key
- [x] P.5 Footer copy when prices present — awaiting human QA with key

### Executor progress — streaming prices (2026-08-11)

- Env: `STREAMING_AVAILABILITY_API_KEY` + optional `STREAMING_AVAILABILITY_BASE_URL` in `packages/env/src/server.ts` (Polar/Resend optional pattern).
- Server: `streaming-availability-prices.ts` — fetch `GET /shows/movie|tv/{id}?country=`, lowest-HD pick, name-key aliases for TMDb matching; Redis key `sense:streaming-prices:v1:…` (12h).
- Routes: `GET /api/movies/:id/streaming-prices` + `GET /api/tv/:id/streaming-prices` — 400 bad region, `{ configured: false }` when unset, 429 via `hit()`, 502 on upstream failure.
- Web: `MovieDetailStreaming` client-fetches when region set; overlays prices on **Your region** row only; footer switches to live-price copy when amounts render.
- Tests: 8 server + 2 web unit tests green.
- **Live key wired (2026-08-11):** RapidAPI key + `STREAMING_AVAILABILITY_BASE_URL=https://streaming-availability.p.rapidapi.com` in `apps/server/.env`. Smoke test `movie/550` US returned Prime rent/buy amounts.
- **Bugfix (checks not prices):** Duplicate RapidAPI key header casings caused 403; fixed to single `x-rapidapi-key`.
- **2026-08-11 evening:** Removed forced provider auto-select (it stole focus). Prices now load for **all countries** in one upstream call (`offersByCountry`); provider rail is freely choosable again.

### Open questions — resolved by Approach A defaults

1. Region-only — **yes**.  
2. Source — **Streaming Availability**.  
3. HD vs 4K — **lowest HD**.

### Project Status Board — review translation

- [x] T.1 DB migration + schema — human ran `db:migrate` (2026-08-11)
- [x] T.2 Language detection + backfill (backfill `--apply` still pending human)
- [x] T.3 Translation provider + env (needs `AI_GATEWAY_API_KEY` from human to run live)
- [x] T.4 Translate API + invalidation
- [x] T.5 Web language resolution + preference + Settings select
- [x] T.6 Drawer UI — human verified (`good ok`, 2026-08-11); control moved above body on Agentation feedback
- [x] T.7 Verify — focused suites green; human drawer QA via T.6 (`good ok`)

### Executor progress — T.1 (2026-08-11)

- `packages/db/src/migrations/0041_review_translation.sql` — additive: `ALTER TABLE review ADD COLUMN IF NOT EXISTS source_language text` + `CREATE TABLE IF NOT EXISTS review_translation` (`id`, `review_id` FK cascade, `target_language`, `title`, `body`, `model`, `created_at` tz) with `CONSTRAINT review_translation_review_language_uk UNIQUE (review_id, target_language)`.
- Journal entry `idx: 41` registered in `meta/_journal.json` (unjournaled files are silently skipped — see Lessons).
- `packages/db/src/schema/activity.ts` — `review.sourceLanguage`, `reviewTranslation` table, `reviewTranslationRelations`, `translations: many(...)` on `reviewRelations`.
- No redundant `review_id` index — the unique constraint's backing index already covers the prefix.
- Verified: `tsc --noEmit -p packages/db` clean for `activity.ts` (the three `pg` `TS7016` errors are pre-existing, missing `@types/pg`). Biome's whole-file CRLF complaint is repo-wide on Windows checkouts — untouched `quote.ts` reports the same; diff is +50/−1, not a line-ending rewrite.
- **Not run:** `bun run db:migrate` — left to the human since it mutates the live Neon database. *(Human confirmed applied, 2026-08-11.)*

### Executor progress — T.2 (2026-08-11)

- **`apps/server/src/lib/detect-language.ts`** — `detectReviewLanguage(body)` → base ISO-639-1 tag or `null`; `stripUndetectableNoise` removes mention tokens + URLs first (they drag detection toward English). Dependency **`tinyld@1.3.4`** added to `apps/server`, imported as **`tinyld/light`** (see Lessons — the full model calls plain English "Berber" at accuracy 1.000).
- Gating is by **length**, not tinyld's accuracy score: **24** chars latin, **8** for CJK/hangul. Accuracy is unusable as a gate (correct Spanish = 0.11, wrong answers = 1.000).
- **`apps/server/src/routes/reviews.ts`** — `sourceLanguage` set on `POST /` and recomputed on `PATCH /:id` **only when the body text actually changed** (a visibility-only edit must not churn it). Hoisted `nextBody` so the trim happens once.
- **`apps/server/scripts/backfill-review-source-language.ts`** + `bun run reviews:backfill-language` — dry run by default, `--apply` to write; raw SQL so the `updatedAt` `$onUpdate` hook does not stamp every legacy review as edited.
- **Dry run against production data:** 501 rows without a language → **447 detected, 54 too short/ambiguous**; `en=367 it=47 hi=16 fr=3 pt=3 nl=2 pl=2 fi=2 de=2 tr=1 es=1 ro=1`. The pre-`light` run produced `ber=5 rn=2 eo=1 af=1` junk on English/Italian rows — the corpus is what caught it.
- Tests: **18/18** in `detect-language.test.ts`, including regressions built from the real misdetected rows (elongated English, casual English, abbreviated Italian) and non-latin coverage (zh/ru/ar/hi).
- Also removed a now-unused `count` import in `reviews.ts` left behind by **pre-existing uncommitted work** in the tree (the plan-tier → `fetchPatronAvatarBadgeMaps` refactor) — it was failing `check-types`.
- Verified: no regression. `check-types` clean for all touched files; failing suites (Lanyard, Letterboxd, listing-presence, taste-overlap) pass in isolation or are the known `mock.module` ordering pollution.
- **Not run:** `reviews:backfill-language --apply` — one write command, left to the human.

### Executor progress — T.3 (2026-08-11)

- **`apps/server/src/lib/review-translation-tokens.ts`** — `maskMentionTokens` / `restoreMentionTokens`. Mention tokens are swapped for numbered `[[n]]` placeholders **before** the model sees them and restored after, so preservation is **structural, not a prompt request**. Restoring throws `MentionPlaceholderError` when the model dropped, duplicated or invented a placeholder — a review whose links silently vanished is worse than no translation, so the caller keeps the original. Placeholders may legitimately **move** (word order differs per language) and padded `[[ 0 ]]` is tolerated. Side benefit: the model never receives link targets, so it cannot translate canonical film titles.
- **`apps/server/src/lib/review-translation-provider.ts`** — `ReviewTranslationProvider` seam (`translate(request)`), `createReviewTranslationProvider(generate?)` with an **injectable generate** so masking/prompting/restoring is testable without a key or network. Gateway impl uses `generateObject` + `gateway(model)` from **`ai@^7.0.59`**, `temperature: 0.2`. Prompt rules: keep placeholders, don't translate titles/names, **keep the writer's register** (slang/profanity/enthusiasm — no politeness drift), no added commentary.
- Language names for prompts come from **`Intl.DisplayNames`**, not a hardcoded map — no new shared package needed, and the web side can localise the same tags for the reader.
- **`packages/env/src/server.ts`** — `AI_GATEWAY_API_KEY` + `REVIEW_TRANSLATION_MODEL`, both `optionalNonEmptyString()` (Polar/Resend pattern). `isReviewTranslationConfigured()` is the feature switch; default model `google/gemini-2.5-flash-lite`.
- Tests: **17/17** across `review-translation-tokens.test.ts` (8) and `review-translation-provider.test.ts` (9) — including placeholder reordering, drop/duplicate/invent failures, and the model inventing a title for a review that had none.
- `check-types` clean for all touched files.
- **Blocked for live use:** `AI_GATEWAY_API_KEY` is **not set** in `apps/server/.env`, so no end-to-end call was possible. Until it is set the feature reports itself unconfigured and the UI will hide the control — which is the intended degraded behaviour, not a bug.

### Executor progress — T.4 (2026-08-11)

- **`apps/server/src/lib/review-translation-service.ts`** — `resolveReviewTranslation(source, target, deps)` with **injected** `loadStored` / `saveStored` / `translate`. Cheapest path first: **same-language short-circuit → stored row → provider (then persist)**. Kept out of the route deliberately: a route test for `reviews.ts` would need a ~200-line mock of the whole module graph, whereas this unit is exhaustively testable. Also exports **`normalizeLanguageTag`** (`en-US`/`PT_br` → `en`/`pt`; region dropped so `en-US` and `en-GB` don't double the bill; junk → `null`).
- **`POST /api/reviews/:id/translate`** in `reviews.ts` — session required (anonymous access is an open faucet on a metered model), **503** when unconfigured, `normalizeLanguageTag` **400** on junk, **`hit()`** 20/min burst + **200/day** ceiling, then the **same `canViewContent` visibility gate as `GET /:id`** so translation can never become a way to read a review you can't otherwise see. Empty body → 400.
- **Caching:** Redis via `cachedRead` wraps the service call with key `sense:review-translation:{id}:{lang}:{updatedAtMs}` (TTL 24h). Putting **`updatedAt` in the key** means an edit self-invalidates the hot cache with no explicit Redis invalidation path. Postgres `review_translation` stays the source of truth; Redis exists to keep repeat reads off Neon (per the Neon compute reduction work).
- **Invalidation:** `PATCH /:id` deletes `review_translation` rows **only when the body text actually changed** — a visibility or rating edit must not throw away paid-for translations.
- **`MentionPlaceholderError` → 502**, leaving the reader on the original text; any other provider error also 502 with a `console.error` breadcrumb.
- **`GET /api/reviews/:id`** now returns **`canTranslate`** (engine configured ∧ `sourceLanguage` known ∧ non-empty body). `sourceLanguage` already rides along in the spread `row.review`.
- Tests: **12** new — `review-translation-service.test.ts` (7, incl. "does not persist when the provider fails") and `reviews-translate.test.ts` (5 guard rails: 401 unsigned, 503 unconfigured, 400 junk/traversal language, schema rejection). The route test also proves the endpoint is actually mounted.
- Full server suite **812 pass / 11 fail** — same 11 pre-existing failures as before T.2 (779/11); every one of the 33 tests added across T.3–T.4 passes. `check-types` clean for all touched files.

### Executor progress — T.5 (2026-08-11)

- **`apps/web/src/lib/review-translation-language.ts`** — `REVIEW_TRANSLATION_LANGUAGE_OPTIONS` (18 base tags for the Settings dropdown), `normalizeReviewTranslationLanguage`, `resolveReviewTranslationLanguage({ preference, navigatorLanguage })` → **pref → browser → `en`**, and `reviewLanguageDisplayName(tag, displayLocale)` on `Intl.DisplayNames` (same approach as the server prompt side, no hardcoded name map). The option list is deliberately **not** a whitelist for resolution: a patron whose browser is set to a language we don't list (Czech, say) still gets translations — the list only keeps the dropdown short.
- **Bug caught by its own test:** `"not-a-language"` split on `-` yields `"not"`, which passes a bare `^[a-z]{2,3}$` check, so junk would have reached the model as a real language. Both normalizers now require the **whole** string to be locale-shaped (`^[a-z]{2,3}([-_][a-z0-9]{2,8})*$`) before taking the base tag. Fixed on the server too (`review-translation-service.ts`) with a regression test, so the two stay in parity.
- **Preference** — `PROFILE_PREF_REVIEW_TRANSLATION_LANGUAGE` (`"reviewTranslationLanguage"`) + `readReviewTranslationLanguagePref` in `profile-preferences.ts`, normalized on read so a legacy `en-GB` collapses to `en`. Empty/absent means "follow the browser", which is why the save path **deletes** the key rather than storing `""` (mirrors `catalogTmdbLanguage`).
- **Settings** — `MeReviewLanguageSelect` (`me-review-language-select.tsx`), modeled on `MeCatalogLanguageSelect`, in **Settings → Catalogue** under Catalogue language so both language controls sit together; section description now reads "…streaming, and reading." The follow-browser option names the detected language ("Match my browser (English)") but reads `navigator` **in an effect only** — naming it during SSR would mismatch on hydration.
- Wired through `settings-form-context.tsx` at all ten touchpoints (type, state, draft restore, dirty check, both draft writes, three dep arrays, prefs build, context value) and `MeAccountSettingsDraftPayload`.
- **`use-review-translation-language.ts`** — `useReviewTranslationLanguage(enabled)` for T.6: applies the browser language immediately so the drawer can label its control on first paint, then upgrades when `GET /api/profiles/me` returns the preference. Module-level cache with a separate `preferenceLoaded` flag so "fetched, no preference set" is not re-fetched forever; `invalidateReviewTranslationLanguageCache()` fires on Settings save next to the catalogue-language invalidation.
- Tests: **15** new in `review-translation-language.test.ts` (resolution order, junk rejection, display names, preference reads, option-list invariants) + 1 server regression. Web suite **698 pass / 7 fail** — all 7 pre-existing and unrelated (activity timestamps, list poster URLs, retired catalogue redirect, two files importing `vitest`). `tsc --noEmit` reports nothing in any touched file.

### Executor progress — engine switch to direct Gemini (2026-08-11, amends T.3)

**Trigger:** human set an API key. It was a **Google AI Studio key**, not a Vercel AI Gateway key, pasted into `AI_GATEWAY_API_KEY` — those are different credentials and are not interchangeable (gateway takes a `vck_…` Bearer token; a Google key must go to `generativelanguage.googleapis.com` via `x-goog-api-key`).

- **Two engines, whichever key is present.** `resolveReviewTranslationEngine({ googleApiKey, gatewayApiKey })` → `"google" | "gateway" | null`, Google winning when both are set (direct path, no middleman). `isReviewTranslationConfigured()` now delegates to it. Both resolvers are **pure**, with thin `env`-reading wrappers, so tests don't depend on whatever is in the developer's `.env`.
- **`@ai-sdk/google@4.0.41`** added to `apps/server` — resolves the same `@ai-sdk/provider@4.0.7` as `ai@7.0.59`, so the versions line up. Model is built **per call** via `createGoogleGenerativeAI({ apiKey })` rather than at module load, so importing the module without a key (every test) stays safe, and the key comes from `@still/env` instead of ambient `process.env` (Turbo strict env can drop undeclared vars).
- **Model id differs per engine:** gateway routes on `google/<model>`, the direct provider takes the bare name. `resolveReviewTranslationModel(engine, override)` handles both; `REVIEW_TRANSLATION_MODEL` still overrides either.
- **Default model is now `gemini-3.5-flash-lite`** (was `gemini-2.5-flash-lite`). The old one **404s** for newer accounts — *"no longer available to new users"* — even though it still appears in the `/v1beta/models` listing, so the listing is not proof of access. Pinned rather than the floating `gemini-flash-lite-latest` alias so a Google release cannot silently move translation quality or cost.
- `apps/server/.env`: the key was moved onto **`GOOGLE_GENERATIVE_AI_API_KEY`** (value untouched).
- **Live end-to-end verified** with a throwaway script (since deleted): Italian review → English in **874ms**, both `#[Dune](/movies/438631)` and `@[Ada](/profile/ada)` tokens intact, and register preserved — *"madonna che roba"* came back as *"holy shit what stuff"* rather than being politely sanitised, which is exactly what the voice rule in the system prompt is for.
- Tests: **6** new (engine precedence, unconfigured, per-engine model ids, override). Translation suites **36/36**; full server suite **819 pass / 11 fail** — same 11 pre-existing failures. `check-types` clean for touched files.

### Executor progress — T.6 (2026-08-11)

- **`ReviewTranslateControl`** in the full-read drawer (`review-detail-sheet.tsx`), below the body and above comments. Surface rules: signed-in only, not the author, `canTranslate` from GET, and `sourceLanguage !==` reader target language.
- Idle pill: **`Translate to {Language}`** (`bg-background` on `bg-card`, no border/ring). Busy: spinner + **Translating…**. After success: **`Translated from {Source} · Show original`**. Re-show uses a client cache (**Show translation**) so toggle does not re-pay the model.
- Failures toast and **never** swap `translationView`, so the original title/body stay on screen. Same-language short-circuit toasts "already in your language" and leaves the original.
- Payload plumbing: `canTranslate` + `sourceLanguage` on `normalizeReviewDetailPayload`; display title/body prefer `translationView` when set. Control is keyed by `reviewId` so opening another review remounts clean state.
- **`fetch-review-translation.ts`** + pure **`review-translation-result.ts`** (normalize kept free of `@/lib/api` so unit tests do not boot the web env schema). 3 normalize tests pass.
- Target language via **`useReviewTranslationLanguage`** (Settings → browser → `en`).
- Placement follow-up (Agentation): control moved **above** score/title/body so a long review does not bury Translate.

### Executor progress — T.7 (2026-08-11)

- Focused suites: web translation **18/18**; server detect + tokens + provider + service + translate route **54/54**.
- Human QA: drawer translate + top placement verified (`good ok`).
- Optional leftover for human: `bun run reviews:backfill-language --apply` if older reviews still lack `sourceLanguage` (no Translate pill until detected).
- **Planner: track complete** (human `done`, 2026-08-11).

## `/quotes` lobby remake — better-interface (2026-08-10)

**Mode:** Complete — human verified (`ok`, 2026-08-10).  
**Trigger:** Agentation on `QuotesPatronLobbyShell` — “remake the ui and ux of this page” + `/better-interface`.  
**Scope:** Signed-in `/quotes` only (`QuotesPatronLobbyShell` + saved/submitted rows, chips, empty/loading). Not title Quotes tab, staff queue, or profile strip (except keep pin/visibility contracts).  
**Viewport noted:** 1736×1010. Runtime screenshot **Not verified** (browser redirected to `/sign-in`).

### Background and Motivation

`/quotes` already ships collection switch (Saved · Submitted), media filter (All · Films · Shows), submission status chips, infinite list, visibility + profile pin. It reuses the **home catalogue card shell** and stacks **three centered pill toolbars** under a short intro — so it reads as a generic filter stack, not a quote collection. Spec (`2026-06-14-favorite-quotes-design.md`) wanted lobby parity with diary chrome and a quote-first list; the shell has grown into vertical chip chrome that eats the first viewport.

### Key Challenges and Analysis

1. **Chrome vs content** — Intro + View + (Status) + Kind can consume ~½ the first screen before any quote.
2. **Wrong shell metaphor** — `HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME` is a poster-grid shell; Community feed uses flat `bg-background` rows on `bg-card` without a tall centered header stack.
3. **IA duplication** — Saved/Submitted and All/Films/Shows are both primary; status is secondary and only on Submitted — should live in one `HomeLobbyFilterRow`-class row, not three stacked rails.
4. **Must stay visibly different** after remake (same bar as Community lobby redesigns) — not an invisible structure shuffle.
5. **Keep contracts** — `?view=` / `?kind=` / `?status=`, lobby nav, infinite pager, visibility PATCH, pin max 3.

### Recommended approach (approve with `b`)

**Approach A — Editorial reading room + home filter-row IA (recommended)**

- Drop the centered multi-rail header stack.
- One filter row under sticky chrome: **leading** Saved · Submitted (+ status as inline secondary or popover when Submitted); **trailing** All · Films · Shows (or reverse if density needs it — pick during Task 1).
- Quote-first rows: larger editorial measure, quieter meta (poster + title as footer context), actions in a compact trailing cluster — still flat `bg-background` on `bg-card` (no borders/rings).
- Empty/loading keep centered empty + skeleton but match new row anatomy.
- Page title can stay in document metadata / sr-only or a single quiet line — not a hero that outranks the quote stream.

**Rejected for now**

| Candidate | Why reject |
| --- | --- |
| B — Pixel-clone Community Activity rows | Quotes need editorial quote hierarchy, not feed-verb bylines |
| C — Masonry / backdrop still wall | Heavier, speculative assets; fights `max-w-2xl` reading measure |

### High-level Task Breakdown (post-`b`, Executor one task per `go`)

1. **Filter IA** — Collapse chips into one `HomeLobbyFilterRow` (or quotes-specific twin); preserve URL builders/tests.  
   *Success:* one row at 1736 and narrow; Submitted shows status without a third full-width rail.
2. **Shell** — Remake `QuotesPatronLobbyShell` hierarchy (no stacked intro+3 toolbars); keep `LobbyNavigationProvider`.  
   *Success:* first viewport shows filters + ≥1 quote card when data exists.
3. **Saved / submission rows** — Editorial remake of `QuotesSavedRow` / `QuotesSubmissionRow` + skeleton parity.  
   *Success:* quote body is the dominant signal; actions remain reachable (visibility, pin, View on title).
4. **Empty + copy** — Align empty titles/CTAs with new IA; verb-first browse path.  
   *Success:* empty states still point to saving/suggesting from title Quotes tab.
5. **Verify** — focused lobby tests + human QA checklist (Saved/Submitted, kind, status, pin, visibility, infinite).

### Project Status Board — quotes remake

- [x] Q.0 Approach approved (`b`)
- [x] Q.1 Filter IA — shipped
- [x] Q.2 Shell remake — dropped visible h1/description; filter row is the chrome (human feedback 2026-08-10)
- [x] Q.3 Row remake — quote-first cards
- [x] Q.4 Empty/copy
- [x] Q.5 Automated verify **20/20** + human QA (`ok`, 2026-08-10)

### Executor progress — Q.1 (2026-08-10)

Shipped one-line filter chrome:
- New `quotes-lobby-filter-row.tsx` → `HomeLobbyFilterRow`
- **Leading:** Saved · Submitted; on Submitted, status inline at `sm+`, `HomeLobbyChipPopover` below `sm`
- **Trailing:** All · Films · Shows
- URL builders unchanged; `quotes-lobby.test.ts` **4/4** (extra href cases for view/status)

### Executor progress — Q.2 (2026-08-10)

Human: do not want h1 + description above filters. Removed visible intro from `QuotesPatronLobbyShell`; kept `sr-only` h1 for landmarks; filters are the only header chrome.

**Follow-up (Agentation):** Submitted status chips → `HomeLobbyFilterRow` `center` on `sm+` (Community ranks pattern); mobile keeps status popover in the leading rail.

### Executor progress — Q.3 (2026-08-10)

Quote-first lobby cards:
- Shared `quotes-lobby-listing-meta.tsx` (card shell + poster/title footer)
- Larger editorial body (`text-xl` / `sm:text-2xl`); listing + actions in footer row
- Submission status moved under the quote (not above)
- Skeleton + list gap (`gap-5`) matched; visibility/pin hit targets ~40px

### Executor progress — Q.4 (2026-08-10)

Empty copy helper `quotes-lobby-empty-copy.ts` + tests **3/3**:
- Films/Shows vocabulary; teach Quotes-tab save vs suggest
- CTA: Saved → “Browse films & shows”; Submitted → “Browse titles to suggest”
- Wired through `QuotesLobbyEmptyState` + `QuotesLobbyBrowseLink label`

Lobby tests **7/7** pass.

### Executor progress — Q.5 (2026-08-10)

Automated: quotes lobby + empty-copy + attribution + timestamp + pinned-quotes tests **20/20** pass; no linter diagnostics on remake files. Browser signed-in visual QA **Not verified** in agent session.

### Executor's Feedback or Assistance Requests

**Shipped** — `/quotes` remake (Approach A, Q.1–Q.5) closed on human `ok` (2026-08-10).

---

## Achievements back navigation (2026-08-02)

**Brainstorm approved (human `go`).** Spec: `docs/superpowers/specs/2026-08-02-achievements-back-navigation-design.md` (**Approved**). **Locked:** `resolveAchievementsReturn` anti-loop; persist prior route on achievements entry; fallback home browse rail. **Executor shipped (2026-08-02):** `isAchievementsPath` / `isAchievementsReturnHref` / `resolveAchievementsReturn`; `useAchievementsReturn` + `AchievementsTopBar`; `DetailReturnCapture` achievements entry; tests **12/12 pass** on `movie-detail-return.test.ts`. **Pending human QA:** account menu → Achievements → back; Achievements → Profile → Achievements → back (not “Achievements”).

## Listing detail scroll reset (2026-08-02)

**Brainstorm approved (human `go`).** Spec: `docs/superpowers/specs/2026-08-02-listing-detail-scroll-reset-design.md` (**Approved**). Plan: `docs/superpowers/plans/2026-08-02-listing-detail-scroll-reset.md`. **Locked:** forward entry to film/TV detail + tab switches → instant top; back to lobby preserves scroll; Lenis sync; temporary `history.scrollRestoration = 'manual'` on detail shells. **Executor Tasks 1–4 done (2026-08-02):** `scroll-document-to-top.ts` + tests **1/1 pass**; `use-listing-detail-scroll-reset.ts` wired in `movie-detail-view-shell.tsx`; `AppScrollToTop` DRY'd. **Human verified (`ok`, 2026-08-02):** home → movie top; back restores lobby scroll; tab switches top. **Follow-up fix (2026-08-02):** swallow `AbortError` on listing presence snapshot fetch + abort in-flight home catalogue pages on unmount (dev overlay `signal is aborted without reason`).

## Discord profile activity — Lanyard (2026-07-28)

**Brainstorm approved (human `go`).** Spec: `docs/superpowers/specs/2026-07-28-discord-profile-activity-design.md` (**Approved**). Plan: `docs/superpowers/plans/2026-07-28-discord-profile-activity.md`. **Locked:** one-click Connect Discord · Sense Presence guild (no Lanyard public server) · self-hosted Lanyard · activity lines on profile + account menu only · reuse `presenceVisibility` · `DISCORD_ACTIVITY_ENABLED` flag. **Executor Task 1 done (2026-07-29):** optional Discord/Lanyard env vars in `packages/env/src/server.ts`; `discord-activity-config.ts` + tests **7/7 pass**. **Executor Task 2 done (2026-07-29):** `discord-activity.ts` formatter (Spotify · playing · streaming · custom) + tests **6/6 pass**. **Executor Task 3 done (2026-07-29):** `lanyard-client.ts` REST fetch + 15s in-memory cache + tests **4/4 pass**. **Executor Task 4 done (2026-07-29):** `discord-guild-member.ts` guild join/kick (PUT/DELETE) + tests **5/5 pass**. **Executor Task 5 done (2026-07-29):** `integrations.discordActivityEnabled` helpers on web + server (`discord-activity-preferences.ts`); PATCH `/profiles/me` deep-merge via `sanitizeDiscordActivityPreferences`; tests **5/5** server + **3** new web cases pass. **Executor Task 6 done (2026-07-29):** `discord-activity-visibility.ts` — `canViewerSeeDiscordActivity` (unsigned · self · friends/public · private profile · connected/enabled gates); tests **11/11 pass**. **Executor Task 7 done (2026-07-29):** `GET /api/profiles/:handle/discord-activity` — `fetch-profile-discord-activity.ts` + `profile-discord-activity-data.ts`; feature-flagged; 404 when profile hidden; `{ visible: false | true, activity? }`; never exposes Discord snowflake; tests **9/9 pass**. **Executor Task 8 done (2026-07-29):** Better Auth `socialProviders.discord` (`identify` + `guilds.join`) when credentials set; `databaseHooks` guild join + profile prefs on link/unlink; `@still/auth/lib/discord-oauth-callback.ts` + `discord-presence-guild.ts`; server routes `POST /api/me/discord/finish-setup`, `DELETE /api/me/discord`, `GET /api/me/discord/status`; tests **4/4** auth + **5/5** route + guild member **5/5** pass. **Executor Task 9 done (2026-07-29):** `kickDiscordPresenceGuildOnUserDelete` in `discord-oauth-callback.ts` wired into Better Auth `beforeDelete`; tests **6/6** oauth callback suite. **Executor Task 10 done (2026-07-29):** `me-discord-connect.tsx` on Settings → Profile (hidden when feature off); Connect via `linkSocial`; activity toggle in form save; Finish setup + Disconnect via `/api/me/discord/*`. **Executor Task 11 done (2026-07-29):** profile hero Discord activity row — `ProfileDiscordActivityRow`, RSC `fetchProfileDiscordActivityServer` + client fetch helper, wired on `/profile/[handle]` under bio (hidden when API returns `visible: false`). **Executor Task 12 done (2026-07-29):** account menu self preview — `AccountMenuDiscordActivity` in `app-user-account-menu.tsx`; fetch on open + 30s poll while open; `aria-live="polite"` + second-person SR copy (`discord-activity-self-copy.ts`, tests **4/4**). **Executor Task 13 done (2026-07-29):** `docker/discord-lanyard.compose.yml` (Lanyard + Redis, Task 0 checklist + env wiring in header comments); spec links compose file. **Discord profile activity track complete** (Tasks 1–13) — pending human Task 0 E2E + verification checklist. **Manual Task 0 still blocking E2E:** Discord app + Sense Presence guild + self-hosted Lanyard on staging.

**Executor polish (2026-07-30):**
- [x] DPA.14 Clickable album art toggles to a rotating vinyl with the cover as its center label; click again restores the cover.
- [x] DPA.14 accessibility/performance — `aria-pressed`, contextual labels, focus ring, transform/opacity-only state transition, linear disc rotation, and static vinyl under reduced motion.
- [x] DPA.14 visual refinement — matched the supplied reference with a full-size circular artwork disc and minimal dark center label; removed realistic grooves and reflective highlight.
- [x] DPA.15 artwork metadata — album tooltip on cover/vinyl plus creator portrait at the lower-right corner with creator-name tooltip; sourced from Lanyard `large_text`, `small_image`, and `small_text` (not inferred).
- [x] DPA.15 automated verification — server Discord formatter/fetch tests **17/17 pass**, web activity tests **2/2 pass**, and no linter diagnostics.
- [x] DPA.16 cover/vinyl motion polish — interruptible 300ms opacity + scale + 4px blur bridge using `cubic-bezier(0.2, 0, 0, 1)`; press feedback normalized to `0.96`; reduced motion retains a 200ms opacity-only state cue.
- [x] DPA.14 automated verification — Discord activity UI tests **2/2 pass**; no linter diagnostics.
- [ ] DPA.14 human verification — click the artwork on `/profile/adgv`, confirm vinyl/cover toggle and rotation.

**Executor's Feedback or Assistance Requests:** Please manually verify the vinyl interaction while a listening activity is visible. The current browser verification session loaded the profile without a Discord activity row, so the live visual state could not be exercised automatically.

## Neon compute reduction (2026-07-30)

**Plan:** `neon_compute_reduction_b3671851.plan.md` (attached in Cursor plan; do not edit plan file). **Locked:** keep Neon/Postgres · prod warm at **0.25 CU** · target **<$25/mo** · 7-day measurement gate before any D1 experiment · baseline template `docs/superpowers/specs/2026-07-30-neon-compute-baseline.md`.

**Executor shipped (2026-07-30):**
- [x] **baseline-neon** — `database-target.ts` credential-safe classifier + boot log line; `database-target.test.ts` **6/6**; baseline doc template.
- [x] **isolate-dev-jobs** — ordinary `bun dev` no longer runs recurring DB jobs; explicit `RUN_LOCAL_JOBS=true` or `bun run dev:jobs`; `run-local-scheduler.test.ts` **3/3**.
- [x] **cache-auth-session** — Better Auth `session.cookieCache` 5m; `freshContext` on staff/billing/import/referrals/me-data/me-discord/plan-features; `request-session.test.ts` **2/2**.
- [x] **cache-presence-metadata** — `presence-profile-metadata-cache.ts` read-through Redis (60s) for online + listing presence; invalidation on `PATCH /profiles/me`; `patron-presence.ts` + `listing-presence.ts` wired; tests **3/3** cache + listing-presence suite **17/17**.
- [x] **cache-discord-metadata** — `discord-activity-metadata-cache.ts` (300s) split from Lanyard live cache; `fetch-profile-discord-activity.ts` refactored; invalidation on profile PATCH, `DELETE /me/discord`, and OAuth link/unlink via `registerDiscordMetadataInvalidator`; `fetch-profile-discord-activity.test.ts` **9/9**.
- [x] **verify-rollout (automated)** — focused tests **40/40 pass** across 6 files; `graphify update .` skipped (CLI not on PATH).

**Deploy / measure (human):**
1. Deploy server first (jobs isolation + metadata caches); enable session cookie cache with deploy (already in `@still/auth`).
2. Smoke: sign-in · staff route · ban/revoke · impersonation · library delete · presence poll · Discord activity · `RUN_LOCAL_JOBS` off in ordinary dev.
3. Record Neon branch metrics for **7 days** in baseline doc vs pre-change baseline; if projected spend still **>$25/mo**, plan one disposable D1 read-model benchmark only — do not migrate auth/transactional data.

**Executor's Feedback or Assistance Requests:** Human should capture pre/post Neon CU-hours in Neon console (Query Insights + branch usage) using the baseline template. Prefer local Postgres for dev; use `RUN_LOCAL_JOBS=true` only when scheduler testing against remote Neon.

## Review people mentions — # films · @ cast/crew & patrons (2026-07-07)

**Brainstorm approved (human `go`).** Spec: `docs/superpowers/specs/2026-07-07-review-people-mentions-design.md` (**Approved**). Plan: `docs/superpowers/plans/2026-07-07-review-people-mentions-plan.md`. **Locked:** `#` film/TV · `@` people/patrons · title cast-first · comments parity · SN.9.1 notifications. **Executor Tasks 1–11 done** — focused tests **34/34 pass** (web 22 + server 12); mention-related `tsc` clean; monorepo `check-types` still fails on pre-existing server `dist/` TS5055; `graphify update .` skipped (not on PATH / `bunx graphify` has no executable on Windows). **Executor re-verify (2026-07-25):** mention lib tests **19/19** web · **2/2** notify · **4/4** comment mention route · hover preview **1/1** — all pass. **Human verified (`ok`, 2026-07-25).**

**Shipped** — review people mentions track closed (Tasks 1–11 + hover preview `13dd5d0`).

## Sense subscriptions & referrals — Polar (2026-07-05)

**Brainstorm approved (human `go`).** Spec: `docs/superpowers/specs/2026-07-04-sense-subscriptions-design.md` (**Approved**, billing provider **Polar**). Plan: `docs/superpowers/plans/2026-07-05-sense-subscriptions-polar.md`. **Shipped + human verified (Task 16, 2026-07-06):** Polar checkout/portal/sync, `/pricing`, feature gates, staff grants, referrals, Invite & earn, Devoted purchasable + confirm dialog. **Next track:** Phase 8 polish + Launch readiness (see below).

## Taste queue — non-interrupting backfill (2026-07-03)

**Brainstorm approved (human `go`).** Spec: `docs/superpowers/specs/2026-07-03-taste-queue-non-interrupting-backfill-design.md` (**Approved**). Plan: `docs/superpowers/plans/2026-07-03-taste-queue-non-interrupting-backfill.md`. **Locked:** hero + rail; append-only tail backfill; maintain 24-title depth via debounced `GET /api/taste/for-you`; unified hero `activeIndex` on remove; poster tail enter animation (`motion/react`). **Executor Task 1 done:** `taste-match-queue.ts` — `activeIndexAfterRemoval`, `mergeTailBackfill`, scheduler + backfill runner; `taste-match-queue.test.ts` **10/10 pass**; `TASTE_MATCH_TARGET_RESULTS` re-exported from `taste-matched-discovery.ts`. **Executor Tasks 2–5 done:** debounce tests; hero + rail wired — tail-only backfill, unified hero index, poster `AnimatePresence`, rail consumed listener. **Shipped (Task 7, human `go` 2026-07-03):** unit tests **12/12** pass; no in-slot splice in hero/rail handlers.

## Month recap dialog — community winners (2026-06-30)

**Brainstorm approved (human `go`).** Spec: `docs/superpowers/specs/2026-06-30-month-recap-dialog-design.md` (**Approved**). Plan: `docs/superpowers/plans/2026-06-30-month-recap-dialog.md`. **Locked:** first signed-in visit each calendar month (patron TZ) celebrates prior month; slides = most film logs · most TV logs · most reviews; skip empty categories; all signed-in patrons; What's New first then recap; localStorage seen per `YYYY-MM`; new files only + `app-shell.tsx` mount (no person-detail overlap). **Executor Task 1 done:** `resolvePreviousCalendarMonthWindow`, `celebratedMonthKeyFromWindow`, `celebratedMonthLabel` + tests **9/9** pass. **Executor Task 2 done:** optional `window` + `limit` on `fetchLeaderboard`; optional `window` on `fetchMembersLeaderboard`; tests **15/15** pass. **Executor Task 3 done:** `fetchMonthRecap`, `buildMonthRecapCategories`, `GET /api/community/month-recap`; tests **11/11** pass. **Executor Task 4 done:** `month-recap-seen`, `month-recap-month-key`, `month-recap-types`, `fetch-month-recap-client`; tests **4/4** pass. **Executor Task 5 done:** `MonthRecapPodium` + `MonthRecapDialog` (What's New carousel shell). **Executor Task 6 done:** `MonthRecapDialogRoot` in `app-shell.tsx` (What's New gate, fetch, defer timing). **Executor Task 7 done (2026-07-25):** targeted tests **15/15** pass (server 11 · web 4); spec **Approved**; monorepo `check-types` blocked by pre-existing `@still/plans` entitlements test — not month-recap regressions. **Human verified (`ok`, 2026-07-25):** defer after What's New, dismiss persists, empty categories skip, reduced-motion clean.

**Shipped** — month recap dialog track closed (Tasks 1–7 + manual QA).

## Presence AFK status — orange dot (2026-06-16)

**Brainstorm approved (human `si`).** Spec: `docs/superpowers/specs/2026-06-16-presence-afk-status-design.md`. Plan: `docs/superpowers/plans/2026-06-16-presence-afk-status.md`. **Shipped (Tasks 1–9, 2026-06-16).** **Human verified (2026-06-16):** tab-away orange, return-to-active green, rapid tab-switch stability (BroadcastChannel + away debounce). **Locked:** `away` when tab hidden (immediate) OR no input ≥ **5 min**; global on all `PatronOnlineDot` surfaces; `activityState` on `POST /api/realtime/presence`; Redis HASH `sense:presence:activity`; green = active, orange = away; micro-pop on `active` ↔ `away`; privacy unchanged (`friends`/`public`). **Automated verification:** server **41/41** · web **17/17** pass. **Pending optional human QA:** tab-away orange dot, 5 min idle, return-to-active green micro-pop, reduced-motion instant swap, listing corner + drawer parity.

## Presence online visibility controls — movie/TV detail (2026-06-16)

**Brainstorm approved (human `go`).** Spec: `docs/superpowers/specs/2026-06-16-presence-online-visibility-design.md`. Plan: `docs/superpowers/plans/2026-06-16-presence-online-visibility.md`. **Locked:** online-now status only; small green dot badge; show in both compact avatar row and drawer rows; dedicated privacy setting `preferences.privacy.presenceVisibility` with `friends|public`; default `friends`; control in Settings → Privacy. **Executor progress:** Task 1 complete (preference parser + tests 11/11 pass); awaiting human `go` for Task 2.

## Listing engagement stats — movie/TV detail (2026-06-16)

**Brainstorm approved (human `go`).** Spec: `docs/superpowers/specs/2026-06-16-listing-engagement-stats-design.md`. Plan: `docs/superpowers/plans/2026-06-16-listing-engagement-stats.md`. **Locked:** four chips (Watched · Lists · Favorited · Watchlist) under community score; always show incl. `0`; chip counts global; drawer rows viewer-visible only; tap → `DetailVaulSheet`. **Milestone 1a shipped:** chip row + four counts on movie/TV detail GET. **Milestone 1b shipped (Executor 2026-06-16):** `listing-engagement-query` + `GET /api/movies|tv/:id/engagement/{watches|lists|favorites|watchlist}`; `MovieDetailEngagementDrawer` wired from chips (signed-in only). **Executor verification (2026-07-25):** tests **17/17** pass (server 11 · web 6); summary route test aligned to `fetchCachedListingCommunityStats` (`6ae8fae`). **Human verified 1b (`ok`, 2026-07-25).**

**Shipped** — listing engagement stats Milestone 1b closed.

## Listing presence — Phase B (2026-06-16)

**Shipped (Tasks 1–6, human `ok` 2026-06-16).** Spec: `docs/superpowers/specs/2026-06-16-listing-presence-design.md`. Plan: `docs/superpowers/plans/2026-06-16-listing-presence.md`. **Automated verification:** `@still/realtime` **12/12** · `listing-presence` lib **10/10** · `realtime-presence` routes **10/10** · web copy/display **6/6** — **38/38 pass**. **UI:** corner pill on `MovieDetailViewShell` outer `bg-card` section — stacked `PatronPortraitWithMetalTier` avatars (max **3**, **`+N`**) + **`N viewing`** count; `GET` returns **`viewingPatrons`** (public-profile viewers in room, excludes self) for header-style initials fallback (`PatronPortraitAvatar`); private viewers count-only. **Pending optional QA:** poll fallback with SSE blocked; two-browser tab-close drop.

## Liveblocks realtime layer (2026-06-15)

**Brainstorm validated (`a`).** Spec: `docs/superpowers/specs/2026-06-15-liveblocks-realtime-design.md` (**superseded**). **Replacement spec (approved 2026-06-15):** `docs/superpowers/specs/2026-06-15-sense-realtime-redis-sse-design.md`. **Plan:** `docs/superpowers/plans/2026-06-15-sense-realtime-redis-sse.md` (11 tasks). **Task 1 done:** Liveblocks keys removed from local `apps/web/.env.local` + `apps/server/.env`; `LiveblocksRootProvider` no-ops without `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` → no watermark locally. **Task 2 done (2026-06-15):** `packages/liveblocks/` → `packages/realtime/` (`@still/realtime`); all app imports + `bun.lock` updated; `bun test packages/realtime` **10/10 pass**. **Note:** If `bun dev` fails with `Cannot find module 'zod'`, check `packages/config/` — `package.json` + `tsconfig.base.json` must exist (`git restore packages/config/` then `bun install`). **Human:** remove Liveblocks env vars from Vercel Preview/Production if set. **Task 4 done (2026-06-15):** `realtime-publish.ts` (XADD + 24h EXPIRE); call sites in `comments.ts`, `reviews.ts`, `notification-delivery.ts` use `publishRealtimeEvent`; tests **10/10** (`00-realtime-publish.test.ts` runs first — Bun `mock.module` stubs from route tests). **Task 8 done (2026-06-15):** `InboxRealtimeSubscriber` in app layout; `notifications-inbox-live` pub/sub; bell stops 30s poll when SSE connected, refetches on `notification.created`. **Task 9 done (2026-06-15):** `ReviewRealtimeSubscriber` — dedicated EventSource per open review drawer (`review:{id}`); `comment.created` → refetch + **New** pill when scrolled up; `reaction.updated` → live like/dislike counts in header `ReactionsBar` + carousel engagement patch; first live comment fires `realtime.comment.received_live` product event. **Task 11 shipped (2026-06-15, human `ok`):** Automated verification **45/45 pass**; manual QA signed off. **Task 10 done (2026-06-16):** Liveblocks deps + UI removed (`rg liveblocks apps` → tests/history only); list reorder REST-only; new listing presence uses Redis SSE stack. **Redis + SSE realtime** replaces Liveblocks for Wave 0–1 (inbox bell, review comments/reactions, list reorder live sync). **Post-ship fixes:** list room multiplexed on app-shell SSE + `BroadcastChannel` dev fallback; stills/reviews carousel arrow cascade fixed (`allowScrollSettleRef` in `detail-editorial-rail-snap.ts`). **Human deploy:** Vercel Upstash Redis integration — same `UPSTASH_*` on server + web; remove Liveblocks keys from all envs.

## Letterboxd pillars roadmap (2026-06-13)

**Brainstorm complete — Approach B approved (`b`).** Spec: `docs/superpowers/specs/2026-06-13-letterboxd-pillars-roadmap-design.md` (**approved**). Plan: `docs/superpowers/plans/2026-06-13-letterboxd-pillars-roadmap.md`. **Shipped (Tasks 1–21, human `ok` 2026-06-15):** showcase · post-log ritual · viral reviews · journal · members · detail counts · Wrapped · streaming alerts · motion polish · list discovery · taste-rail caption centering. **Task 20 catalogue stat line** reverted per Agentation (user remove on `/home`). **Deferred:** catalogue stat line (not in product). **Next track:** Planner picks — Phase 8 polish, Track B follow-ups, or new spec.

## Sense sound layer — micro-feedback → voice reviews (2026-06-13)

**Spec approved (2026-06-13).** Spec: `docs/superpowers/specs/2026-06-13-sense-sound-layer-design.md`. Plan: `docs/superpowers/plans/2026-06-13-sense-sound-layer.md`. **Phase D complete (Tasks 1–5).** **Task 6 done:** migration `0027_review_audio` + Drizzle `review.audio_*` columns. **Task 7 done:** `review-audio.ts`, `vercel-blob-audio-put.ts`, `POST /api/reviews/:id/audio` (owner-only, 10/hr), relaxed create (`hasVoiceAttachment`) + PATCH body rules — 9/9 server tests pass. **Task 8 done:** `app/api/reviews/[id]/audio/route.ts` multipart proxy + `upload-review-audio.ts` client helper. **Task 9 done:** `review-audio-limits.ts`, `ReviewAudioPlayer`, `ReviewAudioRecorder`. **Task 10 done:** `review-composer.tsx` — Text · Voice · Both toolbar, recorder, upload-after-create. **Phase B complete (Tasks 6–11).** Planner/human sign-off **2026-06-13** (`k`). Sense sound layer (Phase D + Phase B) **shipped** — manual QA optional follow-up on mobile Safari voice playback. **Post-ship UI (2026-06-13):** `ReviewAudioRecorder` + composer mount polished per make-interfaces-feel-better (staggered enter, icon swap, progress bar, scale-on-press); removed composer `min-h-[22rem]` workaround after measured format pill fix.

## Diary metal tier avatars (2026-06-10)

**Implementation complete (2026-06-10).** Spec: `docs/superpowers/specs/2026-06-10-diary-metal-tier-avatars-design.md`. Thresholds: 100 silver · 500 gold · 1000+ chromatic (total diary logs). Server: `diary-metal-tier.ts`, `serializePatronProfileForClient(..., logsCount)` → `diaryMetalTier` on profiles, feed, search, leaderboards, reviews, following-ratings, etc. Web: `metal-fx` + `PatronPortraitWithMetalTier` (shader or static ring on reduced motion / software GPU); all patron avatar call sites migrated. Tests: server 20 pass (diary-metal-tier, profile-media, feed-rating-divergence, movie-following-ratings); web 2 pass; `bun run build` green after `MeProfile` typing on diary/lists/watchlist + following-ratings payload types. **Human verify:** patron with ≥100 logs shows silver ring in nav/feed/profile; 500/1000 upgrades; reduced motion → static ring only; <100 → no ring.


**Implementation complete (2026-06-10).** Spec + plan as above. Subagent-driven Tasks 1–8 landed: server Pro GIF gate, preference flags, `PatronPortraitAvatar` animated path, profile hero wiring, Settings grayscale toggle + Pro copy, `avatarIsAnimated` threaded through feed/nav/leaderboards. Tests: server 13 pass (profile-media + feed helpers), web 22 pass (prefs + profile-media). **Human verify:** Pro GIF upload on Settings → Profile; toggle grayscale in Appearance; check profile hero + nav/feed animation.

## Background and Motivation

Still is already designed as a cinephile diary with an explicit "cinema atmosphere"
layer (film grain, vignette, marquee ticker, film-strip rail, genre-driven hero
glow, "lobby chatter / now showing" copy, arthouse vs multiplex presets). The user
feels the site still isn't immersive enough and wants more personality connected
to film as a medium.

Direction confirmed via interview on 2026-05-13:

- **Vibe**: 70mm epic / Kubrick-Villeneuve — wide cinematic framing, heavy
  vignette, deep blacks, ultra-quiet UI, big posters.
- **Scope**: Everywhere — global tokens, motion, typography, shell chrome.
- **Ingredients**: editorial display type, real letterboxing, scene-cut page
  transitions, film stock detail (sprockets/edge codes/flicker), per-film color
  world, end-credits patterns, ticket-stub artifacts, subtle audio.
- **Constraints**: None — use judgment (so: still WCAG AA, still respect
  `prefers-reduced-motion`, perf budget within reason, audio strictly opt-in).

The goal is a meaningful visual shift, not a subtle polish.

### Secondary initiative (2026-05-14): product design system & screen IA

The product direction is a **Letterboxd-class diary + social layer**, with more
features (lists, chat, badges, richer home) and a **modern, enjoyable** feel so
people return often. A **Mobbin (web)** pass surfaced recurring patterns: thin
icon rail or labeled sidebar, pill search with removable scope tags, chip-based
browse, tab + filter toolbars for libraries, masonry/timeline for personal
media, centered profile heroes with stat-tabs, optional friend-activity column,
floating primary composer. **Planner goal for this track:** define a **coherent
design system** (tokens, layout primitives, key screens) that stays compatible
with the existing **cinematic / 70mm** identity (Fraunces display, theater
surfaces, grain, optional audio) without fighting it — _atmosphere on the
canvas, clarity in the controls._

## Key Challenges and Analysis

### 1. Typography is the single biggest gap

`globals.css` aliases `--font-serif` to Inter (`--font-proxima-nova`). The
`font-serif` and `font-editorial` utilities therefore render in a UI sans face,
which is the loudest reason the system doesn't read as "cinematic". One file
(`diary-entry.tsx`) imports Playfair Display inline, proving the absence is
already being papered over case-by-case. A real editorial display face needs to
live at the token layer.

Recommended face: **Fraunces** (Google Fonts, variable axis for `opsz`,
`SOFT`, `WONK`; free; Letterboxd-adjacent cinematic gravitas). Alternatives:
PP Editorial Old (paid, sharper editorial cut), GT Sectra (paid, more
"prestige drama"), Migra (paid, Kubrick-adjacent).

### 2. Per-film color world requires sync-time work

Today's `accentFromGenres` is a static genre→hex lookup, only used for the
hero glow. A true per-film color world needs:

- **Extraction**: server-side at TMDB sync time using `node-vibrant` + `sharp`,
  pulled from poster (preferred) or backdrop. Persist 3 colors per movie:
  `accent` (vibrant/warm), `accent_muted` (darker), `accent_text` (legible).
- **Theming**: a `MovieThemeProvider` (server component, no JS) injects per-film
  CSS vars at the page root. Buttons, hero glow, scrollbar, dividers, link
  underlines, focus rings — all subtly bend to the film.
- **Fallback**: if palette absent (new film, sync miss), fall back to existing
  genre accent.

Cost: one-time DB migration adding three columns to `movies` + extension to
`tmdb-sync.ts` to compute palette on insert/update.

### 3. Page transitions: Next 16 view-transitions API is the right tool

Already on Next 16 + React 19. Use the stable `next/view-transitions` API
(unstable_ViewTransition export wrapped via project shim). Fade-to-black 180ms
between route swaps; iris-out only on movie page entry. Falls back gracefully
on Firefox/older Safari (no transition, instant nav — acceptable).

### 4. Audio is the riskiest ingredient

Autoplay policies, user trust, accessibility. Mitigations:

- Default OFF. Toggle in settings: "Theater audio (experimental)".
- WebAudio with gain envelope (fade-in 600ms, never abrupt).
- All clips CC0 from freesound.org, ≤50KB each, lazy-loaded.
- Three clips only: projector hum (loops on movie pages), reel clack (on log),
  soft curtain whoosh (on first page load post-opt-in).
- Hard-mute on `prefers-reduced-motion: reduce` AND no audio API on iOS Low
  Power Mode.

### 5. Scope is large — must phase aggressively

Each phase below is shippable on its own and delivers visible value. We do not
move to phase N+1 until N is verified by the human planner.

### 6. Existing "arthouse" preset is conceptually fine but underused

Keep `data-cinema-preset="arthouse"` as the default and use the same hook for
70mm tuning rather than introducing a new preset name. (Adding "imax" or "70mm"
would just be a third arbitrary label. The aesthetic IS arthouse 70mm — that's
what the picks say.) Existing `multiplex` preset stays as a louder mode.

### 7. Design system reboot vs. cinematic maximalism (2026-05-14)

**Tension:** Heavy chrome (vignette, grain, tickets, credits) can **compete**
with scanability if every surface is decorative. **Resolution:** treat UI in
layers — **(A)** shell chrome and hero moments carry cinema; **(B)** lists,
forms, settings, and dense feeds follow **quiet** patterns (consistent radius,
spacing, one accent, predictable hit targets). **Technical anchor:** shadcn
`base-lyra` + `packages/ui` tokens; avoid one-off components where a primitive
(`AppShell`, `FilterToolbar`, `ContentGrid`) would unify behavior.

**Success for Track B** is not “more screens” but **fewer decisions per
interaction**: navigation depth, filter discoverability, empty states that
invite the next log, and mobile-first tap targets (≥44px) without breaking
desktop density.

## High-level Task Breakdown

Each task block below has explicit success criteria the Executor can self-verify
before reporting completion. One task at a time. Human Planner confirms before
moving on.

### Phase 1 — Foundation: editorial type, true black, letterbox primitive

**1.1 Add Fraunces display face + `font-display` token**

- Add `Fraunces` to `apps/web/src/app/layout.tsx` via `next/font/google` with
  `variable: "--font-fraunces"`, `display: "swap"`, axes `opsz 9..144`,
  `wght 300..700`.
- In `packages/ui/src/styles/globals.css`:
  - Add `--font-fraunces-stack: var(--font-fraunces, "Fraunces"), ui-serif, Georgia, serif;`
  - Add new utility class `.font-display` and new theme token `--font-display`.
  - Keep `font-serif` aliased to Inter for backwards compat for now (we will
    decide page-by-page whether a heading is "display" or "serif").
- Success: `<h1 className="font-display">Still</h1>` renders in Fraunces in dev,
  no FOUT, build passes.

**1.2 Migrate top-level page headings from `font-serif` to `font-display`**

- Files: landing `page.tsx` h1 + h2, `movie/[id]/page.tsx` h1, `home/page.tsx`
  Section titles, `BrandMark` wordmark, `diary-entry` ticket title (drop the
  inline Playfair_Display import — replace with `font-display`).
- Tagline/long-form copy stays on `font-editorial` (still Inter — that's
  correct, editorial body is a different job).
- Success: visual diff shows display headlines in Fraunces sitewide; no
  Playfair_Display inline imports remain in `apps/web/src/`.

**1.3 Refine black scale + heavier vignette default**

- In `globals.css`:
  - Add `--surface-theater: #020202` (deeper than `--surface-canvas`), used as
    the body background.
  - Bump `:root` defaults: `--cinema-vignette-spread: 180px`,
    `--cinema-vignette-alpha: 0.55`. Multiplex preset bumps proportionally.
  - New utility `.cinema-theater-floor`: bg `--surface-theater` with subtle
    radial vignette inset baked in.
- Success: body background is visibly darker (just shy of pure black, never
  banded), hero edges feel more "house lights down".

**1.4 `<Letterbox>` primitive**

- New file: `apps/web/src/components/cinema/letterbox.tsx`.
- Props: `aspect` (`"2.39"` | `"2.35"` | `"1.85"` | `"21:9"`, default `"2.39"`),
  `bars` (default `true`, draws 16px true-black bars top + bottom on desktop,
  10px on mobile), `children`, `className`.
- Uses CSS `aspect-ratio` + `overflow: hidden`, never JS.
- Success: drop in around landing hero rail and movie page backdrop, get
  letterbox bars + scope crop without ratio drift.

**1.5 Apply letterbox to landing hero, movie hero, profile cover (if it exists)**

- Wrap `LandingPosterRail` in letterbox 2.39:1.
- Movie hero `<section>`: backdrop image gets letterbox 2.39:1; poster overlaps
  the lower bar by 30% (Villeneuve poster-overlap pattern).
- Profile page hero (if present): 21:9 letterbox.
- Success: hero sections read as widescreen frames, not banners.

**Phase 1 deliverable**: Open the site and the typographic + framing change is
the first thing you feel. Estimate: 2–4 hours executor time.

### Phase 2 — Per-film color world

**2.1 Schema migration: add palette columns to `movies`**

- File: `packages/db/src/schema/movie.ts`. Add `accentVibrant`, `accentMuted`,
  `accentText` as nullable text columns.
- Generate migration via `bun run db:generate` (or equivalent — check
  package.json scripts).
- Success: migration file exists, schema typecheck passes.

**2.2 Palette extraction at TMDB sync time**

- File: `apps/server/src/jobs/tmdb-sync.ts`. After fetching/storing a movie's
  poster URL, fetch the poster bytes (cap at w342 size) and run `node-vibrant`
  to get `Vibrant`, `DarkMuted`, and a contrast-safe text color via WCAG ratio
  check against `#070707`.
- Persist to the three new columns.
- Skip + log if poster URL missing or extraction throws.
- Success: re-running the sync on a sample of 10 movies populates the three
  columns with valid hex strings.

**2.3 `MovieThemeProvider`**

- New file: `apps/web/src/components/movie/movie-theme-provider.tsx`. Server
  component (no `"use client"`). Takes `accent`, `accentMuted`, `accentText`
  props and renders a `<div style={{ "--movie-accent": …, "--movie-accent-muted": …, "--movie-accent-text": … }}>` wrapper.
- Update `movie/[id]/page.tsx` to use this instead of the inline `style` block,
  and pass palette from DB (fall back to `accentFromGenres` if columns null).
- Success: movie page DOM has the three CSS vars on the article wrapper.

**2.4 Wire palette into chrome elements**

- In `globals.css`, add a `.movie-themed` scope that lets these vars bleed into:
  - `::selection` background
  - focus ring color (override `--ring` inside scope)
  - scrollbar thumb (inside scope)
  - any `.movie-hero-glow` overrides (already partly done)
  - link underline color on body copy inside the page
- Don't override button accent color — buttons stay desert-orange app-wide
  (consistency > novelty).
- Success: viewing two different movie pages side-by-side, the selection
  color, focus ring, and scrollbar visibly differ per film.

**Phase 2 deliverable**: every movie page wears its own film's color.

### Phase 3 — Scene-cut transitions + projector boot

**3.1 Adopt `next/view-transitions`**

- Wrap `(app)/layout.tsx` with `unstable_ViewTransition` (or stable export in
  current Next 16.2.0 — verify exact import path).
- Add a CSS rule in `globals.css`:
  ```css
  @media not (prefers-reduced-motion: reduce) {
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation-duration: 180ms;
      animation-timing-function: var(--aker-ease);
    }
    ::view-transition-old(root) {
      animation-name: cinema-fade-out;
    }
    ::view-transition-new(root) {
      animation-name: cinema-fade-in;
    }
  }
  ```
- Define `cinema-fade-out` (opacity 1→0 over a black overlay) and
  `cinema-fade-in` (opacity 0→1).
- Success: navigating from `/home` to `/movies/...` cross-fades through black
  instead of pop-in.

**3.2 Iris-out on movie page enter (progressive enhancement)**

- Add `view-transition-name: hero-iris` to the movie page hero `<section>`.
- Define a circular `clip-path` keyframe that grows from 0% to 100% radius.
- Falls back to plain fade on browsers without VT support.
- Success: opening a movie page from elsewhere visibly irises out from center.

**3.3 Projector boot on first paint**

- New component: `apps/web/src/components/cinema/projector-boot.tsx`. Client.
- On mount, if `sessionStorage.cinemaBooted` is unset: render a fixed full-screen
  black overlay with a 5-frame opacity flicker (0→0.95→0.2→1→0) over ~360ms,
  then unmount and set the flag.
- Skip entirely on `prefers-reduced-motion: reduce` or repeat-views (BFcache).
- Mount once in `(app)/layout.tsx`.
- Success: refresh the app shell, see a brief projector-startup flicker, then
  the page resolves; navigate elsewhere and back without seeing it again.

**Phase 3 deliverable**: navigation feels like cuts between scenes; first
visit feels like the house lights coming down.

### Phase 4 — Film stock detail

**4.1 Edge codes on `.cinema-film-strip-rail`**

- Extend the existing CSS rail with optional `data-edge-code` attribute that
  renders small monospace numbers (`24 · 25 · 26 …` or `KODAK · 5219 · 24P`)
  inside each "perf" using `::before` counters.
- Class variant: `.cinema-film-strip-rail--coded`.
- Success: diary list with `coded` rail shows tiny frame-stamp text along the
  perf rail.

**4.2 `<FrameStamp>` component**

- New file: `apps/web/src/components/cinema/frame-stamp.tsx`.
- Renders fixed-position small label at top-left of a parent, e.g.
  `4-PERF · 70MM · CINEMASCOPE` or `STILL · REEL 1 · 24FPS`. Uses
  `font-mono`, opacity 0.4, letter-spacing 0.3em. Decorative (`aria-hidden`).
- Used on movie page hero and landing hero.
- Success: hero corners show subtle frame-stamp text without competing with
  the title.

**4.3 Subtle projector flicker on hero entry**

- CSS-only keyframe `cinema-projector-flicker`: 6 small opacity/brightness
  blips over 480ms. Applied via class `.cinema-hero-flicker` to the hero
  inner image on first render.
- Use `animation-play-state: paused` on `prefers-reduced-motion`.
- Success: opening a movie page shows a barely-perceptible flicker on the
  backdrop, then settles.

**Phase 4 deliverable**: film-medium texture without becoming Halloween/grindhouse.

### Phase 5 — Credits patterns

**5.1 Profile page → filmography layout**

- Restructure `profile/[handle]/page.tsx` to lead with a credits-styled
  filmography: section header `FILMOGRAPHY`, then a 3-column grid (YEAR ·
  TITLE · ROLE/RATING), small-caps year column tabular-nums, title in
  `font-display`, third column muted.
- Below filmography: existing reviews/lists in sub-sections styled like
  "ALSO CREDITED FOR".
- Success: a profile reads top-to-bottom like an IMDb-meets-end-credits doc.

**5.2 `<CreditsCrawl>` component**

- New file: `apps/web/src/components/cinema/credits-crawl.tsx`. Client.
- Accepts `lines: { role: string; people: string[] }[]`, renders a vertically
  scrolling end-credits crawl (CSS-only animation, slow). Pauses on hover/focus.
- Honor reduced-motion: static stacked layout instead.
- Success: drop in at the bottom of any movie page (`tmdbJson.credits.crew`)
  to see a crawl that pauses on hover.

**5.3 Long review → "and that's a wrap" closing credits**

- In `reviews/[id]/page.tsx`, append a `CreditsCrawl` with author + likers +
  commenters styled as "WRITTEN BY / READ BY".
- Success: long reviews end with a real credits sequence.

**Phase 5 deliverable**: reading a profile or a long review feels like the
credits at the end of a film.

### Phase 6 — Watchlist + ticket primitive

**6.1 Extract `<TicketStub>` primitive from `DiaryEntry`**

- New file: `apps/web/src/components/cinema/ticket-stub.tsx`.
- Generalized ticket: poster top, color stub bottom, punched notches, optional
  rating/note/badge slots, optional `tearDirection` prop.
- Refactor `DiaryEntry` to compose `TicketStub`.
- Success: existing diary visual unchanged; new component covers the same UI
  in fewer lines.

**6.2 Watchlist as ticket stack**

- `watchlist/page.tsx`: render watchlist items as `TicketStub`s in a fanned
  grid. On hover, the hovered ticket lifts and shifts neighbors slightly
  (CSS-only via `:has` + transform).
- Success: visually, the watchlist reads as "tickets I've collected", not
  "items in a queue".

**6.3 Home "Coming attractions" as ticket strip**

- Replace the simple poster grid in `home/page.tsx` "Coming attractions"
  section with a horizontal ticket-strip variant of `TicketStub` (compact
  prop).
- Success: home gains a tangible texture distinction between sections.

**Phase 6 deliverable**: the watchlist feels like a physical object.

### Phase 7 — Audio (opt-in)

**7.1 Settings toggle**

- Add `theaterAudio` boolean to user preferences (DB column on `profile` or
  `user_preferences` — pick what exists; do not add a whole table for one
  flag).
- Surface in `/me/settings`: switch with copy "Theater audio (experimental) —
  projector hum on film pages, soft clack on logs. Default off."
- Success: toggling persists round-trip.

**7.2 `useCinemaSound` provider** _(implemented as `useCinematicAudio` inside `sound-provider.tsx`)_

- New file: `apps/web/src/components/cinema/sound-provider.tsx`. Client.
- WebAudio context, lazy-loaded only after first user gesture AND toggle on.
- API: exposed `useCinematicAudio()` with `play(name)`, `stopSound(name)`, looping teardown helpers.
- Clips bundled in `apps/web/public/audio/`: `projector-hum.ogg`, `reel-clack.ogg`, `curtain.ogg`. CC0, ≤50KB.
- Hard-mute on `prefers-reduced-motion`.
- Success: with toggle on, navigating to a movie page starts projector hum
  faded in over 600ms; logging a film triggers a single reel-clack.

**Phase 7 deliverable**: opt-in audio layer feels like a real cinema, never
forced on anyone.

### Phase 8 — Polish + verify

- **Manual / release QA** (Planner): cross-browser sweep, Lighthouse Δ vs baseline, WCAG probes on darkest `MovieThemeProvider` palettes.
- **Automated Executor pass** (repo): authoritative `globals.css` header taxonomy; removed brittle absolute reference to DESIGN.md sources; **`prefers-reduced-motion`** freezes `.animate-spin` + ticket links (`a.cinema-ticket-link`); accented **button** `:focus-visible` inside `.movie-themed` matches anchors; **`@media (prefers-contrast: more)`** stacks a white outer ring on keyed focus inside tinted film shells; **`/sign-in` + `/search`** wrap `useSearchParams` clients in `<Suspense>` with lightweight fallbacks so `next build` (static prerender) succeeds.
- **Optional later**: prune any remaining duplicate `arthouse` tuning if still redundant once defaults equal 70 mm presets.

**Phase 8 deliverable**: ship-ready after manual matrix + Lighthouse/contrast checkpoints above.

### Track B — Design system & screen IA (Mobbin-informed, 2026-05-14)

Executor runs **one sub-task at a time**; human Planner confirms before the
next. Each item has self-verifiable success criteria.

**B.1 — Audit & principles doc (in-repo only: scratchpad + code comments)**

- Inventory primary routes: landing, home, diary, movie, profile, lists,
  reviews, search, watchlist, chat, settings.
- For each: note layout pattern (rail vs top nav), density, duplicate CTAs,
  a11y gaps (focus order, heading hierarchy).
- Write **5–7 non-negotiable principles** (e.g. one global accent, display type
  only for titles/H1–H2, chips for filters, popovers for dense filters).
- **Success:** bullet audit + principles appended under this track in
  `scratchpad.md` (Executor section cross-link); no behavior change.
- **Delivered 2026-05-14 (Executor):** see `Executor's Feedback` → _B.1 complete_.

**B.2 — Token & elevation pass (globals / theme)**

- Formalize **surface ladder** (`canvas` → `raised` → `popover`) compatible
  with `#020202` theater floor; ensure borders/contrast work on per-film tinted
  pages (`.movie-themed`).
- Document spacing scale usage for **page gutters vs card gutters** (avoid
  arbitrary `p-4`/`p-6` mix).
- **Success:** Storybook or static page not required; instead `globals.css`
  comments + token names used by ≥3 representative components; `tsc`/build
  green.
- **Delivered 2026-05-14 (Executor):** elevation tokens + `@theme` utilities
  (`surface-canvas` / `surface-raised` / `surface-overlay`); `--card` /
  `--popover` mapping; `AppNav`, `ActivityItem`, `CommandPalette` + diary/home
  empty states use `bg-surface-*`; `(app)/layout` gutter comment; `user-menu`
  drops redundant `bg-card` on dropdown (uses `bg-popover`). `bun run build`
  green — if Link/redirect route types falsely fail, delete `apps/web/.next` and
  rebuild (stale `RouteImpl` cache).

**B.3 — `AppShell` primitive (navigation contract)**

- Choose **default:** icon rail + labeled section header _or_ collapsible
  sidebar (Mobbin: Threads/Sora vs Grain/Suno). Pick one for MVP consistency.
- Spec: breakpoints where rail becomes drawer; where FAB / bottom bar appears
  (if any).
- **Success:** single shell component wraps `(app)` layout; no duplicate nav
  markup; keyboard landmark (`nav`, `main`).
- **Delivered 2026-05-14 (Executor):** `AppShell` in `components/app/app-shell.tsx`
  wraps chrome + `main#main-content`; `(app)/layout.tsx` only auth/profile gates;
  `appShellMainContentMinHeightStyle` + `APP_SHELL_BOTTOM_RESERVE_CSS` for person
  page vertical centering; docblock states bottom-bar contract (no rail→drawer).

**B.4 — Search + filter primitives**

- **Global search:** pill, optional scope tag (“Movies”, “People”), clear action.
- **Browse/discover:** chip row + optional advanced drawer (genre/year/service).
- **Success:** `/search` and one browse surface (e.g. home or new `/explore`)
  use the same primitives; applied filters show as dismissible chips.
- **Delivered 2026-05-14 (Executor):** `SearchPillField` + `FilterChipRow` /
  `FilterChipLink` / `FilterChipButton` (`components/ui/`); `SearchClient` uses
  pill + scope “Films” + dismissible query chip; `/movies/popular` +
  **`/movies/upcoming`** share `MovieCatalogSurfaceChips` + `PopularMoviesInfinite`
  `catalogKind`; `fetchMoviesUpcoming` in `still-api-fetch.ts`; search skeleton
  pill-shaped. Advanced drawer deferred to later browse work.

**B.5 — Core screens (priority order — adjust with human)**

1. **Home / following** — feed card anatomy (avatar, film line, rating, poster
   thumb, actions); optional right rail “friend activity” (collapsible).
   - **Delivered + human verified 2026-05-14:** `ActivityItem` + `FeedPersonAvatar`,
     `HomeFriendActivityRail`, `deriveFriendRailEntries`; nested review/list links
     removed; stable feed keys.
2. **Discover** — grid + chips + sort; empty genre state.
   - **Delivered 2026-05-14 (Executor):** `/movies/discover` + `GET /api/movies/discover` +
     `GET /api/movies/genres`; `MovieDiscoverToolbar` (genre rail + sort chips);
     `PopularMoviesInfinite` `catalogKind="discover"`; `MovieCatalogSurfaceChips`
     adds **Discover**; home empty CTA → discover; empty catalogue panel when
     TMDb returns zero rows.
3. **Film detail** — hero + tabs (reviews / lists / related); sticky log CTA.
   - **Delivered 2026-05-14 (Executor):** `MovieDetailExploreTabs` (Reviews / Lists /
     Related + empty states); `GET /api/movies/:id/lists`; hero **MovieActions**
     moved to **sticky** dock (`bottom` aligned with `AppShell` nav reserve);
     lists tab surfaces public lists containing the title.
4. **Quick log** — modal or bottom sheet: film → date → rating → note →
   submit; disabled-until-valid.
   - **Delivered + human verified 2026-05-14:** `QuickLogRoot` / `useQuickLog`; `MovieActions` Log opens sheet; `postLog` payload + validation as shipped (see Executor feedback B.5.4).
5. **Diary** — month grouping + list/masonry toggle for user stills only.
   - **Delivered + human verified 2026-05-14:** month buckets sorted **newest first**; rows within month by `watchedAt` desc; invalid dates → **Undated** section; `DiaryPageClient` toolbar (**Tickets** = ticket grid / **Stills** = CSS-column masonry of poster tiles + optional rating); preference `localStorage` `still.diary.layout`; `DiaryStillTile` for masonry-only; rows without joined `movie` skipped server-side.
6. **Lists** — Savee-style row: title + count + horizontal poster strip.
   - **Delivered + human verified 2026-05-14:** `withCoverPosterPaths` in `apps/server/src/lib/list-cover-posters.ts` — wired to `GET /api/lists` + `/popular` + `/me` + `/by-user/:userId`, list `POST`/`PATCH` return, and profile `lists` query; **`ListRowStrip`** (`apps/web/…/list-row-strip.tsx`) + **`toListBoardRow`** (`lib/list-board-row.ts`); `/lists` index + profile **Lists** section use bordered single-column rows (title, counts, likes, updated, optional description, overlapping poster strip from real `poster_path`); removed broken `ListCard` TMDB `movieId.jpg` URLs.
7. **Profile** — centered header + stat tabs + content grid.
   - **Delivered + human verified 2026-05-14:** centered hero (avatar overlap, display name, @handle, bio, stats row, actions); **`?tab=`** section tabs (`filmography` + `sectionOrder` rails with content); semantic **`<table>`** filmography; single **content grid** panel per tab; Biome-a11y-friendly vs prior `role="table"` on `div`.
8. **Notifications** — grouped list, read state.
9. **Settings** — left sub-nav sections.
   - **Delivered (Executor 2026-05-15):** `(app)/me/layout.tsx` + **`MeAccountNav`** (`me-account-nav.tsx`) — **vertical** “Account” links on **`md+`** (icon + label + short description); **horizontal** underlined tabs on **`<md`** (profile-tabs pattern); wraps **`/me/settings`** and **`/me/customization`**.

- **Success per screen:** responsive at `sm`/`md`/`lg`; one a11y pass (labels,
  focus); loading/empty/error states specified and implemented where missing.

**B.6 — Motion & delight budget**

- Align with user rules: interaction motion **≤200ms**; route transitions may
  stay cinematic but **lists/grids** avoid gratuitous stagger.
- **Success:** checklist in scratchpad Lessons + no new `prefers-reduced-motion`
  violations.
- **Delivered + human verified 2026-05-14:** `--aker-duration` / `--aker-duration-slow` **0.2s**; Framer dialogs/sheets/onboarding **0.2s** + `useReducedMotion`; `AppNav` + landing poster rail; ticket stub filter **200ms**; **Lessons** entry — see Executor **Track B.6** log.

**B.7 — Planner sign-off**

- Human reviews Track B on staging: “easy + beautiful enough to return daily.”
- **Success:** explicit Planner note in scratchpad closing Track B or listing follow-ups.
- **Recorded 2026-05-14:** Executor section **“Human: B.6 signed off + Track B.7 Planner sign-off”** — Track B implementation arc closed for shipped B.3–B.6 + B.5.4–B.5.8 scope; **follow-ups** listed there (B.5.2/B.5.3/B.5.9, nav parity, B.1/B.2, Phase 8 manual). _(**2026-05-15 / 2026-05-16:** those follow-ups closed in Executor — **Human: B.5.2 / B.5.3 / B.5.9 signed off**, **Human: B.1 / B.2 signed off**.)_

**Track B deliverable:** a **usable** product skin: predictable navigation,
fast filtering, readable feeds, profiles that feel premium — **on top of** the
existing cinematic identity rather than replacing it.

## Project Status Board

### Phase 1 — Foundation

- [x] 1.1 Add Fraunces display face + `font-display` token _(awaiting human verify)_
- [x] 1.2 Migrate top-level headings from `font-serif` to `font-display` _(awaiting human verify)_
- [x] 1.3 Refine black scale + heavier vignette default _(awaiting human verify)_
- [x] 1.4 `<Letterbox>` primitive _(awaiting human verify)_
- [x] 1.5 Apply letterbox to landing hero, movie hero, profile cover _(awaiting human verify)_

**Phase 1 complete — awaiting Planner/human sign-off before Phase 2.**

### Phase 2 — Per-film color world

- [x] 2.1 Schema migration: add palette columns to `movies` _(SQL: `0001_abnormal_black_bolt.sql`; run `bun run db:migrate` when DB reachable)_
- [x] 2.2 Palette extraction at TMDB sync time
- [x] 2.3 `MovieThemeProvider`
- [x] 2.4 Wire palette into chrome elements (`globals.css` `.movie-themed`)

### Phase 3 — Scene-cut transitions

- [x] 3.1 Adopt View Transitions (CSS `::view-transition-*`, `experimental.viewTransition`) + `CinemaSceneCut` veil
- [x] 3.2 Iris-out on movie page enter (`cinema-hero-iris` + `view-transition-name: hero-iris`)
- [x] 3.3 Projector boot on first paint (`ProjectorBoot`)

### Phase 4 — Film stock detail

- [x] 4.1 Edge codes on `.cinema-film-strip-rail` (`--coded`, `data-edge-code`)
- [x] 4.2 `<FrameStamp>` component (landing + movie hero)
- [x] 4.3 Subtle projector flicker on hero entry (`.cinema-hero-flicker`)

### Phase 5 — Credits patterns

- [x] 5.1 Profile page → filmography layout
- [x] 5.2 `<CreditsCrawl>` component
- [x] 5.3 Long review → "and that's a wrap" closing credits

### Phase 6 — Watchlist + ticket primitive

- [x] 6.1 Extract `<TicketStub>` primitive from `DiaryEntry`
- [x] 6.2 Watchlist as ticket stack
- [x] 6.3 Home "Coming attractions" as ticket strip

### Phase 7 — Audio (opt-in)

- [x] 7.1 Settings toggle
- [x] 7.2 `useCinematicAudio` / CinemaSound provider

### Phase 8 — Polish + verify

**Manual QA playbooks:** **8.1**, **8.3**, and **8.4** have Executor-written checklists in **`### Phase 8.1 prep`**, **`### Phase 8.3 prep`**, and **`### Phase 8.4 prep`** (same file, below this list).

- [x] 8.1 Cross-browser smoke _(**Phase 8.1 prep** — Chrome · Safari · Firefox · iOS Safari; human **`ok` 2026-07-06**)_
- [x] 8.2 Reduced-motion audit — code sweep (globals + `cinema-ticket-link` + loaders)
- [ ] 8.3 Lighthouse perf _(**Phase 8.3 prep** — mobile vs last tagged release, like-for-like build mode)_
- [ ] 8.4 a11y contrast on per‑film palette _(**Phase 8.4 prep** — `.movie-themed` extremes + WCAG probe)_
- [x] 8.5 `globals.css` token map prose + stray path cleanup + button focus parity
- [x] 8.6 `next build` green: Suspense shells for `/sign-in` + `/search`; `prefers-contrast` focus boost on `.movie-themed` controls _(Executor verified `bun run build` in `apps/web/`)_

### Phase 8.1 prep — Cross-browser smoke checklist _(Executor 2026-05-16; refreshed 2026-07-06)_

**Browsers:** Chrome · Safari · Firefox · iOS Safari — same signed-in account (staging or local).

**Per browser (ordered pass) — 2026-07 product IA**

1. **`/home`** — Movies · TV · Community browse rail; sticky search + chips; no horizontal overflow at **390px**; **Movies ↔ Community** pill moves without full-page freeze.
2. **`/home?browse=tv`** — run chips (Ongoing · Completed · Upcoming); **Continue watching** rail when applicable.
3. **`/home?browse=community`** — Lists · Reviews · Activity · Film/TV ranks; period chips (Week · Month · Year · All time).
4. **`/movies/[id]`** — hero legible; **About · Community · Quotes · Streaming** tabs; bottom **`MobileTabBar`** clears content; switch tabs once each.
5. **⌘K / Ctrl+K** — search dialog opens viewport-fixed; token pills + infinite results scroll; **People** row when signed in.
6. **`/profile/[handle]`** — taste persona pill (*Dramatist*, not *Genre-led*); popover genres; **`/diary`** + **`/watchlist`** lobby chips.
7. **`HomeStickyChrome` notifications** — bell menu on home/diary/watchlist/lists/profile (not movie/TV detail); one row tap if data.
8. **`/me/settings` ↔ `/me/settings/subscription`** — sidebar vs mobile; **Invite friends** opens Invite & earn dialog.
9. **`/achievements`** — Badges · Goals · Challenges; back pill; no overflow at **390px**.
10. **`/pricing`** — tier cards + compare table at **390px** (watch horizontal overflow on compare grid).

**Pass criteria:** no blank shell, no stuck modal/palette, bottom nav tappable (≥ ~44px), **Firefox** tolerates absent **View Transitions** (instant nav OK), no console **errors** on critical paths.

**Chrome partial smoke (Executor 2026-07-06, unsigned, 390×844):**

| Route | Result | Notes |
|-------|--------|-------|
| `/sign-in` | ☑ | Form renders; auth shell visible |
| `/movies/550` | ☑ | Detail shell + tabs; **no** horizontal overflow |
| `/pricing` | ⚠ | Compare section **overflows** at 390px (705px scroll width) — verify signed-out + signed-in |
| `/home` | — | Redirects to sign-in (needs session) |

**Signed-in matrix (human):** run rows 1–10 above in **Chrome · Safari · Firefox · iOS Safari**. **Human `ok` 2026-07-06 — 8.1 closed.**

**Known dev note:** if profile taste pill throws `tasteArchetypeLabel is not defined`, hard-refresh — source uses `tasteSignaturePillLabel` (stale HMR).

### Phase 8.3 prep — Lighthouse mobile perf _(Executor 2026-05-16)_

**Tool:** Chrome **Lighthouse** (DevTools) or hosted **PageSpeed Insights** against the staging origin.

**Setup**

- Preset: **Mobile** + default throttling; first run in a **clean profile** (or hard-reload with cache disabled) so scores are comparable run-to-run.
- Compare **like vs like**: **`next start`** (or production deploy) vs the **same** for the last **git tag** you care about — do **not** compare **`next dev`** to **`next start`**.

**URLs to capture (mobile)** — adjust host to staging:

1. **`/`** (marketing — largest paint is usually hero / poster rail).
2. **`/home`** (signed-in lobby — feed + rails).
3. **`/movies/[id]`** — pick a **poster-heavy** film (large hero image).
4. **`/diary`** — long ticket list (scroll cost).

**Log per URL:** **Performance** score, **LCP** (element + time), **CLS**, **TBT** (or **INP** if shown), Chrome version, build mode.

**Pass gate (relative, default):** no **> ~5 pt** drop in **Performance** on **`/home`** vs last tagged baseline **without** an obvious cause (new hero asset, removed `priority`, slower API); **LCP** not worse by **> ~500ms** on same network/hardware. _(Planner may tighten numbers.)_

### Phase 8.4 prep — Per-film palette contrast _(Executor 2026-05-16)_

**Scope:** Pages under **`.movie-themed`** (film detail and any chrome that inherits per-film CSS vars) — **WCAG AA** for text and controls that patrons actually read.

**Pick 3 films** (swap ids for real rows in your DB): **high-chroma** poster, **muted / brown** poster, **dark-on-dark** edge case if you have one.

**Per `/movies/[id]`**

1. Chrome **Rendering → Emulate CSS `prefers-contrast: more`** — buttons, links, and focus rings remain visible on hero + dock.
2. **Axe** (or another contrast tool) on **primary CTA**, **hero link**, **body/meta** near accent-tinted regions — export or screenshot failures.
3. **Keyboard:** **Tab** from first focusable through hero + into **MovieDetailExploreTabs** — no focus trapped or invisible behind hero.

**Pass criteria:** no **critical** contrast failures on the **read title → rate / log → open tabs** path; **`prefers-contrast: more`** remains shippable.

### RadialToolkit — Catalogue lobbies (Scope A)

- [x] RT.A Spec + plan approved _(2026-05-22)_
- [x] RT.1 Recipe builder + tests (`catalogue-radial-items`)
- [x] RT.2 `CataloguePosterTile` shell
- [x] RT.3 Add-to-list from radial (`useAddToListRadial`)
- [x] RT.4 `PopularMoviesInfinite` + `/home`
- [x] RT.5 `/watchlist`
- [x] RT.6 `/diary` (film + TV group poster)
- [x] RT.7 Build, `graphify update`, `AGENTS.md` _(awaiting human QA **ok**)_

### Track B — Design system & screen IA _(**B.1–B.7** + **B.5.1–B.5.9** human-verified per scratchpad where shipped; Phase 8 manual QA still open)_

- [x] B.1 Route audit + written principles (scratchpad + code) _(human verified 2026-05-16)_
- [x] B.2 Token & elevation ladder (surfaces, gutters, `.movie-themed` harmony) _(human verified 2026-05-16)_
- [x] B.3 `AppShell` / navigation contract for `(app)` _(human verified 2026-05-14)_
- [x] B.4 Search + filter primitives (global pill, chips, advanced drawer) _(human verified 2026-05-14; drawer deferred)_
- [x] B.5 Core screens (…) — **one screen per Executor milestone** _(**B.5.1–B.5.9** human-verified **2026-05-15** where shipped: **B.5.2** Discover, **B.5.3** film detail, **B.5.9** settings sub-nav — user **ok** **2026-05-15**; **B.5.4–B.5.8** as previously verified **2026-05-14**.)_
- [x] B.6 Motion budget checklist (≤200ms interactions; reduced-motion clean) _(human verified 2026-05-14)_
- [x] B.7 Planner / human sign-off on Track B _(Planner note 2026-05-14 — see Executor; staging “daily return” bar met for shipped scope, follow-ups listed)_

## Executor's Feedback or Assistance Requests

### 2026-08-10 — `/home` slow load: runaway fetch loop in `HomeTasteMatchedHero` (fixed)

**Symptom:** shell/skeleton painted fast, posters took seconds to fill in — local and Vercel.

**Root cause (measured, not guessed):** three effects in `home-taste-matched-hero.tsx` depended on the derived **`spotlight` object** while writing results back into `movies`, so each write rebuilt that object and refired the effects. Idle `/home` issued **815 API requests in 25s** (~22 req/s) to `/api/movies/:id` (title-logo + trailer) and `/api/logs/me/by-movie/:id`. At **2 Neon queries per request** the DB did ~29s of pointless work per 25s window, starving the `/home` RSC render.

**Fix:** key the effects on the primitive **`spotlight?.tmdbId`**, seed from `moviesRef.current`, and return `prev` unchanged from `setMovies` when nothing differs.

**Verified:** idle **815 req/25s → 2 req/30s** (presence + streak polls only). `/home` waves **913ms + 1442ms → 125ms + 317ms** (~443ms total). No type errors in changed files; `tv-watch.ts` / `staff.test.ts` / `listing-presence-copy.test.ts` / `packages/plans` failures are **pre-existing** (in-progress `staffRole` work).

**Left in place:** opt-in `traceTiming` helpers + `[trace:req]` logger, silent unless **`STILL_TRACE_TIMING=1`**. Planner declined the secondary wins (duplicate per-request profile query; serial RSC waves) — deferred, not done.

**⚠️ The above was a premature all-clear — see the follow-up below.**

### 2026-08-10 (cont.) — `/home` real bottleneck: `tmdb_json` dragged by `select({ log, movie })`

**Correction:** the loop fix above was real but **not the cause of the slow load**. The two RSC waves I instrumented were only **330ms** while the actual page response was **10–11s** — I had measured only the spans I already suspected and called it done.

**Root cause:** `/api/taste/for-you` (`buildTasteMatchedDiscovery`) ran **10–33s** and held the taste-hero **Suspense boundary** open, so the shell painted instantly and posters lagged. Phase timing isolated it to two queries using **`.select({ log, movie })`** with `.limit(400)`: `movie.tmdbJson` holds the **verbatim TMDb payload**, so both shipped hundreds of large JSONB blobs from Neon **eu-central-1** to use **six scalar fields**.

**Fix:** column-scope both queries — `viewerDiaryRows` in `taste-matched-discovery.ts` and the neighbor query in `taste-social-candidates.ts`. No logic change.

**Verified:** `viewerDiaryRows` **4383ms → 50ms**, `socialCandidates` **4804ms → 76ms**, `buildTasteMatchedDiscovery` **10851ms → 1618ms**, `/home` **11.3s → 2.3s**. Typecheck clean on changed files; taste suite **28 pass / 5 fail** identical to a stashed baseline (env-var failures under root `bun test`, pre-existing).

**Follow-up round (same session) — all three secondary items done:**

1. **`/api/lists/me` ~20x per load → 0.** `useAddToListRadial` prefetched lists in a **mount effect**, and the hook runs **once per poster cell**. Lists now load in `openPicker` only (callers never read `listsLoading`).
2. **`enrichMovies` 504ms → 125ms.** Split proved the cost was the query, not TMDb (`enrich cacheRows` **420ms** vs `enrich rows` **83ms**). Fixed in two steps: fetch `tmdb_json` only for the **12 hero titles** (rail carries **24**), then replace the column with a **`jsonb_build_object` projection** of the only paths read — `videos`, `images.logos`, `keywords`. Verified against real rows: **425,706B → 10,590B** for 5 movies (**~40x**), pickers returning identical trailers/logos. `enrich heroJson` **300ms → 44ms**.
3. **`resolveTasteNeighbors` ~263ms — deliberately left alone.** Already column-scoped and parallel; no cheap win. **Latent risk:** it fans out `fetchOverlapDiarySlices` **one query per followed patron** (and per candidate), so it degrades on heavy-following accounts.

**Final:** `buildTasteMatchedDiscovery` **970ms**, `/home` **1.63s** (from **11.3s**). Typecheck clean on changed files; taste suite **28 pass**, no new failures vs baseline.

**Same anti-pattern still present elsewhere** (not on the `/home` path, unmeasured): `.select({ log, movie, ... })` in `feed-rating-divergence.ts`, `routes/feed.ts`, `routes/logs.ts` (×2), `recompute-user-taste-signature.ts`, `suggested-patron-discovery.ts`, `movie-following-ratings.ts`. Worth auditing if feed or profile pages feel slow.

**Caveat:** gains are **larger locally than in prod** — the remote dev DB (eu-central-1) exaggerates transfer cost.

### 2026-07-25 — Movie detail shell layout review (Agentation `/movies/426063`)

**Shipped:** `MovieDetailViewShell` — hero scoped to **About** only; top bar restored **outside** the card on `bg-background` canvas (sticky header like before); simplified flex stretch on card section; back pill uses **`formatListingDetailBackAffordance`**; hero meta **`text-sm`** + title **`leading-[1.12]`** on movie/TV pages. Person detail shell aligned. Tests: `movie-detail-return.test.ts` (+2).

**Human verified + committed (`a1f5964`, 2026-07-25).** Layout + animation polish shipped. Segment pill uses **`translateX` + `width`** (not `scaleX` — preserves `rounded-full`). Same pill slide on **`SegmentedPillToolbar`** (`/home` chips). **Nested drawer stack (`f68ecbe`):** lower `DetailVaulSheet` scales when a sheet opens above it.

### 2026-07-20 — Person awards brainstorm

**Approved design:** Approach **2** (person strip + drawer). Spec: `docs/superpowers/specs/2026-07-20-person-awards-design.md`. Plan: `docs/superpowers/plans/2026-07-20-person-awards-plan.md`.

**SDD Tasks 1–7 shipped** (`cc3871c`…`a52f53c`) + review fixes (`2bcdcef` Oscars-first prestige · shared column; `30d7095` no empty column padding). Lib tests **person-awards 4/4** (+ earlier suites). **Follow-up list chrome (`5883ab5`):** shared `FestivalRecognitionAwardList` + Won/Nominated pills in person drawer and movie View all. **Human verified Task 8 + follow-ups 1–10 (`ok`, 2026-07-25):** About order · stills rail drag · editorial rail snap · taste hero YouTube · default Popular · cinema-only streaming · request-host origin · staff notes author · portrait still widths (`cf8fd45`).

**Person awards + detail polish track closed (2026-07-25).**

**Executor batch (`6ac492e` · `f6f65a7`, 2026-07-25):** Community **Ranks** chip first + Popular sort URL serialization · profile hero + ledger drawer typography · About column width + drop Community from About nav · poster `draggable={false}` · synopsis cursor-CTA CSS · watch-region drawer scale · landing/pricing `generateMetadata` request-host · auth localhost trusted origins. Home lobby tests **12/12** pass.

**Executor (2026-07-25):** **`TvDetailProgressPanel`** UX refresh on `/tv/*` About — summary meter card (episodes watched + % + next line), spaced `bg-background` season/episode tiles (no dividers/shadows), per-season progress bars, collapsed accordion headers show watch counts, status-aware subtitles, `DetailMotionButton` on primary actions. **Shipped + human verified (`ok`, 2026-07-25) — `5cf6908`.**

### 2026-07-20 — Person detail gallery stills (Agentation `/people/1892`)

**Ask:** more actor images from films below on person detail.
**Shipped (Executor, `7c67d71`):**
- TMDb person fetch appends `images,tagged_images`
- `buildPersonGallerySlides` → `screenshots` on `GET /api/people/:id` (landscape tagged first, then extra profiles; hero portrait excluded)
- About tab renders `MovieDetailStillsSection` under the TMDb link (movie stills chrome)
- Tests: `person-gallery-slides.test.ts` **4/4**

**Manual confirm:** open `/people/1892` (About) — stills rail below; download still works. **Human verified (`ok`, 2026-07-25).**

**Follow-up (2026-07-20):** person gallery uses `imageFit="contain"` so mixed portrait/poster/backdrop tags letterbox instead of `object-cover` crop. Movie/TV stills stay `cover`.

**Follow-up 2:** each slide carries `aspectRatio` from TMDb; stills cards use that ratio (portrait → narrower `20rem` card, landscape → wide card) so format matches the image.

### 2026-07-20 — Community feed chips: Ranks first

**Agentation:** `/home?browse=community&sort=ranks` — “ranks should be the first one on the left”.
**Shipped:** `HOME_COMMUNITY_FEEDS` order → **Ranks · Lists · Reviews · Activity** (default feed still `lists`). Updated chip comment + AGENTS.md.
**Manual confirm:** reload Community lobby — Ranks is leftmost chip. Reply **`ok`**.

### 2026-07-20 — Better Auth `Invalid origin: http://localhost:3001`

**Root cause:** `apps/server/.env` had `CORS_ORIGIN` / `BETTER_AUTH_URL` = `http://192.168.1.34:3001` while web uses `http://localhost:3001`.

**Shipped (Executor):**
1. Set `BETTER_AUTH_URL` + `CORS_ORIGIN` to `http://localhost:3001` in `apps/server/.env`
2. Dev `trustedOrigins` in `packages/auth` now always includes `localhost:3001` + `127.0.0.1:3001`
3. Dev Elysia CORS in `apps/server/src/server/app.ts` allows the same pair alongside `CORS_ORIGIN`

**Manual confirm (Planner/human):** Restart `bun dev`, reload `http://localhost:3001`, confirm the Invalid origin error is gone and sign-in/session works. Reply **`ok`**.

### 2026-07-07 — Runtime crash fix (`usePatronEntitlements` provider boundary)

**Shipped:** patched `apps/web/src/components/profile/profile-patron-actions.tsx` to avoid a hard crash when profile actions render outside the signed-in entitlement provider tree.
- Switched `ProfileOtherPatronActions` from `usePatronEntitlements` to `usePatronEntitlementsOptional`
- Added a defensive fallback: `canUseTasteOverlap` now checks `entitlements?.hasFeature("taste_overlap")`
- Added an inline comment documenting why this component must handle missing provider context (public-share/profile surfaces)

**Why:** dev runtime repeatedly threw:
- `usePatronEntitlements must be used within PatronEntitlementsProvider`
- stack included `ProfileOtherPatronActions`

**Verification status:**
- `ReadLints` on the touched file: **no linter errors**
- Local typecheck command attempts:
  - `bun --filter web check-types` → no matching filter in this workspace
  - `bun run check-types` in `apps/web` → script not defined
  - `bunx tsc --noEmit` in `apps/web` → fails on existing `.next/dev/types/validator.ts` generated-file errors, unrelated to this patch

**Manual confirm request (Planner/human):**
1. Reload the profile page path that previously crashed
2. Confirm no entitlement-provider runtime error appears in dev logs
3. Confirm **Compare taste** behavior still gates correctly (visible for entitled viewers, upgrade gate otherwise)

**Follow-up hardening (same task, 2026-07-07):**
- Guarded `ProfileOtherPatronActions` against a second provider-boundary crash path by rendering `PlanFeatureGate` **only when** entitlements context exists.
- Reason: `PlanFeatureGate` itself uses strict `usePatronEntitlements`, so showing it while `entitlements` is `null` could still throw on public-share surfaces.

### 2026-07-02 — Vercel typecheck blocker fix (patron feedback Date vs string)

**Shipped:** patched `apps/web/src/lib/fetch-patron-feedback-client.ts` to remove unsafe API casting and explicitly normalize feedback payloads.
- Added timestamp normalizers: `asIsoString` / `asNullableIsoString`
- Added runtime mappers: `normalizeFeedbackListItem` and `normalizeFeedbackDetail`
- Converted list/detail fetchers to map server payload (`Date | string`) into client contract (`string` timestamps) instead of force-casting

**Why:** Vercel failed on:
- `Conversion ... may be a mistake`
- `createdAt` mismatch (`Date` from server type vs `string` in web client type)

**Verification status:**
- Local build remains blocked by an existing machine dependency issue (`aws4fetch` resolution), unrelated to this feedback typing fix.
- Ready for Vercel re-run to confirm this specific typecheck error is cleared.

### 2026-07-02 — Vercel build blocker fix (BlobPart / Uint8Array mismatch)

**Shipped:** patched `apps/server/src/lib/r2-dev-assets.ts` in `bodyFromBytes`.
- Normalized bytes with `Uint8Array.from(bytes)` before creating `Blob`
- Switched Blob input to `normalizedBytes.buffer` to satisfy strict DOM `BlobPart` typing (`ArrayBuffer`-backed path) used by Next 16 typecheck

**Why:** Vercel failed with:
- `Type 'Uint8Array<ArrayBufferLike>' is not assignable to type 'BlobPart'`
- failing line was `new Blob([bytes]).stream()`

**Verification status:**
- Original error signature is removed by code path change (line now uses normalized `ArrayBuffer`)
- Local full build verification is currently blocked by existing environment dependency resolution issues (`aws4fetch` / `tsdown` module resolution in this machine), which are separate from the original `BlobPart` error.

**Manual confirm request (Planner/human):**
1. Re-run Vercel deploy for commit containing this patch
2. Confirm the `BlobPart`/`Uint8Array<ArrayBufferLike>` type error no longer appears
3. Report the next failing step (if any) so I can handle the next blocker as a separate task

### 2026-06-16 — Presence AFK Task 9 (complete — plan shipped)

**Automated verification:**
- Server: `bun test src/lib/presence-activity.test.ts src/lib/listing-presence.test.ts src/lib/patron-presence.test.ts src/routes/realtime-presence.test.ts` → **41/41 pass**
- Web: `bun test src/lib/patron-activity-tracker.test.ts src/components/profile/patron-online-dot.test.ts src/lib/listing-presence-copy.test.ts` → **17/17 pass**

**Manual QA checklist (optional):**
1. Tab away → other patron sees orange dot within ~25s (or sooner on heartbeat flip)
2. 5 min idle on visible tab → orange
3. Mouse move / tab focus return → green micro-pop
4. `prefers-reduced-motion` → color swap only, no scale/blur
5. Movie/TV listing corner pill + presence drawer dots match global portrait badges

**Planner:** AFK presence plan **complete** — human **`bene`** on tab-switch fix (2026-06-16).

### 2026-06-16 — Presence AFK Task 6 (complete)

**Shipped:** wired local activity state into presence heartbeats.
- `PatronActivityProvider` in `use-patron-activity-tracker.tsx` (single DOM listener set for app shell)
- `buildPresenceHeartbeatBody` + `activityState` on `touchPatronAppPresenceClient` / `touchListingPresenceClient`
- `PatronOnlineProvider` + `useListingPresence` pass `activityState` on 25s heartbeat; immediate POST on active↔away flip (skips duplicate on mount)
- `(app)/layout.tsx` wraps `PatronActivityProvider` around `PatronOnlineProvider`

**Tests:** `bun test src/lib/patron-activity-tracker.test.ts src/lib/fetch-patron-online.test.ts` → **6/6 pass**.

**Ready for next milestone:** reply **`go`** for **Task 9** (full verification + docs).

### 2026-06-16 — Presence AFK Task 8 (complete)

**Shipped:** wired `presenceState` to portraits and listing presence.
- `PatronPortraitWithMetalTier` — `usePatronPresenceState` for global surfaces; optional `presenceState` prop for listing snapshot (skips batch lookup)
- `formatPatronPresenceDotLabel` — `@handle online now` vs `@handle away`
- Listing presence row + drawer — `showOnlineStatus` + `presenceState={patron.presenceState}`

**Tests:** `bun test src/lib/listing-presence-copy.test.ts` → **10/10 pass**.

**Ready for next milestone:** reply **`go`** for **Task 9**.

### 2026-06-16 — Presence AFK Task 7 (complete)

**Shipped:** `PatronOnlineDot` green/orange + micro-pop.
- `presenceState: "active" | "away" | null` replaces `visible`
- `presenceDotSurfaceClass` — `bg-emerald-400` vs `bg-desert-orange`
- Mount/unmount `AnimatePresence` unchanged; active↔away micro-pop `scale [1, 1.12, 1]` ~180ms (skipped when reduced motion)
- Portrait bridge: `presenceState={isOnline ? "active" : null}` until Task 8 wires `usePatronPresenceState`

**Tests:** `bun test src/components/profile/patron-online-dot.test.ts` → **2/2 pass**.

**Ready for next milestone:** reply **`go`** for **Task 8**.

### 2026-06-16 — Presence online visibility Task 1 (complete)

**Shipped (Task 1):** added presence visibility preference helpers in `profile-media.ts`:
- `readProfilePresenceVisibilityPref(preferences)` with safe fallback
- constants/types for `friends|public`
- default behavior is `friends` when key is missing/invalid

**Tests:** `bun test src/lib/profile-media.test.ts` → **11/11 pass** (added dedicated tests for missing/public/invalid visibility values).

**Note:** Existing tier assertion in `profile-media.test.ts` was out of sync with current `resolveDiaryMetalTier` thresholds and is now aligned (`150` => `chromatic`).

**Ready for next milestone:** reply **`go`** to start **Task 2** (server snapshot filtering by visibility in listing presence).

### 2026-06-16 — Presence online visibility Task 2 (complete)

**Shipped (Task 2):** server-side snapshot filtering now enforces `presenceVisibility`:
- `listing-presence.ts` imports follow graph and reads `preferences.privacy.presenceVisibility`
- `pickListingPresenceViewingPatrons` now filters identities to:
  - always show when visibility is `public`
  - show when visibility is `friends` only if viewer is mutual/friend
- returned patron rows now include `isOnlineNow: true`

**Tests:** `bun test src/lib/listing-presence.test.ts src/routes/realtime-presence.test.ts` → **21/21 pass**.

**Ready for next milestone:** reply **`go`** to start **Task 3** (route-level contract verification for the additive `isOnlineNow` payload and visibility behavior).

### 2026-06-16 — Presence online visibility Task 3 (complete)

**Shipped (Task 3):** route contract verification now explicitly locks the additive presence payload field.
- Updated `realtime-presence.test.ts` mocked snapshot and response assertions to require `viewingPatrons[*].isOnlineNow === true`.

**Tests:** `bun test src/routes/realtime-presence.test.ts` → **10/10 pass**.

**Ready for next milestone:** reply **`go`** to start **Task 4** (Settings → Privacy control for presence visibility).

### 2026-06-16 — Presence online visibility Task 4 (complete)

**Shipped (Task 4):** Settings → Profile now includes a privacy control for presence visibility:
- Added `readProfilePresenceVisibilityPref` and constants in `apps/web/src/lib/profile-preferences.ts`
- Added tests in `apps/web/src/lib/profile-preferences.test.ts` (default friends, explicit public, invalid fallback)
- Extended settings form state/draft persistence for `presenceVisibility`
- Persisted nested payload on save via `preferences.privacy.presenceVisibility`
- Added UI control under profile privacy: **Friends only** / **Public**

**Tests:** `cd apps/web && bun test src/lib/profile-preferences.test.ts` → **20/20 pass**.

**Note:** Workspace-wide `bun run check-types` fails in existing `server` project due to pre-existing TS5055 dist overwrite errors; no new web lint diagnostics were introduced for changed files.

**Ready for next milestone:** reply **`go`** to start **Task 5** (render online-dot status in compact presence row + drawer rows).

### 2026-06-16 — Presence online visibility Task 5 (partial complete)

**Shipped (Task 5a):**
- Added `isOnlineNow: true` to web presence snapshot patron type (`fetch-listing-presence.ts`)
- Updated `ListingPresenceRow` avatar rendering with a compact green online dot badge
- Updated a11y label copy from "is viewing" to `online now`

**Tests:** `bun test src/lib/listing-presence-copy.test.ts src/lib/profile-preferences.test.ts` → **26/26 pass**.

**Note / blocker for Task 5b:** there is currently no dedicated listing-presence drawer rows component in the web app to apply the same badge treatment; only the compact row is currently implemented for listing presence.

**Ready for guidance:** reply **`go`** to proceed with Task 6 (verification + docs), or tell me which drawer component you want to use for the presence patron rows so I can wire the same green-dot badge there.

### 2026-06-16 — Presence online visibility Task 6 (complete)

**Automated verification run:**
- `apps/server`: `bun test src/lib/profile-media.test.ts src/lib/listing-presence.test.ts src/routes/realtime-presence.test.ts` → **32/32 pass**
- `apps/web`: `bun test src/lib/profile-preferences.test.ts src/lib/listing-presence-copy.test.ts` → **26/26 pass**

**Docs updated:**
- `AGENTS.md` listing-presence guidance now includes online-dot badges + `preferences.privacy.presenceVisibility` (`friends` default, optional `public`) in Settings → Profile.
- Scratchpad milestone updates recorded for Tasks 1–6.

**Manual QA still needed (human):**
1. Friends-only default: friend sees identity + dot, non-friend sees count-only.
2. Public mode: non-friend also sees identity + dot.
3. Presence row hides when alone.

**Open implementation gap:** presence drawer rows are not implemented in current listing-presence UI surface, so green-dot treatment is currently applied to the compact row only.

### 2026-06-16 — Presence online visibility follow-up (drawer rows added)

**Shipped:** implemented listing-presence drawer rows with online badges.
- New `apps/web/src/components/movie/listing-presence-drawer.tsx`
- `ListingPresenceProvider` now opens this drawer from the compact presence count action
- Drawer rows render `PatronPortraitWithMetalTier` + green online dot (`isOnlineNow`)
- Compact row count pill now acts as drawer trigger via `onOpenDrawer`

**Tests:** `bun test src/lib/listing-presence-copy.test.ts src/lib/profile-preferences.test.ts` → **26/26 pass**.

**Lint:** no diagnostics on updated drawer/row/provider files.

### 2026-06-16 — Presence drawer copy test coverage

**Shipped:** extracted drawer headline/description logic into a pure helper:
- `buildListingPresenceDrawerCopy` in `apps/web/src/lib/listing-presence-copy.ts`
- `listing-presence-drawer.tsx` now consumes this helper

**Tests added:** `apps/web/src/lib/listing-presence-copy.test.ts`
- singular title for one visible patron
- hidden/private gap description when viewer count exceeds visible rows

**Verification:** `bun test src/lib/listing-presence-copy.test.ts` → **8/8 pass**.

### 2026-06-14 — Onboarding wizard v3 Task 9 (wizard state machine)

**Shipped:** `onboarding-wizard.tsx` — full step machine (welcome → identity → verify gate → taste → favorites → done), abbreviated **Maybe later** / **Finish later** paths, `runOnboardingFinish` wiring, email-verify auto-advance + `EMAIL_VERIFICATION_REQUIRED` toast fallback. `onboarding/page.tsx` updated to full-bleed `OnboardingWizardLayout`; deleted legacy `onboarding-flow.tsx`.

**Tests:** onboarding lib suite **11/11 pass** (`onboarding-handle-validation`, `onboarding-taste-state`, `onboarding-finish`).

**Manual verify on `/onboarding`:**
1. **Set up now** — avatar → name → handle → bio → (verify if unverified) → quick-rate (≥8) → favorites → done → `/home`
2. **Maybe later** — name + handle only → `/home` with `markOnboarded`
3. **Finish later** on identity steps — jumps to missing name/handle or saves when valid
4. Unverified email — hard stop on verify before taste; resend + refresh advances to taste
5. Desktop live preview + mobile strip on identity steps; preview hidden on taste
6. Reduced motion — instant step transitions (no slide)

Reply **`ok`** to proceed to **Task 10** (final QA + spec status).

### 2026-06-14 — Onboarding wizard v3 Task 10 (in progress)

**Taste step split layout (Executor):**
- `taste-step.tsx` — `useTasteStepData` hook + `TasteStepControls` (left) + `TasteStepGridPanel` (right / mobile stack)
- `onboarding-wizard.tsx` — taste grid in layout preview column on `lg+`; controls stay in ~400px shell; mobile stacks chrome then grid (no preview strip)
- `onboarding-wizard-layout.tsx` — `previewClassName` for stretch alignment on taste

**Taste UX v2 (2026-06-14, approved `go`):**
- Recoverable skips — skipped titles animate out of grid; search can unskip or add films
- `TasteFilmSearchPopover` — mention-style picker on left (no rated pills shelf)
- **0–10 sliders** — per-title `LogRatingSlider` `variant="compact"` replaces 6–10 chips; commit on change when **> 0**; drag to 0 clears rating
- **Pool load fix** — parallel `Promise.all` for 12 pool IDs + shimmer skeleton grid until first paint (no empty catalogue stall)
- `log-rating-slider.tsx` — shared `compact` track-only variant for narrow tiles

**Automated tests:** onboarding suite **14/14 pass** on gate/taste-state/finish (full suite 21/21 prior).

**Manual verify on `/onboarding` (Task 10 checklist):**
1. **Set up now** — full path through taste (≥8 ratings) → favorites → done → `/home`
2. **Maybe later** — name + handle only → `/home`; cannot bypass full setup without `onboardedAt`
3. **Taste desktop** — left: title, progress, search; right: poster grid with compact sliders + **Haven't seen**; skeleton on first load
4. **Taste mobile** — controls then full-width grid below; no profile preview strip
5. Rate below 6 via slider; skip then search to recover a title
6. Own saved handle shows available (not “taken”); handle helper colors (emerald / destructive)
7. Verify step — preview at full opacity; light theme BrandMark readable on auth/onboarding
8. Legacy patron with diary — not forced back to `/onboarding`

Reply **`ok`** after manual QA to mark Task 10 shipped + update spec status.

### 2026-06-14 — Onboarding gate hotfix (legacy patrons forced to re-onboard)

**Cause:** v3 gate required `onboardedAt`, but pre-v3 patrons only had `handle` (old gate) — never received `onboarded_at`.

**Fix:** Legacy grandfather when `handle` + any of: `createdAt` before 2026-06-14, diary logs, taste signature, or favorites. `GET /profiles/me` lazy-sets `onboardedAt`; migration `0030_onboarding_grandfather_backfill.sql` for bulk backfill. Mid-wizard v3 (same-day signup, handle only) stays gated.

**Run:** `bun run db:migrate` (optional if API lazy backfill is enough — refresh `/home` once).

### 2026-06-13 — Letterboxd pillars Task 7 (diary year/decade chips)

**Shipped:** `GET /api/logs/me/diary` accepts `?year=` / `?decade=` (watch date filter on `watchedAt`); returns `watchPeriods: { years, decades }`. Server: `diary-log-query.ts` parsers + `diary-watch-periods.ts`. Web: `DiaryWatchPeriodChips` above filter row, URL/context wiring, period-specific empty state. Tests: server `diary-log-query.test.ts` (10 pass), web `diary-lobby-order.test.ts` (9 pass).

**Manual verify on `/diary`:**
1. Decade row (e.g. **2010s**) filters grid in place; **All** clears
2. Year chip (e.g. **2024**) filters; decade + year are mutually exclusive
3. Empty year/decade shows **No films logged in …** + **Show all years**
4. Switch Movies / TV — period chips refresh per ledger tab
5. Infinite scroll keeps year/decade filter on page 2+

Reply **`ok`** to proceed to **Task 8** (per plan).

### 2026-06-13 — Letterboxd pillars Task 9 fix (`ViralReviewRailCard`)

**Root cause:** `FeedListingThumb` `layout="card"` is built for **horizontal** review rows (`self-stretch` + fixed width), not vertical rail tiles — poster stretched/collapsed inside `w-46` cards.

**Fix:** `home-viral-reviews-rail.tsx` — dedicated top `aspect-2/3` poster, vertical stack (title → optional body → likes), `items-stretch` rail, concentric radius (`rounded-2xl` card / `rounded-xl` poster / `p-3`).

**Width fix (2026-06-13):** Removed `max-w-2xl` cap — rail now `w-full` with `flex-1 basis-0` cells (same pattern as taste-matched rail) so cards grow across the lobby on wide viewports; horizontal scroll + edge fades when the row overflows.

**Manual verify on `/home?browse=community&sort=reviews`:**
1. **Most liked reviews** rail — each card shows full-width poster, readable title (e.g. “Would you kill…”), like count pinned at bottom
2. Tap card → review reader opens
3. **All reviews · Most liked** chips still switch feed correctly

Reply **`ok`** on Tasks 8–9 to proceed to **Task 10** (Journal schema).

### 2026-06-13 — Letterboxd pillars Task 10 (Journal schema + public routes)

**Shipped:** migration `0029_journal_post` + `journal.ts` schema; `apps/server/src/routes/journal.ts` (`GET /api/journal`, `GET /api/journal/sitemap`, `GET /api/journal/:slug`, staff `POST/PATCH/DELETE`); public web `/journal`, `/journal/[slug]`; `og/journal/[slug]`; sitemap + `robots` allow `/journal/`; seed `packages/db/src/seeds/journal-posts.sql` (4 articles). Tests: `journal-post.test.ts` (7 pass), `og-image-metadata.test.ts` updated.

**Manual verify:**
1. `bun run db:migrate` then `bun run db:seed-journal` (no `psql` needed on Windows)
2. Incognito `/journal` — lists 4 articles; open an article — markdown renders
3. Draft slug returns 404 on public `GET /api/journal/:slug`
4. `/sitemap.xml` includes `/journal` + article URLs

Reply **`ok`** to proceed to **Task 11** (staff journal panel + home rail).

### 2026-06-13 — Letterboxd pillars Task 11 (staff journal panel + home rail)

**Shipped:** `GET /api/journal/manage` (staff list incl. drafts); `StaffJournalPanel` on `/staff` (create/edit/publish/delete); `HomeJournalRail` on `/home` Movies lobby (latest 3 published); Journal nav — desktop sticky shortcut, account menu, mobile You sheet, Go to dialog (⌘⇧K); `JournalReadTracker` fires `journal.read` on article view. Tests: `mobile-nav.test.ts` updated (9 pass).

**Manual verify:**
1. `/staff` as owner/admin — Journal section lists seeded posts; edit + **Publish now** updates live `/journal/[slug]`
2. `/home?browse=movies` — **From the journal** rail shows up to 3 cards; links open articles
3. Desktop header Journal icon + mobile **You → Journal** + account menu **Journal** → `/journal`
4. Open article — network `POST /api/product-events` with `journal.read` (signed in)

Reply **`ok`** to proceed to **Task 12** (Members leaderboard API).

### 2026-06-13 — Letterboxd pillars Task 12 (Members leaderboard API)

**Shipped:** `apps/server/src/lib/members-leaderboard-query.ts` — sorts `popular` (diary logs by `watchedAt`), `reviews`, `lists` (excludes Favorites system list), `likes` (review likes received in period); reuses `resolveLeaderboardWindow`; public profiles only; blocks excluded for signed-in viewer; pagination + `diaryMetalTier` + `viewerFollows`. Route `GET /api/members/leaderboard` in `apps/server/src/routes/members.ts`; registered in `app.ts`. Tests: `members-leaderboard-query.test.ts` (6 pass). Curl verified `sort=popular&period=month&limit=3`.

**Manual verify:**
1. `GET /api/members/leaderboard?sort=popular&period=month` — ranked public patrons with counts
2. Try `sort=reviews`, `sort=lists`, `sort=likes` — different orderings
3. `period=week|year|all` — window metadata in response
4. Signed in — `viewerFollows` true for followed patrons

Reply **`ok`** to proceed to **Task 13** (`/members` page).

### 2026-06-13 — Letterboxd pillars Task 13 (Members in Community Ranks)

**Shipped (refactor):** Patron contribution leaderboards live under **Community → Ranks** center chips — **Films · Shows · Reviews** (`?browse=community&sort=ranks&rank=`). **Reviews** uses `GET /api/members/leaderboard`; **Films/Shows** keep diary podium boards. Removed standalone Members Community tab + `HomeCommunityMembersSortToolbar`. Legacy `/members`, `?sort=members`, and retired `?rank=popular|lists|likes` redirect/canonicalize to Ranks (retired patron ranks → **Reviews**). **Reviews rank:** podium + list from #4, count → ledger drawer → review reader; film poster + title render **above** hero still in reader. Components: `MembersLeaderboard`, `PatronMembersLedgerDrawer`, `MembersFollowButton`, `members.followed` analytics.

**Manual verify:**
1. `/home?browse=community&sort=ranks` — center rail shows **Films · Shows · Reviews**
2. Tap **Reviews** — patron podium + rows; tap count → ledger → poster opens review reader (poster/title above still)
3. Tap **Films · Shows** — existing diary podium + list from #4
4. `/members?sort=reviews` → redirects to `…&sort=ranks&rank=reviews`
5. Signed in — **Follow** on patron rank rows; `members.followed` event

Reply **`ok`** to proceed to **Task 14** (watches + watchlist counts on detail).

### 2026-06-13 — Letterboxd pillars Task 14 (Detail social proof counts)

**Shipped:** `listing-community-stats.ts` — distinct public diary **watches** + **watchlist** totals; counts hidden when &lt;3 (`LISTING_COMMUNITY_ENGAGEMENT_MIN_COUNT`). Extended `GET /api/movies|tv/:id` → `community.watchesCount` / `community.watchlistCount`. `MovieDetailCommunityRatingHero` compact line: `{n} watches · {m} on watchlists` under public ratings (movie + TV detail pages). Tests: `listing-community-stats.test.ts` (4 pass).

**Manual verify:**
1. Open a film with ≥3 public diary logs — hero shows watches line when threshold met
2. Same for watchlist count on a popular title
3. TV detail `/tv/[id]` — same meta under community score
4. Title with &lt;3 watches and &lt;3 watchlist rows — no engagement line (privacy)

Reply **`ok`** to proceed to **Task 15** (Year in Review compute).

### 2026-06-13 — Letterboxd pillars Task 15 (Year in Review compute)

**Shipped:** `year-in-review.ts` — `computeYearInReviewFromRows`, `fetchYearInReviewForUser`, `parseYearInReviewYear`; UTC calendar year on `log.watchedAt` / `review.publishedAt`; `eligible` when ≥5 diary logs (`YEAR_IN_REVIEW_MIN_LOGS`). Payload: `totalLogs`, `averageRating`, `topGenres` (top 3), `topDecade`, `busiestMonth`, `topTitles` (max 5 by rating), `longestStreakInYear`, `reviewCount`. Route `GET /api/me/year/:year` in `me-data.ts` (auth-only; 400 invalid year). Tests: `year-in-review.test.ts` (2 pass), `me-data.test.ts` year route (3 pass).

**Manual verify:**
1. Signed in — `GET /api/me/year/2024` returns JSON with `year`, `eligible`, stats
2. Year with &lt;5 diary logs — `eligible: false`, empty stats arrays
3. Invalid year (`/api/me/year/foo`) — 400
4. Signed out — 401

Reply **`ok`** to proceed to **Task 16** (Wrapped pages + OG).

### 2026-06-13 — Letterboxd pillars Task 16 (Wrapped pages + OG)

**Shipped:** `/me/year/[year]` Wrapped page (stats, top posters, copy link + download card); public share shell `/year/[handle]/[year]` with OG metadata; `GET /og/year/[handle]/[year]` Satori card (avatar, stats, poster thumbs; private/ineligible → default OG); `GET /api/profiles/:handle/year/:year` for public previews; **Your {year} in film** card on Achievements; `wrapped.viewed` / `wrapped.shared` analytics. Tests: `year-in-review-display.test.ts` (3 pass).

**Manual verify:**
1. Achievements — **Your 2026 in film** card when ≥5 diary logs this year
2. `/me/year/2026` — stats, top picks, share preview
3. **Copy link** → `/year/adgv/2026` previews OG in Slack/iMessage
4. Private profile OG → Sense default card
5. Signed-in owner opening share link redirects to `/me/year/2026`

Reply **`ok`** to proceed to **Task 17** (streaming alerts snapshot).

**Shipped:** `ProfileShowcaseStrip` (horizontal scroll + edge fades, **Showcase** label, owner edit pencil + 4 fixed slots with dashed **Add**), `ProfileShowcaseEditSheet` (`DetailVaulSheet`, Film · TV · Review picker, `PATCH /api/profiles/me/showcase`), `apps/web/src/lib/profile-showcase.ts` + 5 tests pass. Profile page parses `showcaseResolved` from API.

**Manual verify:**
1. Own profile — legacy `favoriteMovieIds` appear in Showcase without re-saving
2. Edit sheet — add film + TV + review → refresh persists
3. Public visitor profile — sees strip; private non-owner — section hidden
4. Fifth item rejected in edit sheet / API

Reply **`ok`** to proceed to **Task 5** (review reader **Add to showcase**).

### 2026-06-04 — Home catalogue search commit _(Executor — Task 1/8)_

**Shipped:** `apps/web/src/lib/home-catalogue-search-param.ts` + tests — `canCommitCatalogueSearch`, serialize/parse, summary label, commit/clear href builders, `resolveCommitBrowseFromDraft`, `isHomeCatalogueSearchActive`, `readHomeCatalogueSearchFromParams`.

**Checks run:** `bun test apps/web/src/lib/home-catalogue-search-param.test.ts` (13 pass).

**Human / Planner:** Review helpers only — no UI yet. Reply **`ok`** to proceed to **Task 2** (fetch pagination).

### 2026-06-04 — Home catalogue search commit _(Executor — Task 2/8)_

**Shipped:** Optional `page` on `fetchMoviesSearch` / `fetchTvSearch` in `still-api-fetch.ts` (forwards `?page=` to `/api/movies/search` and `/api/tv/search`).

**Checks run:** Existing callers unchanged (page omitted → server default page 1).

**Human / Planner:** Reply **`ok`** to proceed to **Task 3** (paginated search loader).

### 2026-06-04 — Home catalogue search commit _(Executor — Task 3/8)_

**Shipped:** `apps/web/src/lib/home-catalogue-search-load-page.ts` + tests — `loadCatalogueSearchPage`, `parseCatalogueSearchPagePayload`, `resolveCatalogueSearchFetchTarget`, row → `PopularMovieSeed` mapper.

**Checks run:** `bun test apps/web/src/lib/home-catalogue-search-load-page.test.ts` (7 pass).

**Human / Planner:** Reply **`ok`** to proceed to **Task 4** (search results grid component).

### 2026-06-04 — Home catalogue search commit _(Executor — Task 4/8)_

**Delivered:** `apps/web/src/components/home/home-catalogue-search-infinite.tsx` — reads `?search=` via `useSearchParams`, parses tags with studio/genre hooks, builds plan via `buildCatalogueSearchPlanFromCommit`, client-fetches page 1, renders `PopularMoviesInfinite` with `loadPage` + lobby grid classes; skeleton / empty / error + “Clear search” row. Added `buildCatalogueSearchPlanFromCommit` to `home-catalogue-search-load-page.ts` (+ 2 tests).

**Verify (Executor):** `cd apps/web && bun test src/lib/home-catalogue-search-load-page.test.ts` → **9 pass**.

**Human / Planner:** Reply **`ok`** to proceed to **Task 5** (wire grid on `/home` + hide browse chips when search active).

### 2026-06-04 — Home catalogue search commit _(Executor — Task 5/8)_

**Delivered:** `/home` TMDB lobby branches on `isHomeCatalogueSearchActive` (raw `?search=` from URL, not cookie restore). When active: hides sort + venue chip row, continue-watching + taste-matched rails; renders `HomeCatalogueSearchInfinite` in `Suspense` with `HomeCatalogueSearchGridSkeleton` fallback. `HomeCatalogSortChips` + `HomeCatalogViewModeToolbar` return `null` on `/home` Movies/TV when `?search=` is set (defense in depth). Exported `HomeCatalogueSearchGridSkeleton` for page fallback.

**Human / Planner:** Reply **`ok`** to proceed to **Task 6** (⌘K Enter → commit URL + close + hydrate dialog from URL).

### 2026-06-04 — Home catalogue search commit _(Executor — Task 6/8)_

**Delivered:** `home-sticky-search.tsx` — `commitOrSubmitDraft` on form + token field Enter: when `canCommitCatalogueSearch`, records recent, `buildHomeCatalogueSearchCommitHref`, `router.push` (off `/home` or browse/community fix) or `router.replace(..., { scroll: false })`, then `beginClose()`. Dialog open hydrates from `?search=` via one-shot `hydrateFromUrlOnOpenRef` + effect (waits for studio metadata when structured). `canCommitCatalogueSearch` now rejects `@`-only people drafts.

**Verify (Executor):** `bun test src/lib/home-catalogue-search-param.test.ts` → **14 pass**.

**Human / Planner:** Reply **`ok`** to proceed to **Task 7** (pill summary + × clear).

### 2026-06-04 — Home catalogue search commit _(Executor — Task 7/8)_

**Delivered:** `HomeStickySearch` reads committed `?search=` on `/home`, shows `formatCommittedSearchSummary` in foreground semibold text; trailing **×** clears via `buildHomeCatalogueSearchClearHref` (`stopPropagation` on mousedown/click). Pill body still opens ⌘K (hydrates from URL). `homeTriggerEl` store type widened to `HTMLElement` for pill wrapper ref.

**Human / Planner:** Reply **`ok`** to proceed to **Task 8** (browse rail clears search).

### 2026-06-04 — Search Enter vs Tab _(Executor fix)_

**Fixed:** `SearchTokenField` — **Enter** always submits catalogue search; **Tab** alone inserts ghost suggestion pills (no longer obstructed by auto-tag on Enter).

### 2026-06-04 — Home catalogue search commit _(Executor — Task 8/8)_

**Delivered:** `buildBrowseSurfaceNavigateHref` strips `?search=` when leaving search mode via Movies / TV / Community rail — restores target surface from `home-lobby-persist`. `HomeBrowseSurfaceProvider` allows re-tapping the active rail when `search` is set (clears search on Movies re-tap). Tests in `home-browse-surface-nav.test.ts` (+3).

**Verify (Executor):** `bun test src/lib/home-browse-surface-nav.test.ts` → **8 pass**.

**Human / Planner:** Commit a search on `/home`, then tap **TV**, **Movies**, or **Community** — grid/chips should return (no `?search=`). Reply **`ok`** for checkpoint (full test suite + build).

### 2026-06-04 — AbortError on committed search grid _(Executor fix)_

**Fixed:** `HomeCatalogueSearchInfinite` page-1 fetch now catches aborted `fetch` rejections; added `isFetchAbortError` + fetch generation guard.

### 2026-06-05 — `/lists` tooltip hover delay + bell _(Executor)_

**Fixed:** `HomeStickyChrome` header icon tooltips now open instantly by setting `TooltipProvider` `delay={0}` (was `delay={220}`), so icon-only buttons don't feel “laggy” on hover.

**Added:** Notification bell uses the same `Tooltip` / `TooltipTrigger` / `TooltipContent` shell as the other header shortcuts (inside `HomeNotificationsMenu`, under `TooltipProvider delay={0}` in `HomeStickyChrome`).

**Checks run:** `apps/web` `bun run build` (compiled successfully; TypeScript run).

**Human / Planner:** On desktop, open `/lists`, hover the header icons (Watchlist / Lists / Diary) and the notification bell: tooltip should appear immediately on hover.

### 2026-06-05 — Pro status missing on lobby chrome _(Executor)_

**Fixed:** `/watchlist`, `/lists`, and `/diary` now pass `isPro: Boolean(profileData.isPro)` into `HomeStickyChrome` `stickyUser`, matching `/home`. Without it, the account dropdown hid Pro themes and the Pro badge on those routes.

**Checks run:** ReadLints clean on the three page files; `graphify update .`.

**Human / Planner:** As a Pro user, open account menu on `/home` then `/watchlist`, `/lists`, `/diary` — Pro badge + Pro theme chips should match on every route. Reply **`ok`** when signed off.

### 2026-06-03 — Review rating tenths + detail sheet edit/delete _(Executor)_

**Shipped (inline — subagent quota blocked):** Spec `docs/superpowers/specs/2026-06-03-review-rating-edit-delete-design.md`, plan `docs/superpowers/plans/2026-06-03-review-rating-edit-delete.md`. Migration **`0017_review_rating_tenths_backfill`**. Server: tenths on `POST/PATCH /api/reviews`, copy log rating verbatim, sync on log PATCH, display-scale community avg, DELETE clears pins/reactions/comments. Web: publish sends tenths (`87` not `9`), `formatStoredLogRatingDisplay` in reader, composer edit mode (PATCH), detail sheet **Delete** / **Edit** for owners.

**Checks run:** `bun test apps/server/src/lib/review-rating.test.ts`, `bun test apps/web/src/lib/log-rating.test.ts`, `apps/web` `check-types` (pass), `graphify update .`.

**Human / Planner:** (1) Log **8.7** → publish review → reader shows **8.7**. (2) Edit log rating → review updates. (3) Own review sheet → **Edit** / **Delete**. Run migration **`0017`** on deployed DB before release. Reply **`ok`** when signed off.

### 2026-05-28 — List detail cover dialog redesign follow-up _(Executor)_

**Shipped:** Reworked `ListDetailCoverPicker` dialog to match existing sheet/dialog patterns used across list flows: `APP_MODAL_OVERLAY_CLASS` overlay, motion entry/exit with `motion/react`, top-right close affordance, centered title/description treatment, scrollable body, and anchored action footer (`Reset` + `Done`) using shared button variants and `DetailMotionButtonWrap`.

**Checks run:** `bun test "apps/web/src/app/(app)/lists/[id]/page.test.ts"` (pass), `ReadLints` clean on `list-detail-cover-picker.tsx` after Biome class-order fix.

**Human / Planner:** Verify `/lists/<id>` → **Change cover** opens the new sheet style, closes on overlay/Escape/X/Done, and reset/upload/poster pick still persist correctly. Reply **`ok`** when signed off.

### 2026-05-28 — List detail owner controls polish (`/lists/[id]`) _(Executor)_

**Shipped:** Removed the shadow from the list detail **Choose cover** button in `list-detail-cover-picker.tsx`. Added owner-only `ListDetailOwnerControls` on list detail hero with two actions: existing **Choose cover** and new **Edit details** (title + description) using `ListLobbyEditDialog`, with `router.refresh()` after save so hero content updates immediately.

**Checks run:** `bun test "apps/web/src/app/(app)/lists/[id]/page.test.ts"` (pass), `NEXT_PUBLIC_SERVER_URL=http://localhost:3000 bun test "apps/web/src/components/list/ranked-list-reorder-grid.test.tsx"` (pass), `ReadLints` on touched files (no issues), `graphify update .` (completed).

**Human / Planner:** On `/lists/<id>` as owner, verify **Choose cover** has no shadow and **Edit details** opens the edit sheet, saves title/description, and updates the hero text after close. Reply **`ok`** when signed off.

### 2026-05-22 — App themes (Theater · Lobby Light · Noir) _(Executor)_

**Shipped:** Spec `docs/superpowers/specs/2026-05-22-app-themes-design.md` + plan `docs/superpowers/plans/2026-05-22-app-themes.md`. Registry (`app-themes.ts` + server mirror), CSS `html.theme-*` blocks, `AppThemeShell` + `next-themes` (`still-app-theme`), Settings **Appearance** section, account menu chips, profile pref validation on PATCH, bundled cinema defaults + override flag.

**Fix 2026-05-22 (Theater = Light):** React hydration was resetting `<html class>` to font vars only, dropping `theme-lobby-light` / `.dark`. **`RootHtmlClassSync`** + **`root-html-appearance.ts`** merge fonts + palette; **`ThemeFlashGuardScript`** applies stored palette before paint.

**2026-05-22:** Removed patron-facing **Cinema atmosphere** (Quiet theater / Multiplex booth) — UI, profile prefs, `data-cinema-preset`, preset-specific CSS. Appearance is **color theme only**; legacy keys stripped on profile PATCH.

**Human / Planner:** Settings **Appearance** + avatar menu chips — **Theater / Light / Noir** only. Reply **`ok`** when signed off.

### 2026-05-22 — RadialToolkit catalogue lobbies (Scope A) _(Executor)_

**Shipped:** `CataloguePosterTile`, `buildCatalogueRadialItemSpecs` (+ tests), `useAddToListRadial`; wired into **`PopularMoviesInfinite`** (`catalogueRadialSurface` + `signedIn`) on **`/home`**, **`/watchlist`**, and **`DiaryLobbyGrid`** / **`DiaryTvGroupCell`**. Build + unit tests pass.

**Human / Planner:** RMB-hold on lobby posters on `/home` (Movies/TV), `/diary`, `/watchlist` — confirm menus match surface (watchlist **Remove** destructive; movies **Add to list**). Reply **`ok`** when signed off.

### 2026-05-20 — Auto Favorites list + profile filter _(Executor)_

**Shipped:** Migration **`0007_system_favorites_list`** (`list.system_kind`, `list_item.id` PK + `tv_id` XOR); **`favorites-list-sync.ts`**; logs POST/PATCH/DELETE hooks; lists API guards + TV join on GET `/:id`; profile **`?favorites=1`** with **All | Favorites** chips; social **Favorites** tab → `?tab=movies&favorites=1`; list detail read-only for system list + TV posters; add-to-list picker excludes system list.

**Human / Planner:** Heart a film/TV on detail → confirm **Favorites** list appears under Lists; profile **Movies** → **Favorites** chip filters grid; unfavorite removes list item. Reply **`ok`** when signed off. **Follow-up (not blocking):** backfill script for existing `log.liked` rows.

### 2026-05-20 — Search dialog catalogue tags **V2.1** _(Executor)_

**Shipped (code):** Extended **`search-query-tags`** (`genre` / `curated`, **`deriveCatalogueFilterBundle`**, serialize/parse v2); **`search-curated-tags`**; **`useSearchDialogGenres`**; **`useCatalogueTagSearch`** (replaces structured hook in **`home-sticky-search`**); movie + TV discover **`genre`/`keywords`/`company`** (comma AND); **`GET /api/tv/genres`**; removed **“Studios filter Films only”** copy; studio suggestions allowed on TV media tag. **Tests:** `search-query-tags.test.ts` — 14 pass.

**Human / Planner (V2.1 exit):** Open **`/home`** search → type **`hor`** → Tab → **Horror** pill → poster grid (discover, no title). Try **Anime** curated + **A24** on Films/TV. Recents: **`A24 · Horror · Anime · marty`**. Reply **`ok`** to advance **V2.2** (TV search company filter) or note gaps.

**Pending:** V2.2–V2.4 per **`docs/superpowers/plans/2026-05-20-search-dialog-catalogue-tags-v2.md`**; TV text search + studio still movie-only until V2.2.

**Hotfix (2026-05-20):** Genre suggestions temporarily fetch **`en-US`** labels + module cache (so `hor` → Horror regardless of region-derived locale). **Planner:** **V2.5** added to end of v2 plan — Settings **catalogue language** pref, localized genre Tab/recents, optional UI i18n (Task 13). Revert hardcoded English when V2.5 ships.

### 2026-05-20 — Search dialog catalogue tags **V2.5 + V2.2/V2.4** _(Executor)_

**Shipped:** **Settings → Catalogue language** (`catalogTmdbLanguage` pref, `MeCatalogLanguageSelect`); server `getTmdbLanguageForUser` (explicit → watch region → `en-US`); genre fetch uses patron language (`useCatalogTmdbLanguage` + per-language cache); **TV search** `?company=` + discover fallback; over-filter empty copy + **3+ tag** hint; removed `use-structured-catalog-search.ts`. **Tests:** 20 pass (`search-query-tags`, `profile-preferences`).

**Human / Planner:** **ok** (2026-05-20) — V2.5 locale + TV studio search + polish signed off.

**Planner:** Catalogue tags v2 core (**V2.1–V2.5**) complete for shipped scope. Optional stretch **Task 13** (UI message i18n) remains in plan if product wants Settings/search chrome translated later.

### 2026-05-20 — TV watching progress _(Planner — brainstorm complete)_

**Approved design (hybrid approach 3):** `tv_watch` tracker + scoped diary (`show` / `season` / `episode`); patron toggles **season vs episode** progress mode; statuses **watching · paused · abandoned · finished · rewatching**; in-app **`tv.new_episode`** notifications; anime = TV on TMDb (no separate community).

**Docs:**

- Spec: `docs/superpowers/specs/2026-05-20-tv-watching-progress-design.md`
- Plan: `docs/superpowers/plans/2026-05-20-tv-watching-progress.md` (phases **W.1–W.4**)

**Human:** **yes** (2026-05-20) — design §1–§3 approved; spec + plan written.

**Next:** Human **`ok`** on **W.1** → **`go`** for **W.2** (TV detail UX). Apply migration `0006_tv_watch` locally (`cd packages/db && bun run db:migrate`).

### 2026-05-20 — TV watching progress **W.1** _(Executor)_

**Shipped:** `tv_watch` + `tv_watch_episode` schema; `log.log_scope` / `season_number` / `episode_number`; `validateTvLogScope` in `@still/db`; `GET /api/tv/:id/seasons` + `season/:n`; `GET/POST/PATCH /api/tv-watch/*` (start, status, mark episode, mark-next, seasons); logs POST/PATCH scope validation. Migration **`0006_tv_watch.sql`**. **Tests:** 4 pass (`packages/db/src/tv-log-scope.test.ts`). **Server build:** green.

**Human / Planner:** Run `db:migrate`, smoke API (below), reply **`ok`** for W.2.

### 2026-05-20 — TV watching progress **W.2** _(Executor)_

**Shipped:** `TvDetailWatchProvider` + `useTvWatch`; hero **Start watching** / **Mark next episode** / status chips / continue line; **Your progress** section (season vs episode modes, checklists, mark season complete); `still-api-fetch` tv-watch helpers; About tab **Progress** nav rail entry. Files: `tv-detail-primary-actions.tsx`, `tv-detail-progress-panel.tsx`, `tv-detail-watch-context.tsx`, `tv-detail-client-root.tsx`, `tv/[id]/page.tsx`.

**Human / Planner:** Open `/tv/[id]` (signed in) → **Start watching** → toggle episodes → **Mark next episode** → switch status **Paused** → **Progress** section in About. Reply **`ok`** for **W.3** (scoped Quick Log + diary chips).

### 2026-05-20 — TV watching progress **W.3** _(Executor)_

**Shipped:** `TvLogScopePicker` in Quick Log (Episode / Season / Whole show + season/episode selects); scope state on create + PATCH; `coerceDiaryLogRows` normalises `log_scope` / season / episode from **`GET /api/logs/me`**; diary poster grid **`scopeLabel`** chip (`S02E04`, `Season 2`); `TvLogScopeChip` on ticket stubs; edit flows pass scope (`diary-log-edit-button`, `use-tv-detail-user-state`). Files: `tv-log-scope-picker.tsx`, `tv-log-scope-display.ts`, `tv-log-scope-chip.tsx`, `quick-log-sheet.tsx`, `diary-entry.tsx`, `diary/page.tsx`, `movie-poster.tsx`.

**Human / Planner:** Quick Log on a series → pick **Episode** + season/episode → save → **`/diary`** shows scope chip on poster; **Edit log** reopens with same scope. Reply **`ok`** for **W.4**.

### 2026-05-20 — Diary TV grouping (in-place expand) _(Executor)_

**Shipped:** Client-side **`buildDiaryLobbyGridItems`** (`diary-lobby-grouping.ts`) — films one tile per log; TV logs group by **`tmdbId`**. **`DiaryLobbyGrid`** + **`DiaryTvGroupCell`**: collapsed poster shows **most specific scope** + **`N diary entries`** subline; tap **flips** card (poster front → log list back, same 2∶3 footprint); scope/date/rating rows → Quick Log edit; **Open series** / **Add diary entry** on back; one flipped group at a time (outside click + Escape). **`formatTvLogScopeLabel`** → **Whole series** never blank. Spec corrected: patron chose flip **(3)**, not row-span — `docs/superpowers/specs/2026-05-20-diary-tv-grouping-design.md`. Tests: `diary-lobby-grouping.test.ts` (2 pass).

**Human / Planner:** On **`/diary`**, two logs same series → one tile; tap → **card flips** (grid does not grow); back shows labeled rows; flip back via poster-side tap or ↺ on back. Reply **`ok`** when verified.

### 2026-05-20 — TV watching progress **W.4** _(Executor)_

**Shipped:** `apps/server/src/jobs/tv-new-episode-sync.ts` — scans `tv_watch` (`watching`/`rewatching` + `notify_new_episodes`), dedupes `tv.new_episode` per episode, one stub per show per pass; scheduled every **6h** in `apps/server/src/index.ts` (`TV_EPISODE_SYNC_ENABLED` env, default on). **`notifications.ts`** — `tv.new_episode` href → `/tv/{id}#tv-section-progress`. Notification icons: **`Tv`** in list + dropdown. **`fetch-tv-watch-me-server.ts`** + **`HomeContinueWatchingRail`** on **`/home`** (signed-in, `watching,rewatching`, limit 12, hidden when empty).

**Human / Planner:** (1) Start watching two series → **`/home`** shows **Continue watching** with **Next: S…E…** captions. (2) Pause one → it drops off the rail. (3) With notifications on, after a recent episode airs, bell shows **New episode · {show}** → opens TV detail **Progress** section. Reply **`ok`** when verified.

**Project Status Board (TV progress):**

- [x] W.1 Schema + API core (`tv_watch`, log scope, seasons routes, tv-watch CRUD) — **Executor 2026-05-20**; human **`ok`**
- [x] W.2 TV detail UX (start watching, status, progress panel) — **Executor 2026-05-20**; human **`ok`**
- [x] W.3 Scoped Quick Log + diary chips — **Executor 2026-05-20**; human **`ok`** **2026-05-20**
- [x] Diary TV grouping (lobby flip) — **Executor 2026-05-20**; human **`ok`** **2026-05-20**
- [x] W.4 Notifications job + continue-watching rail — **Executor 2026-05-20**; human **`ok`** **2026-05-20** (nested `<a>` + rail polish)

### 2026-05-20 — Search V2.5 recents locale round-trip _(Executor)_

**Shipped:** `home-search-recent-storage.ts` — v2 localStorage rows store `tags` + `freeText` + display `label`; genre pills refresh names from current `catalogTmdbLanguage` on read/restore (legacy string rows migrate on read). Wired in `home-sticky-search.tsx`. **Tests:** `home-search-recent-storage.test.ts` (4 pass) + `search-query-tags.test.ts` (20 pass).

**Human / Planner:** Settings → **Español** → search `ter` → save recent → switch back to English → pick recent chip → genre id **27** still applies with updated label. Reply **`ok`** or note gaps. **TV progress W.1–W.4** closed for shipped scope.

### 2026-05-20 — TV lobby **Ongoing / Completed** right rail _(Executor)_

**Shipped:** TV **Ongoing** → discover `with_status=0` (Returning), **Completed** → `ended` (3) — fixes overlap from old `on_the_air` sheet. Upcoming discover unchanged. TV **left:** **Latest | Popular** only. TV **right:** **Ongoing | Completed | Upcoming** | sep | **Filters**; **In cinemas / At home** only when **`run=upcoming`**. Slices are mutually exclusive (`?run=`). Example: `/home?browse=tv&sort=popular&run=upcoming`. Legacy `?sort=ongoing|upcoming` still maps. **Tests:** 6 pass across `home-catalog-run` + `home-catalog-sort`.

**Human / Planner:** TV → **Upcoming** (right) shows first-air grid; cannot combine with Ongoing/Completed; **Popular** + **Completed** uses ended discover. **Human `ok` 2026-05-21** on overlap fix (Returning vs Ended).

**Follow-up (Executor 2026-05-21):** `/tv/discover?status=returning|ended` now forwards to API; lobby persist restores `?run=`; home footnote link works.

### 2026-05-22 — Community watch leaderboards _(Executor)_

**Shipped:** **Film ranks** + **TV ranks** on `/home?browse=community` — five centered community chips; **`?period=week|month|year|all`** (persisted); tier-card podium + list from #4; server **`/api/leaderboard/films|tv`** + per-patron **`…/logs`** (public profiles only, every log in window); **`PatronWatchLedgerDrawer`** (filmography-style poster grid); client refetch with patron IANA **`tz`** after SSR (**`fetchCommunityLeaderboard`**); **`home-leaderboard-interactive.ts`** — subtle hover on **@handle** (underline) and **count** (soft wash + **`DetailMotionButton`** press). **Tests:** `leaderboard-period`, `home-community-feed`, `home-leaderboard-period` — **12 pass**. **`bun run build`** in **`apps/web`** — **exit 0** (also fixed unrelated TS: `normalizeTmdbImagesBundle`, `HomeLobbySearchParams.period`, onboarding profile cast, auth **`Field`** motion prop pick).

**Human / Planner:** `/home?browse=community&sort=film-ranks&period=month` — podium + rows; tap **@** → profile; tap **count** → drawer with posters; switch **Week / Year** and return — period persists; **TV ranks** same flow. Reply **`ok`** when verified.

### 2026-05-21 — Community lobby on `/home` _(Executor)_

**Shipped:** Replaced “coming soon” placeholder with live community feeds — **Lists** (public list poster grid), **Reviews** (recent public reviews + `ReviewCard`), **Diary** (`GET /api/logs/recent` + `ActivityItem`), **Activity** (following feed or `/api/feed/discover` + friend rail). **`HomeCommunityLobby`**, **`HomeCommunityEmpty`**, server **`/api/logs/recent`**, enriched **`/api/reviews/recent`** with profile. Sort chips no longer say “coming soon”.

**Human / Planner:** `/home` → **Community** → cycle **Lists / Reviews / Diary / Activity**; confirm rows or centered empty states. Reply **`ok`** when verified.

### 2026-05-21 — Community Reviews + Activity polish _(Executor)_

**Shipped:** **`ReviewCard`** — optional **`listing`** with left **`FeedListingThumb`** (poster from `/api/reviews/recent` `movie` join). **`ActivityItem`** — poster-first row layout, no **`MoviePoster`** elevation (fixes clipped action buttons); list rows use **`coverPosterPaths`** from feed API. Server: **`feed-items.ts`** (`feedAtMs`, `enrichFeedListRows`, ISO `at`); **`/api/feed/discover`** sort fixed (`Number(Date)` → **`feedAtMs`**). Community catalogue shell **`overflow-visible`** (was clipping feed chrome).

**Human / Planner:** `/home?browse=community&sort=reviews` — each review shows film poster on the left; **Activity** tab — posters load, right-side actions not cut off. Reply **`ok`** when verified.

### 2026-05-21 — Community feed polish: borders, ratings, avatars _(Executor)_

**Shipped:** **`ActivityItem`** / friend rail — borderless **`bg-background`** + shadow (matches **`ReviewCard`**); **`FeedPersonAvatar`** + friend rail use **`PatronPortraitAvatar`** / **`profilePatronAvatarImageUrl`** (fixes private Blob **403** in terminal). Ratings use **`DiaryLogRatingLabel`** / **`formatStoredLogRatingDisplay`** (0.0–10.0, not raw tenths → **47.5**). **`AGENTS.md`** documents rating + avatar contracts.

**Open (not blocking):** Search V2.5 Task 13 UI i18n stretch; Phase **8.1 / 8.3 / 8.4** manual QA.

### 2026-05-21 — Build green + type fixes _(Executor)_

**Shipped:** `bun run build --filter=web` **exit 0** after fixes: `tmdb.ts` gunzip cast, `app-scroll-to-top` expanded width state, `tv-detail-primary-actions` diary `onClick` wrapper, `MyTvLog` scope fields, `fetch-tv-watch-me-server` cast. **Tests:** search + catalog **26 pass**.

**Human / Planner:** Open **`/achievements`** (Badges / Goals, back pill) → **`ok`**. Or run Phase **8.1** checklist from scratchpad.

### 2026-05-21 — `/achievements` lobby verify prep _(Executor)_

**Shipped:** Unit tests **`achievements-lobby-tab.test.ts`** (5 pass) — `parseAchievementsLobbyTab`, `buildAchievementsLobbyHref`, `isAchievementsLobbyTabId`. **`bun run build --filter=web`** exit 0. HTTP smoke: **`/achievements?tab=goals`** → **200** on dev (**307** when unauthenticated redirect applies).

**Human / Planner:** Signed in → **`/achievements`** — **Badges** grid (earned vs locked tooltips); **Goals** tab (`?tab=goals`) — progress rows; back pill label matches last browse (e.g. **Lobby** from `/home`). **Human `ok` 2026-05-21** — verified.

### 2026-05-21 — Continue watching: TV browse only _(Executor)_

**Shipped:** **`/home`** — **`HomeContinueWatchingRail`** and **`fetchTvWatchMeServer`** only when **`browse=tv`** (hidden on **Movies** / **Community**). **`home-continue-watching-rail.tsx`** docstring updated; **`AGENTS.md`** notes TV-only rail.

**Human / Planner:** Signed in with active TV watches → **Movies** on `/home` has **no** Continue watching strip; switch to **TV** → rail appears with **Next: S…E…** captions. **Human `ok` 2026-05-21** — verified.

### 2026-05-20 — Search dialog catalogue tags **V2.5 planned** _(Planner)_

**Added to** `docs/superpowers/plans/2026-05-20-search-dialog-catalogue-tags-v2.md` **and** design spec § Patron locale (now implemented — see Executor entry above).

### 2026-05-20 — Search dialog tagged query **Phases 2–3** _(Executor)_

**Shipped:** **`GET /api/movies/search?company=`** (TMDb filter + discover title fallback); **`GET /api/lists/search`** (own lists, auth); **`useStructuredCatalogSearch`** + **`SearchDialogListResults`**. Combined flow: A24 pill + Films + **`marty`** hits company-scoped movie search; **lists** tag searches patron lists (sign-in prompt when logged out).

**Human / Planner:** Retest A24 + marty; add **lists** tag + title filter. Reply **`ok`** for Phase 4 (serialized recents) or note issues.

### 2026-05-20 — Search dialog tagged query **Phase 4 + closure** _(Executor)_

**Shipped:** **`serializeStructuredQuery`** / **`parseRecentStructuredQuery`** (recents round-trip); open-animation height/overflow fixes (content-fit panel, skeletons, horizontal clip). **Task 10 closure:** TV media tag blocks studio Tab suggestions; **`searchResultsStatusMessage`** in **`aria-live`** regions; focus returns to search pill on close; **`motion/react`** import; **Recent searches** **`sr-only`** heading.

**Planner:** Tagged-query plan **Phases 1–4 complete** per **`docs/superpowers/plans/2026-05-20-search-dialog-tagged-query.md`**. No Phase 5 in scope — run **manual test checklist** in that plan (§ Manual test checklist) then mark feature signed off.

**Human / Planner:** Full checklist (A24+marty, lists, recents, reduced motion) → reply **`ok`** for Planner sign-off on tagged search.

### 2026-05-20 — Search dialog tagged query **Phase 1** _(Executor)_

**Shipped:** Token field in **`HomeStickySearch`** — **`search-query-tags.ts`**, **`SearchTagPill`**, **`SearchTokenField`**. Human verified pill padding + tag UX (**ok**).

### 2026-05-20 — `/achievements` lobby remake _(Executor)_

**Shipped:** `/achievements` rebuilt on the **profile/diary lobby shell** — `AchievementsTopBar` (back pill), `rounded-[2.5rem] bg-card` tray, **Badges / Goals** tab chips (`?tab=goals`), patron intro line. **Badges** panel loads full **`/api/badges/catalog`** with earned state from **`/me`** (milestone tray glyphs, locked tiles muted). **Goals** panel merges **`/api/achievements/catalog`** + **`/me`** progress (divide-y rows, no card borders; hidden goals stay secret until progress/unlock). Shared glyphs in **`milestone-badge-glyph.tsx`**; **`profile-patron-milestones.tsx`** imports the same module.

**Human / Planner:** Open **`/achievements`** — switch **Badges** / **Goals**, hover earned vs locked badges, confirm back pill returns to last browse context. **Human `ok` 2026-05-21** — verified.

### 2026-05-20 — Marketing landing: Mobbin-pattern remake _(Executor)_

**Shipped:** Root **`/`** rebuilt to match Mobbin marketing IA on Still’s dark canvas — floating pill nav (`shadow-mobbin-xl`, `rounded-full`, `bg-card`), centered hero with emblem + dual CTAs, social-proof band, large **rounded-top preview shelf** with poster marquee + home-lobby grid radii, zig-zag **2×2 feature** panels (no 3-column row). New modules under **`apps/web/src/app/_marketing/`** (`landing-nav`, `landing-hero`, `landing-preview`, `landing-poster-marquee`, `landing-features`, `landing-footer`, `landing-social-proof`). **`landing-poster-rail.tsx`** import switched to **`motion/react`** (legacy rail unused on page).

**Mobbin reference:** MCP **`search_screens`** — Mobbin web landing (centered hero, pill nav, trusted-by strip, rounded product shelf).

**Human / Planner:** Log out (or incognito) and open **`http://localhost:3001/`** — scroll **preview** + **features**, check nav anchors and sign-up CTAs. Reply **`ok`** when the Mobbin rhythm + Still tokens feel right.

### 2026-05-19 — TV diary + watchlist parity _(Executor)_

**Shipped:** `tv` table + migration **`0003_conscious_quicksilver`**; `log` / `watchlist_item` support **exactly one of** `movie_id` or `tv_id` (CHECK + partial unique indexes). Server: **`ensureTvCached`**, **`POST /api/logs`** accepts **`movieId` XOR `tvId`**, **`GET /api/logs/me/by-tv/:tvId`**, watchlist **`POST`** same XOR, **`DELETE /api/watchlist/tv/:tvId`**, **`GET /api/watchlist/check/tv/:tvId`**, feed + profile queries join **`tv`**. Web: **`TvDetailPrimaryActions`**, **`useTvDetailUserState`**, **`QuickLog`** + **`still-api-fetch`** for TV, diary/watchlist lobbies + **`ActivityItem`** + profile filmography handle mixed rows.

**Human / Planner:** Run **`bun run db:migrate`** in **`packages/db`** (direct Postgres `DATABASE_URL`) before QA. Verify: log a show from **`/tv/[id]`**, see it on **`/diary`** and **`/watchlist`** with correct **`/tv/`** links; home feed log rows for TV.

**Verify (Executor):** `apps/server` **`bun run check-types`**, `apps/web` **`bunx tsc --noEmit -p tsconfig.json`** → **exit 0**.

**Shipped:** **`HomeCatalogSortChips`** — third tab **Upcoming** for **Movies** only (TV unchanged). **`home/page.tsx`** — **In cinemas + Upcoming** seeds from **`fetchMoviesUpcoming`**; **At home + Upcoming** seeds from **`fetchMoviesDiscover`** (`flatrate`, **`primary_release_date.asc`**, **`release_gte`** = UTC today) with **`discoverReleaseGte`** passed through **`PopularMoviesInfinite`** for paging. **`HomeCatalogViewModeToolbar`** — Filters targets **`/movies/upcoming`** vs discover with **`release_gte`**. **`home-lobby-url`** docstring mentions **Upcoming**.

**Verify (Executor):** `apps/web` **`bunx tsc --noEmit`**, `apps/server` **`bun run check-types`** → **exit 0**.

**Human / Planner:** On **`/home`** (Movies), cycle **Latest / Popular / Upcoming** × **In cinemas / At home**; open **Filters** from **Upcoming + In cinemas** → **`/movies/upcoming`**; from **Upcoming + At home** → discover with ascending primary date + **`release_gte`**.

### 2026-05-17 — Home lobby: streaming vs theatrical overlap _(Executor)_

**Shipped:** **`/home` Movies + Popular + Streaming** now uses **TMDb discover** with **`with_watch_monetization_types=flatrate`** + **`watch_region`** (from optional **`TMDB_WATCH_REGION`** env, else **`US`**) instead of raw **`/movie/popular`**, so the rail skews toward titles with **subscription streaming** in that region. **Theatrical** rails (**now playing** / **upcoming**) get a short **footnote** explaining that many films stream the same week, so overlap with Streaming is expected. **`GET /api/movies/discover`** accepts **`monetization`** + **`watch_region`**; **`/movies/discover`**, **`MovieDiscoverToolbar`**, **`PopularMoviesInfinite`**, and **Filters** on home preserve the new query. **`packages/env`:** optional **`TMDB_WATCH_REGION`** (ISO alpha-2).

**Verify (Executor):** `apps/web` **`bunx tsc --noEmit`**, `apps/server` **`bun run check-types`**, **`biome check`** on touched files → **exit 0**.

**Human / Planner:** Spot-check **`/home`** (Movies, Popular, Streaming) vs Theaters; open **Filters** from Streaming+Popular — should land on discover with **`monetization=flatrate`**. Reply **`ok`** when behaviour matches intent.

### 2026-05-18 — `/diary` lobby: **In cinemas / At home** stay on diary _(Executor)_

**Shipped:** **`HomeCatalogViewModeToolbar`** uses **`usePathname()`**; on **`/diary`** venue chips use **`buildDiaryLobbyHref({ order, venue })`** (no **`buildHomeLobbyHref`** redirect). **`buildDiaryLobbyHref`** + **`parseDiaryLobbyVenue`** in **`diary-lobby-order.ts`** — default venue follows home **Popular** (**streaming**); diary **Filters** link mirrors that slice (**`/movies/now-playing`** vs discover **`flatrate` + popularity**). **`DiaryCatalogOrderChips`** preserves **`?venue=`** when changing **`?order=`**. **`diary/page.tsx`** reads **`venue`** for **`catalogueWaveKeyOverride`** only (no per-log venue in DB yet — grid still shows all logged films).

**Verify (Executor):** repo root **`bun run build --filter=web`** → **exit 0**.

**Human / Planner:** On **`/diary`**, tap **In cinemas** / **At home** — URL should stay under **`/diary`** with **`?venue=`**; order chips should keep the active venue. Reply **`ok`** when it matches intent.

### 2026-05-15 — User `executor`: Section kicker — quiet Mobbin-style labels _(Executor)_

**Shipped:** **`apps/web/src/components/ui/section.tsx`** — section kickers drop **forced uppercase** + **desert-orange** micro-marquee styling; they render as **sentence-case** strings from each call site, **`11px` / `font-medium` / `tracking-wide` / `text-muted-foreground`**, with slightly more vertical air (**`mb-1.5`**, section stack **`space-y-5`**). Applies everywhere **`Section`** is used (home, diary, catalogue billboards, movie detail tabs, etc.).

**Verify (Executor):** repo root **`bun run check-types --filter=web`** → **exit 0**.

**Human / Planner:** Spot-check **`/home`**, **`/movies/popular`**, **`/diary`** — kickers should read as quiet metadata, not orange ticker tape. Reply **`ok`** when it matches intent. **Project Status Board:** **8.1 / 8.3 / 8.4** remain **manual** (prep sections already in this file).

### 2026-05-16 — User `go`: Catalogue **← Lobby** a11y + comment parity _(Executor)_

**Shipped:** **`/movies/popular`**, **`/movies/upcoming`**, **`/movies/discover`** — **`aria-label="Back to home lobby"`** on the header **Lobby** link (visible **← Lobby** unchanged); **upcoming** / **discover** RSC comments aligned with **popular** (seed page, cookie jar, **`blockedReason`**).

**Verify (Executor):** repo root **`bun run check-types`** + **`bun run build --filter=web`** → **exit 0**. _(Turbo may warn on querying **`apps/web/.next/dev/lock`** symlink metadata — benign when dev server touched that path.)_

**Human:** user **`ok`** **2026-05-16** — **popular / upcoming / discover** billboard **← Lobby** (**`aria-label`**, touch-safe hover tint, RSC comment parity) **human verified**; does **not** close **Phase 8.1** (full cross-browser matrix still manual).

### 2026-05-16 — User `go`: Phase 8 board ↔ prep cross-links _(Executor)_

**Shipped:** **Phase 8** status list — intro line + each open row (**8.1**, **8.3**, **8.4**) now points at its **`### Phase 8.* prep`** playbook in the same scratchpad so the Project Status Board is navigable without hunting.

**Verify (Executor):** repo root **`bun run check-types`** + **`bun run build`** → **exit 0**.

### 2026-05-16 — User `go`: Phase 8.3 + 8.4 manual prep _(Executor)_

**Shipped:** Scratchpad sections **Phase 8.3 prep — Lighthouse mobile perf** and **Phase 8.4 prep — Per-film palette contrast** — repeatable scripts + default pass gates so **8.3** / **8.4** can be ticked without ad-hoc notes.

**Verify (Executor):** repo root **`bun run check-types`** + **`bun run build`** → **exit 0** (cache hit).

### 2026-05-16 — User `go`: Phase 8.1 prep + regression _(Executor)_

**Shipped:** Scratchpad **Phase 8.1 prep — Cross-browser smoke checklist** (route matrix + pass criteria) so **8.1** has a repeatable human script across **Chrome · Safari · Firefox · iOS Safari**.

**Verify (Executor):** repo root **`bun run check-types`** + **`bun run build`** → **exit 0** (all cache hit).

### 2026-05-15 — Track B.5.9: Settings account sub-nav _(human verified 2026-05-15)_

**Shipped**

- **`apps/web/src/app/(app)/me/layout.tsx`:** Wraps **`/me/settings`** and **`/me/customization`** in a flex row (`max-w-5xl` … `lg:max-w-6xl`) with shared sub-navigation.
- **`apps/web/src/components/profile/me-account-nav.tsx`:** Client nav with **`usePathname`** — **`md+`**: left **Account** list (Settings / Customize + descriptions, `aria-current`); **`<md`**: horizontal scroll strip with bottom border (matches profile section tab affordance). Icons: **Settings**, **Palette**.

**Verify (Executor):** `cd apps/web && bun run build` → **0**.

**Verify (human)**

- **`/me/settings`** and **`/me/customization`**: narrow viewport shows top tabs; **`md+`** shows left rail; active route highlights correctly; keyboard tab order sensible.

**Human verify:** ok 2026-05-15.

### 2026-05-15 — Command palette: Discover launcher _(Executor)_

**Shipped**

- **`apps/web/src/components/app/command-palette.tsx`:** **`NAV_SHORTCUTS`** adds **Discover films** → **`/movies/discover`** (`Compass` icon) after **Popular films**, matching **`MovieCatalogSurfaceChips`** and the home **Or just explore** CTA.

**Verify (Executor):** `cd apps/web && bun run build` → **0** (2026-05-15).

### 2026-05-15 — User `go`: monorepo verify _(Executor)_

**Ran** (repo root **`C:\Users\adgv\Documents\Projects\still`**): **`bun run check-types`** then **`bun run build`** → **exit 0** (`turbo` **2.9.12** — **`@still/ui`**, **`server`**, **`@still/api-client`** typecheck; **`web`** `next build` **16.2.6**, **`server`** `tsdown`, **`extension`** `wxt build`). _At the time of this run, Turbo warned **`no output files found for task extension#build`** — addressed same day by **`turbo.json`** **`.output/**`** (see **User `go`: Turbo `build` outputs for WXT\*\*)._

**Human / Planner:** ~~Track B rows still open for explicit **`ok`**: **B.5.2** Discover, **B.5.3** film detail, **B.5.9** settings sub-nav~~ — user **ok** **2026-05-15** (see **Human: B.5.2 / B.5.3 / B.5.9 signed off**).

### 2026-05-15 — User `go`: Turbo `build` outputs for WXT _(Executor)_

**Shipped:** Root **`turbo.json`** — global **`build.outputs`** includes **`".output/**"`** so **`apps/extension`** (`wxt build` → **`apps/extension/.output/`**) participates in Turbo cache without **`no output files found for task extension#build`\*\*.

**Verify (Executor):** `bunx turbo build --filter=extension` twice → second run **`cache hit, replaying logs`**; no missing-output warning.

### 2026-05-15 — User `go`: WXT `runner` → `webExt` _(Executor)_

**Shipped:** **`apps/extension/wxt.config.ts`** — renamed top-level **`runner`** to **`webExt`** (same **`disabled: true`**), per WXT 0.20 deprecation (`InlineConfig#runner` → `webExt`).

**Verify (Executor):** `bunx turbo build --filter=extension --force` → **exit 0**; build log no longer prints **`InlineConfig#runner is deprecated`**.

### 2026-05-15 — User `go`: tsdown `noExternal` → `deps.alwaysBundle` _(Executor)_

**Shipped:** **`apps/server/tsdown.config.ts`** — replaced deprecated **`noExternal: [/@still\/.*/]`** with **`deps: { alwaysBundle: [/@still\/.*/] }`** so workspace **`@still/*`** packages stay inlined per tsdown ≥0.21.

**Verify (Executor):** `bunx turbo build --filter=server --force` → **exit 0**; log no longer shows **`noExternal` is deprecated**.

### 2026-05-15 — User `go`: tsdown quiet `onlyBundle` hint _(Executor)_

**Shipped:** **`apps/server/tsdown.config.ts`** — under **`deps`**, set **`onlyBundle: false`** so tsdown stops suggesting a whitelist while the server bundle still intentionally inlines **`node_modules`** (alongside **`alwaysBundle`** for **`@still/*`**).

**Verify (Executor):** `bunx turbo build --filter=server --force` → **exit 0**; **`dist/index.mjs`** still **~1.55 MB**; build log no longer prints the **`deps.onlyBundle`** hint or the **Detected dependencies in bundle** list.

### 2026-05-15 — User `go`: catalogue Lobby link touch-safe hover _(Executor)_

**Shipped:** **`/movies/popular`**, **`/movies/upcoming`**, **`/movies/discover`** — **`← Lobby`** link uses **`[@media(hover:hover)]:hover:text-foreground`** instead of bare **`hover:text-foreground`**, plus a short JSX comment (matches Track B touch guidance: no transient hover flash on press).

**Verify (Executor):** `cd apps/web && bun run build` → **0**; **`biome check --write`** on the three pages → clean.

### 2026-05-15 — User `go`: catalogue pages drop useless fragments _(Executor)_

**Shipped:** **`popular`**, **`upcoming`**, **`discover`** movie routes — removed redundant **`<>`** wrappers around **`Section`** body children (Biome **`noUselessFragments`**); **`ReactNode`** accepts multiple siblings without an extra fragment.

**Verify (Executor):** **`biome check --write`** on the three files + **`bun run build`** in **`apps/web`** → **0**.

### 2026-05-15 — User `go`: post–B.5 regression gate _(Executor)_

**Ran:** repo root **`bun run check-types`** + **`bun run build`** → **exit 0** (after user **ok** closed **B.5.2 / B.5.3 / B.5.9**). **`extension`** / **`server`** mostly **cache hit**; **`web`** full **`next build` Next 16.2.6** — no **`no output files found for task extension#build`** (current **`turbo.json`** includes **`.output/**`\*\*).

**Scratchpad hygiene:** Track B board header updated for **B.5** closure; **B.4** “next milestone” text updated; **monorego** log footnoted to **Turbo** **`.output/**`\*\* fix.

### 2026-05-14 — Track B follow-up: notifications nav parity _(human verified 2026-05-14)_

**Shipped**

- **`apps/web/src/components/app/app-nav.tsx`:** Removed **`hidden sm:block`** from the notifications control — **bell is always** in the floating bar (next to overflow, before avatar). Added **`aria-current="page"`** and a subtle **`bg-muted/80`** when `pathname` is `/notifications`.

**Verify (Executor):** `cd apps/web && bun run build` → **0**.

**Verify (human):** `< sm` width: bell visible; one tap → `/notifications`; active state reads on the icon.

**Human verify:** ok 2026-05-14.

### 2026-05-14 — Human: notifications nav parity signed off

User replied **ok** — **Track B follow-up** (always-visible notifications bell in `AppNav`, `aria-current` + active styling on `/notifications`) treated as **human verified** 2026-05-14.

### 2026-05-14 — Human: B.6 signed off + Track B.7 Planner sign-off

User replied **ok go** — **B.6 Motion budget** is **human verified** (2026-05-14): global `--aker-duration` / `--aker-duration-slow` at **0.2s**, Framer sheets/dialogs/onboarding at **0.2s** with **`useReducedMotion`** fast paths, **`AppNav`** pip + hover respecting reduced motion, **landing poster rail** stagger/duration capped, **ticket stub** filter hover **200ms**.

**B.7 — Planner closes Track B (implementation arc)** for the **shipped Executor scope**: predictable `(app)` shell (B.3), search/filter primitives (B.4), core screens **B.5.4–B.5.8** + motion pass (B.6), aligned with the scratchpad **“usable product skin”** goal. **Staging / product bar:** acceptable for **daily return** for this slice; full polish still depends on Phase 8 manual QA and items below.

**Documented follow-ups (not blocking this B.7 note)**

- **B.5.2 / B.5.3 / B.5.9:** user **ok** **2026-05-15** — **human verified** (see Executor **Human: B.5.2 / B.5.3 / B.5.9 signed off**). **⌘K Discover** shortcut shipped 2026-05-15 (**Command palette: Discover launcher**).
- **Nav parity:** ~~notifications bell `hidden sm:block`~~ **addressed + human verified 2026-05-14** — bell always in `AppNav`; user **ok** on narrow-viewport check.
- **B.1 / B.2:** user **ok** **2026-05-16** — **human verified** (see **Human: B.1 / B.2 signed off**).
- **Phase 8:** **8.1** cross-browser smoke (**Phase 8.1 prep**), **8.3** Lighthouse (**Phase 8.3 prep**), **8.4** per-film palette contrast (**Phase 8.4 prep**) — manual; use prep sections before ticking rows.

### 2026-05-14 — Track B.6: Motion budget _(human verified 2026-05-14)_

**Shipped**

- **`packages/ui` `globals.css`:** `--aker-duration` and `--aker-duration-slow` set to **0.2s** (was 0.24s / 0.34s) so token-driven hovers/transitions meet **≤200ms**; comment notes cinematic one-shots (iris ~0.42s, VT ~180ms, flicker ~0.48s) stay explicit exceptions.
- **Framer (dialogs / sheets / onboarding):** enter/exit tweens **0.2s** (was 0.22–0.3s) in `command-palette.tsx`, `review-composer.tsx`; `onboarding-flow.tsx` uses shared **`stepTransition`** + **`useReducedMotion`** (instant when OS requests reduced motion).
- **`app-nav.tsx`:** `useReducedMotion` — disables bar `whileHover` nudge + uses **≤180ms** tweens for the active pip (`layoutId`) instead of springs that could overshoot the budget.
- **`landing-poster-rail.tsx`:** `useReducedMotion` skips stagger and mount tween; otherwise **0.2s** motion, capped stagger delay **0.1s** max; row **`key`** from poster ids (not array index).
- **`ticket-stub.tsx`:** poster filter hover **duration-200** (was 300ms).

**Verify (Executor):** `cd apps/web && bun run build` → **0**.

**Verify (human)**

- Toggle OS “reduce motion”: nav pip + landing poster rail should feel instant or nearly so; hovers on buttons/cards still acceptable.
- Normal motion: UI color/transform transitions feel snappy, not sluggish.

**Human verify:** ok 2026-05-14.

### 2026-05-14 — Human: B.5.8 signed off

User replied **ok** — Track B **B.5.8** (notifications: calendar grouping, `title`/`body`, per-row read + `payload.href` enrichment) treated as **Planner/human verified**. Next Executor milestone when user sends **go**: **B.6 Motion budget** (≤200ms interactions; reduced-motion clean) per Planner.

### 2026-05-14 — Track B.5.8: Notifications _(human verified 2026-05-14)_

**Shipped**

- **Server `GET /api/notifications`:** `withNavigationHints()` merges `payload.href` when absent — follow rows resolve `fromUserId` → `profile.handle` → `/profile/:handle`; chat → `/chat`; badge/achievement → `/achievements`.
- **Inserts:** follow notification includes `href` when the follower has a handle; chat/badge/achievement payloads include `href` for new rows.
- **Web:** `NotificationsList` groups by **local calendar day** (Today / Yesterday / older); shows **`title`** + optional **`body`**; icons by `kind` prefix; **Mark all read** unchanged; **per-row read** via `POST /api/notifications/:id/read` (`postNotificationRead` in `still-api-fetch`) on primary row button + **Open** link; optimistic UI with rollback on failure.
- **Verify (Executor):** `apps/server` `bun run check-types` → **0**; `apps/web` `bun run build` → **0**.

**Verify (human)**

- `/notifications`: sections + unread highlight; tap row text or Open marks read (stays grouped under same day); Mark all read clears highlights.
- Follow / chat / badge notifications show sensible Open targets (profile, chat, achievements).

**Human verify:** ok 2026-05-14.

### 2026-05-14 — Human: B.5.7 signed off

User replied **ok** — Track B **B.5.7** (centered profile hero, `?tab=` section nav, semantic filmography table) treated as **Planner/human verified**. _(Next milestone after subsequent **go**: **B.5.8 Notifications** — now **human verified 2026-05-14**.)_

### 2026-05-14 — Human: B.5.6 signed off

User replied **ok** — Track B **B.5.6** (lists index Savee-style rows + `coverPosterPaths` API) treated as **Planner/human verified**. **B.5.7 Profile** followed in the next **go** and is now **human verified** as well.

### 2026-05-14 — Track B.5.6: Lists index (Savee rows) _(human verified 2026-05-14)_

**Shipped**

- **Server:** `withCoverPosterPaths()` batches `movie.poster_path` for all `cover_movie_ids` on each list row; applied to `GET /api/lists`, `/popular`, `/me`, `/by-user/:userId`, plus `POST /` and `PATCH /:id` responses; profile `GET /:handle` list payload uses the same helper (`list-cover-posters.ts`).
- **Web:** `ListRowStrip` + `toListBoardRow`; `/lists` “Your lists” + “Popular this week” as full-width bordered list; profile Lists rail matches; removed **`list-card.tsx`** (incorrect `…/w185/{tmdbId}.jpg` poster URLs).

**Human verify:** ok 2026-05-14.

### 2026-05-14 — Track B.5.7: Profile layout _(human verified 2026-05-14)_

**Shipped**

- **`/profile/[handle]`:** Centered hero under banner — **avatar** (image or initials) overlaps band, @handle, display name, pronouns, bio, **`<dl>`** stats (followers / following) + location / website, centered actions (Customize / Edit or **Follow**).
- **Section nav:** `?tab=filmography|reviews|lists|favorites` — **filmography** always listed; other tabs only when that rail has rows; order follows **`sectionOrder`**; active link uses **`aria-current="page"`** + bottom border; bar scrolls horizontally on narrow viewports; entire nav omitted when only filmography applies.
- **Panels:** one primary block per tab — **semantic `<table>`** filmography (replaces prior `div role="table"`); empty-ledger CTA; favorites **responsive grid**; reviews **2-col** `ReviewCard` list; lists reuse **`ListRowStrip`**.
- Removed the nested **“Also credited for”** mega-`Section` wrapper.

**Human verify:** ok 2026-05-14.

### 2026-05-14 — Human: B.5.4 + B.5.5 signed off

User replied **ok** — Track B **B.5.4** (quick log sheet) and **B.5.5** (diary Tickets / Stills layout + month ordering) treated as **Planner/human verified**. Next Executor milestone when user sends **go** was **B.5.6 Lists** (Savee-style row + poster strip) — now delivered; next **go**: **B.5.7 Profile** per Planner.

### 2026-05-14 — Track B.5.5: Diary layout _(human verified 2026-05-14)_

**Shipped**

- **`/diary`:** Server builds **month sections** (with **Undated** fallback for bad timestamps); **newest month first**; logs inside each month **newest first**; drops rows with no `movie` join (cannot render).
- **`DiaryPageClient`:** Toolbar **Tickets** (existing `DiaryEntry` grid) vs **Stills** (CSS `columns-*` masonry + `DiaryStillTile` poster cells, half-star overlay when rated); choice persisted in **`localStorage`** `still.diary.layout`.
- **A11y:** Toolbar `role="toolbar"` + `aria-label`; layout buttons `aria-pressed`; still links expose composite `aria-label` (title · watched date).

**Human verify:** ok 2026-05-14.

### 2026-05-14 — Track B.5.4: Quick log sheet _(human verified 2026-05-14)_

**Shipped**

- **`quick-log-sheet.tsx`** — Zustand `useQuickLog` + `QuickLogRoot`: mobile bottom sheet / desktop centered dialog (Framer Motion **≤200ms**), Escape + backdrop close, `role="dialog"` + labelled title.
- **Flow:** Film (pre-filled from movie page, or TMDb search when `open()` with no `movieId`) → **date** (`type="date"`, default today, noon local → ISO for `watchedAt`) → optional **rating** (`StarRating`) → optional **note** (500 cap) → **Save log** disabled until `movieId` + valid date + note length OK.
- **`AppShell`** mounts `<QuickLogRoot />` next to review composer.
- **`MovieActions`:** **Log** opens the sheet (sound + diary refetch on success via `onSuccess`); heart-without-log still one-tap `postLog` + like.

**Human verify:** ok 2026-05-14.

### 2026-05-14 — Human: B.3 signed off

User replied **ok** — Track B **B.3** (`AppShell` + bottom nav contract) treated as **Planner/human verified**.

### 2026-05-14 — Track B.5.3: Film detail _(human verified 2026-05-15)_

**Shipped**

- **`GET /api/movies/:id/lists`** — public `list` rows joined via `list_item` for this `movieId`, ordered by likes (max 24).
- **`MovieDetailExploreTabs`** (`components/movie/movie-detail-explore-tabs.tsx`) — client tablist (Reviews / Lists / Related) with keyboard arrows, Home/End; Reviews consolidates featured + grid; Lists empty state + create-list link; Related = TMDb rail + `DoubleFeatureSuggestion` or empty copy.
- **`/movies/[id]/page.tsx`** — fetches lists; removes duplicate hero `MovieActions`; **sticky** action dock under hero (`bottom-[max(6rem,…)]` to clear `AppShell` bottom nav); Reception section unchanged above tabs.

**Verify (human)**

- Sticky bar clears bottom nav on narrow + iOS safe-area; log/watchlist/like still work once.
- Tab panels + empty states; lists tab populates when a public list includes the film.
- `bun run build` (`apps/web`) and `bun run check-types` (`apps/server`) → **0** (Executor).

**Human verify:** ok 2026-05-15.

### 2026-05-14 — Track B.5.2: Discover _(human verified 2026-05-15)_

**Shipped**

- **API** (`apps/server`): `tmdbApi.discoverMovies` + `genreMovieList`; `GET /api/movies/discover?page&genre&sort` (whitelist `sort_by`, `vote_count.gte` for vote-average sorts); `GET /api/movies/genres` — routes registered **before** `/:id`.
- **Web** (`still-api-fetch`): `fetchMoviesDiscover`, `fetchMovieGenres`.
- **Route** `apps/web/src/app/(app)/movies/discover/page.tsx`: `searchParams` genre + sort; `MovieDiscoverToolbar` (horizontal genre rail + sort chips, shareable URLs via `discover-catalog-url.ts`); `DiscoverCatalogEmpty` when `total_results === 0`; `PopularMoviesInfinite` supports `catalogKind="discover"` + `key` reset on filter change.
- **`MovieCatalogSurfaceChips`:** third chip **Discover**; home empty-feed **Or just explore** → `/movies/discover`.

**Verify (human)**

- `/movies/discover`, chip genre + sort, pagination, empty edge (e.g. impossible combo if any), TMDB-unconfigured hint.
- `cd apps/web && bun run build` → **0**; `apps/server` `bun run check-types` → **0** (Executor).

**Human verify:** ok 2026-05-15.

### 2026-05-15 — Human: B.5.2 / B.5.3 / B.5.9 signed off

User replied **ok** — Track **B.5.2** (Discover), **B.5.3** (film detail explore tabs + sticky dock), and **B.5.9** (settings account sub-nav) treated as **Planner / human verified** **2026-05-15**. **B.5** status board row marked **complete** for shipped milestones.

### 2026-05-14 — Human: B.5.1 signed off

User replied **ok** — Track B **B.5.1** (home lobby feed anatomy + collapsible friend-activity rail) treated as **Planner/human verified**. _(**B.5.2–B.5.9** closed out with user **ok** **2026-05-15** — see **Human: B.5.2 / B.5.3 / B.5.9 signed off**.)_

### 2026-05-16 — Human: B.1 / B.2 signed off

User replied **ok** — Track **B.1** (route audit + in-repo principles) and **B.2** (token & elevation ladder) treated as **Planner / human verified** **2026-05-16**. Project Status Board rows **B.1** and **B.2** updated.

### 2026-05-14 — Track B.5.1: Home / following _(human verified 2026-05-14)_

**Shipped**

- **Feed cards** (`components/feed/activity-item.tsx`): `FeedPersonAvatar` + byline + film line + rating/meta + **poster thumb on the right** (`MoviePoster` `xs`) + **44px icon action** (film / read review / list). `article` + `focus-within` ring; **removed invalid nested `<Link>`** on review + list rows (whole-card link wrapped profile link before).
- **`feed-person-avatar.tsx`**: profile disc with initials fallback, 44px tap target, ring on focus/hover.
- **Friend activity rail** (`lg+`): `deriveFriendRailEntries` in `lib/home-friend-rail.ts`; `HomeFriendActivityRail` client aside — collapse persists in `localStorage` (`still.home.friendRail.collapsed`); empty copy when no follows data.
- **`home/page.tsx`**: flex row layout for lobby section + rail; **stable list keys** via `activityRowKey` (payload ids, not array index).

**Verify**

- `/home` ≥`lg`: friend rail visible, collapse/expand, list scrolls if many friends; `<lg` rail hidden, feed full width.
- Log / review / list rows: no nested-link warnings in a11y tree; poster + icon actions reachable by keyboard.
- `cd apps/web && bun run build` → exit **0** (Executor verified).

### 2026-05-14 — Human: B.4 signed off

User replied **ok** — Track B **B.4** (search pill, filter chips, `/movies/upcoming`, home lobby links) treated as **Planner/human verified**. _(**B.5** milestones closed **2026-05-15** — **Human: B.5.2 / B.5.3 / B.5.9 signed off**; **B.1 / B.2** closed **2026-05-16** — **Human: B.1 / B.2 signed off**.)_

### 2026-05-14 — B.4 complete: search + browse primitives _(human verified 2026-05-14)_

**Shipped**

- `components/ui/search-pill-field.tsx` — pill search (icon, optional scope, clear controls).
- `components/ui/filter-chip-row.tsx` — `FilterChipRow` (`role="toolbar"`), `FilterChipLink`, `FilterChipButton`.
- `SearchClient`: pill field + static **Films** scope + dismissible **Query · “…”** chip row; `showClearQuery={false}` to avoid duplicate clears.
- `MovieCatalogSurfaceChips` + route **`/movies/upcoming`** (mirrors popular seed + infinite); `fetchMoviesUpcoming`; `PopularMoviesInfinite` gains `catalogKind` + correct footer catalogue label.
- `movies/popular` + `movies/upcoming` render shared chips; search page `Suspense` fallback uses pill-shaped skeleton bar.
- **Home** “Popular this week” header links: **Opening soon** → `/movies/upcoming`, **See all** → `/movies/popular`.

**Deferred:** advanced filter drawer (genre/year/service) — needs API or client filter spec.

**Verify:** `cd apps/web && bun run build` → exit **0**.

### 2026-05-14 — Planner: Track B (design system) added

**Context:** User requested a **full design system redo** for usability and
delight (Mobbin web patterns: rails, pills, chips, library toolbars, profile
layouts). This is **Track B** in `High-level Task Breakdown` and `Project Status
Board`. It **does not** cancel Phases 1–7 (largely done) or Phase 8 manual QA.

**Resolution (human “go”, 2026-05-14):** proceed with **B.1** before Phase 8
manual QA; items **8.1 / 8.3 / 8.4** stay on the board as parallel ship debt.

### 2026-05-14 — B.3 complete: `AppShell` + nav contract _(human verified 2026-05-14)_

**Shipped**

- `apps/web/src/components/app/app-shell.tsx`: single server component for
  projector boot, grain, `AppNav`, `main#main-content` (bottom padding for
  floating bar), `CinemaSceneCut`, gutter wrapper, command palette, review
  composer, badge watcher. Docblock = Mobbin-style **bottom bar** MVP (no
  sidebar rail).
- `apps/web/src/app/(app)/layout.tsx`: auth + profile redirects only; renders
  `<AppShell user={…}>{children}</AppShell>`.
- `APP_SHELL_BOTTOM_RESERVE_CSS` + `appShellMainContentMinHeightStyle` exported
  for pages that need viewport math in sync with `main` padding; `people/[id]`
  imports shared style (removed local duplicate).

**Verify**

- `cd apps/web && bun run build` → exit **0**.

### 2026-05-14 — B.2 complete: token & elevation ladder _(human verified 2026-05-16)_

**Shipped**

- `packages/ui/src/styles/globals.css`: formal ladder `--surface-canvas` →
  `--surface-raised` (was `surface-card-base` / deep graphite) →
  `--surface-overlay` (`#121212` between card and `muted`); `--background` /
  `--card` / `--popover` map to those; header + cinema tuning comments updated;
  `.movie-themed` note (don’t replace panel fills with accent floods).
- `@theme inline`: `--color-surface-canvas`, `--color-surface-raised`,
  `--color-surface-overlay` for Tailwind `bg-surface-*`.
- **Components using explicit `bg-surface-*`:** `AppNav` (raised), `ActivityItem`
  (raised), `CommandPalette` (overlay), `home` `EmptyFeed` + `diary` empty
  dashed panels (raised/40).
- `(app)/layout.tsx`: one-line comment that horizontal gutters are owned there.
- `user-menu.tsx`: remove `className="bg-card"` on `DropdownMenuContent` so
  default `bg-popover` (overlay tier) applies.

**Verify**

- `cd apps/web && bun run build` → exit **0** (Next 16.2.6).

**Note:** First build after route work hit bogus `RouteImpl` errors for real
paths; **`rm -rf apps/web/.next` + rebuild** cleared them — documented in
`Lessons`.

**Human verify:** ok 2026-05-16.

### 2026-05-14 — B.1 complete: route audit + principles _(human verified 2026-05-16)_

**Scope:** `apps/web/src/app` routes + shared `(app)` chrome (`layout.tsx`,
`AppNav`). No code changes for B.1 — audit only.

**App shell (shared):** `(app)/layout.tsx` → `main` + full-width horizontal
padding (`px-4` … `2xl:px-16`), bottom padding for **fixed bottom nav**
(`AppNav`: pill bar, `role="navigation"` `aria-label="Main"`, `BrandMark` on
`sm+`, ⌘K search, overflow menu, **notifications bell** in the bar on **all** breakpoints _(Track B nav parity fix 2026-05-14 — was `hidden sm:block`)_). `CommandPaletteRoot`,
`ReviewComposerRoot`, `BadgeWatcher`, grain + `CinemaSceneCut` + `ProjectorBoot`.

**Route inventory**

| Route                                 | Layout / pattern                                                                                    | Density & chrome | CTAs / nav / a11y notes                                                                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------- |
| `/` (`page.tsx`)                      | Marketing: theater floor, hero `Letterbox`, anchor nav (`md+`)                                      | High atmosphere  | Signed-in users redirect to `/home`.                                                                      |
| `/onboarding`                         | Centered `max-w-2xl` column, no `AppNav`                                                            | Medium           | OK for focused funnel.                                                                                    |
| `(auth)/sign-in`, `sign-up`           | Auth layout                                                                                         | Medium           | `Suspense` for searchParams consumers (Phase 8).                                                          |
| `/home`                               | Stacked `Section`s: feed, popular grid, upcoming, news/tickets                                      | Medium–high      | Secondary “Your diary” duplicates global Diary nav — acceptable nudge.                                    |
| `/diary`                              | `Section` + per-month `cinema-film-strip-rail--coded` + ticket grid                                 | High (tickets)   | Strong empty state → `/search` + _Log_.                                                                   |
| `/watchlist`                          | Ticket stack (Phase 6)                                                                              | High             | Coherent with diary metaphor.                                                                             |
| `/news`                               | Single `Section` + `NewsStrip`                                                                      | Low–medium       | —                                                                                                         |
| `/chat`                               | Full-bleed `ChatPane` (threads + messages)                                                          | High             | Primary nav item — good.                                                                                  |
| `/movies/[id]`                        | Full-bleed hero (flush top), dense metadata + actions                                               | High             | Known hero hit-testing constraints (Executor log 2026-05-13).                                             |
| `/movies/popular`                     | Poster/browse grid                                                                                  | Medium           | “Discover” split from home.                                                                               |
| `/search`                             | `SearchClient` + skeleton `Suspense`                                                                | Medium           | Palette + `/search` should share primitives in **B.4**.                                                   |
| `/lists`, `/lists/new`, `/lists/[id]` | `Section` + cards / form / detail                                                                   | Medium           | “Lists” in overflow menu + direct URL — discoverability OK for v1.                                        |
| `/reviews/[id]`                       | Long-form review + credits (Phase 5)                                                                | Medium           | —                                                                                                         |
| `/profile/[handle]`                   | Banner `Letterbox`, filmography ledger, `Section`s                                                  | High             | Rich; watch tab order on narrow widths in **B.5**.                                                        |
| `/people/[id]`                        | Person detail, `Section`, filmography-style lists                                                   | Medium           | Custom `minHeight` to align with floating nav — pattern to centralize in **B.3**.                         |
| `/notifications`                      | `Section` + list                                                                                    | Low              | **Bell in `AppNav` on all breakpoints** (2026-05-14); avatar menu “Notifications” kept as secondary path. |
| `/me/settings`, `/me/customization`   | Shared **`me/layout`**: `MeAccountNav` (vertical `md+`, tab strip mobile) + `max-w-2xl` form column | Medium           | **B.5.9** sub-nav — **human verified 2026-05-15**.                                                        |
| `/achievements`                       | Standard page (from overflow)                                                                       | Medium           | —                                                                                                         |

**Non-negotiable principles (Track B)** — align implementation in B.2–B.6:

1. **Two visual layers:** _Cinema_ (grain, letterbox, film strip, vignette, scene cuts) on shells and heroes; _Utility_ (lists, forms, filters) stays calm: predictable spacing, minimal animation, no decorative pointer blocking.
2. **One global accent role:** keep primary CTA / active nav pip on the existing accent token; per-film `.movie-themed` tints chrome but **does not** splinter button semantics (already Phase 2 policy — extend to Track B components).
3. **Typography roles:** `font-display` for page `h1` / major section titles; UI sans for dense labels, scores, and card titles (current direction — formalize in code reviews).
4. **Navigation parity:** every destination reachable on **mobile** without `sm-only` dead ends; if an icon is `hidden sm:block`, provide an equivalent in the always-visible cluster or overflow (**notifications bell** addressed in **`AppNav`** 2026-05-14).
5. **Page gutter contract:** outer horizontal padding comes from `(app)` layout; inner components avoid re-introducing conflicting `mx-auto px-*` unless intentionally breaking full-bleed (document exceptions in **B.2**).
6. **Touch targets:** maintain **≥44px** vertical hit areas on primary nav and global actions (`AppNav` links already `min-h-11` — don’t regress).
7. **Motion budget:** interaction feedback **≤200ms** for hovers/focus; route transitions may stay cinematic; **no** gratuitous list stagger; honor `prefers-reduced-motion` (Phase 8 baseline).

**Mobbin MCP:** use `"image_format": "jpg"` for `search_screens` if the agent environment rejects WebP.

**Human verify:** ok 2026-05-16.

### 2026-05-13 — `/movies/[id]` hero taps (Log / Watchlist / overlap)

**Cause**: Putting `pointer-events: none` on the full-bleed hero wrapper (via `.cinema-vignette`) made the overlapping title / `MovieActions` row unreliable for hit-testing; inset vignette shadow does not need that. Decorative Scope frame stays non-interactive with `pointer-events-none` on the hero `<Letterbox>` root.

**Also**: Overlap strip now uses `relative z-20 isolate pointer-events-auto` so the pulled-up column consistently wins over the Scope frame. `bun run build` in `apps/web` — green (Executor).

**Planner verify**: `/movies/687163` at ~2530×1322. If taps still fail only while Agentation’s toolbar is active, the extension overlay is above the page (stack often shows `_agentation_...`).

### 2026-05-13 — Phase 5 Executor pass (Planner confirm)

**What shipped**

- `CreditsCrawl` (`apps/web/src/components/cinema/credits-crawl.tsx`) + crawl keyframes in `packages/ui/src/styles/globals.css` (pause on hover/focus; reduced-motion collapses to a scrollable stack).
- Profile: Filmography ledger (Year · Title · Score) from deduped `recentlyWatched`; favorites/reviews/lists under **Also credited for**; redundant “recent” rail removed from section order parsing.
- Movie page: crawl block before `CreditsFooter`, fed by `crewRowsToCreditsCrawlLines` with a broader `buildCrewRows(..., 80)` pass for marquee depth vs the compact crew table.
- Review detail API: `GET /api/reviews/:id` now joins author `profile` and returns `likedByProfiles` (≤40 likes, newest first) for crawl copy.
- Long reviews (≥480 chars body): footer **And that’s a wrap** + crawl (Written / Read / Applauded lines).

**Verify**

- `bunx tsc --noEmit -p apps/web/tsconfig.json` and `apps/server` — clean.

Planner: manual spot-check `/profile/[handle]`, `/movies/[id]`, `/reviews/[id]` (long vs short review) plus reduced-motion pref.

### 2026-05-13 — Phase 6 Executor pass (Planner confirm)

**What shipped**

- `TicketStub` (`apps/web/src/components/cinema/ticket-stub.tsx`): poster + perforated stub (`default`/`compact`), optional `stubKicker`, TMDB fragment or HTTPS `poster_url`, `linkHoverGrow` to avoid conflicting transforms in stacks.
- `DiaryEntry` refactored onto `TicketStub` (same visual silhouette).
- `globals.css`: `.watchlist-ticket-stack` `:has(li:hover)` fan/lift choreography + reduced-motion reset.
- `watchlist/page.tsx`: held tickets (`TicketStub`), stack flex wrap; **`linkHoverGrow={false}`** so stack transforms win.
- `home/page.tsx`: **Coming soon** horizontal ticket rail (`compact` stubs); deterministic feed list keys (`idx` instead of `Math.random()`).

**Verify**: `tsc --noEmit` (web). Manual: `/watchlist` hover focus on one ticket vs neighbors; `/home` carousel on narrow viewports (`snap-x`). Reduced motion: hover stack should stay flat.

### 2026-05-13 — Phase 7 Executor pass (Planner confirm)

**What shipped**

- **Preferences merge** on PATCH `/profiles/me`: shallow merges `preferences` JSON so unrelated keys survive (`apps/server/src/routes/profiles.ts`).
- **`apps/web/public/audio/`**: projector hum, reel clack (+ spare curtain cue) bundled as lightweight Opus.
- **`sound-provider.tsx`**: gesture-gated Web Audio decode, mute on reduced motion, fetches patron preference; **`useCinematicAudio`** exposes `play` / `stopSound` / looping teardown.
- **`movie-projection-hum.tsx`** + `<MovieProjectionHum />` on `/movies/[id]` for looping booth hum (~600 ms linear gain ramp-in).
- **Settings**: `preferences.theaterAudio` persisted + synced to audio context post-save (`settings-form.tsx`, `settings/page.tsx` types).
- **`MovieActions`**: emits `reel-clack` after successful log flows.
- **`Providers`**: `CinemaSoundProvider` under `ThemeProvider`.

**Planner verify**: Toggle in `/me/settings`, open any film route with audio on; quit route hum should fade off; retry with OS reduced motion (expect silence).

### 2026-05-14 — Phase 8 Executor pass (partial automation)

**What shipped**

- **`globals.css`** header **token / surface map** (drops brittle absolute DESIGN.md path); catalogs Phases 1–7 primitives (grain, iris, crawl, stacks, `/public/audio`, etc.).
- **Reduced motion**: freeze **`.animate-spin`** loaders; **`a.cinema-ticket-link`** neutralizes Diary / ticket lifts + poster brighten transitions (`ticket-stub` adds the marker class).
- **a11y**: `.movie-themed button:focus-visible` shares the accented ring recipe with anchors so keyed nav doesn’t regress on tinted film pages.

**Still manual**: 8.1 browser matrix; 8.3 Lighthouse deltas vs baseline; 8.4 saturated poster edge palettes.

### 2026-05-14 — Production build unblock (Executor)

**Issue**: Next static prerender failed — `useSearchParams()` without a Suspense ancestor on `/sign-in` (and the same pattern on `/search` via `SearchClient`).

**Fix**

- `(auth)/sign-in/page.tsx`: `<Suspense fallback={<SignInFormFallback />}>` around `<SignInForm />` (skeleton placeholders + `aria-busy`).
- `(app)/search/page.tsx`: same pattern wrapping `<SearchClient />`.
- **`globals.css`**: under `@media (prefers-contrast: more)`, film-page links/buttons get a stronger double-ring focus shadow for WCAG-ish visibility on neon accents.

**Verify**: `cd apps/web && bun run build` → exit **0** (Next 16.2.6, Turbopack).

**Planner**: Phase 8 still needs human 8.1 / 8.3 / 8.4 before declaring ship-ready.

### 2026-05-13 — `db:migrate` fix (pg + env path + baseline hint)

- **`packages/db`**: `db:migrate` now runs `bun run ./src/migrate.ts` using `pg` + `drizzle-orm/node-postgres/migrator` (avoids Neon serverless / `drizzle-kit migrate` issues; use Neon **direct** `DATABASE_URL`, not pooler).
- **Bugfix**: `migrate.ts` loads `apps/server/.env` via `../../../apps/server/.env` (from `packages/db/src/`).
- **Drift**: If migrate fails with `type "…" already exists` (Postgres 42710), the DB was likely built with `push` without journal rows; the script logs a SQL hint to insert into `drizzle.__drizzle_migrations` or use a fresh DB.

### 2026-05-13 — Task 1.1 complete, awaiting manual verify

**What changed**

- `apps/web/src/app/layout.tsx`: import `Fraunces` from `next/font/google` with
  `variable: "--font-fraunces"`, `axes: ["opsz"]`, `display: "swap"`. Variable
  is added to the `<html>` className alongside Inter/Geist Mono.
- `packages/ui/src/styles/globals.css`:
  - New `:root` token `--font-fraunces-stack` with multi-tier fallback
    (Fraunces → PP Editorial Old → GT Sectra → ui-serif → Georgia → serif).
  - New theme token `--font-display: var(--font-fraunces-stack);` in the
    `@theme inline` block, which auto-generates the Tailwind `font-display`
    utility under v4.
  - New `.font-display` plain-CSS utility with cinematic defaults
    (`letter-spacing: -0.02em`, `opsz: 96`, `SOFT: 30`, `ss01/ss02` features).
  - New `.font-display-sm` sibling for smaller display use (`opsz: 24`).
- `font-serif` still aliases to Inter — backwards compatible. No existing
  heading visually changes yet; that's task 1.2.

**Automated checks passed**

- `tsc --noEmit -p apps/web/tsconfig.json` → 0 errors.
- Dev server (Turbopack, Next 16.2.6) recompiled successfully (`✓ Compiled in
131ms`) and served `/movies/...` with HTTP 200 after the edit.
- Pre-existing module-not-found and hydration errors in the dev log are
  unrelated to this change (untracked WIP `floating-tab-bar.tsx`, pre-existing
  nested-`<a>` in `BrandMark`/`AppNav`). Flagged but not in scope for 1.1.

**Manual verify — please do this and confirm before I move to 1.2**

1. Open any page in the app (e.g. `/home`).
2. In devtools elements panel, inspect `<html>` and confirm it has both
   `--font-inter` and `--font-fraunces` CSS variables resolving to a
   `__className_…` Next.js next/font value.
3. Temporarily slap `className="font-display text-6xl"` on any heading (or
   open a fresh route file and add an `<h1 className="font-display">Test</h1>`)
   — confirm it renders in Fraunces, not Inter. Visually it should feel
   editorial / serif / cinematic, with subtle slab-ish terminals.
4. Confirm no console errors related to font loading.

If verified, say "1.1 ok" or "go" and I'll proceed to 1.2 (migrating actual
top-level headings sitewide). If Fraunces feels wrong, now is the cheapest
time to swap it (e.g. to Fraunces with a different opsz, or to Cormorant,
Newsreader, or a paid face).

### 2026-05-13 — Task 1.2 complete, awaiting manual verify

**Migration policy applied**

- `font-display` (Fraunces) for: every page `<h1>`, every page-section `<h2>`
  via the shared `Section` component + landing's features `<h2>`, BrandMark
  wordmark, DoubleFeatureSuggestion film-title `<h3>`, MovieShareStub
  film-title, DiaryEntry ticket title, Diary month divider, auth marketing
  pull-quote, home empty-state callout, chat sidebar "Chats" header.
- `font-serif` (Inter, unchanged) intentionally kept for: inline movie title
  mentions in the feed, card titles (list-card, review-card, news-strip
  headlines, chat thread titles, profile list titles), small UI labels
  (badges, achievements), review composer header, numeric figures with
  `tabular-nums` on the movie page (scores would look like a phone bill in
  Fraunces), inline `<span>` movie references in review hero.

**Course correction during 1.2 — `.font-display` now uses `font-optical-sizing: auto`**
The 1.1 `.font-display` utility I wrote forced `font-variation-settings: "opsz" 96`,
which would make smaller usages (text-lg, text-xl, text-2xl) look display-cut
and chunky. Browsers have honored `font-optical-sizing: auto` by default since
2019 (Chrome 79+, Firefox 62+, Safari 13+), so a single utility scales
gracefully from text-lg to text-7xl without us juggling sibling classes. I
removed the never-applied `.font-display-sm` sibling I'd added in 1.1.

**Files touched (22)**

Shared components:

- `components/brand-mark.tsx`
- `components/ui/section.tsx` (header + docblock)
- `components/cinema/double-feature-suggestion.tsx`
- `components/cinema/movie-share-stub.tsx`
- `components/diary/diary-entry.tsx` (drops inline Playfair_Display import)
- `components/onboarding/onboarding-flow.tsx` (3 h1s)
- `components/chat/chat-pane.tsx` (sidebar h2)
- `components/list/new-list-form.tsx`

Pages / routes:

- `app/page.tsx` (landing h1 + features h2)
- `app/global-error.tsx`
- `app/(app)/error.tsx`
- `app/(app)/movies/[id]/error.tsx`
- `app/(app)/movies/[id]/page.tsx` (hero h1)
- `app/(app)/home/page.tsx` (empty-state)
- `app/(app)/diary/page.tsx` (month dividers)
- `app/(app)/reviews/[id]/page.tsx` (review h1)
- `app/(app)/lists/[id]/page.tsx`
- `app/(app)/profile/[handle]/page.tsx` (profile h1)
- `app/(app)/me/settings/page.tsx`
- `app/(app)/me/customization/page.tsx`
- `app/(auth)/sign-in/page.tsx`
- `app/(auth)/sign-up/page.tsx`
- `app/(auth)/layout.tsx` (Capra pull-quote)

Plus `packages/ui/src/styles/globals.css` (simplified `.font-display`,
removed unused `.font-display-sm`).

**Automated checks passed**

- `tsc --noEmit -p apps/web/tsconfig.json` → 0 errors.
- No lint warnings on touched files.
- Dev server (Turbopack) hot-reloaded across all 22 file edits with no
  errors, multiple `✓ Compiled in {32,47,50}ms`. `/movies/1317288` continues
  returning 200.

**Manual verify**

1. Hit `/home`, `/diary`, `/movies/<anything>`, `/profile/<handle>`,
   `/lists`, `/sign-in`, `/sign-up`, `/me/settings`, `/me/customization`,
   `/reviews/<id>`, and root `/` (landing). Eyeball that every page H1, every
   "Section" header (Lobby chatter / Now showing / Coming attractions etc.),
   the BrandMark, the diary ticket title, the auth Frank Capra quote, and
   the home empty-state are all in Fraunces.
2. Confirm card titles / inline mentions / numeric scores DID NOT change
   (e.g. the TMDb 9.2/10 on movie pages stays in Inter — that's intentional).
3. Confirm no console errors and no FOUT flash.

If everything reads correctly, say "1.2 ok" or "go" and I'll proceed to 1.3
(refining the black scale + heavier vignette default, the second-biggest
perceptual lever of Phase 1).

### 2026-05-13 — Tasks 1.3, 1.4, 1.5 complete (Phase 1 foundation)

**1.3** — `--surface-theater: #020202`, `--background` uses it; vignette defaults
180px / 0.55 (multiplex 130px / 0.62); `.cinema-theater-floor`; scrollbar border;
`themeColor` `#020202`; `--color-theater` in theme.

**1.4** — `components/cinema/letterbox.tsx` (aspects 2.39, 2.35, 1.85, 21:9).

**1.5** — Landing: `cinema-theater-floor` + Letterbox around poster rail;
`LandingPosterRail` fills frame. Movie: backdrop in Letterbox; content
`md:-mt-24`. Profile: banner in 21:9 Letterbox; no-banner gradient strip.

**Verify**: spot-check `/`, `/movies/:id`, `/profile/:handle` (with banner).
Say **Phase 1 ok** to start Phase 2, or request tweaks.

### 2026-05-13 — Phase 2 (per-film color world) implemented

- Migration `0001_abnormal_black_bolt.sql` adds `palette_accent`, `palette_muted`,
  `palette_foreground` on `movie`.
- `apps/server/src/lib/poster-palette.ts` + `sync-movie-palette.ts`;
  `node-vibrant/node` + poster fetch → Buffer; persists after `cacheDetail` and
  stale refresh job.
- `MovieThemeProvider` + `.movie-themed` chrome (selection, link focus).
- **Run** `bun run db:migrate` when the DB is reachable; then load a film page
  once to extract/store palette.

### Open questions for the Planner before execution begins

1. **Display font final pick** — default plan is **Fraunces** (free,
   variable, sufficient gravitas). If the user prefers PP Editorial Old,
   GT Sectra, or Migra and is willing to fund a license + self-host, I'll
   swap. **Default: Fraunces.**

2. **Audio assets sourcing** — plan is to source three CC0 clips from
   freesound.org and commit them under `apps/web/public/audio/`. If user
   wants custom-recorded or licensed clips, that's a separate task. **Default:
   freesound CC0.**

3. **Phase ordering** — plan ships Phase 1 first (typography + letterbox)
   because it has the largest perceptual ROI per hour. If the user would
   rather see per-film color world (Phase 2) first because it photographs
   well in screenshots, I'll re-order. **Default: 1 → 2 → 3 → … → 8.**

4. **Profile filmography (5.1)** — currently profile shows reviews + lists.
   The "filmography" reframing reorganizes the page. If the user has strong
   feelings about retaining a particular section first, flag it now. **Default:
   filmography → reviews → lists.**

## Lessons

- **Onboarding preview pane height:** do not rely on `size-full` / `h-full` (% height) inside a column-flex aside to center short content — percentage height often collapses to content height, so nested `min-h-full` + `items-center` is a no-op and the specimen sticks top. Prefer `flex-1 min-h-0` on the reveal shell and `absolute inset-0` + `min-h-full` center for fill specimens. **Import QA tip:** “center the import” means the **upload** dropzone step (`import-upload`), not the provider picker.
- **Onboarding “I've verified” needs a fresh session:** Prefer `GET /api/me/email-verified` (Postgres via `freshContext`). Client `getSession` / cookie-cache stay stale. In **development**, skip the verify step entirely — auth does not `sendOnSignUp` locally.
- **Import source tiles on `bg-card`:** never translucent hover (`muted/*` or `foreground/8` replaces opaque `bg-background` and the tile vanishes into the card). Use **brightness** filter; serve brand PNGs with plain `<img>` + prefetch.
- **Onboarding unlock must wait for Enter:** do not set `markOnboarded` on favorites “Complete setup”, and do not grandfather post-v3 accounts via diary / taste / favorites on `GET /profiles/me` — that unlocked `/home` during the import step. Persist profile + logs first; `markOnboarded: true` only on **Enter Sense** (or abbreviated skip). Pre-v3 handle-only grandfather stays.
- **`t-page-slide` JS duration + `.is-active`:** browsers often serialize `--page-slide-dur: 200ms` as **`.2s`**. `Number.parseInt(".2s")` is **NaN** → `setTimeout(..., NaN)` fires immediately → layers clear before the CSS tween (`is-animating` without `is-active` reads as a hard cut). Always parse with `parseCssDurationMs` / `readPageSlideMs`. Separately: if activation rAF/timeout is **cleared on effect cleanup**, Strict Mode / parent re-renders cancel `.is-active` before paint — keep the activation timer (or use a generation token), and do **not** put `children` in the route-change effect deps.
- **`t-page-slide` snapshot cache + React Strict Mode:** if you write `cacheRef.current = incoming` in the effect and the cleanup only cancels timers, Strict Mode’s fake unmount leaves the cache on the *new* key so the replay bails and the enter layer can stick at `opacity: 0` (`is-animating` without `is-active`). Restore the outgoing cache in cleanup **only while the timeout has not completed**; after it completes, leave the cache on the new key so the next real step still snapshots the right outgoing page.
- **"AI API key" is not one credential — check the prefix before wiring a provider:** a **Vercel AI Gateway** key is `vck_…`; a **Google AI Studio** key is `AIza…` or, since Google's 2026 migration to *auth keys*, **`AQ.…`** (~53 chars). They are not interchangeable — the gateway takes a Bearer token, while a Google key must reach `generativelanguage.googleapis.com` via the **`x-goog-api-key`** header (`AQ.` keys additionally **fail** on Google's OpenAI-compatible endpoint with *"Multiple authentication credentials received"*). Pasting a Gemini key into `AI_GATEWAY_API_KEY` looks configured and fails only at call time. Inspect **length + prefix** (never echo the value) before assuming which SDK to reach for.
- **A model listed by `/v1beta/models` is not necessarily callable:** `gemini-2.5-flash-lite` appears in the listing for a new key yet returns **404 — "no longer available to new users"** on `generateContent`. Validate a default model with a **real one-shot call**, not by grepping the catalogue. Also prefer a **pinned** id over the floating `…-latest` alias for anything metered, so a provider release cannot silently change output quality or price.
- **Distinguish auth failures from availability failures by status code:** the first live translation attempt returned **404**, not 401/403 — which immediately proved the key was valid and narrowed the problem to the model id. Read the status before assuming the credential is wrong.
- **Resolvers that read `env` at module scope are untestable on a configured machine:** `isReviewTranslationConfigured()` originally read `env` directly, so once a real key landed in `.env` the "unconfigured" branch could never be exercised. Split into a **pure** `resolve…({ keys })` plus a thin env-reading wrapper; tests then cover precedence deterministically regardless of the developer's `.env`. (Route-level tests can keep using `mock.module`.)
- **`tinyld` full model is overfit on rare languages — always import `tinyld/light`:** measured on **501 real review rows**, the full model labelled plain English (`"My friends got traumatized by Anora so I suggested this as a palette cleanser lmao."`) as **Berber with accuracy 1.000**, informal Italian (`"...nn ce l'ho ma cmq..."`) as Berber, and elongated English (`"LOVELYYYY FACEEEEEEE"`) as Romanian — producing `ber=5 rn=2 eo=1 af=1` junk. **`tinyld/light`** gets all of those right, still covers **ja/ko/zh/ru/ar/hi/tr**, and cleared every bogus rare-language hit. Corollary: **accuracy scores are useless as a confidence gate** — correct Spanish scores **0.11** while a *wrong* answer scores **1.000**. Gate on **text length** instead (24 chars latin, 8 for CJK/hangul, since dense scripts decide in fewer characters). Normalizing repeated letters made **zero** difference — don't bother.
- **Backfilling a derived column with Drizzle `.set()` silently stamps `updatedAt`:** `review.updatedAt` uses `$onUpdate(() => new Date())`, so a `db.update(review).set({...})` backfill would mark every historical review as freshly edited (and, for review translation, invalidate every `updatedAt`-keyed cache). Use **raw `db.execute(sql\`UPDATE ...\`)`** in backfill scripts — matches `backfill-onboarding-visibility.ts`.
- **`apps/server` `tsc -b` poisons itself via `dist/`:** `tsconfig.json` sets `outDir: "dist"` with **no `include`**, so the next build reads its own emitted `.d.ts` as input and fails with **`TS5055: Cannot write file ... would overwrite input file`** for any newly added file. `dist/` is gitignored build output — `Remove-Item -Recurse -Force dist, tsconfig.tsbuildinfo` and re-run.
- **Verifying "was this failure pre-existing?" — never `git stash -u` in this repo:** the working tree carries large amounts of *other* uncommitted work plus hundreds of untracked skill files, so a global stash changes far more than your own edits and the before/after test counts are not comparable (observed **1464 vs 1577** passing). Also, root `bun test` **double-counts** every test (duplicate path casing `packages\db` vs `packages/db`), so failure lists print twice. Instead, **run the suspect test files in isolation** — that also separates real failures from the known `mock.module` ordering pollution.
- **`select({ table })` on a table with a verbatim-JSON column is a transfer bomb:** `/api/taste/for-you` took **10–33s** and held the `/home` Suspense boundary open (page **11.3s**). Two queries used **`.select({ log, movie })`** with `.limit(400)` — `movie.tmdbJson` stores "the full TMDb response verbatim", so each pulled hundreds of fat JSONB blobs from Neon (**eu-central-1**) to use **six scalars** (`genreIds`, `year`, `originalLanguage`, `popularity`, `rating`, `movieId`). Column-scoping both (`taste-matched-discovery.ts` `viewerDiaryRows`, `taste-social-candidates.ts`) took **4383ms → 50ms** and **4804ms → 76ms**; `buildTasteMatchedDiscovery` **10851ms → 1618ms**; `/home` **11.3s → 2.3s**. Rule: never `select({ table })` on `movie`/`person` — they carry `tmdb_json`. Effect is worst on remote DBs, so it can hide locally.
- **A Suspense boundary still owns the page's total time:** Next logs `GET /home 200 in Ns` only when **every** boundary resolves. The taste hero's own comment said it kept the slow call "off the critical path" — true for **first paint**, false for **completion**, which is exactly the "skeleton fast, posters slow" symptom. Instrumenting only the two RSC waves showed a healthy **330ms** while the real page was **10s**: partial instrumentation produced a **false all-clear**. Always compare traced spans against the **end-to-end** number before declaring a fix.
- **Effects keyed on derived objects can DDoS the API:** `/home` felt slow because **`HomeTasteMatchedHero`** ran a runaway fetch loop (~**815 requests / 25s idle**, ~22 req/s) against `/api/movies/:id/title-logo`, `/trailer`, and `/logs/me/by-movie/:id`. Three effects depended on the **`spotlight` object** (`movies[safeActiveIndex]`) while two of them wrote results back via `setMovies(prev => prev.map(...))`, which rebuilds that element — new identity → effects refire → fetch → forever. Each request cost **2 Neon queries**, so the DB burned ~29s of work and starved the `/home` RSC render (waves went **125ms + 317ms → 913ms + 1442ms** under saturation). Fix: key enrichment effects on the **stable primitive `spotlight?.tmdbId`**, seed initial values from **`moviesRef.current`**, and make `setMovies` updaters **return `prev` unchanged** when nothing differs. Rule: never put a **derived object** in a dependency array when the effect writes back into the state that derives it — depend on an id.
- **Measuring before fixing matters:** the first hypothesis (uncached TMDb) was **wrong** — TMDb is ~120ms warm and the unauthenticated catalogue endpoint is ~170ms. Opt-in timing helpers `apps/{web,server}/src/lib/trace-timing.ts` (gated by **`STILL_TRACE_TIMING=1`**) plus the `[trace:req]` logger in `apps/server/src/local.ts` attribute DB/TMDb cost to routes. Gotchas: **Turbo strict env** drops undeclared vars (declare in `turbo.json` `dev.env` or run the app directly), and **Bun can share port 3000 across two processes**, so a stale non-instrumented server silently answers requests — verify the listener PID before trusting timings.
- **Local auth origins:** `CORS_ORIGIN` / `BETTER_AUTH_URL` on the server must match the browser origin (`localhost` vs LAN IP). Mismatch → Better Auth `Invalid origin`. Dev now also trusts `http://localhost:3001` + `http://127.0.0.1:3001` even when `CORS_ORIGIN` is a LAN URL.
- **Client API typing bridge:** when Eden/web consumes server DTOs containing `Date` fields but client view-model expects `string`, do not cast arrays directly (`as PatronFeedbackListItem[]`). Normalize payload timestamps explicitly (`Date -> toISOString`) in fetch adapters to satisfy strict TS and avoid cross-package type drift.
- **Next 16/TS 5.5 DOM typing:** `new Blob([bytes])` can fail when `bytes` is `Uint8Array<ArrayBufferLike>` (because `BlobPart` expects `ArrayBuffer`-compatible views). Normalize with `Uint8Array.from(bytes)` and pass `normalizedBytes.buffer` to `Blob` in strict monorepo typechecks.
- **Presence AFK realtime:** `touchListingPresence` must set `changed: true` when **activity state** flips (not only ZSET occupancy) so `publishRealtimeEvent` fires `presence.updated`; global portrait badges need **`PatronOnlineProvider`** subscribed to **`patron:app`** SSE (`resolveStaticRealtimeRoomAccess` must allow that room). **Tab-away heartbeats** must fire **synchronously inside `visibilitychange`** (`usePatronActivityFlipHeartbeat`) with `fetch` **`keepalive`** — background tabs throttle React `useEffect`, so away POSTs never ran. **Upstash `hset`:** use **`hset(key, { [userId]: state })`** — the 3-arg `hset(key, field, value)` form is a **silent no-op** on `@upstash/redis`, so away never persisted and every read fell back to `active`. **Rapid tab churn:** coordinate with **`BroadcastChannel`** (`PatronActivityTabSync`) — patron stays **active** if **any** Sense tab is visible; debounce **away** heartbeats ~400ms (`createPresenceHeartbeatScheduler`); remove duplicate per-tab `visibilitychange` POSTs that raced sendBeacon vs active. `--aker-duration` / `--aker-duration-slow` in `packages/ui/src/styles/globals.css` are **0.2s** max for tokenized UI transitions; hero iris, projector flicker, and view-transition durations stay **explicit longer values** where cinematic. Framer **`useReducedMotion`** should gate decorative stagger (e.g. marketing poster rail) and snap onboarding step transitions when the OS requests reduced motion.
- `packages/db/src/migrate.ts` must load `.env` with **`../../../apps/server/.env`**
  (from `src/`), matching how `drizzle.config.ts` resolves `../../apps/server/.env`
  from the `packages/db/` cwd.
- **`db:migrate`** uses `pg` + programmatic `migrate()`; Neon pooler/serverless
  drivers are a poor fit for migration transactions—prefer the direct connection
  string for CLI migrate.
- If **`drizzle-kit push`** was used, **`__drizzle_migrations`** may be empty while
  objects exist; baseline with hashed rows or reset the DB before `db:migrate`.
- Inter is the current `--font-serif` alias. Any heading using `font-serif`
  to a dedicated `font-display` token is more honest than rebinding
  `font-serif` and keeps backward compat options open.
- `diary-entry.tsx` already imported Playfair Display inline — symptom of
  the missing display face. We'll remove that one-off in 1.2.
- Next 16 + React 19 means stable view-transitions are available; no need
  for framer-motion AnimatePresence at the route level (still fine for
  in-page animations).
- `framer-motion` imports are `from "framer-motion"`, not `motion/react` —
  per user rules.
- **Sticky headers + flex lobbies:** `flex min-h-0 flex-1` on page shells inside
  `AppShell` `<main>` caps height to the viewport and breaks `position: sticky`
  (scroll moves inside the flex child). Prefer `flex flex-1 flex-col` without
  `min-h-0` on document-scroll pages; keep `overflow-x-clip` off ancestors of
  sticky top bars; avoid `overflow-y: auto` on both `html` and `body`.
- **Mobbin MCP** (`search_screens`): some environments fail WebP decode — use
  `"image_format": "jpg"` for reliable screen pulls when researching patterns.
- **Next.js `RouteImpl` / Link href errors after route changes:** if `next build`
  fails TypeScript on valid paths (e.g. `/search`, `/sign-in`) with
  `typedRoutes: false`, delete **`apps/web/.next`** and rebuild — stale generated
  types can linger and contradict the live `app/` tree.
- **Turbo `extension#build`:** WXT writes artifacts under **`apps/extension/.output/`**, not **`dist/`**. Root **`turbo.json`** **`build.outputs`** must include **`".output/**"`\*\* (or a package rule) or Turbo warns and skips caching that task’s outputs.
- **WXT ≥0.20:** top-level **`runner`** in **`wxt.config.ts`** is deprecated — use **`webExt`** (same shape, e.g. **`disabled: true`** to skip auto-launching Chrome during dev/build tooling).
- **tsdown ≥0.21:** top-level **`noExternal`** is deprecated — use **`deps.alwaysBundle`** (same patterns) to force bundling workspace packages like **`@still/*`**. For a **fat server bundle** that inlines many **`node_modules`** deps, **`deps.onlyBundle: false`** silences whitelist-audit noise (see **`apps/server/tsdown.config.ts`**).
- **Phase 8.1 (cross-browser smoke):** repeatable route matrix + pass criteria live in **`.cursor/scratchpad.md`** under **`### Phase 8.1 prep — Cross-browser smoke checklist`** — run it before ticking **8.1** on the Project Status Board.
- **Phase 8.3 (Lighthouse mobile):** prep + default relative pass gates under **`### Phase 8.3 prep — Lighthouse mobile perf`** — log scores against the **same** build mode as the last tagged baseline.
- **Phase 8.4 (per-film contrast):** prep under **`### Phase 8.4 prep — Per-film palette contrast`** — sample **three** **`/movies/[id]`** extremes before ticking **8.4**.
- **Catalogue billboard Lobby link:** **`popular` / `upcoming` / `discover`** header **`← Lobby`** uses **`aria-label="Back to home lobby"`** plus **`[@media(hover:hover)]:hover:text-foreground`** so touch avoids stuck-hover tint and screen readers get a clear target name.
- **`lists.test.ts` + new imports:** when `lists.ts` pulls modules that import extra `@still/db` symbols (`profile`, `log`), extend the test **`mock.module("@still/db")`** or mock the lib (e.g. **`list-owner-log-scores`**) before **`await import("./lists")`**.
- **Hand-written SQL migrations** must be registered in **`packages/db/src/migrations/meta/_journal.json`** or **`bun run db:migrate`** skips them — SN.15 **`0015_list_collaborator`** caused list detail **404** (API query failed → RSC **`notFound()`**).

### 2026-05-27 — TV on lists (Planner)

**Approved:** `docs/superpowers/specs/2026-05-27-tv-on-lists-design.md` — Approach A, full parity, split picker meta (`0 titles` empty, `N films · M shows` mixed).

**Plan:** `docs/superpowers/plans/2026-05-27-tv-on-lists.md` (11 tasks: migration → aggregates → API → meta line → shared picker → TV hero → radial → QA).

**Project Status Board:**

- [x] TL.1 DB migration (`cover_tv_ids`, `movie_items_count`, `tv_items_count`) — migration `0008` applied
- [x] TL.2 `refreshListAggregates` + cover poster order
- [x] TL.3 Lists API POST/DELETE/me TV
- [x] TL.4 Web `AddToListMedia` + meta line + radial + TV hero
- [x] TL.5 Build + manual QA — human **`ok`** (2026-05-27)

**Shipped (2026-05-27):** TV on lists — migration `0008`, lists API `tvId`, split picker meta (`0 titles` / `N films · M shows`), `AddToListMedia` on TV detail + catalogue radial. Spec: `docs/superpowers/specs/2026-05-27-tv-on-lists-design.md`.

### 2026-05-27 — TV diary rewatch scope (Executor)

**Approved:** `docs/superpowers/specs/2026-05-27-tv-log-rewatch-scope-design.md` — Approach A (scoped prior counts + auto season diary on mark complete).

**Project Status Board:**

- [x] TR.1 `tv-log-scope-prior.ts` + unit tests
- [x] TR.2 `use-tv-detail-user-state` scoped `priorLogCount` / `priorTvLogs` / `handleEditLog`
- [x] TR.3 `quick-log-sheet` scope-aware rewatch + form scope payload on POST
- [x] TR.4 `tv-detail-primary-actions` show-scoped hero badge
- [x] TR.5 `tv-detail-progress-panel` per-season counts, auto `postLog`, Edit diary
- [x] TR.6 `catalogue-poster-tile` TV show-scoped prior count
- [x] TR.7 `apps/web` build + unit tests pass
- [ ] TR.8 Human manual QA — reply **`ok`** when verified

**Executor's Feedback or Assistance Requests:** Please verify on a TV detail page: (1) log S1 → Quick Log S2 → Rewatch **off**; (2) log S1 again → Rewatch **on**; (3) hero badge counts **show** logs only; (4) mark season complete creates diary row without “Log to diary” toast CTA; (5) complete season with existing log shows **Edit diary**.

**Shipped (code, pending QA):** `apps/web/src/lib/tv-log-scope-prior.ts`, `my-tv-log.ts`, updates to quick log, TV detail hero/progress, catalogue radial TV quick log.

### 2026-05-27 — Instant lobby navigation / perceived performance (Planner)

**Approved:** `docs/superpowers/specs/2026-05-27-instant-lobby-navigation-design.md` — Approach **A** (client patron lobby shells + `useLobbyTransition`) + **C** (Suspense/streaming on TMDb + detail). Scope **C** app-wide; URL **instant UI first** then `router.replace`.

**Phases:** (1) `/diary`, `/profile/[handle]`, `/watchlist` — (2) community/order chips — (3) `/home` TMDb grids — (4) detail tab streaming.

**Plan:** `docs/superpowers/plans/2026-05-27-instant-lobby-navigation.md` (Phase 1: tasks 1–7 — hook → diary → profile → watchlist → QA gates).

**Project Status Board:**

- [x] IL.1 Spec human review — **`ok`** (2026-05-27)
- [x] IL.2 Implementation plan
- [x] IL.3 Task 1 — `useLobbyTransition` + provider
- [x] IL.4 Task 2–3 — Diary shell + chips — human **`ok`**
- [x] IL.5 Task 4–5 — Profile shell + chips — human **`ok`**
- [x] IL.6 Task 6–7 — Watchlist shell + order chips — human **`ok`**
- [x] IL.8 Phase 1 closure — patron lobbies shipped (2026-05-27)
- [x] IL.9 Phase 2 — `/home` community period + post-log `router.refresh` — human **`ok`** (2026-05-27)
- [x] IL.10 Phase 3 — `/home` TMDb instant chips + grid dim pulse — assumed complete on **`go to next`** (2026-05-27)
- [x] IL.10b Sticky header regression fix — human **`ok good`** (2026-05-27)
- [x] IL.11 Phase 4 — film/TV detail About·Streaming instant tabs + Suspense About body — human **`ok`** (2026-05-27)

**Executor's Feedback or Assistance Requests:** Instant lobby navigation (IL.1–IL.11) **complete** through Phase 4 human sign-off (2026-05-27). Optional follow-ups (not in v1 spec): list-detail query tabs if added later; `router.refresh()` polish on more mutation paths; diary `waveKey` venue-only remount skip.

Symptom **B** (frozen full page) on chip taps — root cause is `<Link>` + `force-dynamic` RSC awaiting all data; `loading.tsx` does not help query-only navigations.

### 2026-05-29 — Unified ⌘K search + people (Planner)

**Brainstorm approved:** `docs/superpowers/specs/2026-05-29-unified-search-people-design.md` — merge cmdk into catalog dialog; `GET /api/profiles/search` (public profiles, following/mutual-first); follow suggestions on empty query; retire ⌘⇧K palette. Plan: `docs/superpowers/plans/2026-05-29-unified-search-people.md`. Friends product deferred (mutual follow boost only).

**Executor 2026-05-29 (US.1):** Shipped unified ⌘K — `GET /api/profiles/search`, People + Suggested for you; deleted `command-palette.tsx`; build ok.

**Executor 2026-05-29 (Go to split):** Removed full **Go to** grid from catalog search (was making ⌘K dialog too tall). Added compact **`GoToDialogRoot`** (**⌘⇧K** / **Ctrl+Shift+K**), `go-to-dialog-store.ts`, single **Go to…** row in empty ⌘K; `catalog-search-dialog-store.requestClose` dismisses catalog when opening go-to; deleted `search-dialog-go-to-group.tsx`; build ok. **Human QA:** **`ok`** (2026-05-29).

### 2026-05-29 — Home browse instant navigation (Planner)

**Brainstorm:** Human confirmed pill freeze on all browse tabs (**A**), Community slowest; prefetch **D** (implementor choice → hover + idle prefetch, not mount bundle).

**Draft spec:** `docs/superpowers/specs/2026-05-29-home-browse-instant-navigation-design.md` — extends IL with `HomeBrowseSurfaceProvider`, `HomeLobbyBodyGate`, Community core-first + deferred leaderboards (waves A/B).

**Project Status Board:**

- [x] HB.1 Human spec review — **`va bene`** (2026-05-29)
- [x] HB.2 Implementation plan — `docs/superpowers/plans/2026-05-29-home-browse-instant-navigation.md`
- [x] HB.3.1 Task 1 — `home-browse-surface-nav` + provider + tests (5 pass, build ok)
- [x] HB.3.2 Task 2 — `HomeLobbyNavigationRoot` on `/home`; deduped `LobbyNavigationProvider` (build ok)
- [x] HB.3.3 Task 3 — `HomeLobbyBodyGate`, `CommunityLobbySkeleton`, `TmdbLobbySkeleton` (build ok)
- [x] HB.3.4 Task 4 — `HomeStickyChrome` optimistic browse pill + `selectBrowseSurface` (build ok)
- [x] HB.3.5 Task 5 — Community `router.prefetch` on hover/focus + idle on Movies/TV (build ok)
- [x] HB.3.6 Wave A human QA — **`ok`**
- [x] HB.4 Wave B — core RSC (`fetchHomeCommunityCore` + `HomeCommunityRscPayload` Suspense), client-deferred leaderboards + ranks skeleton/retry (build ok)
- [ ] HB.4.1 Wave B human QA — Community Lists fast; Film/TV ranks skeleton then podium; reply **`ok`**
- **HB.4 fix (2026-05-29):** Activity → Film ranks flashed podium then stuck skeleton — `useEffect` re-synced empty RSC `{}` leaderboard props on in-lobby `?sort=` changes, wiped client hydration, set `leaderboardsLoading` without re-fetch. Removed that sync; ranks skeleton only when loading **and** no board for active period.
- [ ] HB.4 Wave B — Community core RSC + leaderboard defer + prefetch

### 2026-05-28 — Home sticky icon tooltips (Executor)

**Project Status Board:**

- [x] HT.1 Add hover tooltips to `/home` sticky icon shortcuts (watchlist, lists, diary)
- [x] HT.2 Keep existing accessible labels/titles intact and preserve active-state pill behavior
- [ ] HT.3 Human QA on `/home?sort=popular` at desktop viewport — confirm tooltip copy/position feels right

**Executor's Feedback or Assistance Requests:** Please verify on `/home?sort=popular` (desktop) that hovering each icon shortcut shows a tooltip (`Watchlist`, `Lists`, `Diary`) and that click/active behavior still matches previous behavior. Reply **`ok`** when this looks right.

### 2026-05-28 — Ranked list drag reorder (Planner)

**Approved:** `docs/superpowers/specs/2026-05-28-ranked-list-drag-reorder-design.md` — Approach **1** (client drag + bulk reorder API + optimistic save + undo).

**Plan:** `docs/superpowers/plans/2026-05-28-ranked-list-drag-reorder.md` (7 tasks: server route/tests -> transactional reorder -> web fetch helper -> client sortable grid -> page gating -> verify -> manual QA).

**Project Status Board:**

- [x] RL.1 Spec approved by human (`approach 1`)
- [x] RL.2 Implementation plan written
- [x] RL.3 Server reorder API + tests
- [x] RL.4 Web reorder grid + optimistic save/undo
- [x] RL.5 Lists page gate wiring (ranked editable only)
- [x] RL.6 Build + automated verification
- [ ] RL.7 Human QA on ranked/non-ranked/read-only list behavior

**Executor's Feedback or Assistance Requests:** RL.3 is complete via subagent and verified in workspace: `POST /api/lists/:id/reorder` now exists with exact-set validation (`itemIds`), owner/collaborative permissions, favorites guard, transactional position normalization, and route tests in `apps/server/src/routes/lists.test.ts` (including duplicate/partial/foreign validation). Please reply **`ok`** to proceed to RL.4 (web reorder UI with optimistic save + undo).

**Executor's Feedback or Assistance Requests:** RL.4 is complete via subagent and verified in workspace: `postListReorder` helper added, `ranked-list-reorder-grid.tsx` created with pointer drag + optimistic reorder + rollback on failure + undo toast flow, and focused tests in `ranked-list-reorder-grid.test.tsx` passing. Please reply **`ok`** to proceed to RL.5 (wire `/lists/[id]` gating so ranked editable lists use the reorder grid while others stay static).

**Executor's Feedback or Assistance Requests:** RL.5 is complete in workspace: `/lists/[id]` now gates reorder UI via `canReorderRankedList` (ranked + signed-in owner/collaborative only), renders `RankedListReorderGrid` only under that gate, and keeps `ListDetailFilmsGrid` unchanged for non-ranked/read-only flows. Added focused branch tests in `apps/web/src/app/(app)/lists/[id]/page.test.ts` and helper coverage in `list-detail-page-branching.ts`; verified with `bun test "src/app/(app)/lists/[id]/page.test.ts" "src/components/list/ranked-list-reorder-grid.test.tsx"` (pass). Please reply **`ok`** to proceed to RL.6 (broader automated verification / typecheck-build pass).

**Executor's Feedback or Assistance Requests:** RL.6 verification is complete. Results: (1) `apps/server` reorder tests pass (`bun test src/routes/lists.test.ts`), (2) web ranked-list tests pass (`bun test "src/app/(app)/lists/[id]/page.test.ts" "src/components/list/ranked-list-reorder-grid.test.tsx"`), (3) web production build passes (`bun run build`). Note: `bun run check-types` is not a valid script in `apps/web`, but `next build` includes TypeScript checking and completed successfully. Please run RL.7 manual QA and reply **`ok`** (or report issues).

**Executor's Feedback or Assistance Requests:** Bugfix applied for manual QA blocker: native browser image/link drag was hijacking ranked-list pointer drag. In `apps/web/src/components/list/ranked-list-reorder-grid.tsx`, each tile now blocks native `dragstart`, prevents default on pointer down to avoid selection drag, and suppresses click navigation when interaction became a drag. Regression tests still pass (`bun test "src/components/list/ranked-list-reorder-grid.test.tsx" "src/app/(app)/lists/[id]/page.test.ts"`). Please re-test ranked drag behavior and report back.

**Executor's Feedback or Assistance Requests:** Replaced custom pointer drag with `@dnd-kit` sortable implementation in `ranked-list-reorder-grid.tsx` after QA reported brittle behavior (no proper slot snapping/drag feedback). Current behavior now uses `DndContext` + `SortableContext` + `useSortable` transforms while preserving existing optimistic save + undo + rollback flows. Added dependencies `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` in `apps/web/package.json`. Verification: `bun test "src/components/list/ranked-list-reorder-grid.test.tsx" "src/app/(app)/lists/[id]/page.test.ts"` and `bun run build` both pass. Please re-run ranked-list drag QA and confirm if interaction now matches expected snap/reorder behavior.

### 2026-05-28 — Landing hero Mobbin layout on dark canvas (Executor)

**Shipped (approach 2):** Replaced La Nube full-bleed poster hero with Mobbin **IA** on Still tokens — centered mark + display headline + subline + dual pill CTAs (`/sign-up`, `/sign-in`) + raised **three-window product stage** (Home grid / Diary rows / Lists duo) using TMDb posters. New modules: `landing-mobbin-hero.ts`, `landing-hero-preview-stage.tsx`; `landing-hero.tsx` is now a server component (no glass pager / old marquee build).

**Human / Planner:** Log out or incognito → **`/`** — confirm first section reads Mobbin-like (copy stack + product shelf) while sections below stay unchanged. Reply **`ok`** or note tweaks (copy, CTA labels, stage overlap).

### 2026-05-29 — Sense product roadmap + Phase 1 launch blockers (Planner → Executor)

**Brainstorm approved:** `docs/superpowers/specs/2026-05-29-sense-product-roadmap-design.md` — Approach **Launch Tier 0** on existing movies + TV + Community; patron-facing **Sense** rebrand (phased C); strategy source `sense-media-platform-strategy.md`.

**Project Status Board:**

- [x] SN.1 Roadmap spec + human alignment (catalogue scope, rebrand phased C, pre-launch)
- [x] SN.2 Phase 1a implementation — taste signature, Letterboxd import, onboarding v2 quick-rate, editorial cold-start, OG taste card, `app-brand` / BrandMark
- [x] SN.3 Human QA on Phase 1 — **`done`** (2026-05-29)

**Executor's Feedback or Assistance Requests:** Phase 1 launch blockers **signed off** by human. **Next (Tier 1, not started):** rare badge pass, rivalry/taste overlap, completionist challenges, streaks + protection, optional anime wedge. Run `bun run db:migrate` on any fresh env before testing import/taste columns. Internal `@still/*` rename remains post-launch month 1 per spec.

### 2026-05-29 — Sense Tier 1: rare badge pass (Executor)

**Shipped:** `badge-prestige.ts` (server + web) — volume milestones (`watch_10`+) hidden from profile tray; prestige-first sort; no toast/notification for volume unlocks; 7 new **prestige** catalog badges + **Diaries Merged** on Letterboxd import; Achievements lobby relabels **Volume milestones** (muted); pin API rejects volume badges.

**Project Status Board:**

- [x] SN.4 Tier 1 rare badge pass — implementation + tests
- [x] SN.4.1 Human QA — **`ok`** (2026-05-29)

### 2026-05-29 — Sense Tier 1: rivalry / taste overlap (Executor)

**Shipped:** `sense-taste-overlap.ts` + tests — shared watches, compatibility %, divergences, positive framing. API: `GET /api/taste/overlap/:handle` (signed-in), `GET /api/taste/compare?a=&b=` (OG/share), `POST /api/taste/challenge/:handle` (notification + `?tasteCompare=1` deep link). UI: **Compare taste** on other profiles, `TasteOverlapDialog`, shareable `/og/compare/[viewer]/[target]`.

**Project Status Board:**

- [x] SN.5 Tier 1 rivalry / taste overlap — implementation + tests + build
- [x] SN.5.1 Human QA — **`ok`** (2026-05-29): notification deep link, **Compare tastes** / **Not now** inbox actions, compact pill sizing
- [x] SN.5.2 OG taste + compare cards — Satori `display: flex` fix; **`ok`** from human

### 2026-05-29 — Sense Tier 1: completionist challenges (Executor)

**Shipped:** Four curated sets (Nolan, Horror canon, Ghibli, A24) in `completionist-challenges.ts`; `user_completionist_challenge` migration `0011`; `GET/POST /api/challenges`; progress from diary logs; prestige badge + notification on complete; **Achievements → Challenges** tab with join, progress bar, film list.

**Project Status Board:**

- [x] SN.6 Tier 1 completionist challenges — implementation + tests + build
- [x] SN.6.1 Human QA — **`ok`** (2026-05-29): challenges visible; join UX clarified

**Executor's Feedback or Assistance Requests:** `/achievements?tab=challenges` → **Join challenge** → log missing films from **View films** → badge + notification when done. Restart API after migrate/seed. Reply **`ok`** when QA passes.

**2026-05-29 fix — empty Challenges tab:** Achievements RSC used Eden `challenges.get()` with `.catch()` that hid failures; switched to `GET /api/challenges/catalog` via `fetchAchievementsChallengesCatalog` (cookie-forwarded). Server enrollment lookup is try/catch so missing `0011` table still returns the static catalog. Client panel refetches catalog when SSR sent an empty list.

**Next Tier 1:** **SN.7** streaks + protection

### 2026-05-29 — Sense Tier 1: streaks + protection (Executor, in progress)

**Goal:** Diary logging streak with shields + one-time grace — never a punitive cliff (strategy §7 W4).

**Project Status Board:**

- [x] SN.7.1 DB `user_streak` + pure streak math + tests
- [x] SN.7.2 API `GET /api/streaks/me`, `POST /api/streaks/freeze` + log hook
- [x] SN.7.3 Profile streak chip (own profile) + at-risk + shield CTA
- [x] SN.7.3b Profile header meta consolidation — `ProfilePatronByline` (single middot row); compact inline streak pill (shields inline when calm)
- [x] SN.7.5 Achievements streak card — `useWatchStreak` + `AchievementsWatchStreakCard` (best run, shield CTA, **Go to diary** nudge) on all tabs
- [x] SN.7.4 Human QA — **`ok`** (2026-05-29): profile byline streak + `/achievements` card; shield / at-risk

**Shipped:** `watch-streak.ts`, migration `0012_user_streak.sql`, `watch-streak-sync.ts`, `routes/streaks.ts`, `ProfileWatchStreak`, `profile-patron-byline.tsx`, `use-watch-streak.ts`, `achievements-watch-streak-card.tsx`.

**Executor's Feedback or Assistance Requests:** Run **`bun run db:migrate`** (0012). **Profile** — compact streak + one meta byline. **`/achievements`** — streak card above tabs (current + best run). At-risk → shield + diary link. Reply **`ok`** when SN.7.4 passes.

### 2026-05-29 — Sense Tier 1: optional anime wedge (Executor, in progress)

**Goal:** Expose anime as a first-class discovery shortcut **inside existing TV/search surfaces** (no separate `/anime` product surface).

**Project Status Board:**

- [x] SN.8.1 Search dialog quick-entry wedge — add **Anime** quick chip in the “Show” row; toggles curated `anime` tag and sets listing mode to TV
- [x] SN.8.2 Human QA — `ok` (2026-05-29)
- [x] SN.8.3 Empty-state anime entrypoint — add **Anime** quick action in empty `⌘K` state (no typing required)
- [x] SN.8.4 Human QA — `ok` (2026-05-29)

**Shipped:** `home-sticky-search.tsx` now includes (1) an explicit **Anime** quick chip beside **Films** / **TV shows** in active query mode and (2) an empty-state **Anime** quick action under **Go to…**, both wired to curated tag rules (`slug: "anime"`), preserving the strategy rule that anime stays under TV/catalog search rather than a separate product rail.

**Executor proactive pre-QA pass (2026-05-29):** SN.7 streak flow sanity pass completed before manual QA. Verified route wiring (`streaksRoute` mounted in `server/app.ts`), post-log streak sync hook in `routes/logs.ts`, and profile header integration (`ProfileWatchStreak` gated by `isMe`). Automated checks passed: `apps/server/src/lib/watch-streak.test.ts` (**6 pass**) and `apps/web/src/lib/watch-streak-display.test.ts` (**3 pass**). No blockers found; SN.7.4 remains manual QA gate.

### 2026-05-29 — Sense Tier 1: notification quality (Planner — SN.9 brainstorm complete)

**Goal:** Fewer, higher-signal inbox rows; central delivery policy; Settings toggles; comment + import notifications; mutual-gated review likes (opt-in).

**Brainstorm lock-in:** Scope **C**; achievements **B** (badges only, drop `achievement.unlocked` inbox); comments **B** (review owner + reply target); mentions **defer**; import **dedicated** `import.completed` (no duplicate badge ping on import run); likes **mutual** when enabled (default off).

**Spec:** `docs/superpowers/specs/2026-05-29-sense-notification-quality-design.md` — **approved + implemented** 2026-05-29.

**Shipped (Executor):** `notification-delivery.ts` + tests; all producers migrated; `achievement.unlocked` inbox removed; `comment.on_review` / `comment.replied` + Reply UI; `import.completed` + `suppressInbox` on import badge; `review.liked` mutual-gated; Settings **Notifications** section; inbox/dropdown icons + href hints.

**Project Status Board:**

- [x] SN.9.0 Planner brainstorm + design doc
- [x] SN.9.1 Implementation (policy + settings + comment/import/like)
- [x] SN.9.2 Human QA — **`ok`** (2026-05-29): notification policy + review deep links (`/movies/:id?review=`) verified
- [x] SN.9.2b Review notification deep link — movie detail + review sheet; legacy `/reviews/:id` redirect; restored `profileTasteCompareFromSearch`

### 2026-05-29 — Sense Tier 1: list quality (Executor — SN.10)

**Shipped:** `list-quality` helpers; Community list ordering prefers described public lists; `PATCH /api/lists/:id/items/item/:itemId` for per-title notes; list detail shows/edits annotations (`ListItemNoteControl`); public-list description hints in create/edit + owner discoverability nudge; list OG metadata uses description.

**Project Status Board:**

- [x] SN.10.1 Implementation
- [x] SN.10.2 Human QA — public list description hint; add note on list detail; Community lists favor described lists
- [x] SN.10 note UI — editorial display + canvas pill editor (`list-item-note-display`, redesigned `list-item-note-control`)

### 2026-05-29 — Sense Tier 1: creator recognition v1 (Executor — SN.11)

**Shipped:** `creator-recognition` lib + tests; Community `/reviews/recent` + discover feed rank by engagement (likes·2 + comments·3); `GET /api/profiles/curators/spotlight`; profile `creator` field + **Curator** pill; **Curators on Sense** row on Community → Lists; reviews tab hint copy.

**Project Status Board:**

- [x] SN.11.1 Implementation
- [x] SN.11.2 Human QA — **`ok`** (2026-05-29): centered curator row; list poster likes; Community Lists/Reviews
- **Local sparse DB:** `NODE_ENV=development` uses relaxed SN.11 thresholds (1 described public list qualifies); set `CREATOR_RECOGNITION_STRICT=true` to rehearse production gates. No demo seed — use real lists you create.

**Executor 2026-05-29 (Agentation — Community Lists):** Centered **Curators on Sense** row when few patrons (`w-max` inner list + outer `justify-center`); **list poster wall** shows title count + heart + like count on bottom scrim for all tiles (cover and no-cover). Files: `home-curator-spotlights.tsx`, `list-lobby-poster.tsx`, `lists-lobby-order.ts` (`likesCount` on `ListLobbySeed`).

**Human / Planner:** SN.11.2 signed off **`ok`** (2026-05-29).

**Tier 3 status:** SN.13–SN.17 **code-complete** (2026-05-29); SN.17.1b OAuth **deferred**. **Post–Tier 3:** launch readiness (**LR.1–LR.2**) + open human QA gates.

---

## Sense Tier 2 — Months 3–6 (Planner 2026-05-29)

**Spec:** `docs/superpowers/specs/2026-05-29-sense-tier-2-design.md`  
**Strategy loops:** Loop 3 (SEO lists), Loop 4 (feed divergence), Tier 4 identity (activity signature, pinned reviews).

**Build order (Executor: one board row at a time; human `ok` per wave):**

| Wave  | Track    | Focus                                                      |
| ----- | -------- | ---------------------------------------------------------- |
| **A** | **ST.1** | Public SEO list pages — **done** (`ok` 2026-05-29)         |
| **B** | **ST.2** | Profile activity signature (diary heatmap, 52 weeks)       |
| **C** | **ST.3** | Pinned signature reviews (max 3)                           |
| **D** | **ST.4** | Taste-matched discovery v1 (rule-based rail)               |
| **E** | **ST.5** | Feed divergence rows                                       |
| —     | defer    | Director deep-dives (**ST.6**); curator analytics → Tier 3 |

### Project Status Board — Tier 2

- [x] **ST.1.1** API — `canViewList` + `GET /api/lists/:id` + `GET /:id/cover-image` return 404 for private lists unless owner (`list-view-access.ts`, route tests)
- [x] **ST.1.2** Web — `/l/[id]` public list (no auth shell); read-only detail; sign-in CTAs; share copies `/l/`; signed-in → `/lists/[id]` redirect
- [x] **ST.1.3** SEO — `app/sitemap.ts`, `app/robots.ts`, `GET /api/lists/sitemap` (public + described + non-system lists)
- [x] **ST.1.4** Human QA — **`ok`** (2026-05-29): `/l/…`, sitemap, robots, private 404
- [x] **ST.2.1** Activity signature — `buildActivitySignature`, `GET /api/profiles/:handle/activity-signature`, `ProfileActivitySignature` on profile header
- [x] **ST.2.2** Human QA — **`ok`** (2026-05-29): heatmap shows active days; weekday labels pinned left; auto-scroll to recent weeks
- [x] **ST.3.1** Pinned reviews — migration `0013`, `pinned_review_ids`, `PATCH /api/profiles/me/pins`, `pinnedReviews` on `GET /:handle`, hero strip + review sheet pin
- [x] **ST.3.2** Human QA — **`ok`** (2026-05-29): pin/unpin, max 3, profile strip, visitor view
- [x] **ST.4.1** Taste-matched discovery v1 — `buildTasteMatchedDiscovery`, `GET /api/taste/for-you`, `HomeTasteMatchedRail` on `/home` when `browse=movies` + signed in
- [x] **ST.4.2** Human QA — **`ok`** (2026-05-29): RSC prefetch + shimmer skeleton + `CataloguePosterTile` radial on rail
- [x] **ST.5.1** Feed divergence rows — `pickFeedRatingDivergence` / `findFeedRatingDivergence`, inject `kind: divergence` on `GET /api/feed`, `ActivityDivergenceRow` + **Weigh in** (Quick Log)
- [ ] **ST.5.2** Human QA — **paused** (2026-05-29): hard to seed 3-account follow + Δ≥4 setup; code shipped + feed refetch/period fixes; resume when needed

**ST.1 signed off** **`ok`** (2026-05-29) — API privacy, `/l/[id]` public pages, sitemap + robots.

**ST.2 signed off** **`ok`** (2026-05-29) — client fetch, pinned weekday labels, auto-scroll to recent weeks, contrast fix.

**ST.3 signed off** **`ok`** (2026-05-29) — pinned signature reviews (max 3), profile strip, review sheet pin control.

**Executor (ST.3.1 — 2026-05-29):** `0013_profile_pinned_review_ids.sql`; `PATCH /api/profiles/me/pins`; `pinnedReviews` on profile GET; `ProfilePinnedReviewsStrip`; **Pin to profile** in review reader.

**Executor (ST.4.1 — 2026-05-29):** `apps/server/src/lib/taste-matched-discovery.ts` (≥10 **movie** logs, ≥6 unseen matches, genre/decade/language scoring vs popular cached pool); `GET /api/taste/for-you` (auth + rate limit); `HomeTasteMatchedRail` on Movies lobby (title **Because you gravitate toward …**); cold-start returns null (no rail). Tests: threshold + rail title helpers.

**ST.4 signed off** **`ok`** (2026-05-29) — polish: `/home` RSC parallel `for-you` + `initial` prop; `HomeTasteMatchedRailSkeleton` (`ShimmerBone`); `CataloguePosterTile` `surface="home"` for radial. Fix: `HomeCatalogSortChips` `catalogBrowse` prop (community chips outside provider).

**Executor (ST.5.1 — 2026-05-29):** `feed-rating-divergence.ts` (Δ ≥ 4.0 among ≥2 followed patrons on same title); one row spliced into signed-in `GET /api/feed` at index 3; `ActivityDivergenceRow` on Community **Activity** tab; **Weigh in** opens Quick Log. Tests: `feed-rating-divergence.test.ts`. **Awaiting ST.5.2 human QA.**

**ST.5.2 manual QA checklist (2026-05-29):**

1. **Setup:** Signed in; follow **≥2** patrons; each has a **rated** log on the **same** film/TV with spread **≥ 4.0** on the 0–10 scale (e.g. 3.0 vs 8.0). Use **All time** period first (`/home?browse=community&feed=activity&period=all`).
2. **Row appears:** Community → **Activity** — look for **“Your circle split on this one”** near the top (~4th slot after splice). Poster right, flat `bg-background` row (no border).
3. **Copy:** Two **@handle** links, scores like **3.0** / **8.0** (not tenths), **(Δ 5.0)** or similar; title links to movie/TV detail.
4. **Weigh in:** Opens Quick Log for that title (film or TV id correct).
5. **Open title:** Navigates to `/movies/[id]` or `/tv/[id]`.
6. **Negative:** &lt;2 follows → no divergence row. Spread &lt;4 on every shared title → no row. Signed out → discover feed only (no divergence).
7. **Period:** Switch **Week** — row only if both patrons’ latest logs on that title fall in the week window (`item.at` filter).

**Automated pre-check:** `bun test apps/server/src/lib/feed-rating-divergence.test.ts` — 5 pass.

**Executor (2026-05-29 — profile/list scores + Activity feed fixes):** `patron-log-poster-caption.ts`, list `ownerLog`, ranked list scrim labels; Community Activity client `/api/feed` refetch + divergence exempt from period filter; fixed `coerceActivityTimestamp` import + AbortError on feed abort.

**Executor (2026-05-29 — list cover 404):** `listPosterDisplayUrl` / `listBoardRowPosterUrl`; blob paths no longer prefixed with `image.tmdb.org`; Activity `ListActivity` + `FeedListingThumb` proxy `unoptimized`; profile list tile + search dialog aligned. Tests: `list-cover-image.test.ts` (3 pass). **Human `ok`** (2026-05-29).

### 2026-05-29 — Strategy plan closure + Phase 0 metrics (Planner + Executor)

**Strategy map (`sense-media-platform-strategy.md` §9):**

| Tier              | Status            | Notes                                                                                                          |
| ----------------- | ----------------- | -------------------------------------------------------------------------------------------------------------- |
| **0** Launch      | **Code-complete** | Taste signature, import, onboarding v2, editorial, OG taste card, instant home nav                             |
| **1** 90 days     | **Code-complete** | SN.4–SN.11 shipped; human QA mostly `ok`                                                                       |
| **2** Months 3–6  | **Code-complete** | ST.1–ST.5.1 shipped; **ST.5.2** QA paused (seed difficulty)                                                    |
| **3** Months 6–12 | **Planned**       | [2026-05-29-sense-tier-3-design.md](../docs/superpowers/specs/2026-05-29-sense-tier-3-design.md) — SN.13–SN.17 |

**Phase 0 exit gap closed:** retention funnel instrumentation — migration `0014_product_event`, `recordProductEvent`, `POST /api/product-events`, SQL guide [2026-05-29-sense-product-metrics.md](../docs/superpowers/specs/2026-05-29-sense-product-metrics.md).

- [x] **SN.12.1** `product_event` schema + migration 0014
- [x] **SN.12.2** Server hooks: import complete, first log, onboarding `markOnboarded`
- [x] **SN.12.3** Client: taste card share → `trackSenseProductEvent`
- [x] **SN.12.4** Tests: `product-event-kinds.test.ts` (3 pass)
- [ ] **SN.12.5** Human: run `bun run db:migrate`; verify rows in `product_event` after import / first log / share

**Tier 2 formal status:** Implementation arc **complete**; **ST.5.2** remains optional manual QA (divergence row). **ST.6** director deep-dives deferred per tier-2 design.

### 2026-05-29 — SN.13 Creator analytics v1 (Executor)

- [x] **SN.13.1** `fetchCreatorAnalyticsForUser` + `GET /api/profiles/me/creator-analytics`
- [x] **SN.13.2** `AchievementsCreatorAnalyticsCard` + `useCreatorAnalytics` (curators only; hidden otherwise)
- [x] **SN.13.3** Eligibility covered by `creator-recognition.test.ts` (`qualifiesAsCurator`)
- [x] **SN.13.4** Human QA — **`ok`** (2026-05-29): **Curator reach** on `/achievements`; non-curator hidden

**Executor (2026-05-29 — Letterboxd import UX):** Step-by-step export guide, file checklist, drag/drop, diary.csv gate, last-import summary. **Human `ok`** (continue).

**SN.13 signed off** **`ok`** (2026-05-29) — Tier 3 wave A complete.

### 2026-05-29 — SN.14 Profile themes (Pro) (Executor)

- [x] **SN.14.1** Pro palettes **Ember** + **Midnight** (`theme-ember`, `theme-midnight`) in web/server registries + `globals.css`
- [x] **SN.14.2** `profileAccent` + `bannerFrame` prefs; `sanitizeAppearancePreferences` Pro gate; PATCH mirrors accent → `accentColor`
- [x] **SN.14.3** Settings **Appearance**: theme swatches (Pro badge), accent + banner frame pickers; account menu hides Pro themes when `!isPro`
- [x] **SN.14.4** `resolveAppThemeForPatron`; `AppThemeShell` + layout pass `isPro`; public profile reads `bannerFrame` from `profile.preferences`
- [x] **SN.14.5** Tests: `profile-appearance.test.ts`, `app-themes.test.ts` (`resolveAppThemeForPatron`)
- [ ] **SN.14.6** Human QA: set `profile.is_pro = true` in DB (or billing hook when wired); save Ember + accent + Cinema frame; visit `/@handle` as another user

### 2026-05-29 — Sense theme display names Set A (Executor)

- [x] Labels: **Calm · Lucid · Pensive · Cozy · Dreamy** (`app-themes.ts`); account menu uses `def.label`; Settings copy updated
- [x] Spec: [2026-05-29-sense-theme-display-names-design.md](../docs/superpowers/specs/2026-05-29-sense-theme-display-names-design.md)
- [x] Tests: `app-themes.test.ts` label assertions (5 pass)

### 2026-05-29 — SN.15 Collaborative lists (Executor, complete)

- [x] **SN.15.1** Migration `0015_list_collaborator` + `list_collaborator` schema
- [x] **SN.15.2** `canEditList` — only owner or invited patrons (fixes open `is_collaborative` hole)
- [x] **SN.15.3** `POST/DELETE /api/lists/:id/collaborators` invite by @handle
- [x] **SN.15.4** List detail + `/l/[id]` byline; owner **Collaborators** invite UI; `viewerCanEdit` for reorder/notes
- [x] **SN.15.4b** `lists.test.ts` mocks: `profile` on `@still/db`, `list-owner-log-scores`; regression test — `is_collaborative` alone does not grant reorder
- [x] **SN.15.5** Human QA — collaborative lists + shared lists lobby verified

### 2026-05-29 — SN.16 Advanced taste matching (Executor, code complete)

- [x] **SN.16.1** `GET /api/taste/suggested-patrons` — overlap rank, shared genre phrase, excludes following
- [x] **SN.16.2** ⌘K empty People rail — **Taste matches** + **From your network** sections
- [~] **SN.16.3** Human QA **skipped** — sparse local user graph; re-test when staging has overlapping diaries

**Next (pick one for Executor `go`):** **LR.1 QA** · **LR.2** launch QA · **HB.4.1** · **RL.7** · **TR.8** · **ST.5.2**

### SN.17 — Anime depth (Wave E) — spec approved

**Spec:** `docs/superpowers/specs/2026-05-29-sense-tier-3-anilist-design.md`  
**Plan (Phase A):** `docs/superpowers/plans/2026-05-29-sense-anilist-import.md`

- [x] **SN.17.1** Anilist JSON import — diary + `tv_watch` + watchlist — **code shipped** (2026-05-29)
- [x] **SN.17.1 QA** — human **`ok`** (2026-05-29): diary Movies/TV pills, 500-log fetch, re-import backfill verified
- [x] **SN.17.2** Seasonal anime browse — **code shipped** (2026-05-29): `/home?browse=tv&animeSeason=1`, **This season** chip on left rail (Latest · Popular · This season)
- [x] **SN.17.2 QA** — human **`ok`** (2026-05-29): chip placement left rail, seasonal grid verified
- [x] **SN.17.3** MAL enrichment on TV detail — **code shipped** (2026-05-29): Jikan `/anime/{id}` with 7d `_stillMal` cache on `tv.tmdbJson`; `malEnrichment` on `GET /api/tv/:id`; About line via `TvDetailMalMeta` (hidden when no MAL id / fetch fail)
- [x] **SN.17.3 QA** — human **`ok`** (2026-05-29): MAL line on imported anime About tab verified
- [ ] **SN.17.1b** Anilist OAuth — **deferred** (2026-05-29, user): JSON upload sufficient for now; revisit when import volume / support burden justifies OAuth

### Post–Tier 3 — Launch readiness & strategy continuation (Planner 2026-05-29)

**Tier 3 implementation arc (SN.13–SN.17) is code-complete.** Anilist OAuth (**SN.17.1b**) is explicitly **out of scope until demand**.

**Strategy source:** [sense-media-platform-strategy.md](../sense-media-platform-strategy.md) §15 closing directive + [2026-05-29-sense-product-roadmap-design.md](../docs/superpowers/specs/2026-05-29-sense-product-roadmap-design.md) rollout waves **1b → Launch**.

**Recommended build order (Executor: one row at a time; human `ok` per wave):**

| Wave      | ID                  | Focus                                     | Why now                                                                                                        |
| --------- | ------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **A**     | **LR.1**            | **Sense patron rebrand sweep**            | Launch gate #6 — residual “Still” in patron UI (nav aria, toasts, community copy, credits footer, share stubs) |
| **B**     | **LR.2**            | **Launch gate QA pass**                   | Roadmap checklist: onboarding → import → editorial → taste card → log &lt;30s → home instant nav               |
| **C**     | —                   | **Human QA backlog**                      | **HB.4.1** Community ranks · **RL.7** ranked lists · **TR.8** TV rewatch · **ST.5.2** divergence (optional)    |
| **D**     | **SN.12.5**         | **Product metrics verification**          | `0014_product_event` — import / first log / taste share events in DB                                           |
| **E**     | **SN.14.6**         | **Pro themes QA**                         | Ember/Midnight + accent + banner frame on public profile                                                       |
| **Defer** | **ST.6**            | Director / creator deep-dives             | Tier 2 carry; after launch or taste discovery v2                                                               |
| **Defer** | **Monetization**    | Billing + list cap + streak shields (Pro) | Strategy §12 — after launch gate                                                                               |
| **Defer** | **Internal rename** | `@still/*` → `@sense/*`                   | Roadmap phased C month 1 post-launch                                                                           |

### Project Status Board — Launch readiness (LR)

- [x] **LR.1** Patron-facing **Sense** rebrand sweep — **code shipped** (2026-05-29): `APP_NAME` / `APP_MEMBER_LABEL` / `APP_COMMUNITY_AVERAGE_LABEL` in `app-brand.ts`; ~30 patron surfaces updated (nav, auth, marketing, detail, community copy). **Email domain** `hello@still.app` unchanged until domain cutover.
- [ ] **LR.1 QA** — human: no “Still” in signed-in UI, auth, marketing, movie/TV detail, account menu
- [x] **LR.2 prep** — production build green + automated taste/import/rebrand tests pass (refreshed **2026-07-06** after Polar/settings type fixes)
- [x] **LR.2** Launch gate QA — roadmap §Testing “Launch blockers QA” (7 scenarios — human **`ok`** 2026-07-06)
- [ ] **SN.12.5** Human: `bun run db:migrate`; verify `product_event` rows
- [ ] **SN.14.6** Human: Pro themes on profile (needs `is_pro` in DB)

**Next (pick one for Executor `go`):** **LR.1** rebrand sweep (recommended first) · **LR.2** launch QA doc · **HB.4.1** · **RL.7** · **TR.8**

### ⌘K tag search fix (Track B) — plan ready

**Spec:** `docs/superpowers/specs/2026-05-29-cmdk-tag-search-design.md`  
**Plan:** `docs/superpowers/plans/2026-05-29-cmdk-tag-search.md`

- [x] **B.cmdk.1** Server: `with_text_query` on movie/TV discover — `tmdb.ts`, `movies.ts`/`tv.ts` `?q=`
- [x] **B.cmdk.2** Client: hook strict AND + `effectiveListingKind` — `catalogue-tag-search-plan.ts`, `use-catalogue-tag-search.ts`, `home-sticky-search.tsx`, `still-api-fetch.ts`, `deriveCatalogueFilterBundle(..., override)`
- [x] **B.cmdk.3** Tests + manual ⌘K Anime/Films/TV QA → human **`ok`** (2026-05-29)

**Executor (2026-05-29):** SN.17.1 implemented — `POST /api/import/anilist`, parsers/adapters, TMDb TV match, apply watchlist/tv_watch/logs, Settings **Import from Anilist** panel. Tests: 16 pass (server). Manual QA: upload `anilist-sample.json` or AniPort export; verify diary + Watching + watchlist.

**Executor (2026-05-29, match fix):** All-unmatched imports — parser ignored `title.userPreferred`, string titles, and flat `mediaId` rows; resolver only tried one English query. Fixed tiered search (userPreferred → english → romaji → native), anime-aware TMDb pick, cached `_stillAnilist` reuse. **Re-import** same JSON.

**Executor (2026-05-29, visibility):** Profile/diary only read `log` rows — in-progress Anilist statuses lived in `tv_watch` only. **`ensureImportedShowLog`** backfills show-scope diary logs when missing (re-import safe). Import counters: `watchesUpdated` vs duplicate JSON rows.

**Executor (2026-05-29, diary UX):** **`GET /api/logs/me`** cap raised **200 → 500** (matches profile filmography) — bulk Anilist import had pushed older **movie** logs off the default diary fetch. **`/diary`** center pills **Movies · TV Shows** (`?tab=movies|tv`) — same 3-column chrome as profile (order | media tab | venue). Files: `diary-lobby-chrome.tsx`, `diary-media-tab-toolbar.tsx`, `diary-lobby-order.ts`, `fetch-my-logs-me-server.ts`, `logs.ts`.

**SN.17.1 QA checklist (human):**

1. Settings → re-import Anilist JSON → **Diary logs** count rises for shows missing before.
2. **`/diary?tab=movies`** — older films visible again (not buried by TV import).
3. **`/diary?tab=tv`** — imported anime; **At home** venue chip.
4. Profile **TV** tab mirrors TV diary rows.

Reply **`ok`** when signed off, or report counts / missing titles.

**Executor (2026-05-29, SN.17.2):** TV **This season** chip on `/home?browse=tv` — `?animeSeason=1` drives TMDb discover (genre **16**, **returning**, `first_air_date.gte` rolling **90d**). Helpers in `home-anime-season.ts`; lobby persist + infinite scroll wired. Tests: `home-anime-season.test.ts`, `home-lobby-url.test.ts`. **QA:** Home → **TV** → tap **This season** → animation grid loads; toggle **Popular/Latest** reorders; other run chips clear seasonal slice.

**Executor (2026-05-29, SN.17.3):** MAL enrichment — `mal-anime-enrichment.ts` + `tv-mal-id.ts`; Jikan fetch with 7d `_stillMal` cache on `tv.tmdbJson`; `malEnrichment` field on `GET /api/tv/:id`; `TvDetailMalMeta` one-line About copy (not hero). MAL id sources: Anilist import `_stillAnilist.idMal`, `_stillMal.malId`, TMDb `external_ids.mal_id`. Tests: 7 server + 2 web pass. **QA:** open an imported anime on `/tv/[id]` → About tab → line like `MAL · 8.32 · #400 ranked · Finished Airing`; non-anime / no MAL id → no line.

**Executor (2026-05-29, LR.1):** Patron **Sense** rebrand — extended `app-brand.ts` with `APP_MEMBER_LABEL` + `APP_COMMUNITY_AVERAGE_LABEL`; updated nav, auth, marketing, detail community copy, credits footers, marquee, share stub. Grep `apps/web`: zero `\bStill\b` remaining. Support email stays `hello@still.app` until domain cutover. **QA:** spot-check sign-in/up, `/home` error states, movie detail “Sense average”, marketing footer.

**Executor (2026-06-01, remove watched):** Quick Log **edit mode** — **Remove from watched** (destructive link) → confirm dialog → `DELETE /api/logs/:id`; refreshes diary, profile, movie/TV detail. **QA:** Edit log from diary radial or movie detail pencil → Remove → confirm.

**Executor (2026-06-01, detail community):** Movie + TV detail **Community** — `GET /api/movies|tv/:id/following-ratings` (followed patrons’ latest diary score/favorite); `lists` responses include `ownerHandle`; compact **From people you follow** avatar row (option A); list cards show **by @handle** (title → list, handle → profile). TV streams via `TvDetailCommunityAsync` + Suspense. Tests: `movie-following-ratings.test.ts` pass. **QA:** signed-in movie/TV detail with followed patrons who logged the title; list bylines link correctly.

**Executor (2026-06-05, profile tab chip):** Fixed tab pill re-animating after catalogue RSC load (Movies -> TV / Lists / Favorites / Reviews). Root cause: inline `function Chip` inside `ProfileTabToolbar` remounted on every parent re-render, replaying `layoutId` motion. Fix: module-level `ProfileTabChip` + `LayoutGroup` wrapper. **QA:** `/profile/[handle]` — tap **TV Shows**, **Lists**, etc.; pill should slide once on tap, not snap/reposition when grid loads.

**Executor (2026-06-05, adult content settings):** Implemented **Settings → Catalogue → Show adult content** (default off). Server policy + TMDb `include_adult` + Jikan Rx/Hentai classification (`tv.adult`, migration `0018_tv_adult.sql`); catalogue/search/diary/watchlist/lists/profile filtering; movie/TV detail returns blocked shell when pref off; web enable dialog (DOB ≥18 not saved + legal checkbox). Spec/plan: `docs/superpowers/specs/2026-06-05-adult-content-settings-design.md`, `docs/superpowers/plans/2026-06-05-adult-content-settings.md`. Build green; 24 unit tests pass. **Fix:** `AdultContentBlockedState` uses `Link` + `buttonVariants` (local Button has no `asChild`). **Pending human QA:** run migration on dev DB; verify blocked detail URL, enable/disable toggle, search/catalogue hide/show.

**Executor (2026-06-05, profile birthdate):** Shipped **profile.birth_date** (migration `0019_profile_birth_date.sql`) + **Show birthday on profile** pref. Settings → Profile: `BirthDatePicker` + public toggle; Catalogue adult toggle skips enable dialog when saved DOB ≥18; dialog saves DOB + enables adult content in one PATCH. Public profile shows month/day via `birthdayDisplay` in about meta. Spec/plan: `docs/superpowers/specs/2026-06-05-profile-birthdate-design.md`, `docs/superpowers/plans/2026-06-05-profile-birthdate.md`. Tests: server birth-date + age-gate (9), web age-gate + prefs (13) pass; `apps/web` build green; `graphify update .` run. **Pending human QA:** run **`bun run db:migrate`** (0019); verify DOB save/reload, public birthday toggle, adult skip-dialog, under-18 rejection, cannot clear DOB while adult on.

**Executor (2026-06-06, home catalog filters popover):** Movies `/home` — slider icon opens in-place filter popover (genre, watch type on **At home**, sort refinements on Popular/Latest); URL params `genre`, `monetization`, `discoverSort`; cookie/persist restore; Popular + In cinemas + genre switches to discover seed fetch. TV/diary/watchlist keep slider link (v1.1). Spec/plan: `docs/superpowers/specs/2026-06-06-home-catalog-filters-popover-design.md`, `docs/superpowers/plans/2026-06-06-home-catalog-filters-popover.md`. **Verify (Executor):** `bun test src/lib/home-catalog-filters.test.ts` → **9 pass**; `bun run build` in `apps/web` → green; `graphify update .` run. **Fix:** `PopoverTrigger` typing — pass `trigger: ReactElement` instead of `children: ReactNode`. **Pending human QA:** `/home?sort=popular&venue=theaters` → open popover → pick genre → URL + grid update; At home → monetization → switch to In cinemas strips monetization; Top rated / A–Z on Popular/Latest; Clear filters; active dot on slider; committed search still shows Clear search only.

**Executor (2026-06-09, staff user-info Tasks 12–17):** Web UI for staff user detail shipped — shared `staff-error-message.ts`; expandable `StaffUsersTab` rows → `StaffUserDetail` (profile summary, role permission chips, Pro toggle, edit form, notes, impersonate); `ImpersonationBanner` wired in `(app)/layout.tsx` via `session.impersonatedBy`. Spec/plan: `docs/superpowers/specs/2026-06-08-staff-user-info-and-management-design.md`, `docs/superpowers/plans/2026-06-08-staff-user-info-and-management.md`. **Verify (Executor):** `cd apps/server && bun test` → **482 pass**; `cd packages/auth && bun test` → **15 pass**; web `tsc` — no errors in new staff files (baseline test-file errors unchanged). **Human QA (Task 18):** **ok** (2026-06-09) — impersonation verified (incl. admin-role targets after `impersonate-admins` + Set-Cookie forward fixes).

**Executor (2026-06-09, impersonate fix):** Impersonation failed — better-auth admin plugin requires `session.impersonatedBy` in the Drizzle schema (not auto-generated for Drizzle). Added `impersonated_by` column (`0026_session_impersonated_by.sql` + `packages/db/src/schema/auth.ts`); `bun run db:migrate` applied. **Lesson:** when enabling admin-plugin impersonation, manually add `impersonatedBy` to `session` — CLI `generate` skips plugin fields for Drizzle.

**Executor (2026-06-09, impersonate cookies):** Impersonate returned 200 + redirected to `/home` but session never swapped — `auth.api.impersonateUser` sets cookies on an internal `Headers` object; wrapping it in a custom Elysia route dropped `Set-Cookie`. Fix: call with `returnHeaders: true` and forward via `forward-auth-set-cookies.ts` on both impersonate + stop-impersonating. **Lesson:** any custom route that calls `auth.api.*` session mutators must forward `returnHeaders` Set-Cookie values to the browser.

**Executor (2026-06-09, impersonate admin target):** Owner could not impersonate users with role `admin`/`owner` — better-auth blocks impersonating `adminRoles` accounts unless the actor holds `user:impersonate-admins`. Added `impersonate-admins` to AC statement + Owner bundle only (`packages/auth/src/permissions.ts`).

**Executor (2026-06-13, taste rail watchlist exclusion):** Spec `docs/superpowers/specs/2026-06-13-taste-rail-watchlist-exclusion-design.md`. Server: `fetchWatchlistMovieTmdbIds` + `buildTasteMatchExcludeIds` merged into `scoreTasteMatchCandidatesForUser` exclude pool. Client: `handleTitleConsumed` (log + watchlist add backfill); taste-rail watchlist add calls `onActionComplete` explicitly. Tests: `taste-watchlist-exclusion.test.ts` **2 pass**. **Pending human QA:** `/home?browse=movies` — watchlisted titles absent from taste rail; RMB → Add to watchlist removes tile + backfills; main catalogue grid unchanged.

**Executor (2026-06-14, favorite quotes — Task 1):** Spec approved `docs/superpowers/specs/2026-06-14-favorite-quotes-design.md`; plan `docs/superpowers/plans/2026-06-14-favorite-quotes.md`. Shipped migration **`0032_listing_quotes`** (`listing_quote`, `listing_quote_upvote`, `listing_quote_save`, `quote_submission` + enums); Drizzle `packages/db/src/schema/quote.ts`; journaled; **`bun run db:migrate`** OK. **Next:** Task 2 server helpers + tests — reply **`go`** to continue.

**Executor (2026-06-14, favorite quotes — Task 2):** `apps/server/src/lib/listing-quote.ts` — body/speaker validation, movie/TV scope, timestamp format/parse, sort/limit parsers, `toListingQuoteItem` DTO mapper. Tests: `listing-quote.test.ts` **17 pass**. **Next:** Task 3 quotes API routes — reply **`go`** to continue.

**Executor (2026-06-14, favorite quotes — Task 3):** Quotes catalog + engagement API. `listing-quotes-query.ts` — fetch movie/TV pages (sort `upvotes|newest`, `hasMore` pagination), viewer upvote/save flags, toggle upvote, save/patch/delete bookmark. Routes: `quotes.ts` (`GET /api/quotes/:id`, `POST …/upvote`, `POST …/save`, `PATCH|DELETE /api/quotes/saves/:id`); nested `GET /api/movies/:id/quotes`, `GET /api/tv/:id/quotes?season=&episode=` (400 when missing); registered in `app.ts`. Tests: `listing-quotes-query.test.ts` **6 pass**, `quotes.test.ts` **7 pass** (31 total with Task 2 helpers). **Next:** Task 4 submit + staff moderation — reply **`go`** to continue.

**Executor (2026-06-14, favorite quotes — Task 4):** Patron submit + staff moderation + notifications. `quote-submission.ts` — parse/validate submit payload, create pending row, staff list/approve/reject, catalog insert on approve (`source: patron`), `quoteSubmissionNotificationHref`. Routes on `quotes.ts`: `POST /api/quotes/submit` (5/24h rate limit), `GET /api/quotes/submissions`, `POST …/approve`, `POST …/reject` (`requireStaff`). Notification kinds `quote.submission.approved|rejected` in registry + inbox href fallback for approved. Tests: `quote-submission.test.ts` **4 pass**, `quotes.test.ts` **12 pass**, `notification-delivery.test.ts` updated. **Next:** Task 5 product events + saved quotes API — reply **`go`** to continue.

**Executor (2026-06-14, favorite quotes — Task 5):** Product events + saved quotes API. Kinds `quote.upvote|save|unsave|submit` in server + web `product-event-kinds.ts`; wired in `quotes.ts` on toggle/save/unsave/submit. `listing-quote-saves-query.ts` — paginated lobby payload (quote + listing thumb, filters `kind` + `visibility`). `GET /api/me/quotes/saved` on `me-data.ts`; `GET /api/profiles/:handle/quotes` (public saves, 404 private profile). Tests: `listing-quote-saves-query.test.ts` **4 pass**, `product-event-kinds.test.ts` updated. **Pending human QA:** save quotes → `/api/me/quotes/saved`; public saves on profile handle. **Next:** Task 6 detail four-tab IA — reply **`go`** to continue.

**Executor (2026-06-14, favorite quotes — Task 6):** Detail IA — four top tabs **About · Streaming · Community · Quotes**. `movie-detail-top-bar.tsx` — original `bg-card` sliding pill track (not SegmentedPillToolbar). Related catalogue stays on **About**; Community is reviews/lists only. Notification deep links → `?view=quotes`. Community rating hero fix — API average is 0–10 display scale (no double `/10`). Tests: `movie-detail-view.test.ts` **9 pass**. **Pending human QA:** tab order + related on About. **Next:** Task 7 quotes tab UI — reply **`go`** to continue.

**Executor (2026-06-14, favorite quotes — Task 7):** Quotes tab UI + suggest sheet. `movie-detail-quotes-panel.tsx` — fetch `GET .../quotes`, TV season/episode picker + URL sync, empty state + footer CTA. `quote-row.tsx` — body/speaker/timestamp, upvote toggle (`t-digit-group` pop-in), save bookmark (`t-icon-swap`). `quote-suggest-sheet.tsx` — DetailVaulSheet form → `POST /api/quotes/submit`. `quote-timestamp.ts` + test **6 pass**. Wired on movie + TV detail pages (stub removed). **Pending human QA:** Quotes tab list/upvote/save; suggest sheet submit (signed in); TV episode scope + URL. **Next:** Task 8 `/quotes` lobby + profile strip — reply **`go`** to continue.

**Executor (2026-06-14, favorite quotes — Task 7 polish):** Fixed duplicate **Suggest a quote** when empty (footer CTA only when `items.length > 0`). Redesigned `quote-suggest-sheet.tsx` to match create-list / review composer chrome (`DetailDrawerScrollBody`, scroll scrims, centered labels, `SHEET_FIELD_*`, Cancel + primary pill footer). `QuoteSuggestCta` — `DetailMotionButtonWrap`, primary pill in empty state, card pill when list has rows. Empty state uses full-height centered layout. **Pending human QA:** empty Quotes tab shows one CTA; suggest sheet matches Quick Log / create-list feel.

**Executor (2026-06-14, favorite quotes — Task 8):** `/quotes` lobby — `HomeStickyChrome`, All · Films · Shows filter chips, saved list with poster/title/excerpt/visibility, infinite scroll via `GET /api/me/quotes/saved`. `ProfileSavedQuotesStrip` — up to 3 recent saves under showcase (public-only for visitors; owner sees visibility chips + **View all** → `/quotes`). `notification-href.ts` — quote approval deep links with `?view=quotes` (+ season/episode for TV). `/quotes` auth-gated in `proxy.ts`; mobile You sheet link. Tests: `quotes-lobby.test.ts`, `notification-href.test.ts`, `mobile-nav.test.ts` pass. **Pending human QA:** save quote → `/quotes` lobby; profile strip owner vs visitor; tap quote approval notification. **Next:** Task 9 staff panel + import — reply **`go`** to continue.

**Executor (2026-06-14, favorite quotes — Task 9):** Staff quotes on `/staff`. `StaffQuotesPanel` — **Queue** (pending submissions, approve/reject + optional note) and **Publish** (direct staff catalog insert, Film/Show + TMDb id + TV episode picker). `POST /api/quotes/staff` → `createStaffListingQuote` (`source: staff`, no submission row). Import adapter: `quote-provider.ts` (env `QUOTE_API_PROVIDER`, stub until licensed provider), `quote-import.ts` (upsert by `externalProvider`/`externalId`, `shouldProtectQuoteFromImportOverwrite` skips staff/patron). Exported `assertListingCached` from `quote-submission.ts`. Tests: `quote-import.test.ts` **4 pass**, `quotes.test.ts` staff route **2 new pass** (18 total in file). **Pending human QA:** staff Publish → visible on title Quotes tab; queue approve/reject; confirm patron lines stay `source: patron` after approve. **Next:** Task 10 verification + changelog — reply **`go`** to continue.

**Executor (2026-06-14, favorite quotes — Task 10):** Verification complete. Server quote suite **50 pass** (`listing-quote`, `listing-quotes-query`, `listing-quote-saves-query`, `quote-submission`, `quote-import`, `quotes` routes). Web **33 pass** (`quote-timestamp`, `quotes-lobby`, `notification-href`, `mobile-nav`, `movie-detail-view`). Changelog **0.2.8** `2026-06-14-favorite-quotes` + What's New slides bumped. Copy polish: suggest drawer button **Submit**, toast **Submitted for review**. **Pending human E2E:** submit quote → staff approve → notification → Quotes tab; save → `/quotes` lobby → profile strip; staff direct publish. **Favorite quotes plan Tasks 1–10 complete** — Planner sign-off on manual QA.

**Executor (2026-06-14, favorite quotes — external import):** MovieQuotes.rocks provider (`moviequotes-provider.ts`) — maps cached TMDb title → `?movie=` slug, paginates up to 5 pages, upserts `source: external_api`. Env: `QUOTE_API_PROVIDER=moviequotes`, `MOVIQUOTES_API_KEY`, `QUOTE_IMPORT_ENABLED=true`. Lazy import on first `GET /api/movies/:id/quotes` page 1; staff `POST /api/quotes/import` + **Import from provider** on `/staff` Publish tab. TV import deferred (provider is film-only). Get API key: https://moviequotes.rocks API docs form.

**Executor (2026-06-15, favorite quotes — post-QA polish):** **Quote attribution** — shared `QuoteAttribution` + `resolveQuoteAttribution`; speaker always shown when present (`— Character`), timestamp right-aligned mono when present; reverted brief hide of import-only speakers. **Detail 404 fix** — `requireListingDetailApiData` (`eden-api-error.ts`): transient API/503 → route `error.tsx` retry UI, not Next generic 404 (dev cold-start). Re-verification: server quote suite **57 pass**, web quote suite **41 pass**. **Human `ok` (2026-06-15):** manual E2E signed off — Favorite Quotes **shipped** (Tasks 1–10 + moviefamous import). Planner: mark spec/plan complete unless follow-ups requested (TV import, licensed timestamp provider).

**Executor (2026-06-15, Letterboxd pillars — Task 17):** Streaming alerts snapshot + diff job. Migration **`0033_watchlist_streaming_snapshot`** (`watchlist_streaming_snapshot` table); `watchlist-streaming-alerts.ts` — flatrate diff per patron `catalogTmdbWatchRegion`, baseline on first pass, `watchlist_now_streaming` notification + `streaming_alert.sent` product event, dedupe per title+provider; `readWatchlistStreamingAlertsPref` (default **true**, Task 18 Settings UI); daily job in `local.ts` (`WATCHLIST_STREAMING_ALERTS_ENABLED`, default on). Notification registry + inbox **Play** icon. Tests: `watchlist-streaming-alerts.test.ts` **11 pass**. **Pending human QA:** add title to watchlist with cached providers → run job twice (or wait 24h) → second pass after provider appears in TMDb cache should bell; toggle `preferences.watchlistStreamingAlerts: false` manually in DB until Task 18 — no notification. **Next:** Task 18 Settings toggle + watchlist **Now on {service}** pill — reply **`go`** to continue.

**Executor (2026-06-15, Letterboxd pillars — Task 18):** Settings + watchlist pill + Pro email. **Settings → Catalogue** toggle **Notify when watchlisted titles stream near me** (`preferences.watchlistStreamingAlerts`, default on). **Notifications** tab adds **Watchlist streaming** inbox kind (`watchlist_now_streaming`). **`GET /api/watchlist`** enriches each row with `streaming_provider_name` from cached TMDb flatrate in patron watch region; lobby maps to poster scrim **Now on {service}**. Pro patrons get Resend email on new availability (`buildWatchlistStreamingAlertEmailContent`, dev console fallback). Tests: server `watchlist-streaming-alerts.test.ts` **13 pass**; web `watchlist-streaming-display.test.ts` + `watchlist-lobby-order.test.ts` **4 pass**. **Pending human QA:** `/me/settings/catalogue` toggle saves + disables job notifications; `/watchlist` shows pill when title has flatrate in your region; Pro email in dev logs on second sync pass. **Next:** Task 19 motion polish — reply **`go`** to continue.

**Executor (2026-06-15, Letterboxd pillars — Task 19):** transitions.dev polish on new surfaces. **`profile-showcase-strip`** — `t-avatar-group` comb hover via shared `useAvatarGroupHover`. **`quick-log-celebration-strip`** — already shipped `t-digit` pop-in (no diff). **`reactions-bar`** — `t-icon-swap` on review like (header, sheet, inline). **`journal/[slug]`** — `JournalArticleReveal` + `t-panel-slide` on hero/body mount. **`year-in-review-page-content`** — `t-success-check` on Copy link. CSS in `packages/ui/src/styles/globals.css` (`t-panel-slide`, `t-success-check`, `.profile-showcase-strip` token overrides). **Pending human QA:** hover showcase posters on own profile; like a review in reader; open journal article; copy Wrapped link. **Next:** Task 20 catalogue stat line — reply **`go`** to continue.

**Executor (2026-06-15, Letterboxd pillars — Task 20):** Catalogue stat line on `/home` Movies/TV lobbies. **`GET /api/catalogue/stats`** — cached `movie` + `tv` row counts (`catalogue-stats.ts` server lib, `catalogue.ts` route). Web **`fetchCatalogueStatsServer`** — `revalidate: 86400`; **`formatCatalogueStatsLine`** — `{N} films · {M} shows in Sense`; **`HomeCatalogueStatLine`** under `HomeLobbyFilterRow` (hidden on Community + active catalogue search). Tests: web `catalogue-stats.test.ts` **2 pass**. **Pending human QA:** `/home?browse=movies` and `browse=tv` show quiet centered stat line below chips; line absent on Community. **Next:** Task 21 list discovery polish — reply **`go`** to continue.

**Executor (2026-06-15, home QA feedback):** Removed catalogue stat line entirely (user Agentation — **remove** on `/home?sort=latest`). Reverted Task 20 web + server surface. **`HomeTasteMatchedRail`** heading — `text-center` on **Because you gravitate toward…** h2.

**Executor (2026-06-15, Letterboxd pillars — Task 21):** List discovery polish (Pillars 4–5). **`GET /api/lists`** returns `{ items, total }` for Community period lobby. **`CommunityListsHeader`** — `{n} popular lists` above curator spotlights. List share toasts — **`Copied link · {title}`** (`list-share-toast.ts`) on detail top bars + lists lobby radial copy. Search people empty-state label **Patrons on Sense** (not “Suggested for you”). List detail hero title already **`text-balance font-semibold`** at hero scale — verified, no diff. Changelog **0.2.9** + What's New **`2026-06-15-list-discovery-polish`**. Tests: `community-lists-header.test.ts` + `list-share-toast.test.ts` **5 pass**. **Pending human QA:** `/home?browse=community&sort=lists` shows count header; copy list link shows title in toast; search People tab label. **Next:** Letterboxd pillars M6 polish complete — Planner sign-off on roadmap bundle.

**Executor (2026-06-15, taste rail QA):** Centered poster title captions (`text-center` on rail cells) + matching skeleton shimmer (`mx-auto`). Heading already centered from prior pass. Tests: polish + taste rail title helpers **7 pass**. **Roadmap:** no Task 22 — Executor idle until Planner names next track or **`ok`** on M6 bundle.

**Planner (2026-06-15):** Human **`ok`** — Letterboxd pillars roadmap **closed** (M5 Wrapped + M6 polish verified: Tasks 16–21 incl. streaming alerts, motion, list discovery, taste rail). Task 20 stat line remains **out** by design. **Next track (2026-06-15):** **LR.1** launch rebrand QA sweep — Executor on **`go`**.

**Executor (2026-06-15, LR.1):** Remaining patron-facing **Still** → **Sense** in staff role-change copy (web dialog + server notification). Added `apps/server/src/lib/app-brand.ts` (mirrors web). Tests: `role-change-dialog-copy.test.ts` + `role-change-notification.test.ts` pass. **Pending human QA:** promote a test user in staff panel → dialog + inbox say **Sense**; spot-check signed-in UI for stray **Still** (LR.1 QA checklist). **Next:** LR.1 human **`ok`** or **`go`** for LR.2 launch gate doc.

**Executor (2026-06-15, LR.2 prep):** **`bun run build` in `apps/web` — GREEN** after type fixes: `journal.ts` staff `viewer` narrow + `PATCH/DELETE` moved to `/api/journal/posts/:id` (disambiguate from `GET /:slug`); `home/page.tsx` legacy `memberSort` from `spRaw`; journal OG metadata spread order; onboarding profile types; quick-log celebration `movieId` narrow; onboarding preview `showFavorites`; quotes saved fetch via `fetchMySavedQuotes` (Eden lacks `/api/me/*` types); `ShowcaseItem` type in `profile-showcase.ts` (no `@still/db` in web); staff journal/quotes cast fixes. Automated gates: taste signature + Letterboxd import + rebrand copy tests **33 pass** (server 21 + web 12). **LR.2 human QA checklist (roadmap §Testing):**
1. **New account** — quick-rate → taste on profile → Community home not empty
2. **Letterboxd import 500+** — no dupes; signature updates; profile loads &lt;3s
3. **Zero follows** — editorial feed scrollable 30s+
4. **Taste card share** — OG personal; link opens profile
5. **Log flow** — search → rate → diary &lt;30s
6. **Sense branding** — no “Still” in patron UI (LR.1)
7. **Home nav** — Movies ↔ Community pill instant (no full-page freeze)

**Pending:** human runs checklist on dev (web **3001**, API **3000**). Reply **`ok`** per scenario or **`go`** for next track after QA.

**Executor (2026-07-01, home load perf):** `/home` Movies refresh blocked on slow `/api/taste/for-you` inside `HomeLobbyBody` `Promise.all` (taste scoring + up to 4× TMDb `movieImages` + community stats). **Fix:** `HomeTasteMatchedHeroRsc` in its own `Suspense` + skeleton so catalogue chips/grid stream without waiting on taste; `enrichTasteMatchMovies` now full-enriches **spotlight only** (index 0) — poster stack rows get backdrop only. **Pending human QA:** hard refresh `/home?browse=movies` — grid/chips should appear in ~2–4s; hero skeleton then fills; total wall-clock may still include hero stream but main lobby no longer blocked 10s+.

**Executor (2026-07-02, patron feedback — Task 10):** Changelog **0.3.1** `2026-07-02-patron-feedback` + What's New slides bumped. Test sweep: server patron-feedback **23/23**, web notification-href **7/7**, auth permissions **12/12** pass. `graphify update .` skipped — `graphify` not on PATH / `bunx graphify` has no executable on Windows (run locally when available). **Patron feedback plan Tasks 1–10 complete** — pending Planner/human sign-off on E2E QA. Commits through **`a611d26`** + Task 10 changelog commit pending.

**Executor (2026-07-05, subscriptions — Task 12):** Referral capture + qualification shipped. **Web:** `referral-cookie.ts`, `ReferralRefCapture` on `/sign-up?ref=`, sign-up form calls `POST /api/referrals/capture` after account creation. **Server:** `referral-capture.ts`, `referral-qualify.ts`, `referral-milestones.ts`, `referrals.ts` (`GET /me`, `POST /capture`, `POST /qualify`); hooks in `profiles.ts` on first `markOnboarded`; notification kinds `referral.qualified` + `referral.milestone`. Tests **17/17 pass**. **Manual QA:** (1) signed-in patron opens `GET /api/referrals/me` — referral link + milestones; (2) new account via `/sign-up?ref={code}` → verify email → finish onboarding → referrer gets inbox notification + Scout badge at 1 qualified; (3) self-referral rejected; (4) restart `bun dev` if API was down. Reply **`go`** for Task 13 (Invite & earn dialog).

**Executor (2026-07-05, subscriptions — Task 13 + root referral link):** Invite & earn dialog + header pill shipped (`invite-earn-dialog.tsx`, `HomeStickyChrome`, Settings → Subscription). **Mobbin-style share link:** primary `referralUrl` is **`/?ref={code}`** (marketing landing); `referralSignUpUrl` kept for direct join. **Capture path:** proxy `withReferralCapture` sets cookie on any page (incl. auth redirects); client `ReferralRefUrlListener` in `providers.tsx` (Suspense); `/sign-up?ref=` still works via `ReferralRefCapture`. Server `referral-share-url.ts` + tests **2/2 pass**. **Manual QA:** (1) Invite & earn — copy link shows `/?ref=`; (2) incognito `/?ref={code}` → cookie → sign up → capture; (3) `/home?ref=` while signed out still sets cookie before `/sign-in` redirect. Reply **`go`** for Task 14 (Devoted request + referee checkout discount).

**Executor (2026-07-05, subscriptions — Task 14):** Devoted invite + referral checkout discount shipped. **Server:** `POST /api/plans/devoted-request` (product_event `devoted.request`, owner/admin inbox `devoted.request` notifications), `GET /api/plans/checkout-discount` (returns `POLAR_DISCOUNT_REFERRAL10` when `referredByUserId && !referralDiscountRedeemed`); webhook already sets `referralDiscountRedeemed` on discount use. **Web:** pricing Devoted **Request invite** wired; `startPolarCheckout` passes `discountId` to `authClient.checkout`. Tests **12/12 pass** (`referral-checkout-discount`, `devoted-request`, product-event kinds). **Manual QA:** (1) signed-in Still patron on `/pricing#devoted` → Request invite → staff owner/admin inbox row; (2) referred patron subscribes Attuned/Immersed → Polar checkout shows 10% off (sandbox + `POLAR_DISCOUNT_REFERRAL10` set); (3) repeat Devoted request within 7d → 409 toast. Reply **`go`** for Task 15 (drop `is_pro`).

**Executor (2026-07-06, Task 16 row 3):** Cancel path verified in code + tests (**5/5** `polar-webhook.test.ts`, incl. `subscription.canceled` + empty `customer.state_changed.active_subscriptions`). **`planOverride` never touched** — only `subscriptionTier` / Polar columns reset in `clearProfileSubscription`. **Manual QA steps:**

1. Settings → Subscription → **Manage subscription** (or `/pricing` → **Switch plan** on current tier).
2. Polar portal → **Cancel subscription** (sandbox may offer immediate vs end-of-period — either is OK; immediate is faster to verify).
3. Return to Sense → open **Settings → Subscription** (auto-syncs Polar on load).
4. **Pass:** plan reads **Still**, status **Canceled** or **Free**, pro themes locked, **Manage subscription** hidden.
5. **Optional staff check:** if you had `planOverride` set, complimentary tier copy still shows and **effective tier** stays override (not Still entitlements).
6. **Webhook path:** if ngrok is up, Polar dashboard → Webhooks → latest delivery should be **202** (`subscription.canceled` or `customer.state_changed`).

Reply **`ok`** when row 3 passes, or paste what Settings still shows if it sticks on paid tier.


Run on dev (**web 3001**, **API 3000**) with Polar sandbox env vars set. Reply **`ok`** per row or note failures.

| # | Scenario | Pass? |
|---|----------|-------|
| 1 | Subscribe **Attuned** monthly → webhook sets tier → **taste signature** visible on profile | ☑ |
| 2 | Upgrade to **Immersed** via customer portal → **pro themes** unlock in Settings → Appearance | ☑ |
| 3 | Cancel subscription → reverts to **Still** (`planOverride` untouched if staff-set) | ☑ |
| 4 | Staff grant **`taste_overlap`** to Still user → **Compare taste** works on profile | ☑ |
| 5 | Referral: new account via `/?ref=` → verify email → finish onboarding → referrer gets **Scout** badge | ☑ |
| 6 | Referred patron checkout → **10% off** on first Attuned/Immersed sub | ☑ |
| 7 | **Devoted** on `/pricing#devoted` → confirm dialog → Polar checkout (or billing portal if subscribed) | ☑ |
| 8 | `/pricing` — tier cards, month/year toggle, **TextMorph** price animation, **Other plans** referral section | ☑ |
| 9 | **Invite & earn** dialog from home header + Settings → Subscription | ☑ |
| 10 | `graphify update .` (local only) | ☐ _(run locally — not on PATH in agent env)_ |

**Planner (2026-07-06):** Human signed off Task 16 checklist rows **1–9**. **Subscriptions + Polar sandbox QA complete.** Row **10** optional local housekeeping.

**Session shipped (2026-07-06):** Pricing portal routing for existing subscribers; Devoted purchasable + confirm dialog; Polar sync on pricing load; webhook cancel + `customer.state_changed` tests; referral/Devoted/staff flows verified in sandbox.

**Follow-ups (post-launch, not blocking):** Add `POLAR_PRODUCT_DEVOTED_*` in prod env when Devoted products exist; run `graphify update .` locally; remove legacy `POST /api/plans/devoted-request` when no longer needed.

---

## Next track (Planner — 2026-07-06)

**Subscriptions closed.** Recommended order before production Polar:

| Priority | Track | What | Why |
|----------|-------|------|-----|
| **1** | **LR.2** | Launch gate QA (7 scenarios in roadmap §Testing) | End-to-end signed-in journey after billing |
| **2** | **Phase 8.1** | Cross-browser smoke (`.cursor/scratchpad.md` → Phase 8.1 prep) | Chrome · Safari · Firefox · iOS Safari |
| **3** | **Phase 8.3** | Lighthouse mobile perf (Phase 8.3 prep) | Perceived speed on `/home`, profile |
| **4** | **Phase 8.4** | Per-film palette contrast (Phase 8.4 prep) | WCAG on `.movie-themed` pages |
| **5** | **Prod Polar** | Swap sandbox → production env + webhook URL | Real billing |

**Also open (lower urgency):** Month recap dialog Task 7 verify · Attuned/Immersed feature-gate spot QA (Tasks 8–9) · LR.1 QA rebrand sweep · `graphify update .`

**Next (pre-launch order):** ~~**Phase 8.1**~~ **done** → **8.3** (active) → **8.4** → **Prod Polar**. Reply **`go`** for 8.3 Lighthouse run.

**Executor (2026-07-06, rows 9 → 4 → 5–6):** Referral unit tests **17/17 pass** (`referral-capture`, `qualify`, `checkout-discount`, `share-url`). Invite & earn wired: `InviteEarnHeaderButton` on `HomeStickyChrome`, `Invite friends` in Settings → Subscription, `InviteEarnDialogRoot` in `AppShell` + signed-in `/pricing`.

**Row 9 — verify now (signed in):**
1. `/home` → header **Invite & earn** (gift icon on mobile) → dialog: headline, `/?ref=` copy field, milestone rail, how-it-works
2. **Settings → Subscription → Invite friends** → same dialog
3. **Copy link** → clipboard shows `http://localhost:3001/?ref=…` (or prod origin)

**Row 4 — staff grant (do this now, owner/admin):**

1. Open **`/staff`** → **Users** tab → search the **Still** test account (or your main account if on Still tier).
2. Expand the row → scroll to **Plan override** section.
3. **Override tier:** leave **None (use subscription)**.
4. Under **Grant-only extras**, check **Taste overlap scores** (`taste_overlap`).
5. **Save plan** → toast “Patron plan updated”.
6. As that patron (or hard-refresh if same browser): open **any other profile** (not your own).
7. **Pass:** **Compare taste** pill shows (not locked upsell) → tap → overlap sheet loads.

**Row 9 — if not done yet:** `/home` → **Invite & earn** + Settings → **Invite friends** → same dialog, copy `/?ref=` link.

Reply **`ok 4`** / **`ok 9`** when each passes.

**Row 5 + 6 — referral E2E (do together, ~10 min):**

**Prereqs:** Referrer signed in; `RESEND_API_KEY` + `EMAIL_FROM` set (referee must verify email); `POLAR_DISCOUNT_REFERRAL10` set for row 6.

1. Referrer: **Invite & earn** → copy link (`http://localhost:3001/?ref=yourcode`).
2. **Incognito** (or another browser) → paste link → lands on `/` or redirects with cookie set.
3. **Sign up** with a **new email** (not referrer’s) + password.
4. **Verify email** from inbox → complete link.
5. Finish **`/onboarding`** wizard (handle + taste steps until `/home` unlocks).
6. **Row 5 pass (referrer account):** notification **Referral qualified** (or similar) + **Achievements** shows **Scout badge**; Invite & earn milestone rail shows Scout **Earned**.
7. **Row 6 (still incognito as referee):** `/pricing#attuned` → **Get started** → Polar checkout should show **10% discount** (referral first sub only).

**Skip traps:** same email as referrer fails capture; skipping email verify or onboarding blocks qualification; self-referral rejected.

Reply **`ok 5`**, **`ok 6`**, or note where it stuck.

**Row 1 — Attuned + taste signature (good next if you’re on Still after row 3):**

1. Confirm **Still** in Settings → Subscription (post-cancel).
2. `/pricing#attuned` → **Get started** → **Attuned monthly** checkout → pay in Polar sandbox.
3. Return via `/success` or open Settings → Subscription → should read **Attuned** (sync on load if webhook lag).
4. Open **your profile** — taste category pill under portrait (e.g. **Genre purist**, **Eclectic**) when you have enough rated diary logs + medium/high confidence.
5. If tier is Attuned but **no pill:** log a few more rated films → **Settings** or onboarding recompute path, or wait for taste recompute after logs.

**Still open:** 4 (staff grant), 5–6 (referral), 7 (Devoted Polar IDs), 9 (Invite & earn), 10 (`graphify update .` — not on PATH in agent env).

Reply **`ok 1`** when Attuned + taste pill show, or **`stuck`** + what Settings shows.

**Row 1:** Still account → `/pricing#attuned` → subscribe monthly → profile **taste signature** visible

**Row 7:** Add `POLAR_PRODUCT_DEVOTED_*` to `.env` → Devoted checkout end-to-end

Reply **`ok 9`**, **`ok 4`**, etc. as you complete each.

**Executor (2026-07-06, pre-launch track — LR.2 start):** Human **`go Recommended order`**. Refreshed automated gates:

- **`bun run build` in `apps/web` — GREEN** (fixes: `sync-polar-checkout.ts` customer fetch; `plan-features.ts` required `key` on insert; settings layout → `fetchMeProfile`; `plan-feature-gate` `still` exhaustiveness; extended `MeProfile` settings fields)
- Server tests **17/17 pass** (`sense-taste-signature`, `letterboxd-import-apply`, `role-change-notification`)

**LR.2 human QA — run on dev (web 3001, API 3000).** Reply **`ok 1`** … **`ok 7`** per row.

| # | Scenario | How to verify | Pass? |
|---|----------|---------------|-------|
| 1 | **New account** | Incognito sign-up → verify email → onboarding quick-rate → profile shows taste pill → `/home?browse=community` not empty | ☑ |
| 2 | **Letterboxd import 500+** | Settings → Data → import diary CSV(s) → no dupes on re-import; taste signature updates; own profile loads **&lt;3s** | ☑ |
| 3 | **Zero follows** | Fresh or unfollowed account → Community **Activity** / editorial scroll **30s+** without dead end | ☑ |
| 4 | **Taste card share** | Own profile → share taste / OG link → preview looks personal; link opens profile | ☑ |
| 5 | **Log flow** | ⌘K search film → Quick Log rate → appears on **`/diary` in &lt;30s** | ☑ |
| 6 | **Sense branding** | Spot signed-in UI — no patron-facing **Still** (LR.1; email domain OK) | ☑ |
| 7 | **Home nav** | `/home` — tap **Movies ↔ Community** pill; no full-page freeze; active pill moves | ☑ |

**Human `ok` 2026-07-06 — LR.2 closed.** **Human `ok` 2026-07-06 — Phase 8.1 closed.**

**Human `ok` 2026-07-06 — taste persona pill closed.** **Active:** Phase **8.3** Lighthouse mobile perf.

**Executor (2026-07-06):** **Fix — mobile prod onboarding loop.** Root cause: RSC `serverApi()` used fixed `NEXT_PUBLIC_SERVER_URL` while `authServer()` uses request `x-forwarded-host`. Files: `resolve-server-api-base-url.ts`, `server-api.ts`, `fetch-me-profile.ts`, `(app)/layout.tsx`.

**Planner (2026-07-06):** **Support campaign + purchase success dialogs** — brainstorm approved (approach 1). Spec: `docs/superpowers/specs/2026-07-06-sense-support-campaign-dialogs-design.md`. Plan: `docs/superpowers/plans/2026-07-06-sense-support-campaign-dialogs.md`. Reply **`go`** on plan to implement Task 1.

**Executor (2026-07-06):** **Support campaign + purchase success dialogs — Tasks 1–5 implemented.** Video at `apps/web/public/campaigns/sense-mobile-teaser.mp4`. Unit tests **5/5** (`sense-support-campaign-seen`, `plan-purchase-success-query`). AppShell gates What's New → `SenseSupportCampaignDialogRoot` when `SENSE_SUPPORT_CAMPAIGN_ENABLED`; `PlanPurchaseSuccessDialogRoot` on `/home`; `/success` → `/home?checkout=success`; Settings strips success query (no duplicate toast); month recap waits for campaign/WN dismiss. **Task 6 — human QA pending:**

| # | Scenario | How to verify | Pass? |
|---|----------|---------------|-------|
| 1 | Campaign once-only | Signed-in first visit — split dialog + vertical video; dismiss → does not return on refresh | ☐ |
| 2 | Video layout | Desktop right column full height; mobile stack; tap-to-play | ☐ |
| 3 | What's New suppressed | No What's New carousel while campaign enabled | ☐ |
| 4 | Checkout success | Polar `/success` → `/home` thank-you dialog with tier label | ☐ |
| 5 | No Settings toast | After checkout, Settings subscription tab has no duplicate success toast | ☐ |

**Executor's Feedback:** Set `SENSE_SUPPORT_CAMPAIGN_ENABLED = false` in `sense-support-campaign.ts` when campaign ends to restore What's New. Optional changelog note deferred unless requested.

**Taste persona pill — manual QA (2026-07-06):**

| # | Scenario | Steps | Pass |
|---|----------|-------|------|
| 1 | Genre-led persona | `/profile/jdc` (or drama-led patron) — pill shows *Dramatist* not *Genre-led* | ☑ |
| 2 | Popover genres | Tap pill — title matches pill; body names *Drama*, *Comedy*, etc. | ☑ |
| 3 | Self vs visitor | Own profile vs another — popover second vs third person | ☑ |
| 4 | Dual affinity | Patron with drama + animation duo — *Dramatist & Toonist* on pill | ☑ |
| 5 | Lazy recompute | Patron with v3 cached taste — visit profile once; pill updates without manual recompute endpoint | ☑ |
| 6 | Low confidence | Patron with &lt;10 logs / low confidence — no pill | ☑ |

**Executor (2026-07-06):** Task 5 verified — `recomputeUserTasteSignature` persists full `computeTasteSignatureFromLogs` payload (incl. `pillLabel`/`pillGenres`/`version: 4`). `profiles` GET calls `ensureFreshTasteSignature` before paint. Added `taste-signature-cache.test.ts` (v3 stale, v4 fresh).

### 2026-07-26 — Avatar plan auras (Task 1 complete)

**Track:** Spec `docs/superpowers/specs/2026-07-25-avatar-plan-aura-design.md` · Plan `docs/superpowers/plans/2026-07-25-avatar-plan-aura.md`. **Executor Task 1 done:** `apps/server/src/lib/patron-plan-tier.ts` — `fetchPlanTiersForUserIds` + `planTierForUserId`; tests **2/2** pass; commit `4b7de8c`. **Next:** Task 2 — `planTier` on listing engagement payloads (TDD). Reply **`go`** to proceed.

### 2026-07-26 — Avatar plan auras (Task 2 complete)

**Executor Task 2 done:** `listing-engagement-query.ts` — parallel `fetchPlanTiersForUserIds` in watch + patron hydrators; `planTier: PlanTierId` on `ListingEngagementWatchItem` / `ListingEngagementPatronItem`. Tests: `listing-engagement-hydration.test.ts` **2/2** pass (+ existing query helpers **6/6**). Commit `4b28a2c`. Web types in `fetch-listing-engagement.ts` updated locally (uncommitted — full web sweep is Task 8). **Next:** Task 3 — `planTier` on remaining ~13 server payload builders. Reply **`go`** to proceed.

### 2026-07-26 — Avatar plan auras (Task 3 complete)

**Executor Task 3 done:** `planTier` plumbed through all remaining server patron-shaped payloads — `leaderboard-query`, `members-leaderboard-query`, `members-leaderboard-items-query`, `profile-search`, `profile-media` (`serializePatronProfileForClient`), `profiles` (search + `/me` + public profile), `movie-following-ratings`, `listing-presence`, `feed-rating-divergence`, `creator-recognition`, `month-recap-query`, `movies` (review authors), `reviews` (detail author). `planTierForUserId` accepts `ReadonlyMap`. Tests on touched modules **78/78** pass. Commit `9219473`. **Next:** Task 4 — web `avatar-aura-tier.ts` config. Reply **`go`** to proceed.

### 2026-07-26 — Avatar plan auras (Task 4 complete)

**Executor Task 4 done:** `apps/web/src/components/profile/avatar-aura/avatar-aura-tier.ts` — `resolveAvatarAuraTier`, `hasAvatarAura`, `avatarAuraRimStyle` with OKLCH conic rim gradients per paid tier. Tests **4/4** pass. Commit `97baab0`. **Next:** Task 5 — aura CSS in `globals.css`. Reply **`go`** to proceed.

### 2026-07-26 — Avatar plan auras (Task 5 complete)

**Executor Task 5 done:** `packages/ui/src/styles/globals.css` — `@layer components` avatar aura block (`.avatar-aura-rim`, `.avatar-aura-layer`, Attuned sweep, Immersed glow/flare, Devoted holo fallback; hover + reduced-motion gated). Inert until Task 6 `AvatarAura` wrapper mounts class names. Commit `b5f58c8`. **Next:** Task 6 — `AvatarAura` wrapper component. Reply **`go`** to proceed.

### 2026-07-26 — Avatar plan auras (Tasks 6–7 complete)

**Executor Tasks 6–7 done:** `avatar-aura.tsx` — rim wrapper + Devoted hover intent/exit timers, CSS layers for Attuned/Immersed, dynamic WebGL mount; `avatar-aura-devoted-canvas.tsx` — chromatic reel shader with CSS holo fallback on failure. `hasAvatarAura` narrowed to type predicate. Commit `8728e72`. **Next:** Task 8 — `PatronPortraitWithAura` rename sweep + web payload types. Reply **`go`** to proceed.

### 2026-07-26 — Avatar plan auras (Task 8 complete)

**Executor Task 8 done:** `PatronPortraitWithAura` replaces `PatronPortraitWithMetalTier` across nav, feed, leaderboards, engagement drawers, profile hero, search people, review reader, and presence surfaces. Web payload types + `buildPatronNavUser` now expose `planTier` (falls back to `effectiveTier`). Deleted `patron-portrait-with-metal-tier.tsx`. Grep clean; avatar-related `tsc` clean (pre-existing unrelated test-file errors remain). Commit `baafb42`. **Pending human QA:** Attuned/Immersed/Devoted portraits show aura rim + hover on home header, Community ranks, movie detail engagement, profile hero. **Next:** Task 9 — remove `diaryMetalBorderBeamColorVariant` / `DIARY_METAL_BORDER_BEAM_STRENGTH` from `diary-metal-tier.ts`. Reply **`go`** to proceed.

### 2026-07-26 — Avatar plan auras (Task 9 complete)

**Executor Task 9 done:** `diary-metal-tier.ts` — removed `diaryMetalBorderBeamColorVariant`, `DIARY_METAL_BORDER_BEAM_STRENGTH`, and `border-beam` import; updated `isCircularPatronPortraitClass` doc (gates auras, not BorderBeam). Test trimmed to circular check only (**1/1** pass). Grep zero hits for retired exports; `border-beam` remains on search chrome only. Commit `901685a`. **Next:** Task 10 — full verification + manual QA on paid tiers. Reply **`go`** to proceed.

### 2026-07-26 — Avatar plan auras (Task 10 — automated verification)

**Executor Task 10 automated pass:**
- **Avatar server tests:** `patron-plan-tier` **2/2**, `listing-engagement-hydration` **2/2**, `diary-metal-tier` **5/5**, `profile-media` serialize **3/3** — all green after restoring **100 / 500 / 1000** diary-metal thresholds (regression from 50/100/150) and fixing `comments.test.ts` mock pollution.
- **Avatar web tests:** `avatar-aura-tier` **4/4**, `diary-metal-tier` **1/1**.
- **Biome:** clean on `avatar-aura/`, `patron-portrait-with-aura.tsx`, `patron-plan-tier.ts`.
- **Grep:** zero hits for retired BorderBeam portrait exports / old component names.
- **Full server suite:** **699 pass / 6 fail** — remaining failures pre-existing and unrelated (`letterboxd` import gap-fill ×3, `listing-presence` ×2, `sense-taste-overlap` ×1). Stale `dist/src` was polluting earlier runs; `bun run build` cleared duplicate dist tests.
- **Web `tsc`:** avatar paths clean; pre-existing vitest/catalogue test-file errors remain.
- **QA fix commit:** `c68adcf`.

**Avatar plan auras track:** Tasks 1–10 code complete. **Executor browser QA (2026-07-26):** dev servers up (`:3001`/`:3000`); `/home` redirects to sign-in — session required for staff `planOverride` tier sweep. **Static verification** matches plan: Still skips `AvatarAura`; Attuned/Immersed/Devoted get rim + tier layers; Devoted 80ms intent / 300ms exit + WebGL lazy load + CSS holo when `softwareGpu` or WebGL fail; hover effects gated `@media (hover: hover)` + `prefers-reduced-motion: reduce` in globals; presence dot remains outside portrait clip on rim.

**Pending human sign-off:** complete manual QA checklist below while signed in (staff panel → set `planOverride` per tier). Reply **`ok`** when verified.

**Manual QA checklist:**
- [ ] Still — no rim
- [ ] Attuned — brass rim + diagonal sweep on hover
- [ ] Immersed — gold rim + breathing glow while hovered
- [ ] Devoted — iridescent rim + WebGL shader after ~80ms hover; CSS holo on software GPU
- [ ] Sizes: feed (~32px), engagement drawer (~72px), profile hero (~128px)
- [ ] Reduced motion — rim only, no motion
- [ ] Touch — rim only, no hover effects
- [ ] Presence dot on rim edge at all tiers
