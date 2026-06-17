/** Clears stale `pointer-events: none` left on Vaul layers by older portaled confirms. */
export function healStuckVaulPointerEventsLock() {
	for (const layer of document.querySelectorAll<HTMLElement>(
		"[data-vaul-drawer], [data-vaul-overlay]",
	)) {
		if (layer.style.pointerEvents === "none") {
			layer.style.removeProperty("pointer-events");
		}
	}
}
