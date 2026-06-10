export const EMAIL_VERIFICATION_REQUIRED_CODE = "EMAIL_VERIFICATION_REQUIRED";

export function isEmailVerificationRequiredError(payload: unknown): boolean {
	if (!payload || typeof payload !== "object") return false;
	const code = (payload as { code?: unknown }).code;
	return code === EMAIL_VERIFICATION_REQUIRED_CODE;
}

export const EMAIL_VERIFICATION_TOAST =
	"Verify your email to share reviews, lists, and your profile publicly.";
