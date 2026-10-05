import { cn } from "@still/ui/lib/utils";

/** White primary-ink halo — `box-shadow` survives tile `overflow-hidden`. */
export const SEARCH_DIALOG_KEYBOARD_FOCUS_WRAP_CLASS =
	"search-dialog-keyboard-focus-wrap";

export function searchDialogKeyboardFocusActive(focused: boolean): string {
	if (!focused) return "";
	return cn("relative z-[1]", SEARCH_DIALOG_KEYBOARD_FOCUS_WRAP_CLASS);
}

/** @deprecated Prefer {@link SearchDialogKeyboardFocusWrap} + {@link searchDialogKeyboardFocusActive}. */
export function searchDialogKeyboardFocusClass(
	focused: boolean,
	_variant: "inset" | "outset" = "inset",
): string {
	return searchDialogKeyboardFocusActive(focused);
}
