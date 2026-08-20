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
	// Local onboarding often can't complete inbox links (auth skips sendOnSignUp
	// in development). Keep the hard gate for production / test.
	if (process.env.NODE_ENV === "development") return;
	if (!user.emailVerified) {
		throw new EmailVerificationRequiredError();
	}
}
