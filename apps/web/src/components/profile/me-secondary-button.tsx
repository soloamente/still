"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import {
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
} from "@/lib/detail-action-motion";

const secondaryPill = cn(
	"inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-background px-4 py-2 font-semibold text-foreground text-sm",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
	"disabled:pointer-events-none disabled:opacity-45",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
);

/** Matches account chrome pills — `font-medium` and same rhythm as Profile link. */
const secondaryPillCompact = cn(
	"inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-background px-4 py-2 font-medium text-foreground text-sm",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
	"disabled:pointer-events-none disabled:opacity-45",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
);

export function MeSecondaryButton({
	children,
	disabled,
	onClick,
	type = "button",
	className,
	size = "default",
	"aria-label": ariaLabel,
}: {
	children: ReactNode;
	disabled?: boolean;
	onClick?: () => void;
	type?: "button";
	className?: string;
	/** `compact` — same typography weight as the Profile pill in `MeAccountTopBar`. */
	size?: "default" | "compact";
	"aria-label"?: string;
}) {
	const pill = size === "compact" ? secondaryPillCompact : secondaryPill;
	return (
		<DetailMotionButton
			type={type}
			disabled={disabled}
			onClick={onClick}
			aria-label={ariaLabel}
			className={cn(pill, className)}
		>
			{children}
		</DetailMotionButton>
	);
}
