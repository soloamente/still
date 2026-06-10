# Resend + Auth Transactional Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Resend-backed transactional auth email (verify, reset password, delete account) with React Email templates from `cinema.sense.fans`, a soft verification gate on public/social API actions, and full forgot/reset password web flows.

**Architecture:** Extend `packages/auth` with a `src/emails/` React Email module and upgrade `sendEmail` to send `html` + `text`. Wire Better Auth hooks in `packages/auth/src/index.ts`. Enforce the soft gate in `apps/server` via a shared `requireVerifiedEmail` helper on selected routes. Add `VerifyEmailBanner` + auth pages under `apps/web`.

**Tech Stack:** Better Auth 1.6.x, Resend, `@react-email/components` + `@react-email/render`, Elysia + Drizzle (`apps/server`), Next.js App Router + motion/react (`apps/web`), Bun test.

**Spec:** `docs/superpowers/specs/2026-06-10-resend-auth-email-design.md`

---

## File structure

**Human / ops (no code)**
- Resend dashboard: verify domain `cinema.sense.fans` on `sense.fans`
- Vercel server project: set `RESEND_API_KEY`, `EMAIL_FROM=Sense <noreply@cinema.sense.fans>`

**packages/auth**
- Modify: `packages/auth/package.json` — add `@react-email/components`, `@react-email/render`, `react`, `react-dom`
- Create: `packages/auth/src/emails/layout.tsx` — shared Sense transactional shell
- Create: `packages/auth/src/emails/verify-email.tsx`
- Create: `packages/auth/src/emails/reset-password.tsx`
- Create: `packages/auth/src/emails/delete-account.tsx`
- Create: `packages/auth/src/emails/render-email.ts` — `renderAuthEmail(component)` → `{ subject, html, text }`
- Create: `packages/auth/src/emails/render-email.test.ts`
- Modify: `packages/auth/src/lib/send-email.ts` — accept `html`; Resend sends both parts
- Modify: `packages/auth/src/lib/send-email.test.ts` — migrate to template render tests; remove `buildDeleteAccountEmail`
- Modify: `packages/auth/src/index.ts` — `emailVerification`, `sendResetPassword`, React Email delete hook

**apps/server**
- Create: `apps/server/src/lib/require-verified-email.ts`
- Create: `apps/server/src/lib/require-verified-email.test.ts`
- Modify: `apps/server/src/routes/profiles.ts` — gate public profile + pins
- Modify: `apps/server/src/routes/follows.ts` — gate follow
- Modify: `apps/server/src/routes/reviews.ts` — gate public visibility
- Modify: `apps/server/src/routes/logs.ts` — gate public visibility
- Modify: `apps/server/src/routes/lists.ts` — gate public lists

**apps/web**
- Create: `apps/web/src/components/auth/verify-email-banner.tsx`
- Create: `apps/web/src/components/auth/forgot-password-form.tsx`
- Create: `apps/web/src/components/auth/reset-password-form.tsx`
- Create: `apps/web/src/app/(auth)/forgot-password/page.tsx`
- Create: `apps/web/src/app/(auth)/reset-password/page.tsx`
- Modify: `apps/web/src/components/auth/auth-route-layout.tsx` — new routes + footers
- Modify: `apps/web/src/components/auth/sign-in-form.tsx` — forgot-password link
- Modify: `apps/web/src/components/auth/sign-up-form.tsx` — verify toast copy
- Modify: `apps/web/src/app/(app)/layout.tsx` — mount `VerifyEmailBanner`
- Modify: `apps/web/src/components/profile/settings-form-context.tsx` (or profile settings panel) — unverified note near visibility controls
- Create: `apps/web/src/lib/email-verification-error.ts` — detect `EMAIL_VERIFICATION_REQUIRED` for toasts

**docs**
- Modify: `README.md` — Email / Resend section

---

### Task 0: Resend domain + production env (human)

**Files:** none (dashboard + Vercel)

- [ ] **Step 0.1: Add domain in Resend**

In the Resend dashboard, add **`cinema.sense.fans`**. Copy SPF + DKIM DNS records.

- [ ] **Step 0.2: DNS on `sense.fans`**

Add the records Resend provides for the subdomain. Wait until Resend shows **Verified**.

- [ ] **Step 0.3: Send a dashboard test email**

