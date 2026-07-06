/** Normalize public referral codes for lookup — mirrors web cookie sanitizer. */
export function normalizeReferralCode(raw: string): string | null {
	const normalized = raw.trim().toLowerCase();
	if (!normalized || normalized.length > 64) return null;
	if (!/^[a-z0-9_-]+$/.test(normalized)) return null;
	return normalized;
}

/** Default referral code derived from a patron handle. */
export function referralCodeFromHandle(handle: string): string {
	const base = handle
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]/g, "")
		.slice(0, 24);
	return base.length > 0 ? base : "patron";
}

/** Short suffix when handle-based codes collide. */
export function randomReferralCodeSuffix(): string {
	return Math.random().toString(36).slice(2, 6);
}
