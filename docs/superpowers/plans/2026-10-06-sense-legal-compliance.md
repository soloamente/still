# Sense Legal & Compliance Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship public Privacy, Terms, Cookie, and Refund pages plus an EU-style cookie preference banner that gates YouTube embeds and first-party analytics, with signup Terms/Privacy acceptance and core-path accessibility fixes.

**Architecture:** Pure web work in `apps/web`. Legal pages are public App Router routes with shared trader constants and long-form bodies. Cookie consent is a small first-party client module (`localStorage`) read by the banner, trailer mounts, and `trackSenseProductEvent`. No third-party CMP. Signup gains a required acceptance control in `SignUpForm`. Accessibility fixes land in shared poster/search/log/detail components.

**Tech Stack:** Next.js App Router, React client components, Bun tests, existing transitions.dev / Sense modal chrome, Inter long-form UI.

**Spec:** `docs/superpowers/specs/2026-10-06-sense-legal-compliance-design.md`

## Global Constraints

- English-only legal copy in v1.
- Sole trader: publish real name + home address + support email (operator-filled constants; no fake address).
- Cookie banner actions: **Necessary only** and **Accept all** (Manage optional).
- YouTube iframes must not mount until embeds consent or explicit Load trailer.
- Client `product_event` tracking must not fire until analytics consent.
- Do not claim “WCAG certified”, “GDPR compliant”, or “lawsuit-proof”.
- This pack is product engineering — final policy wording needs counsel review before relying on it.
- Prefer `stillApiOrigin()` for browser `/api/*`; do not post analytics cross-origin to the API host.
- Motions: consent UI uses existing calm modal/panel patterns; legal body text has no decorative motion.

## File map

| File | Responsibility |
|---|---|
| `apps/web/src/lib/legal-trader.ts` | Operator identity + lastUpdated + site origin helper |
| `apps/web/src/lib/legal-policy-bodies.ts` | Sectioned English policy content (privacy/terms/cookies/refunds) |
| `apps/web/src/lib/cookie-consent.ts` | Read/write consent preference; category helpers |
| `apps/web/src/lib/cookie-consent.test.ts` | Unit tests for consent storage + defaults |
| `apps/web/src/components/legal/legal-page-shell.tsx` | Shared legal page layout + trader block |
| `apps/web/src/components/legal/cookie-consent-banner.tsx` | Banner UI + Necessary only / Accept all |
| `apps/web/src/components/legal/cookie-consent-root.tsx` | Mount banner when no choice |
| `apps/web/src/app/privacy/page.tsx` | Privacy route |
| `apps/web/src/app/terms/page.tsx` | Terms route |
| `apps/web/src/app/cookies/page.tsx` | Cookie policy route |
| `apps/web/src/app/refunds/page.tsx` | Refunds route |
| `apps/web/src/lib/sense-product-analytics.ts` | Gate on analytics consent |
| `apps/web/src/components/detail/listing-detail-trailer.tsx` | Gate / click-to-load YouTube |
| `apps/web/src/components/home/home-taste-hero-media-layer.tsx` | Gate lobby YouTube |
| `apps/web/src/components/home/home-taste-hero-youtube-trailer.tsx` | Respect embeds consent |
| `apps/web/src/components/auth/sign-up-form.tsx` | Terms + Privacy acceptance |
| `apps/web/src/app/_marketing/landing-copy.ts` | Footer legal links |
| `apps/web/src/app/_marketing/landing-copy.test.ts` | Expect new footer hrefs |
| `apps/web/src/components/auth/auth-route-layout.tsx` | Auth footer legal links |
| `apps/web/src/app/pricing/page.tsx` (or pricing chrome) | Link Terms + Refunds |
| `apps/web/src/components/providers.tsx` or `app/layout.tsx` | Mount `CookieConsentRoot` site-wide |
| `apps/web/src/components/movie/movie-poster.tsx` | Ensure content `alt` stays title-based (audit) |
| Claims touch points | Landing/pricing copy strings only where unsupported absolutes exist |

---