From Resend, send a test from `noreply@cinema.sense.fans` to your inbox. Confirm it lands (not spam).

- [ ] **Step 0.4: Vercel server env**

On the **server** Vercel project (`apps/server`):

```
RESEND_API_KEY=re_…
EMAIL_FROM=Sense <noreply@cinema.sense.fans>
```

Redeploy after setting. Local dev can stay unset (console fallback).

---

### Task 1: React Email dependencies + render helper

**Files:**
- Modify: `packages/auth/package.json`
- Create: `packages/auth/src/emails/layout.tsx`
- Create: `packages/auth/src/emails/render-email.ts`
- Create: `packages/auth/src/emails/render-email.test.ts`

- [ ] **Step 1.1: Install dependencies**

Run (working directory `packages/auth`):

```bash
bun add @react-email/components @react-email/render react react-dom
```

Expected: all four appear in `packages/auth/package.json` `dependencies`.

- [ ] **Step 1.2: Write failing render test**

Create `packages/auth/src/emails/render-email.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { VerifyEmail } from "./verify-email";
import { renderAuthEmail } from "./render-email";

describe("renderAuthEmail", () => {
	test("verify template includes url and subject", async () => {
		const url = "https://sense.fans/api/auth/verify-email?token=abc";
		const rendered = await renderAuthEmail(
			VerifyEmail({ url }),
			"Confirm your email for Sense",
		);
		expect(rendered.subject).toBe("Confirm your email for Sense");
		expect(rendered.html).toContain(url);
		expect(rendered.text).toContain(url);
		expect(rendered.text).toContain("24 hours");
	});
});
```

- [ ] **Step 1.3: Run test — expect FAIL**

Run (working directory `packages/auth`):

```bash
bun test src/emails/render-email.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 1.4: Shared layout**

Create `packages/auth/src/emails/layout.tsx`:

```tsx
import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import type { ReactNode } from "react";

/** Dark transactional shell — matches Sense in-app chrome, no marketing blocks. */
export function AuthEmailLayout({
	preview,
	title,
	children,
	ctaLabel,
	ctaHref,
	footer,
}: {
	preview: string;
	title: string;
	children: ReactNode;
	ctaLabel: string;
	ctaHref: string;
	footer: string;
}) {
	return (
		<Html lang="en">
			<Head />
			<Preview>{preview}</Preview>
			<Body style={bodyStyle}>
				<Container style={containerStyle}>
					<Heading style={headingStyle}>{title}</Heading>
					<Section style={copyStyle}>{children}</Section>
					<Button href={ctaHref} style={buttonStyle}>
						{ctaLabel}
					</Button>
					<Text style={footerStyle}>{footer}</Text>
				</Container>
			</Body>
		</Html>
	);
}

const bodyStyle = {
	backgroundColor: "#0a0a0a",
	color: "#f5f5f5",
	fontFamily:
		'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
} as const;

const containerStyle = {
	margin: "0 auto",
	padding: "32px 24px",
	maxWidth: "480px",
} as const;

const headingStyle = {
	fontSize: "22px",
	fontWeight: "600",
	lineHeight: "1.3",
	margin: "0 0 16px",
} as const;

const copyStyle = {
	fontSize: "15px",
	lineHeight: "1.6",
	margin: "0 0 24px",
} as const;

const buttonStyle = {
	backgroundColor: "#f5f5f5",
	color: "#0a0a0a",
	borderRadius: "9999px",
	fontSize: "15px",
	fontWeight: "600",
	textDecoration: "none",
	textAlign: "center" as const,
	display: "block",
	padding: "12px 20px",
} as const;

const footerStyle = {
	fontSize: "13px",
	lineHeight: "1.5",
	color: "#a3a3a3",
	margin: "24px 0 0",
} as const;
```

- [ ] **Step 1.5: Verify email template (minimal for test)**

Create `packages/auth/src/emails/verify-email.tsx`:

```tsx
import { Text } from "@react-email/components";

import { AuthEmailLayout } from "./layout";

