# Landing page remake — unsigned `/`

**Status:** Amended (2026-08-14 visual QA). Human rejected the cinematic hero. Locked: **Mobbin grammar + Sense chrome**. Plan: `docs/superpowers/plans/2026-08-14-landing-mobbin-grammar.md` (original remake Tasks 1–8 shipped the chapter/still layout).
**Date:** 2026-08-14
**Scope:** Remake unsigned `/` (nav through footer) with `/better-interface` + `/transitions-dev`. Product name **Sense**. Story: **identity → diary → community → convert**, told as a Mobbin-style product site (type hero + product well + one tabbed product band), not a cinematic still and not three chapter cards.
**Out of scope (YAGNI):** Signed-in `/` (still redirects to `/home` or `/onboarding`); `/pricing`; onboarding; live taste-signature API; hero trailer or still slideshow; fake stats, logo strips, or testimonials; i18n; changing global `APP_METADATA_DESCRIPTION` (landing `generateMetadata` only).

## Context

The first remake (approach 2) shipped a hybrid: full-bleed TMDb popular backdrop, then three raised chapter cards. Visual QA: the cinematic first screen is wrong. The first screen should match the rest of Sense. The reference is **mobbin.com’s marketing grammar** (canvas, large type, two CTAs, the actual product in a rounded well, then a tabbed product section) rendered in **Sense chrome** (`bg-background` → `bg-card` → inset well). Not glass. Not scroll-hijack poster theater. Not a movie still.

| Topic | Decision |
| --- | --- |
| Scope | Entire unsigned `/` (every section) |
| Story | Identity → diary → community → convert |
| Look | **Mobbin grammar + Sense chrome** — no cinematic still |
| Structure | Type hero + product well; one `#product` band with Taste · Diary · Community tabs |
| Convert | **Create account** + **Sign in** (Sign in also in nav) |
| Motion | Native scroll only. No hijack, parallax, fade-up-on-scroll, Ken Burns, auto-advance |
| Chrome | Surface depth tokens. No decorative borders, rings, or shadows |

## Goals

1. First viewport states **taste / identity** with type + a contained product shot, not a film still and not diary-as-product.
2. The whole page looks like Sense (lobby/pricing language) and like a normal product site (Mobbin), not a glass kit and not cinema.
3. Taste, Diary, and Community are **tabs in one product band**, not three stacked chapter cards.
4. No fake **Contact**, no dead **Catalogue**, no chapter links in the nav (those labels live on the tabs).
5. `prefers-reduced-motion` is respected. transitions-dev only on real state changes (tab pill slide; no Menu/Close once the sheet is gone).

## Non-goals (v1)

- Rebuilding live profile / Quick Log / ranks as interactive widgets.
- Fetching a real patron taste signature for the Taste specimen.
- Trusted-by logos, numeric stats, or testimonials (Sense has none to show honestly).
- Keeping unused Mobbin theater modules “just in case.”
- Changing signed-in redirect behavior.
- Adding Pricing or Changelog into the hero or nav (footer only).

---

## 1. Page map

Unsigned `/` only. `authServer()` + onboarding gate **unchanged**.

```
[skip link → #main-content]
[sticky nav: Sense wordmark | Sign in | Create account]
<main id="main-content">
  #scene      type hero + CTAs + product well (lobby chrome in a raised card)
  #product    How Sense works — tabs Taste · Diary · Community + one specimen well
  #start      convert band (Create account + Sign in)
</main>
[quiet footer]
```

One `h1` (hero). Product band uses `h2`. Native document scroll. **No** `min-h-dvh` lock. Hero is **content-height**: type, CTAs, then the well, with generous padding (`py-16` / `sm:py-24` class). The well should start in the first viewport on a laptop (~1440), not sit below a full-bleed still.

### Drop (unmount and delete if nothing else imports them)

`LandingIntro`, `LandingIntroScrollChapter`, `LandingScrollScenes`, `LandingFeatures`, `LandingFlows`, `LandingPreview`, `LandingScrollReveal`, `LandingTextBoxReveal` / `LandingIntroRevealCopy`, `LandingWorkStack`, `LandingHeroPreviewStage`, `LandingChapter` (no longer mounted), glass nav tokens (`landing-glass.ts` once unused), cinematic hero still (`pickLandingHeroBackdrop` once unused).

Keep and rewrite: `LandingNav`, `LandingHero`, `LandingFooter`, feature visuals the tabs still use.

---

## 2. Nav

