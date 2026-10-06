# Sense Legal & Compliance Pack — Design

**Date:** 2026-10-06  
**Status:** Draft (awaiting user review of this file)  
**Apps:** `apps/web` (primary); `apps/server` only if consent/version persistence needs API storage  
**Disclaimer:** This document is a **product and engineering design**, not legal advice. Policy wording should be reviewed by a qualified lawyer before you rely on it in production.

## Context

Sense (`cinema.sense.fans` today; may move to `sense.fans`) is a social taste platform with diary, Community, subscriptions (Polar), and third-party catalog media (TMDb). There are **no** public Privacy, Terms, Cookie, or Refund pages yet. Client analytics are first-party `POST /api/product-events` only. Trailer UIs embed YouTube. Auth uses session cookies. The operator is a **sole trader** who will publish a **home address** on legal pages. Policies ship in **English only** for v1.

## Goals

1. Publish accurate, linkable legal pages with real trader details.
2. Add EU-style **cookie consent** (Necessary only / Accept all) and gate non-essential embeds/analytics.
3. Add **form consent** on account signup (Terms + Privacy).
4. Document **refunds** in an EU-style cooling-off frame with Polar named as processor.
5. Keep data collection **necessary-only** in product behavior and in policy text.
6. Improve **accessibility** on core patron paths (home, search, diary/log, movie/TV detail): keyboard use, focus, alt text, labeled forms.
7. Remove or soften **unsupported marketing claims**.
8. Flag **copyright**, **local-law**, and other residual risks for counsel/ops.

## Non-goals (v1)

- Lawyer-certified policy text or Italian translations.
- Enterprise CMP (OneTrust, Cookiebot, etc.).
- Full WCAG site certification or “AAA” badges.
- Sense Companion Chrome Web Store legal copy (separate listing).
- Changing Polar merchant-of-record setup (document and confirm with Polar; do not invent it).

## Locked decisions

| Decision | Choice |
|---|---|
| Approach | Product compliance pack (pages + consent UI + embed gate + core a11y) |
| Operator | Sole trader; **publish home address** on legal pages |
| Policy language | English only |
| Cookie UX | Banner with **Necessary only** and **Accept all**; Manage optional if cheap |
| Embeds | YouTube / similar wait for Accept all **or** explicit “Load trailer” (records embed consent) |
| Analytics | First-party only; non-essential events gated on analytics consent |
| Refunds | EU-style cooling-off explanation + Polar + support path |
| Accessibility depth | Core patron paths (not full-site audit) |

## Information architecture

### Public routes (no session required)

| Route | Page |
|---|---|
| `/privacy` | Privacy Policy |
| `/terms` | Terms & Conditions |
| `/cookies` | Cookie Policy |
| `/refunds` | Refund Policy |

### Shared chrome on every legal page

- Product name: **Sense**
- Trader legal name (sole trader)
- Home address (full)
- Privacy / support email
- Public site origin (current production host)
- “Last updated” date (ISO or long English date)
- Quiet long-form layout: Inter, `bg-card` reading surface, no marketing hero

### Discovery links

- Marketing landing footer → all four pages (or “Legal” group)
- Auth (sign-in / sign-up) → Privacy + Terms
- Cookie banner → Cookie Policy + preference actions
- Pricing / checkout → Terms + Refunds
- Settings → Data / Profile → Privacy + Cookies

## Cookie consent

### First visit (no stored choice)

Show a banner or sheet with:

- Short English summary
- Link to `/cookies`
- **Necessary only**
- **Accept all**
- Optional **Manage** (category toggles) if it fits without a third-party CMP

Force a choice before dismissing on first visit (prefer no silent “X” that implies Accept all).

### Persistence

- First-party storage (cookie or `localStorage` key, e.g. `still:cookie-consent:v1`)
- Store: choice timestamp, version, categories granted
- Banner reappears only when policy version bumps or storage is cleared

### Categories

| Category | Examples | Default |
|---|---|---|
| Necessary | Auth/session, CSRF, consent preference itself | Always on |
| Preferences | Theme, watch region, non-ad “seen” flags | Off until Accept all / Manage |
| Analytics | First-party `product_event` funnel events | Off until Accept all / Manage |
| Embeds / media | YouTube iframe trailers | Off until Accept all / Manage **or** click-to-load |

### Embeds behavior

- Detail / taste hero trailers: do **not** mount YouTube until embeds (or Accept all) allowed
- Fallback UI: poster/backdrop + **Load trailer** (or “Allow media embeds”)
- Click-to-load may set Embeds category to granted without forcing Analytics

### Analytics behavior

- No Google Analytics / Meta / similar pixels in v1
- `trackSenseProductEvent` and similar client funnels run only when Analytics is granted (or when the event is reclassified as strictly necessary — default: **not** necessary)
- Server-side domain events that are required to operate the product (e.g. billing webhooks) are documented in Privacy as processing, not as “cookies”

## Form consent

### Sign-up

