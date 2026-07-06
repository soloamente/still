import { stillApiOrigin } from "@/lib/still-api-origin";

export type ReferralCaptureRejectReason =
	| "invalid_code"
	| "referrer_not_found"
	| "self_user"
	| "self_email"
	| "already_captured";

const REFERRAL_CAPTURE_MESSAGES: Record<ReferralCaptureRejectReason, string> = {
	invalid_code: "That invite code doesn't look valid.",
	referrer_not_found: "We couldn't find an account for that invite code.",
	self_user: "You can't use your own invite code.",
	self_email: "You can't use an invite tied to the same email address.",
	already_captured: "Your account already has a friend invite linked.",
};

export type CaptureReferralResult =
	| { ok: true }
	| { ok: false; message: string };

/** Link a friend invite code to the signed-in patron (legacy post-sign-up capture). */
export async function captureReferralClient(
	referralCode: string,
): Promise<CaptureReferralResult> {
	const response = await fetch(`${stillApiOrigin()}/api/referrals/capture`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ referralCode }),
	});

	if (response.ok) {
		return { ok: true };
	}

	if (response.status === 429) {
		return { ok: false, message: "Slow down — try again in a moment." };
	}

	let reason: ReferralCaptureRejectReason | undefined;
	try {
		const body = (await response.json()) as {
			error?: ReferralCaptureRejectReason;
		};
		reason = body.error;
	} catch {
		// Fall through to generic copy.
	}

	return {
		ok: false,
		message:
			(reason && REFERRAL_CAPTURE_MESSAGES[reason]) ||
			"Could not apply that invite code.",
	};
}