### Task 1: Cookie consent storage module

**Files:**
- Create: `apps/web/src/lib/cookie-consent.ts`
- Create: `apps/web/src/lib/cookie-consent.test.ts`

**Interfaces:**
- Produces:
  - `COOKIE_CONSENT_STORAGE_KEY = "still:cookie-consent:v1"`
  - `type CookieConsentCategory = "necessary" | "preferences" | "analytics" | "embeds"`
  - `type CookieConsentState = { version: 1; updatedAt: string; categories: Record<CookieConsentCategory, boolean> }`
  - `readCookieConsent(): CookieConsentState | null`
  - `writeCookieConsent(partial: { analytics: boolean; preferences: boolean; embeds: boolean }): CookieConsentState`
  - `acceptAllCookieConsent(): CookieConsentState`
  - `necessaryOnlyCookieConsent(): CookieConsentState`
  - `hasCookieConsentChoice(): boolean`
  - `cookieConsentAllows(category: Exclude<CookieConsentCategory, "necessary">): boolean`

- [ ] **Step 1: Write the failing tests**

```typescript
import { afterEach, describe, expect, test } from "bun:test";
import {
	COOKIE_CONSENT_STORAGE_KEY,
	acceptAllCookieConsent,
	cookieConsentAllows,
	hasCookieConsentChoice,
	necessaryOnlyCookieConsent,
	readCookieConsent,
} from "./cookie-consent";

afterEach(() => {
	localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
});

describe("cookie-consent", () => {
	test("no choice until written", () => {
		expect(hasCookieConsentChoice()).toBe(false);
		expect(readCookieConsent()).toBeNull();
		expect(cookieConsentAllows("analytics")).toBe(false);
		expect(cookieConsentAllows("embeds")).toBe(false);
	});

	test("necessary only keeps analytics and embeds off", () => {
		necessaryOnlyCookieConsent();
		expect(hasCookieConsentChoice()).toBe(true);
		expect(cookieConsentAllows("analytics")).toBe(false);
		expect(cookieConsentAllows("embeds")).toBe(false);
		expect(cookieConsentAllows("preferences")).toBe(false);
	});

	test("accept all enables analytics and embeds", () => {
		acceptAllCookieConsent();
		expect(cookieConsentAllows("analytics")).toBe(true);
		expect(cookieConsentAllows("embeds")).toBe(true);
		expect(cookieConsentAllows("preferences")).toBe(true);
	});
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `bun test apps/web/src/lib/cookie-consent.test.ts`  
Expected: FAIL (module missing)

- [ ] **Step 3: Implement `cookie-consent.ts`**

```typescript
export const COOKIE_CONSENT_STORAGE_KEY = "still:cookie-consent:v1";
export const COOKIE_CONSENT_VERSION = 1 as const;

export type CookieConsentCategory =
	| "necessary"
	| "preferences"
	| "analytics"
	| "embeds";

export type CookieConsentState = {
	version: typeof COOKIE_CONSENT_VERSION;
	updatedAt: string;
	categories: Record<CookieConsentCategory, boolean>;
};

