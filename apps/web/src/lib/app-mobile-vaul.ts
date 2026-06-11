/** Tailwind `md` — app-shell surfaces use Vaul below this width; dialog/modal at `md+`. */
export const APP_MOBILE_VAUL_MQ = "(max-width: 767px)";

export function subscribeAppMobileVaul(onStoreChange: () => void) {
	const mq = window.matchMedia(APP_MOBILE_VAUL_MQ);
	mq.addEventListener("change", onStoreChange);
	return () => mq.removeEventListener("change", onStoreChange);
}

export function getAppMobileVaulSnapshot() {
	return window.matchMedia(APP_MOBILE_VAUL_MQ).matches;
}

export function getAppMobileVaulServerSnapshot() {
	return false;
}

/** True when app-shell sheets should use Vaul (mobile tab bar, quick log, create list, …). */
export function shouldUseAppMobileVaul(): boolean {
	if (typeof window === "undefined") return false;
	return window.matchMedia(APP_MOBILE_VAUL_MQ).matches;
}