export function VerifyEmail({ url }: { url: string }) {
	return (
		<AuthEmailLayout
			ctaHref={url}
			ctaLabel="Confirm email"
			footer="If you didn't create a Sense account, you can ignore this email."
			preview="Confirm your email for Sense"
			title="Confirm your email"
		>
			<Text style={{ margin: 0 }}>
				Tap the button to verify your email. You'll need this before sharing
				reviews, lists, or your profile publicly.
			</Text>
			<Text style={{ margin: "16px 0 0", color: "#a3a3a3" }}>
				This link expires in 24 hours.
			</Text>
		</AuthEmailLayout>
	);
}
```

- [ ] **Step 1.6: Render helper**

Create `packages/auth/src/emails/render-email.ts`:

```ts
import { render } from "@react-email/render";
import type { ReactElement } from "react";

export async function renderAuthEmail(
	element: ReactElement,
	subject: string,
): Promise<{ subject: string; html: string; text: string }> {
	const html = await render(element);
	const text = await render(element, { plainText: true });
	return { subject, html, text };
}
```

- [ ] **Step 1.7: Run test — expect PASS**

```bash
bun test src/emails/render-email.test.ts
```

Expected: PASS (1 test).

- [ ] **Step 1.8: Commit**

```bash
git add packages/auth/package.json packages/auth/src/emails bun.lock
git commit -m "feat(auth): add React Email layout and render helper"
```

---

### Task 2: Remaining email templates + sendEmail html upgrade

**Files:**
- Create: `packages/auth/src/emails/reset-password.tsx`
- Create: `packages/auth/src/emails/delete-account.tsx`
- Create: `packages/auth/src/emails/templates.test.ts`
- Modify: `packages/auth/src/lib/send-email.ts`
- Modify: `packages/auth/src/lib/send-email.test.ts`

- [ ] **Step 2.1: Reset + delete templates**

Create `packages/auth/src/emails/reset-password.tsx`:

```tsx
import { Text } from "@react-email/components";

import { AuthEmailLayout } from "./layout";

export function ResetPasswordEmail({ url }: { url: string }) {
	return (
		<AuthEmailLayout
			ctaHref={url}
			ctaLabel="Reset password"
			footer="If you didn't ask to reset your password, you can ignore this email."
			preview="Reset your Sense password"
			title="Reset your password"
		>
			<Text style={{ margin: 0 }}>
				We received a request to reset the password for your Sense account.
			</Text>
			<Text style={{ margin: "16px 0 0", color: "#a3a3a3" }}>
				This link expires in 1 hour.
			</Text>
		</AuthEmailLayout>
	);
}
```

Create `packages/auth/src/emails/delete-account.tsx`:

```tsx
import { Text } from "@react-email/components";

import { AuthEmailLayout } from "./layout";

export function DeleteAccountEmail({ url }: { url: string }) {
	return (
		<AuthEmailLayout
			ctaHref={url}
			ctaLabel="Confirm deletion"
			footer="If you didn't request account deletion, ignore this email — nothing will happen."
			preview="Confirm your Sense account deletion"
			title="Confirm account deletion"
		>
			<Text style={{ margin: 0 }}>
				You asked to permanently delete your Sense account. This removes your
				profile, diary, reviews, lists, and followers. There is no undo.
			</Text>
			<Text style={{ margin: "16px 0 0", color: "#a3a3a3" }}>
				This link expires in 24 hours.
			</Text>
		</AuthEmailLayout>
	);
}
```

- [ ] **Step 2.2: Template tests**

Create `packages/auth/src/emails/templates.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import { DeleteAccountEmail } from "./delete-account";
import { ResetPasswordEmail } from "./reset-password";
import { renderAuthEmail } from "./render-email";