**Chrome.** Sticky top bar (not a floating glass cluster). Sense wordmark in a `rounded-full bg-card` pill (`aria-label`: `Sense — home`, `href="/"`). Right: **Sign in** (`/sign-in`) + **Create account** (`/sign-up`, inverted primary pill). **No** Taste · Diary · Community in the nav — those are product tabs. No glass. No **Contact**. No mobile Menu/Close sheet: the bar is wordmark + two CTAs at every width (wrap if needed; hits stay ≥ 44px).

**Scroll.** After `scrollY > 2`, the same soft `background` gradient scrim used on `ProfileTopBar` / `MovieDetailTopBar`. No top scrim “for the still” — there is no still.

**Hits.** CTAs ≥ 44×44 CSS px (padding on the pill).

---

## 3. Hero (`#scene`)

**No still.** Canvas `bg-background`. No TMDb backdrop, no top/bottom cinematic scrims, no Ken Burns, no trailer, no slideshow, no movie logo or title on the hero.

**Type.** Centered. Existing copy (sentence case):

| Slot | Text |
| --- | --- |
| `h1` | Your taste is the point. |
| Subline | A social identity for how you watch — then a diary, lists, and people who see film the same way. |
| Primary | Create account → `/sign-up` |
| Secondary | Sign in → `/sign-in` |

**CTAs.** Primary: inverted pill (`bg-foreground` / `text-background`). Secondary: raised `bg-card` pill, **no border**. Row centered, wrap allowed, 44px height. Press only — no enter fade.

**Product well.** Below the CTAs, one raised Sense card: outer `bg-card` `rounded-mobbin-3xl`, inner `rounded-2xl` `bg-background`. Inside: **static home-lobby chrome** (browse pills **Movies · TV · Community** on a `rounded-full bg-background` track, same language as `/home`) and a **short poster tile grid** (product content inside the well, not a full-bleed collage). Decorative: poster `alt=""`. Not live (no radial toolkit, no navigation from tiles).

**Fetch.** Slim popular movies to poster URLs for the well only. Helper `pickLandingHeroPosters(results, 8)` returns up to eight `{ posterUrl, title }` rows with a usable `poster_url`. On empty/failure: chrome still renders; grid is empty — no broken images. Do not fetch 18 theater posters. Do not pick a backdrop.

**A11y.** Skip link to `#main-content` (visually hidden until focus). One `h1`. Well is decorative (`aria-hidden` on the specimen).

**Landing metadata only** (do not change `APP_METADATA_DESCRIPTION`):

> A social identity for how you watch. Log films and shows, then find people who see film the same way.

OG image stays `/og/home`.

---

## 4. Product band (`#product`)

One section, not three chapter cards. Canvas band with generous vertical padding. `scroll-mt` clears the sticky nav.

| Slot | Text |
| --- | --- |
| `h2` | How Sense works. |
| Tabs | Taste · Diary · Community |

Tabs use existing `SegmentedPillToolbar` (`rounded-full bg-background` track, sliding `bg-card` pill, `aria-label` **How Sense works**). Default **Taste**. Client state only — no URL hash required (YAGNI).

The active tab shows that chapter’s **body** (`text-pretty`, `max-w-md`, centered or under the tabs) and **one** specimen in a raised well (same concentric card language as before: outer `bg-card`, inner `bg-background`). Specimens stay **decorative** (`aria-hidden`). Not live widgets.

| Tab | Body | Specimen |
| --- | --- | --- |
| Taste | Sense reads your diary into a signature — an archetype and the genres that lead. People can see how you watch before they open a list. | Static pill **Genre-led** plus muted line: `Drama leads, with Thriller in rotation.` |
| Diary | Venue, date, and a 0–10 score in one pass. New logs default to at home. Cinema when you were there. | Quick Log success pill: **Logged at home**. |
| Community | Lists, reviews, and ranks — follow patrons and see who logged what. (Do not say friends.) | Film ranks podium. Caption **Film ranks · Month**. Flat tiles. **Shows** if any TV rank label appears; never bare **TV**. |

Do not add a second specimen per tab. Do not revive Add to list / Search / TV watch / review wells on this page. Unmount `LandingChapter`.

Copy constants: keep `LANDING_CHAPTERS` / `LANDING_CHAPTER_COPY` as the **tab** contract (ids + labels + bodies). Nav and footer do not consume chapter hrefs.

---

## 5. Convert (`#start`) and footer

Unchanged from the previous remake.

`#start` is a flat canvas band (not a raised card), first child of the `<footer>` landmark, `id="start"`. Centered, `max-w-[40ch]`.

