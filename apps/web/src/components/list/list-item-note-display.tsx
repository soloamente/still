"use client";

import { cn } from "@still/ui/lib/utils";

/**
 * Read-only curator note under a list title — matches list lobby editorial copy.
 */
export function ListItemNoteDisplay({
	note,
	className,
	lineClamp = 4,
}: {
	note: string;
	className?: string;
	/** Tailwind line-clamp steps (1–6). */
	lineClamp?: 1 | 2 | 3 | 4 | 5 | 6;
}) {
	const trimmed = note.trim();
	if (!trimmed) return null;

	const clampClass =
		lineClamp === 1
			? "line-clamp-1"
			: lineClamp === 2
				? "line-clamp-2"
				: lineClamp === 3
					? "line-clamp-3"
					: lineClamp === 5
						? "line-clamp-5"
						: lineClamp === 6
							? "line-clamp-6"
							: "line-clamp-4";

	return (
		<p
			className={cn(
				"text-balance text-center font-editorial text-foreground/75 text-xs leading-relaxed sm:text-[0.8125rem]",
				clampClass,
				className,
			)}
		>
			{trimmed}
		</p>
	);
}