describe("auth email templates", () => {
	test("reset password includes url and 1 hour copy", async () => {
		const url = "https://sense.fans/reset-password?token=xyz";
		const { html, text } = await renderAuthEmail(
			ResetPasswordEmail({ url }),
			"Reset your Sense password",
		);
		expect(html).toContain(url);
		expect(text).toContain("1 hour");
	});

	test("delete account includes permanently copy", async () => {
		const url = "https://sense.fans/api/auth/delete-user/callback?token=abc";
		const { text } = await renderAuthEmail(
			DeleteAccountEmail({ url }),
			"Confirm your Sense account deletion",
		);
		expect(text).toContain(url);
		expect(text.toLowerCase()).toContain("permanently");
		expect(text).toContain("24 hours");
	});
});
```

- [ ] **Step 2.3: Upgrade sendEmail**

In `packages/auth/src/lib/send-email.ts`, change `SendEmailInput` and Resend call:

```ts
export interface SendEmailInput {
	to: string;
	subject: string;
	html: string;
	text: string;
}
```

Inside `resend.emails.send`, add `html: input.html` alongside existing fields. Dev console fallback logs `text` only (unchanged ergonomics).

- [ ] **Step 2.4: Replace send-email.test.ts**

Delete `buildDeleteAccountEmail` import/tests. Keep one test that imports `renderAuthEmail` + `DeleteAccountEmail` (or rely on `templates.test.ts`) and delete the old builder from `send-email.ts` entirely.

- [ ] **Step 2.5: Run all auth package tests**

```bash
cd packages/auth && bun test
```

Expected: all PASS.

- [ ] **Step 2.6: Commit**

```bash
git add packages/auth/src/emails packages/auth/src/lib/send-email.ts packages/auth/src/lib/send-email.test.ts
git commit -m "feat(auth): add reset and delete React Email templates"
```

---

### Task 3: Better Auth email hooks

**Files:**
- Modify: `packages/auth/src/index.ts`

- [ ] **Step 3.1: Add send helpers in index.ts**

At top of `packages/auth/src/index.ts`, replace `buildDeleteAccountEmail` import with:

```ts
import { DeleteAccountEmail } from "./emails/delete-account";
import { ResetPasswordEmail } from "./emails/reset-password";
import { VerifyEmail } from "./emails/verify-email";
import { renderAuthEmail } from "./emails/render-email";
import { sendEmail } from "./lib/send-email";
```

Add a small internal helper in the same file:

```ts
async function sendAuthEmail(
	to: string,
	element: React.ReactElement,
	subject: string,
): Promise<void> {
	const rendered = await renderAuthEmail(element, subject);
	await sendEmail({
		to,
		subject: rendered.subject,
		html: rendered.html,
		text: rendered.text,
	});
}
```

(Add `import type React from "react"` or use `ReactElement` from `react`.)

- [ ] **Step 3.2: Wire Better Auth config**

Inside `betterAuth({ … })`, add **before** `emailAndPassword`:

```ts
		emailVerification: {
			sendOnSignUp: true,
			autoSignInAfterVerification: true,
			expiresIn: 60 * 60 * 24,
			sendVerificationEmail: async ({ user, url }) => {
				await sendAuthEmail(
					user.email,
					VerifyEmail({ url }),
					"Confirm your email for Sense",
				);
			},
		},
```

Extend `emailAndPassword`:

```ts
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
			sendResetPassword: async ({ user, url }) => {
				await sendAuthEmail(
					user.email,
					ResetPasswordEmail({ url }),
					"Reset your Sense password",
				);
			},
			resetPasswordTokenExpiresIn: 60 * 60,
		},
```

Update `sendDeleteAccountVerification`:

```ts
				sendDeleteAccountVerification: async ({ user: target, url }) => {
					await sendAuthEmail(
						target.email,
						DeleteAccountEmail({ url }),
						"Confirm your Sense account deletion",
					);
				},
```

- [ ] **Step 3.3: Smoke test in dev**

Run server + web. Sign up a new account. Expected: console shows `[send-email:dev-fallback]` with verify link text containing `/api/auth/verify-email`.

- [ ] **Step 3.4: Commit**

```bash
git add packages/auth/src/index.ts
git commit -m "feat(auth): wire verify, reset, and delete emails through React Email"
```

---

### Task 4: Server verification gate helper

**Files:**
- Create: `apps/server/src/lib/require-verified-email.ts`
- Create: `apps/server/src/lib/require-verified-email.test.ts`

- [ ] **Step 4.1: Write failing tests**

Create `apps/server/src/lib/require-verified-email.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import {
	assertEmailVerified,
	emailVerificationRequiredBody,
	isPublicContentVisibility,
} from "./require-verified-email";

describe("assertEmailVerified", () => {
	test("passes when emailVerified is true", () => {
		expect(() =>
			assertEmailVerified({ id: "u1", emailVerified: true }),
		).not.toThrow();
	});

	test("throws EMAIL_VERIFICATION_REQUIRED when false", () => {
		expect(() =>
			assertEmailVerified({ id: "u1", emailVerified: false }),
		).toThrow("EMAIL_VERIFICATION_REQUIRED");
	});

	test("throws when emailVerified is undefined", () => {
		expect(() => assertEmailVerified({ id: "u1" })).toThrow(
			"EMAIL_VERIFICATION_REQUIRED",
		);
	});
});