| Slot | Text |
| --- | --- |
| `h2` | Start a free account |
| Body | Log tonight. Your taste signature forms as you watch. |
| CTAs | Same pair as the hero (Create account + Sign in) |

**Footer** (below `#start`): Sense wordmark; **Pricing** (`/pricing`), **Changelog** (`/changelog`), **Sign in**. **No** Taste · Diary · Community anchors (tabs own those labels). Spacing only — no `border-t`. `© {year} Sense.`

---

## 6. Motion (transitions-dev)

Use tokens already in `packages/ui/src/styles/globals.css`. Do not duplicate `:root`.

| Interaction | Token | Notes |
| --- | --- | --- |
| Product tabs | `SegmentedPillToolbar` sliding pill | Real state change; `useReducedMotion` already on the toolbar |
| CTA / nav press | Existing press opacity or `detail-action-motion` | Immediate, ≤200ms |
| Hero / section enter | **None** | No scroll fade-ups |
| Menu ↔ Close | **None** | No mobile sheet |

`prefers-reduced-motion`: tab pill cut (toolbar already duration 0). No looping motion. Do not put `data-lenis-prevent-wheel` on the product well or tab panels.

---

## 7. Architecture

### Keep / rewrite

| Module | Change |
| --- | --- |
| `apps/web/src/app/page.tsx` | Compose nav + type hero (poster list into well) + `#product` + footer; skip link; landing-only metadata; no backdrop |
| `landing-copy.ts` | Hero/convert/footer strings; `LANDING_CHAPTERS` for **tabs** only (no nav href requirement); product `h2` **How Sense works.** |
| `landing-copy.test.ts` | Tab ids Taste/Diary/Community; convert hrefs; no “friends”; nav is not required to list chapters |
| `landing-hero-still.ts` | Replace backdrop helper with `pickLandingHeroPosters(results, 8)` |
| `landing-hero-still.test.ts` | Empty list, skip missing posters, cap at 8 |
| `landing-hero.tsx` | Type + CTAs + product well; accept poster list; no `backdropUrl` |
| `landing-nav.tsx` | Wordmark + Sign in + Create account; drop chapters and mobile sheet |
| `landing-footer.tsx` | Convert + quiet links; drop chapter anchors |
| `landing-taste-visual.tsx` | Unchanged specimen; mounted in the Taste tab |
| `landing-feature-visuals.tsx` | Quick Log + ranks in Diary/Community tabs |
| `landing-mobbin-hero.ts` | Keep CTA + type tokens; drop still/scrim-only leftovers in the later slim |
| `landing-mark-pill.tsx` | Unchanged wordmark pill |
| `landing-convert.tsx` | Unchanged `#start` |

### New

| Module | Kind | Responsibility |
| --- | --- | --- |
| `landing-product.tsx` | UI (client) | `#product` — `h2`, `SegmentedPillToolbar`, body + specimen slot |
| `landing-hero-well.tsx` | UI | Static lobby chrome + poster grid inside the hero card |

### Delete after unmount

Theater list from the original remake, plus `landing-chapter.tsx`, plus `pickLandingHeroBackdrop` once nothing imports it.

---

## 8. Testing

TDD on `pickLandingHeroPosters` and the copy/href contract (tabs + convert; no friends). Manual QA:

- Unsigned `/` at ~390 and ~1440: type hero + product well in the first viewport; no full-bleed still; tabs swap Taste / Diary / Community specimens.
- Popular fetch failure: hero type + chrome well still read; no broken images.
- `prefers-reduced-motion`: tab pill does not animate.
- Signed-in `/` still redirects to `/home` (or `/onboarding`).
- Keyboard: skip link, nav CTAs, tab chips, convert CTAs; focus visible.
- No glass, no `backdrop-blur` on the hero, no Contact, no Catalogue, no “friends”.

---

## 9. better-interface constraints (v1)

- **A11y:** skip link; one `h1`; decorative well and specimens; 44px hits; toolbar `aria-label` on tabs; focus-visible on pills (box-shadow ring, not outline-only).
- **Layout:** content-height hero; product band not viewport-locked; mobile stacks type then well, then tabs then specimen.
- **Writing:** sentence case; no “friends”; diary copy says **cinema** / **at home**; convert buttons stay **Create account**, **Sign in**.
- **Type:** `font-sans` (SF Pro Rounded), `text-balance` / `text-pretty`; no `font-display` Fraunces on this page.
- **Color:** canvas → raised card → inset well. No text on a movie still.
- **UI:** no decorative borders; no scroll-triggered motion; press only on frequent controls.
