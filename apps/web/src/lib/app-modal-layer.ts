/**
 * Full-viewport modal/sheet overlay — portaled to `document.body` so `isolate`
 * catalogue grids and poster `z-[100]` hover stacks cannot clip or paint above it.
 * Sits above radial toolkit (`z-[200]`) and poster hover (`z-[100]`).
 */
export const APP_MODAL_OVERLAY_CLASS =
	"fixed inset-0 z-[250] grid min-h-[100dvh] place-items-end bg-absolute-black/82 backdrop-blur-sm md:place-items-center";

/** Popovers inside portaled modals must sit above {@link APP_MODAL_OVERLAY_CLASS}. */
export const APP_MODAL_POPOVER_POSITIONER_CLASS = "z-[260]";