describe("emailVerificationRequiredBody", () => {
	test("returns stable code for clients", () => {
		expect(emailVerificationRequiredBody()).toEqual({
			error: "Verify your email to do that",
			code: "EMAIL_VERIFICATION_REQUIRED",
		});
	});
});

describe("isPublicContentVisibility", () => {
	test("only public visibility is gated", () => {
		expect(isPublicContentVisibility("public")).toBe(true);
		expect(isPublicContentVisibility("private")).toBe(false);
		expect(isPublicContentVisibility("followers")).toBe(false);
	});
});
```

- [ ] **Step 4.2: Run test — expect FAIL**

```bash
cd apps/server && bun test src/lib/require-verified-email.test.ts
```

- [ ] **Step 4.3: Implement helper**

Create `apps/server/src/lib/require-verified-email.ts`:

```ts
import type { ContentVisibility } from "@still/db";

export type EmailVerifiedUser = {
	id: string;
	emailVerified?: boolean | null;
};

export class EmailVerificationRequiredError extends Error {
	readonly code = "EMAIL_VERIFICATION_REQUIRED" as const;

	constructor() {
		super("EMAIL_VERIFICATION_REQUIRED");
		this.name = "EmailVerificationRequiredError";
	}
}

export function emailVerificationRequiredBody() {
	return {
		error: "Verify your email to do that",
		code: "EMAIL_VERIFICATION_REQUIRED" as const,
	};
}

/** Soft gate: only `public` visibility counts as public/social content. */
export function isPublicContentVisibility(
	visibility: ContentVisibility,
): boolean {
	return visibility === "public";
}

export function assertEmailVerified(user: EmailVerifiedUser): void {
	if (!user.emailVerified) {
		throw new EmailVerificationRequiredError();
	}
}
```

- [ ] **Step 4.4: Run test — expect PASS**

```bash
cd apps/server && bun test src/lib/require-verified-email.test.ts
```

- [ ] **Step 4.5: Commit**

```bash
git add apps/server/src/lib/require-verified-email.ts apps/server/src/lib/require-verified-email.test.ts
git commit -m "feat(server): add email verification gate helper"
```

---

### Task 5: Apply gate on API routes

**Files:**
- Modify: `apps/server/src/routes/follows.ts`
- Modify: `apps/server/src/routes/profiles.ts`
- Modify: `apps/server/src/routes/reviews.ts`
- Modify: `apps/server/src/routes/logs.ts`
- Modify: `apps/server/src/routes/lists.ts`

**Pattern** — at top of each handler after auth check:

```ts
import {
	assertEmailVerified,
	EmailVerificationRequiredError,
	emailVerificationRequiredBody,
	isPublicContentVisibility,
} from "../lib/require-verified-email";

// inside handler:
try {
	assertEmailVerified(viewer);
} catch (e) {
	if (e instanceof EmailVerificationRequiredError) {
		return status(403, emailVerificationRequiredBody());
	}
	throw e;
}
```

- [ ] **Step 5.1: follows.ts**

In `POST /:userId`, after `if (!viewer) return status(401)`, call `assertEmailVerified(viewer)` (always gate follows).

- [ ] **Step 5.2: profiles.ts**

In `PATCH /me`, before persisting, if `body.isPrivate === false` OR `body.defaultVisibility === "public"`, call `assertEmailVerified(user)`.

In `PATCH /me/pins`, call `assertEmailVerified(user)` (pinned reviews are public showcase).

- [ ] **Step 5.3: reviews.ts**

In `POST /` and `PATCH /:id`, compute effective visibility (existing logic). If `isPublicContentVisibility(visibility)`, call `assertEmailVerified(user)`.

- [ ] **Step 5.4: logs.ts**

Same as reviews — gate only when effective visibility is `"public"`.

- [ ] **Step 5.5: lists.ts**

In create + patch handlers, when `body.isPublic === true` OR resulting row would be public, call `assertEmailVerified(user)`.

- [ ] **Step 5.6: Run server tests**

```bash
cd apps/server && bun test
```

Expected: all existing tests PASS (no regressions).

- [ ] **Step 5.7: Commit**

```bash
git add apps/server/src/routes/follows.ts apps/server/src/routes/profiles.ts apps/server/src/routes/reviews.ts apps/server/src/routes/logs.ts apps/server/src/routes/lists.ts
git commit -m "feat(server): gate public and social actions on verified email"
```

---

### Task 6: Verify email banner + client error handling

**Files:**
- Create: `apps/web/src/components/auth/verify-email-banner.tsx`
- Create: `apps/web/src/lib/email-verification-error.ts`
- Modify: `apps/web/src/app/(app)/layout.tsx`
- Modify: `apps/web/src/components/auth/sign-up-form.tsx`

- [ ] **Step 6.1: Error helper**

Create `apps/web/src/lib/email-verification-error.ts`:

```ts
export const EMAIL_VERIFICATION_REQUIRED_CODE = "EMAIL_VERIFICATION_REQUIRED";

