/** Persist referral code from `?ref=` on any entry route through account creation (30-day TTL). */
export const REFERRAL_COOKIE_NAME = "still:referral:v1";

export const REFERRAL_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30;

/** Normalize cookie value — lowercase alphanumeric + hyphen/underscore. */
export function normalizeReferralCookieValue(raw: string): string | null {
	const normalized = raw.trim().toLowerCase();
	if (!normalized || normalized.length > 64) return null;
	if (!/^[a-z0-9_-]+$/.test(normalized)) return null;
	return normalized;
}

/** Client-only — store referral code when landing with `?ref=` in the URL. */
export function writeReferralCookie(referralCode: string): void {
	if (typeof document === "undefined") return;
	const normalized = normalizeReferralCookieValue(referralCode);
	if (!normalized) return;
	try {
		document.cookie = `${REFERRAL_COOKIE_NAME}=${encodeURIComponent(normalized)}; path=/; max-age=${REFERRAL_COOKIE_MAX_AGE_SEC}; samesite=lax`;
	} catch {
		// Private mode / quota — capture API can still run if caller passes code explicitly.
	}
}

/** Read persisted referral code on the client after sign-up succeeds. */
export function readReferralCookie(): string | null {
	if (typeof document === "undefined") return null;
	const prefix = `${REFERRAL_COOKIE_NAME}=`;
	const match = document.cookie
		.split(";")
		.map((part) => part.trim())
		.find((part) => part.startsWith(prefix));
	if (!match) return null;
	const raw = decodeURIComponent(match.slice(prefix.length));
	return normalizeReferralCookieValue(raw);
}

/** Clear referral cookie after successful capture so stale codes do not re-apply. */
export function clearReferralCookie(): void {
	if (typeof document === "undefined") return;
	try {
		document.cookie = `${REFERRAL_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
	} catch {
		// Best-effort cleanup only.
	}
}

/** Primary share URL — friends land on the marketing home with `?ref=`. */
export function buildReferralLandingUrl(
	siteOrigin: string,
	referralCode: string,
): string {
	const base = siteOrigin.replace(/\/$/, "");
	return `${base}/?ref=${encodeURIComponent(referralCode)}`;
}

/** Optional direct sign-up link for explicit join buttons. */
export function buildReferralSignUpUrl(
	siteOrigin: string,
	referralCode: string,
): string {
	const base = siteOrigin.replace(/\/$/, "");
	return `${base}/sign-up?ref=${encodeURIComponent(referralCode)}`;
}

/** Proxy helper — persist `?ref=` server-side before redirects or RSC render. */
export function applyReferralCookieToResponse(
	res: {
		cookies: {
			set: (
				name: string,
				value: string,
				options: {
					path: string;
					maxAge: number;
					sameSite: "lax";
				},
			) => void;
		};
	},
	referralCode: string | null | undefined,
): void {
	const normalized = referralCode
		? normalizeReferralCookieValue(referralCode)
		: null;
	if (!normalized) return;
	res.cookies.set(REFERRAL_COOKIE_NAME, normalized, {
		path: "/",
		maxAge: REFERRAL_COOKIE_MAX_AGE_SEC,
		sameSite: "lax",
	});
}
