"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

import { searchDialogKeyboardFocusActive } from "@/lib/search-dialog-keyboard-focus";

/**
 * Keyboard focus halo for ⌘K tiles — box-shadow on this shell is not clipped by
 * `overflow-hidden` on inner logos/posters (Tailwind rings on those buttons are).
 *
 * Default `inline-flex` suits fixed-size rail chips. Wrapping grids that rely on
 * `w-full` + aspect frames must pass `flex w-full` (or `block w-full`) so
 * `inline-flex` does not shrink-wrap absolute `Image fill` children to ~0.
 */
export function SearchDialogKeyboardFocusWrap({
	focused,
	className,
	children,
}: {
	focused: boolean;
	className?: string;
	children: ReactNode;
}) {
	return (
		<span
			className={cn(
				"inline-flex shrink-0",
				className,
				searchDialogKeyboardFocusActive(focused),
			)}
		>
			{children}
		</span>
	);
}