export function isEmailVerificationRequiredError(payload: unknown): boolean {
	if (!payload || typeof payload !== "object") return false;
	const code = (payload as { code?: unknown }).code;
	return code === EMAIL_VERIFICATION_REQUIRED_CODE;
}

export const EMAIL_VERIFICATION_TOAST =
	"Verify your email to share reviews, lists, and your profile publicly.";
```

- [ ] **Step 6.2: Banner component**

Create `apps/web/src/components/auth/verify-email-banner.tsx` (`"use client"`):

- `authClient.useSession()` — show when `session?.user.emailVerified === false`
- Copy from spec; **Resend email** button calls:
  ```ts
  await authClient.sendVerificationEmail({
    email: session.user.email,
    callbackURL: "/home",
  });
  ```
- `toast.success("Verification email sent")` on success; `toast.error` on failure
- Styling: full-width `bg-card` strip, `px` matching app shell, no border/shadow
- Disable resend button while pending

- [ ] **Step 6.3: Mount in app layout**

In `apps/web/src/app/(app)/layout.tsx`, after `ImpersonationBanner`:

```tsx
import { VerifyEmailBanner } from "@/components/auth/verify-email-banner";

// inside return, after impersonation banner:
<VerifyEmailBanner session={session} />
```

Pass `session` from existing `authServer()` result (already has `emailVerified`).

- [ ] **Step 6.4: Sign-up toast**

In `sign-up-form.tsx` `onSuccess`, change toast to:

```ts
toast.success("Check your inbox to verify before sharing publicly.");
```

Keep `/onboarding` redirect.

- [ ] **Step 6.5: Build web**

```bash
cd apps/web && bun run build
```

Expected: green build.

- [ ] **Step 6.6: Commit**

```bash
git add apps/web/src/components/auth/verify-email-banner.tsx apps/web/src/lib/email-verification-error.ts apps/web/src/app/(app)/layout.tsx apps/web/src/components/auth/sign-up-form.tsx
git commit -m "feat(web): add verify email banner and sign-up copy"
```

---

### Task 7: Forgot / reset password pages

**Files:**
- Create: `apps/web/src/components/auth/forgot-password-form.tsx`
- Create: `apps/web/src/components/auth/reset-password-form.tsx`
- Create: `apps/web/src/app/(auth)/forgot-password/page.tsx`
- Create: `apps/web/src/app/(auth)/reset-password/page.tsx`
- Modify: `apps/web/src/components/auth/auth-route-layout.tsx`
- Modify: `apps/web/src/components/auth/sign-in-form.tsx`

- [ ] **Step 7.1: Extend AuthRouteLayout**

In `auth-route-layout.tsx`:

- Expand `AUTH_ROUTES` map with `/forgot-password` and `/reset-password` titles/descriptions/footers
- Resolve route from `pathname` with fallback to sign-in config for unknown paths
- `/forgot-password` footer links back to `/sign-in`
- `/reset-password` footer links to `/forgot-password`

- [ ] **Step 7.2: ForgotPasswordForm**

Create `forgot-password-form.tsx` mirroring sign-in field patterns:

```ts
await authClient.requestPasswordReset({
	email: value.email,
	redirectTo: "/reset-password",
});
```

Always set local state to `submitted: true` with neutral copy: “If that email exists, we sent a link.”

- [ ] **Step 7.3: ResetPasswordForm**

Create `reset-password-form.tsx`:

- `useSearchParams()` — read `token` and `error`
- If `error === "INVALID_TOKEN"` or missing token → error panel + link to `/forgot-password`
- Else password + confirm fields; submit:
  ```ts
  await authClient.resetPassword({ newPassword, token });
  ```
- Success → `toast.success("Password updated")` + `router.replace("/sign-in")`

- [ ] **Step 7.4: Pages**

Create `apps/web/src/app/(auth)/forgot-password/page.tsx` and `reset-password/page.tsx` — each renders the form only (layout wraps shell).

- [ ] **Step 7.5: Sign-in link**

In `sign-in-form.tsx`, below password field errors, add:

```tsx
<p className="text-center text-muted-foreground text-sm">
	<Link className="font-medium text-foreground underline-offset-4 hover:underline" href="/forgot-password">
		Forgot password?
	</Link>
