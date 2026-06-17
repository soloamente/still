/** Portaled delete confirms — outer shell ignores hits so a stuck exit cannot block drawer scroll. */
export const DELETE_CONFIRM_OVERLAY_CLASS =
	"pointer-events-none fixed inset-0 z-[250] isolate grid min-h-[100dvh] place-items-center overflow-y-auto overscroll-contain px-4 py-8";

/** Backdrop + panel opt back into pointer events for dismiss + dialog controls. */
export const DELETE_CONFIRM_BACKDROP_CLASS =
	"pointer-events-auto absolute inset-0 bg-absolute-black/78 backdrop-blur-sm";
