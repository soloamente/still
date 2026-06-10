# Resend + auth transactional email — Design

**Date:** 2026-06-10
**Status:** Approved — brainstorming complete; implementation plan written
**Plan:** `docs/superpowers/plans/2026-06-10-resend-auth-email.md`

## Goal

Complete the Resend operational setup for Sense production and wire all Better Auth
transactional email flows: sign-up verification (soft gate), password reset, and
account-deletion verification — with polished React Email templates sent from
`cinema.sense.fans`.

## Context

The data-settings work (2026-06-09) added a minimal Resend wrapper
(`packages/auth/src/lib/send-email.ts`) and wired **account-deletion verification**
only. Env vars `RESEND_API_KEY` and `EMAIL_FROM` exist in `@still/env/server` but
are optional in dev (console fallback) and required in production. Sign-up still
skips verification; sign-in has no forgot-password flow; delete-account email is
plain text only.

## Decisions made during brainstorming

| Question | Decision |
| --- | --- |
| Scope | Full Resend ops **and** all auth transactional emails in one pass |
| Verification policy | **Soft gate** — sign-in and onboarding proceed; public/social actions blocked until verified |
| Password reset | **Full flow** — forgot-password page, reset email, reset-password page |
| Gated actions | **Public/social only** — public content, public profile, follows; private diary OK |
| Sending domain | **`cinema.sense.fans`** on **`sense.fans`** → `Sense <noreply@cinema.sense.fans>` |
| Email format | **React Email** templates with HTML + plain-text fallback |
| Architecture | **Approach 2** — `packages/auth/src/emails/` module + shared server guard (no new `@still/emails` package yet) |

## 1. Resend operational setup

### Resend account & domain

- Create or use the existing Resend project for Sense production.
- Add and verify sending domain **`cinema.sense.fans`** (subdomain of `sense.fans`).
- Add DNS records on `sense.fans` per Resend dashboard: SPF, DKIM, and recommended
  DMARC for the subdomain.
- Send a test message from the Resend dashboard before enabling production env vars.

### Environment variables

Already defined in `packages/env/src/server.ts`; set on the **server** Vercel project
(where Better Auth runs via Elysia):

| Variable | Example | Notes |
| --- | --- | --- |
| `RESEND_API_KEY` | `re_…` | Production API key with send permission |
| `EMAIL_FROM` | `Sense <noreply@cinema.sense.fans>` | Must match verified domain |

**Local dev:** leave both unset → existing console fallback in `sendEmail`.
**Production:** both required → existing throw if either is missing.

### Documentation

Add a short **Email / Resend** section to the repo README:

- DNS checklist for `cinema.sense.fans`
- Env var names and where to set them (server app)
- How to test locally (console logs) vs staging/production (real sends)

## 2. Auth emails module + Better Auth hooks

### Package layout (`packages/auth`)

```
packages/auth/src/
  emails/
    layout.tsx              # Shared Sense shell (wordmark area, footer, dark bg)
    verify-email.tsx
    reset-password.tsx
    delete-account.tsx      # Replaces plain-text buildDeleteAccountEmail body
    render-email.ts         # render() → { html, text }
  lib/
    send-email.ts           # Resend send — html + text
    send-email.test.ts
  index.ts                  # Better Auth hooks
```

**New dependencies:** `@react-email/components`, `@react-email/render`.

### `sendEmail` upgrade

Extend the existing helper:

```ts
sendEmail({ to, subject, html, text })
```

- Resend `emails.send` receives both `html` and `text`.
- Dev fallback logs subject + text (unchanged behavior).
- Production guard unchanged.

Remove or repoint `buildDeleteAccountEmail` — subject/copy moves into the React
Email template; tests assert rendered output instead.

### Better Auth configuration (`packages/auth/src/index.ts`)

| Setting | Value |
| --- | --- |
| `emailVerification.sendVerificationEmail` | Render verify template → `sendEmail` |
| `emailVerification.sendOnSignUp` | `true` |
| `emailVerification.autoSignInAfterVerification` | `true` |
| `emailVerification.expiresIn` | 86400 (24h — match delete-account copy) |
| `emailAndPassword.requireEmailVerification` | `false` (soft gate) |
| `emailAndPassword.sendResetPassword` | Render reset template → `sendEmail` |
| `emailAndPassword.resetPasswordTokenExpiresIn` | 3600 (1h) |
| `user.deleteUser.sendDeleteAccountVerification` | React Email template (same hook) |

Verification and reset URLs use Better Auth's `url` parameter — no custom token
logic.

### Template content

Shared layout across all three emails:

- **From:** `Sense <noreply@cinema.sense.fans>`
- **Tone:** transactional only — no marketing
- **Structure:** headline, one primary CTA button (href = Better Auth `url`), expiry
  note, ignore-if-not-you footer
- **Plain text:** generated via `@react-email/render` (or mirrored strings in unit
  tests)

| Email | Subject (draft) | Expiry copy |
| --- | --- | --- |
| Verify | Confirm your email for Sense | 24 hours |
| Reset password | Reset your Sense password | 1 hour |
| Delete account | Confirm your Sense account deletion | 24 hours (existing copy) |

## 3. Soft verification gate

### Principle

Unverified patrons (`user.emailVerified === false`) may sign in, complete onboarding,
and use **private** features. They may not take **public/social** actions until
verified.

Staff test accounts should be verified in Resend/Better Auth before testing public
flows; no special bypass in code for launch.

### Server helper