function canUseStorage(): boolean {
	return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function readCookieConsent(): CookieConsentState | null {
	if (!canUseStorage()) return null;
	try {
		const raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as CookieConsentState;
		if (parsed?.version !== COOKIE_CONSENT_VERSION) return null;
		if (!parsed.categories) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function writeCookieConsent(input: {
	preferences: boolean;
	analytics: boolean;
	embeds: boolean;
}): CookieConsentState {
	const state: CookieConsentState = {
		version: COOKIE_CONSENT_VERSION,
		updatedAt: new Date().toISOString(),
		categories: {
			necessary: true,
			preferences: input.preferences,
			analytics: input.analytics,
			embeds: input.embeds,
		},
	};
	if (canUseStorage()) {
		localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(state));
		window.dispatchEvent(new Event("still:cookie-consent-changed"));
	}
	return state;
}

export function acceptAllCookieConsent(): CookieConsentState {
	return writeCookieConsent({
		preferences: true,
		analytics: true,
		embeds: true,
	});
}

export function necessaryOnlyCookieConsent(): CookieConsentState {
	return writeCookieConsent({
		preferences: false,
		analytics: false,
		embeds: false,
	});
}

export function hasCookieConsentChoice(): boolean {
	return readCookieConsent() != null;
}

export function cookieConsentAllows(
	category: Exclude<CookieConsentCategory, "necessary">,
): boolean {
	const state = readCookieConsent();
	if (!state) return false;
	return state.categories[category] === true;
}

/** Click-to-load trailer: grant embeds without forcing analytics. */
export function grantEmbedsCookieConsent(): CookieConsentState {
	const prev = readCookieConsent();
	return writeCookieConsent({
		preferences: prev?.categories.preferences ?? false,
		analytics: prev?.categories.analytics ?? false,
		embeds: true,
	});
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `bun test apps/web/src/lib/cookie-consent.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/cookie-consent.ts apps/web/src/lib/cookie-consent.test.ts
git commit -m "feat(web): add first-party cookie consent storage"
```

---

### Task 2: Legal trader constants + policy bodies + pages

**Files:**
- Create: `apps/web/src/lib/legal-trader.ts`
- Create: `apps/web/src/lib/legal-trader.test.ts`
- Create: `apps/web/src/lib/legal-policy-bodies.ts`
- Create: `apps/web/src/components/legal/legal-page-shell.tsx`
- Create: `apps/web/src/app/privacy/page.tsx`
- Create: `apps/web/src/app/terms/page.tsx`
- Create: `apps/web/src/app/cookies/page.tsx`
- Create: `apps/web/src/app/refunds/page.tsx`

**Interfaces:**
- Produces: `LEGAL_TRADER`, `assertLegalTraderReady()`, `LEGAL_POLICY_SECTIONS` keyed by policy id
- Consumes: `APP_NAME` from `@/lib/app-brand`

- [ ] **Step 1: Write failing trader readiness test**

```typescript
import { describe, expect, test } from "bun:test";
import { LEGAL_TRADER, isLegalTraderPlaceholder } from "./legal-trader";

describe("legal-trader", () => {
	test("exposes required fields", () => {
		expect(LEGAL_TRADER.legalName.length).toBeGreaterThan(0);
		expect(LEGAL_TRADER.addressLines.length).toBeGreaterThan(0);
		expect(LEGAL_TRADER.email.includes("@")).toBe(true);
		expect(LEGAL_TRADER.lastUpdated.length).toBeGreaterThan(0);
	});

	test("placeholder helper detects REPLACE_ME tokens", () => {
		expect(isLegalTraderPlaceholder("REPLACE_ME_LEGAL_NAME")).toBe(true);
		expect(isLegalTraderPlaceholder("Ada Lovelace")).toBe(false);
	});
});
```

- [ ] **Step 2: Implement trader + bodies + shell + four pages**

`legal-trader.ts` must start with operator-editable constants. Use clear `REPLACE_ME_*` strings until the human fills them; pages still render, but a comment at the top of the file says “fill before paid launch”.

Policy bodies: structured arrays of `{ heading, paragraphs: string[] }` covering at least:

- Privacy: controller identity, data categories, processors (TMDb, Polar, Resend, auth providers, YouTube, hosting, Neon, Upstash if used), rights, contact, retention at a high level, cookies link
- Terms: account rules, UGC license/rights, TMDb attribution note, prohibited use, liability limits appropriate for a draft, contact
- Cookies: category table matching consent module, how to change choice, link to banner
- Refunds: Polar, EU cooling-off plain English, digital access / withdrawal limits, support email path

`LegalPageShell`: `bg-card` reading column, H1, last updated, trader block, section headings, footer links among the four pages.

Each `page.tsx`: `metadata` title/description + `<LegalPageShell policyId="…" />`.

Routes must be **outside** `(app)` auth wall so guests can read them (same level as `/pricing`).

- [ ] **Step 3: Manual smoke**

Run: `bun run --filter web dev` then open `/privacy`, `/terms`, `/cookies`, `/refunds`  
Expected: 200, trader block visible, no login redirect

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/legal-trader.ts apps/web/src/lib/legal-trader.test.ts \
  apps/web/src/lib/legal-policy-bodies.ts \
  apps/web/src/components/legal/legal-page-shell.tsx \
  apps/web/src/app/privacy/page.tsx apps/web/src/app/terms/page.tsx \
  apps/web/src/app/cookies/page.tsx apps/web/src/app/refunds/page.tsx
git commit -m "feat(web): add public legal policy pages"
```

---

### Task 3: Cookie consent banner + site-wide root

**Files:**
- Create: `apps/web/src/components/legal/cookie-consent-banner.tsx`
- Create: `apps/web/src/components/legal/cookie-consent-root.tsx`
- Modify: `apps/web/src/components/providers.tsx` (or root `app/layout.tsx` children) to mount `<CookieConsentRoot />`

**Interfaces:**
- Consumes: `hasCookieConsentChoice`, `acceptAllCookieConsent`, `necessaryOnlyCookieConsent` from Task 1
- Produces: visible banner until choice; keyboardable buttons; links to `/cookies`

- [ ] **Step 1: Implement banner**

Client component:

- Renders nothing when `hasCookieConsentChoice()`
- Copy: short English + Link to `/cookies`
- Buttons: Necessary only · Accept all
- `role="dialog"` + `aria-labelledby` + focus first action
- `prefers-reduced-motion`: no scale animation (opacity only or instant)
- On click: write consent, unmount

- [ ] **Step 2: Mount `CookieConsentRoot` in Providers** so it appears on landing, auth, and `(app)`

- [ ] **Step 3: Manual verify**

Incognito → landing shows banner → Necessary only → reload → banner gone → trailers still gated (Task 4)  
Incognito → Accept all → analytics may fire (Task 5)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/legal/cookie-consent-banner.tsx \
  apps/web/src/components/legal/cookie-consent-root.tsx \
  apps/web/src/components/providers.tsx
git commit -m "feat(web): add cookie consent banner"
```

---

### Task 4: Gate YouTube embeds + click-to-load

**Files:**
- Modify: `apps/web/src/components/detail/listing-detail-trailer.tsx`
- Modify: `apps/web/src/components/home/home-taste-hero-media-layer.tsx`
- Modify: `apps/web/src/components/home/home-taste-hero-youtube-trailer.tsx` (if it loads iframe API unconditionally)
- Optional create: `apps/web/src/components/legal/load-media-embed-button.tsx`

**Interfaces:**
- Consumes: `cookieConsentAllows("embeds")`, `grantEmbedsCookieConsent()`
- Produces: no YouTube iframe/script until allowed

- [ ] **Step 1: Detail trailer**

If `!cookieConsentAllows("embeds")`, render poster/placeholder + button “Load trailer” that calls `grantEmbedsCookieConsent()` then mounts iframe.  
If allowed, keep current iframe behavior.

- [ ] **Step 2: Taste hero media**

Do not load `youtube-iframe-api` or autoplay iframe until embeds allowed. Show backdrop stills-only fallback; optional “Load trailer” control for signed-in taste hero.

- [ ] **Step 3: Manual verify**

Necessary only → movie detail Trailer does not create `youtube.com` iframe until Load trailer  
Accept all → trailer may auto-mount as today

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/detail/listing-detail-trailer.tsx \
  apps/web/src/components/home/home-taste-hero-media-layer.tsx \
  apps/web/src/components/home/home-taste-hero-youtube-trailer.tsx \
  apps/web/src/components/legal/load-media-embed-button.tsx
git commit -m "feat(web): gate YouTube trailers on cookie consent"
```

---

### Task 5: Gate first-party product analytics

**Files:**
- Modify: `apps/web/src/lib/sense-product-analytics.ts`
- Create: `apps/web/src/lib/sense-product-analytics.test.ts` (mock localStorage + fetch)

**Interfaces:**
- Consumes: `cookieConsentAllows("analytics")`, `stillApiOrigin()`

- [ ] **Step 1: Failing test — no fetch when analytics denied**

```typescript
import { afterEach, describe, expect, mock, test } from "bun:test";
import { COOKIE_CONSENT_STORAGE_KEY, necessaryOnlyCookieConsent } from "./cookie-consent";
import { trackSenseProductEvent } from "./sense-product-analytics";

afterEach(() => {
	localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
	mock.restore();
});

describe("trackSenseProductEvent", () => {
	test("no-ops without analytics consent", () => {
		necessaryOnlyCookieConsent();
		const fetchMock = mock(() => Promise.resolve(new Response(null, { status: 204 })));
		// @ts-expect-error test stub
		globalThis.fetch = fetchMock;
		trackSenseProductEvent("today.pick.viewed", { state: "empty" });
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Implement gate at top of `trackSenseProductEvent`**

```typescript
if (!cookieConsentAllows("analytics")) return;
```

Keep same-origin `stillApiOrigin()` POST (already fixed).

- [ ] **Step 3: Run test — PASS**

Run: `bun test apps/web/src/lib/sense-product-analytics.test.ts`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/sense-product-analytics.ts apps/web/src/lib/sense-product-analytics.test.ts
git commit -m "feat(web): gate product analytics on cookie consent"
```

---

### Task 6: Signup Terms + Privacy acceptance

**Files:**
- Modify: `apps/web/src/components/auth/sign-up-form.tsx`
- Create: `apps/web/src/components/auth/sign-up-form.test.tsx` only if the project already tests auth forms with DOM; otherwise manual + zod schema unit extract

**Interfaces:**
- Extends zod schema with `acceptedLegal: z.literal(true)` (or boolean refine)
- Checkbox not pre-checked; labels link to `/terms` and `/privacy`

- [ ] **Step 1: Extend schema + defaultValues**

```typescript
const schema = z.object({
	email: z.email("Enter a valid email"),
	password: z.string().min(8, "At least 8 characters"),
	acceptedLegal: z.literal(true, {
		error: "Accept the Terms and Privacy Policy to continue",
	}),
});
// defaultValues: { email: "", password: "", acceptedLegal: false }
```

- [ ] **Step 2: Add checkbox field before submit**

Copy: `I agree to the Terms and acknowledge the Privacy Policy` with `Link` components (`target` same tab).  
Submit stays disabled or shows field error until true.

- [ ] **Step 3: Manual verify**

`/sign-up` → submit without check → blocked  
Check → account create proceeds as before

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/auth/sign-up-form.tsx
git commit -m "feat(web): require Terms and Privacy acceptance on sign-up"
```

---

### Task 7: Discovery links (footer, auth, pricing, settings)

**Files:**
- Modify: `apps/web/src/app/_marketing/landing-copy.ts`
- Modify: `apps/web/src/app/_marketing/landing-copy.test.ts`
- Modify: `apps/web/src/components/auth/auth-route-layout.tsx`
- Modify: pricing page / convert CTAs to mention Refunds + Terms
- Modify: Settings data panel or profile settings to link Privacy + Cookies

- [ ] **Step 1: Update footer links**

```typescript
export const LANDING_FOOTER_LINKS = [
	{ href: "/pricing", label: "Pricing" },
	{ href: "/changelog", label: "Changelog" },
	{ href: "/privacy", label: "Privacy" },
	{ href: "/terms", label: "Terms" },
	{ href: "/cookies", label: "Cookies" },
	{ href: "/refunds", label: "Refunds" },
	{ href: "/sign-in", label: "Sign in" },
] as const;
```

Update `landing-copy.test.ts` expectations.

- [ ] **Step 2: Auth footers** — Privacy + Terms links on sign-in and sign-up routes

- [ ] **Step 3: Pricing** — visible links to `/terms` and `/refunds` near purchase CTAs

- [ ] **Step 4: Settings → Data** — short “Legal” row with Privacy + Cookies

- [ ] **Step 5: Run landing-copy tests + commit**

```bash
bun test apps/web/src/app/_marketing/landing-copy.test.ts
git add apps/web/src/app/_marketing/landing-copy.ts \
  apps/web/src/app/_marketing/landing-copy.test.ts \
  apps/web/src/components/auth/auth-route-layout.tsx \
  # plus pricing/settings files touched
git commit -m "feat(web): link legal pages from footer, auth, and pricing"
```

---

### Task 8: Core-path accessibility pass

**Files (touch only where gaps exist):**
- `apps/web/src/components/movie/movie-poster.tsx` — keep `alt={title}`; ensure missing-art path has accessible name
- Search dialog icon-only controls — `aria-label` audit
- Quick Log / sign-up fields — labels already via `Field`; verify checkbox from Task 6 is keyboard-focusable
- Cookie banner — tab order + Escape does **not** imply Accept all
- Detail trailer Load trailer button — visible focus, `type="button"`

- [ ] **Step 1: Keyboard pass checklist (manual)**

Document in PR notes: Tab through `/home` search open, Quick Log open, movie detail Trailer/Load trailer, cookie banner buttons.

- [ ] **Step 2: Fix concrete gaps found** (minimal diffs; shared components preferred)

- [ ] **Step 3: Commit**

```bash
git commit -m "fix(web): accessibility on legal consent and core media paths"
```

---

### Task 9: Claims audit + TMDb attribution note

**Files:**
- Modify: landing/pricing copy modules only where unsupported absolutes exist
- Ensure Privacy/Terms bodies (Task 2) already mention TMDb display rights and user-upload warranties

- [ ] **Step 1: Grep marketing copy**

```bash
rg -n "best|unlimited|never lose|GDPR compliant|WCAG|#1" apps/web/src/app/_marketing apps/web/src/app/pricing apps/web/src/lib --glob "*.{ts,tsx}"
```

- [ ] **Step 2: Soften or remove unsupported claims; do not invent metrics**

- [ ] **Step 3: Commit if any copy changed**

```bash
git commit -m "copy: remove unsupported marketing claims ahead of legal pages"
```

---

### Task 10: Operator fill-in + launch checklist (human)

**Files:**
- Modify: `apps/web/src/lib/legal-trader.ts` with real values
- Optional: mark spec Status → Approved / Implemented

- [ ] **Step 1: Replace `REPLACE_ME_*` with real sole-trader name, address, email, lastUpdated**

- [ ] **Step 2: Confirm Polar merchant-of-record language with Polar dashboard; adjust Refunds copy if Sense is not MoR**

- [ ] **Step 3: Counsel review before treating pages as final legal advice**

- [ ] **Step 4: Production smoke**

- Incognito: banner → Necessary only → no youtube iframe until Load trailer  
- Accept all → analytics network call to same-origin `/api/product-events` when signed in  
- `/sign-up` requires legal checkbox  
- Footer links resolve

- [ ] **Step 5: Commit trader constants (careful: home address becomes public in git)**

```bash
git add apps/web/src/lib/legal-trader.ts
git commit -m "chore(web): fill legal trader identity for publish"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|---|---|
| `/privacy` `/terms` `/cookies` `/refunds` | 2 |
| Trader block + last updated | 2, 10 |
| Cookie banner Necessary only / Accept all | 1, 3 |
| Persist choice | 1 |
| Gate YouTube | 4 |
| Gate analytics | 5 |
| Signup consent | 6 |
| Discovery links | 7 |
| Refunds EU-style + Polar | 2, 10 |
| Data minimization / no new trackers | 5, Global |
| Claims audit | 9 |
| TMDb / UGC copyright notes | 2, 9 |
| Core-path a11y | 8 |
| Risk flags / counsel | 10 |
| No enterprise CMP | Global |

## Self-review notes

- No OneTrust / Cookiebot tasks (YAGNI).
- Consent version bump = change `COOKIE_CONSENT_VERSION` and treat old storage as no choice.
- Italian translation deferred.
- Companion extension store privacy is out of scope (spec non-goal).