</p>
```

- [ ] **Step 7.6: Manual test**

1. `/forgot-password` → submit email → dev console shows reset link
2. Open link → lands on `/reset-password?token=…`
3. Set new password → sign in works

- [ ] **Step 7.7: Commit**

```bash
git add apps/web/src/components/auth/forgot-password-form.tsx apps/web/src/components/auth/reset-password-form.tsx apps/web/src/app/(auth)/forgot-password apps/web/src/app/(auth)/reset-password apps/web/src/components/auth/auth-route-layout.tsx apps/web/src/components/auth/sign-in-form.tsx
git commit -m "feat(web): add forgot and reset password flows"
```

---

### Task 8: Settings profile note + API toast wiring

**Files:**
- Modify: `apps/web/src/components/profile/settings-form-context.tsx` (or the profile settings panel component that renders visibility toggles)

- [ ] **Step 8.1: Unverified inline note**

Near **public profile** / **default visibility** controls, when `session.user.emailVerified === false`, render muted copy:

“Verify your email before making your profile or posts public.”

Use `authClient.useSession()` or pass `emailVerified` from server layout if already available in settings.

- [ ] **Step 8.2: Toast on 403 (optional pass)**

In high-traffic mutation paths that can hit the gate (e.g. review composer submit, list publish toggle, follow button), after API error parse JSON body and if `isEmailVerificationRequiredError(body)` → `toast.error(EMAIL_VERIFICATION_TOAST)`.

Start with **one** shared fetch wrapper or the review composer — don't boil the ocean; banner + server 403 is sufficient for launch if time-constrained.

- [ ] **Step 8.3: Commit**

```bash
git add apps/web/src/components/profile/settings-form-context.tsx
git commit -m "feat(web): note unverified state on profile visibility settings"
```

---

### Task 9: README + final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 9.1: README Email / Resend section**

Add after Database Setup (or new subsection):

```markdown
## Email (Resend)

Transactional auth email (verify, password reset, delete account) sends through
[Resend](https://resend.com) from **`cinema.sense.fans`**.

1. Verify the subdomain in Resend (SPF + DKIM on `sense.fans`).
2. Set on the **server** app (Vercel / `apps/server/.env`):

   - `RESEND_API_KEY`
   - `EMAIL_FROM=Sense <noreply@cinema.sense.fans>`

Local dev without these vars logs email bodies to the server console instead of sending.
Production requires both vars or sends throw at runtime.
```

- [ ] **Step 9.2: Full test suite**

```bash
cd packages/auth && bun test
cd apps/server && bun test
cd apps/web && bun run build
```

Expected: all green.

- [ ] **Step 9.3: Manual QA (from spec §6)**

Run through the checklist in the design spec (sign up verify, soft gate, reset password, delete account HTML).

- [ ] **Step 9.4: Commit**

```bash
git add README.md
git commit -m "docs: add Resend setup instructions for auth email"
```

- [ ] **Step 9.5: graphify update**

```bash
graphify update .
```

(Skip if `graphify` CLI unavailable locally.)

---

## Plan self-review

| Spec requirement | Task |
| --- | --- |
| Resend domain `cinema.sense.fans` | Task 0 |
| Env vars + prod guard | Existing + Task 0 |
| React Email templates (3) | Tasks 1–2 |
| Better Auth hooks | Task 3 |
| Soft gate routes | Tasks 4–5 |
| VerifyEmailBanner | Task 6 |
| Forgot/reset pages | Task 7 |
| Settings note | Task 8 |
| README | Task 9 |
| Delete account HTML | Task 2–3 |

No TBD placeholders. Type names consistent (`assertEmailVerified`, `EMAIL_VERIFICATION_REQUIRED`).
