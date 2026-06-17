/** Session flag while the streaming-region modal is open — What's New waits on this. */
export const WATCH_REGION_PROMPT_ACTIVE_KEY =
	"still:watch-region-prompt-active";

export function isWatchRegionPromptActive(): boolean {
	if (typeof window === "undefined") return false;
	try {
		return sessionStorage.getItem(WATCH_REGION_PROMPT_ACTIVE_KEY) === "1";
	} catch {
		return false;
	}
}

export function setWatchRegionPromptActive(active: boolean): void {
	if (typeof window === "undefined") return;
	try {
		if (active) {
			sessionStorage.setItem(WATCH_REGION_PROMPT_ACTIVE_KEY, "1");
		} else {
			sessionStorage.removeItem(WATCH_REGION_PROMPT_ACTIVE_KEY);
		}
	} catch {
		// Private browsing — best-effort only.
	}
}
