/**
 * Full-viewport modal/sheet overlay — portaled to `document.body` so `isolate`
 * catalogue grids and poster `z-[100]` hover stacks cannot clip or paint above it.
 * Sits above radial toolkit (`z-[200]`) and poster hover (`z-[100]`).
 * Pair with `html[data-software-gpu]` rules in globals.css to drop backdrop-blur.
 */
export const APP_MODAL_OVERLAY_CLASS =
	"modal-overlay-scrim fixed inset-0 z-[250] grid min-h-[100dvh] place-items-end bg-absolute-black/82 backdrop-blur-sm md:place-items-center";

/**
 * Shared scrollport for review composer, quick log, and create-list sheets —
 * `modal-sheet-scroll` adds paint containment (see globals.css).
 */
export const MODAL_SHEET_SCROLL_CLASS =
	"modal-sheet-scroll max-h-[min(calc(92svh-11rem),640px)] overflow-y-auto overscroll-contain pb-24 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Popovers inside portaled modals must sit above {@link APP_MODAL_OVERLAY_CLASS}. */
export const APP_MODAL_POPOVER_POSITIONER_CLASS = "z-[260]";
