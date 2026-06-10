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
