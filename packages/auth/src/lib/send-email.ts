import { Resend } from "resend";

export interface SendEmailInput {
	to: string;
	subject: string;
	text: string;
}

/**
 * Transactional email via Resend. When RESEND_API_KEY / EMAIL_FROM are unset
 * (local dev), the email is logged to the console instead so link-dependent
 * flows (account deletion) stay testable without a provider.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
	// Lazy import: evaluating @still/env/server validates required vars
	// (DATABASE_URL etc.), which would crash pure-helper tests at import time.
	const { env } = await import("@still/env/server");
	// Exactly one of the two vars set = misconfiguration. Fail loudly instead
	// of silently console-logging emails (which would leak deletion links to
	// prod logs and never reach the user).
	if (env.RESEND_API_KEY && !env.EMAIL_FROM) {
		throw new Error(
			"Email misconfigured: RESEND_API_KEY is set but EMAIL_FROM is missing",
		);
	}
	if (!env.RESEND_API_KEY && env.EMAIL_FROM) {
		throw new Error(
			"Email misconfigured: EMAIL_FROM is set but RESEND_API_KEY is missing",
		);
	}
	if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
		console.info(
			`[send-email:dev-fallback] to=${input.to} subject=${input.subject}\n${input.text}`,
		);
		return;
	}
	const resend = new Resend(env.RESEND_API_KEY);
	const { error } = await resend.emails.send({
		from: env.EMAIL_FROM,
		to: input.to,
		subject: input.subject,
		text: input.text,
	});
	if (error) {
		throw new Error(`Email send failed: ${error.message}`);
	}
}

/** Plain-text deletion-verification email — one link, no marketing chrome. */
export function buildDeleteAccountEmail(params: { url: string }): {
	subject: string;
	text: string;
} {
	return {
		subject: "Confirm your Sense account deletion",
		text: [
			"You asked to permanently delete your Sense account.",
			"",
			"Click the link below to confirm. This permanently removes your profile, diary, reviews, lists, and followers. There is no undo.",
			"",
			params.url,
			"",
			"The link expires in 24 hours. If you didn't request this, you can ignore this email — nothing will happen.",
		].join("\n"),
	};
}