New `apps/server/src/lib/require-verified-email.ts`:

```ts
requireVerifiedEmail(user) → void | 403 EMAIL_VERIFICATION_REQUIRED
```

Uses `emailVerified` from Better Auth `getSession` user (already available in
`apps/server/src/context.ts`).

Response body includes a stable code for client handling:

```json
{ "error": "Verify your email to do that", "code": "EMAIL_VERIFICATION_REQUIRED" }
```

### Routes that enforce the gate

| Route | Block when |
| --- | --- |
| `POST/PATCH /api/profiles/me` | `isPrivate: false` or `defaultVisibility: "public"` |
| `POST/PATCH /api/reviews` | Effective visibility resolves to `"public"` |
| `POST/PATCH /api/logs` | Effective visibility resolves to `"public"` |
| `POST/PATCH /api/lists` | `isPublic: true` on create or when toggling public |
| `POST /api/follows/:userId` | Always |
| `PATCH /api/profiles/me/pins` | Pinning a review to public profile showcase |

**Allowed without verification:** private logs/reviews/lists, watchlist, Quick Log
(with private default), imports, export, clear library, delete-account request,
onboarding profile bootstrap (handle/display name while profile stays private).

**Not gated at launch:** comments, likes/reactions (can tighten in a follow-up).

### Client UX

**`VerifyEmailBanner`** in `(app)/layout.tsx` (below impersonation banner when
present):

- Visible when signed in and `emailVerified === false`.
- Copy: “Verify your email to share reviews, lists, and your profile publicly.”
- **Resend email** button → `authClient.sendVerificationEmail({ email, callbackURL: "/home" })`.
- No dismiss — banner stays until verified.
- Flat `bg-card` strip; surface depth tokens only (no borders/shadows).

**API failures:** toast on `EMAIL_VERIFICATION_REQUIRED` with resend affordance.

**Sign-up:** toast after success — “Check your inbox to verify before sharing
publicly.” — still redirect to `/onboarding`.

**Settings → Profile:** inline note near visibility controls when unverified.

**Session refresh:** banner clears after verify link + `router.refresh()`.

## 4. Web auth pages

Reuse `AuthPageShell`, `AuthMotionInput`, `AuthSubmitButton`, and
`AuthRouteLayout` patterns from sign-in/sign-up.

### Extend `AuthRouteLayout`

| Route | Title |
| --- | --- |
| `/forgot-password` | Forgot your password? |
| `/reset-password` | Choose a new password |

Footer links chain sign-in ↔ sign-up ↔ forgot-password.

### Sign-in

- **Forgot password?** link under password field → `/forgot-password`.

### `/forgot-password` — `ForgotPasswordForm`

- Email field + submit.
- `authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })`.
- Always show neutral success (“If that email exists, we sent a link”).
- Link back to `/sign-in`.

### `/reset-password` — `ResetPasswordForm`

- Read `token` from `?token=`; handle `?error=INVALID_TOKEN`.
- Invalid/expired: inline error + link to `/forgot-password`.
- Valid: new password + confirm (min 8, client match check).
- Submit: `authClient.resetPassword({ newPassword, token })`.
- Success → toast + redirect `/sign-in`.

### Email verification

No dedicated `/verify-email` page for launch. Better Auth handles
`/api/auth/verify-email`; `callbackURL: "/home"` with
`autoSignInAfterVerification: true`.

Resend affordances: banner + optional Settings note only.

## 5. Error handling

| Flow | Failure | UX |
| --- | --- | --- |
| Send any email | Resend API error | Server throws; Better Auth surfaces error to client dialog/toast |
| Send any email | Missing env in production | `sendEmail` throws at send time — monitor server logs |
| Send any email | Dev, no env | Console log with full text link (existing) |
| Forgot password | Unknown email | Same success message (no enumeration) |
| Reset password | Invalid/expired token | Inline error on `/reset-password` |
| Verify link | Expired token | Better Auth error page; patron uses banner resend |
| Public action | Unverified | 403 + toast + banner |
| Resend verification | Rate limited | Better Auth error → friendly toast |

## 6. Testing

### Unit tests (`packages/auth`)

- Render tests for each email template: subject, CTA href placeholder, key strings,
  expiry copy.
- `sendEmail` dev fallback and production throw (existing pattern extended for
  `html`).

### Server route tests (`apps/server`)

- `requireVerifiedEmail` helper: verified passes, unverified throws/403.
- One integration-style test per gated route family (profiles public toggle,
  public review create, follow) asserting 403 when `emailVerified: false`.

### Manual QA checklist

- [ ] Resend domain verified; test send from dashboard
- [ ] Sign up → verification email received (HTML renders)
- [ ] Click verify → lands on `/home`, banner gone
- [ ] Unverified: public review blocked; private log OK
- [ ] Forgot password → reset email → new password → sign in
- [ ] Delete account email still works (HTML)
- [ ] Production without env vars fails loudly (staging smoke)

## Out of scope

- Dedicated `@still/emails` workspace package (extract when a second consumer exists)
- React Email dev preview server
- `/verify-email` holding page
- Gating comments, likes, reactions
- Marketing / digest / notification emails beyond auth
- Magic link or OTP auth
- `requireEmailVerification: true` hard gate (can enable later without template changes)
- Email change / re-verification on address update

## Implementation note

After this spec is approved, invoke the **writing-plans** skill to produce
`docs/superpowers/plans/2026-06-10-resend-auth-email.md` with TDD task breakdown.
