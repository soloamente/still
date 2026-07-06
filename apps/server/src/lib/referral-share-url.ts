/** Public landing referral link — Mobbin-style entry on `/` before sign-up. */
export function buildReferralLandingUrl(
	origin: string,
	referralCode: string,
): string {
	const base = origin.replace(/\/$/, "");
	return `${base}/?ref=${encodeURIComponent(referralCode)}`;
}

/** Direct sign-up deep link — still supported for explicit join CTAs. */
export function buildReferralSignUpUrl(
	origin: string,
	referralCode: string,
): string {
	const base = origin.replace(/\/$/, "");
	return `${base}/sign-up?ref=${encodeURIComponent(referralCode)}`;
}
