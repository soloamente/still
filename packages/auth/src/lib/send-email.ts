import { Resend } from "resend";

export interface SendEmailInput {
	to: string;
	subject: string;
	html: string;
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
	if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
		// Production must never console-log emails — deletion links would leak
		// to logs and the user would never receive them. Fail loudly instead.
		if (process.env.NODE_ENV === "production") {
			throw new Error(
				"Email misconfigured: RESEND_API_KEY and EMAIL_FROM are required in production",
			);
		}
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
		html: input.html,
		text: input.text,
	});
	if (error) {
		throw new Error(`Email send failed: ${error.message}`);
	}
}
