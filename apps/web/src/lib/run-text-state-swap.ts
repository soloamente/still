/** `--text-swap-dur` when CSS is available; 150ms under bun test (no document). */
export function readTextSwapDurationMs(): number {
	if (typeof document === "undefined") return 150;
	const parsed = Number.parseFloat(
		getComputedStyle(document.documentElement)
			.getPropertyValue("--text-swap-dur")
			.trim(),
	);
	return Number.isFinite(parsed) ? parsed : 150;
}

/** transitions.dev text-states-swap — exit, set text, enter (same as Letterboxd). */
export function runTextStateSwap(el: HTMLElement, next: string) {
	const dur = readTextSwapDurationMs();
	el.classList.add("is-exit");
	window.setTimeout(() => {
		el.textContent = next;
		el.classList.remove("is-exit");
		el.classList.add("is-enter-start");
		void el.offsetHeight;
		el.classList.remove("is-enter-start");
	}, dur);
}
