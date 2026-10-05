"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

import { searchDialogKeyboardFocusActive } from "@/lib/search-dialog-keyboard-focus";

/**
 * Keyboard focus halo for ⌘K tiles — box-shadow on this shell is not clipped by
 * `overflow-hidden` on inner logos/posters (Tailwind rings on those buttons are).
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
