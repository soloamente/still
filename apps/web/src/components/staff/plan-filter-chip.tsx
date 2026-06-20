"use client";

import { cn } from "@still/ui/lib/utils";
import { Check } from "lucide-react";

/** Staff plans filter chip — label left, circled check affordance on the right. */
export function PlanFilterChip({
	label,
	selected,
	onClick,
	disabled = false,
}: {
	label: string;
	selected: boolean;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			aria-pressed={selected}
			onClick={onClick}
			className={cn(
				"inline-flex min-h-10 w-fit shrink-0 items-center gap-2.5 rounded-full bg-background px-3 py-2 font-medium text-sm transition-colors duration-200 sm:px-4",
				selected
					? "text-foreground"
					: "text-muted-foreground/55 [@media(hover:hover)]:hover:text-foreground/85",
				disabled && "pointer-events-none opacity-45",
			)}
		>
			<span>{label}</span>
			<span
				className={cn(
					"flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200",
					selected
						? "border-foreground bg-foreground text-background"
						: "border-foreground/20 bg-transparent text-transparent",
				)}
				aria-hidden
			>
				<Check className="size-3" strokeWidth={2.5} />
			</span>
		</button>
	);
}
