"use client";

import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";

import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";

const primaryPill = cn(
	"inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 font-semibold text-background text-sm",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
	"disabled:pointer-events-none disabled:opacity-45",
);

/** Matches account chrome pills (`MeAccountTopBar` Profile link). */
const primaryPillCompact = cn(
	"inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-foreground px-4 py-2 font-medium text-background text-sm",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
	"disabled:pointer-events-none disabled:opacity-45",
);

export function MeSaveButton({
	children,
	disabled,
	loading,
	type = "button",
	onClick,
	size = "default",
}: {
	children: React.ReactNode;
	disabled?: boolean;
	loading?: boolean;
	type?: "button" | "submit";
	onClick?: () => void;
	/** `compact` — same height and padding as the Profile pill in `MeAccountTopBar`. */
	size?: "default" | "compact";
}) {
	const pill = size === "compact" ? primaryPillCompact : primaryPill;
	return (
		<DetailMotionButton
			type={type}
			disabled={disabled || loading}
			onClick={onClick}
			className={pill}
		>
			{loading ? (
				<Loader2
					className={
						size === "compact" ? "size-3 animate-spin" : "size-4 animate-spin"
					}
					aria-hidden
				/>
			) : null}
			{children}
		</DetailMotionButton>
	);
}