- Required acceptance: Terms + Privacy (checkbox or equivalent clear control; not pre-checked)
- Links open `/terms` and `/privacy`
- Block submit until accepted
- Prefer recording acceptance timestamp + policy version when practical (DB or auth metadata)

### Other forms

- Invite / feedback / devoted request: purpose line + Privacy link; no marketing opt-in by default
- Marketing email: only if a separate opt-in exists later — unchecked by default, never bundled into signup acceptance

## Refunds

`/refunds` covers:

- Polar as payment / checkout processor (wording must match the real merchant-of-record after ops check)
- EU consumer cooling-off in plain English
- When digital access begins, withdrawal may be limited — disclose at checkout and on this page
- How to request: support email + order/email/account details
- No “unlimited money-back guarantee” marketing

Checkout / pricing UI links to `/refunds` and `/terms`.

## Data minimization (product rules)

- Privacy Policy lists only processors and data Sense actually uses
- Do not expand client analytics property bags casually
- No clipboard/keystroke capture
- Presence / Discord activity remain settings-gated as today
- Settings → Data remains export / library clear / account deletion entry; Privacy links there

## Claims audit

- Scan landing, pricing, onboarding, store-facing copy for unsupported absolutes (“best,” “never lose data,” unlimited guarantees, health claims)
- Replace with accurate product language
- Do not add “WCAG certified,” “GDPR compliant,” or “lawsuit-proof” badges

## Copyright / media

- TMDb catalog art: display under TMDb terms; show required attribution where applicable
- Sense does not claim ownership of studio posters/backdrops
- User uploads (avatar, banner, list cover, voice): Terms require rights; Sense may remove infringing content
- Outline a simple report / takedown contact on Terms (ops process can mature later)

## Accessibility (core paths)

Surfaces in scope:

- `/home` (Movies + TV heroes, catalogue chrome)
- Sticky / ⌘K search
- Diary + Quick Log
- Movie + TV detail

Requirements:

- Keyboard reachability for primary actions
- Visible focus
- Meaningful `alt` on content images; empty alt only when decorative
- Labeled form fields; Enter submits where expected
- Dialogs: focus management, Escape where appropriate
- Prefer shared-component fixes (`MoviePoster`, search dialog, Quick Log, detail shells)
- Respect `prefers-reduced-motion` on consent UI (transitions.dev modal/panel patterns already in globals)

Out of scope v1: every staff surface, Companion extension UI, full automated axe CI gate (optional later).

## Motion

- Consent banner / manage sheet: calm **modal** or **panel reveal** from the existing transitions.dev vocabulary
- Legal page body: no decorative motion

## Third parties to disclose (non-exhaustive)

Document actual production use; trim if a service is unused:

- TMDb (catalog metadata / images)
- Polar (subscriptions / checkout)
- Resend (transactional email)
- Better Auth providers (e.g. Discord, Apple) when enabled
- YouTube (trailer embeds, after consent or click-to-load)
- Hosting / edge (Vercel, and Cloudflare if used)
- Upstash / realtime infrastructure if used for presence or SSE
- Neon (database)

## Risk flags (counsel / ops)

| Risk | Note |
|---|---|
| Italian consumer law / GDPR / ePrivacy | Policy English + sole trader; counsel should review before paid scale |
| Home address public | Required for many trader disclosures; privacy tradeoff accepted |
| Polar merchant of record | Confirm who appears on receipts and who handles chargebacks |
| Age / UGC | Terms should set minimum age and content rules; moderation ops separate |
| Domain move to `sense.fans` | Update trader block, auth env, CORS, Polar/Discord/Apple redirect URLs |
| Companion extension | Separate privacy disclosures for Chrome Web Store |
| Cookie consent vs Strictly necessary | Mis-classifying analytics as necessary recreates compliance risk |
| Accessibility claims | Do not over-claim; ship measurable path improvements |

## Success criteria

1. `/privacy`, `/terms`, `/cookies`, `/refunds` live and linked from landing, auth, pricing, settings.
2. Cookie banner offers Necessary only / Accept all; choice persists.
3. YouTube embeds do not load before embeds consent or click-to-load.
4. Client product analytics respect analytics consent.
5. Sign-up requires Terms + Privacy acceptance.
6. Refunds page matches EU-style + Polar + support path.
7. Core paths show improved keyboard use and alt text on shared components.
8. Claims audit notes resolved or tracked.
9. This spec’s risk table remains visible for counsel/ops.

## Implementation notes (for the later plan)

- Prefer static or MDX legal bodies with a single trader constants module (name, address, email, lastUpdated) so details stay consistent.
- Consent reader is a tiny client module used by trailer components and `trackSenseProductEvent`.
- No new analytics vendors in this pack.
- Server changes only if signup consent version must be stored server-side.

## Open inputs before publish (operator-provided)

Fill before going live (placeholders blocked in prod copy):

- Sole trader legal name
- Home address
- Privacy / support email
- Final public origin (`cinema.sense.fans` vs `sense.fans`)
- Polar merchant-of-record confirmation
- Policy “Last updated” date
