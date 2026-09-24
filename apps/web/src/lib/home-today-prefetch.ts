export type TodayPrefetchTrigger = "mount" | "painted" | "hover";

/**
 * The inactive Today tab is not requested on mount. One paint of the active
 * block, or a hover on the other browse pill, starts it — and only once.
 */
export function shouldPrefetchInactiveToday(input: {
	inactiveRequested: boolean;
	trigger: TodayPrefetchTrigger;
}): boolean {
	if (input.inactiveRequested) return false;
	switch (input.trigger) {
		case "mount":
			return false;
		case "painted":
		case "hover":
			return true;
		default: {
			const unhandled: never = input.trigger;
			return unhandled;
		}
	}
}
