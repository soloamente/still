/** Browser event — profile quote pins changed from `/quotes`. */
export const QUOTE_PINS_CHANGED_EVENT = "sense:quote-pins-changed";

/** Notify profile quote strip to refetch pinned previews. */
export function notifyQuotePinsChanged() {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new CustomEvent(QUOTE_PINS_CHANGED_EVENT));
}
