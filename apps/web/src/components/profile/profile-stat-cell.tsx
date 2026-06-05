"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

/** Uniform profile header metric — number + caption, optional tap target. */
export function ProfileStatCell({
	value,
	label,
	onClick,
	className,
}: {
	value: ReactNode;
	label: string;
	onClick?: () => void;
	className?: string;
}) {
	const content = (
		<>
			<span className="font-semibold text-foreground text-sm tabular-nums">
				{value}
			</span>
			<span className="text-[10px] text-muted-foreground">{label}</span>
		</>
	);

	const shellClass = cn(
		"flex min-h-10 min-w-[4.75rem] flex-col items-center justify-center gap-0.5 rounded-xl bg-background px-3 py-2.5",
		className,
	);

	if (onClick) {
		return (
			<button
				type="button"
				onClick={onClick}
				className={cn(
					shellClass,
					"transition-[background-color,transform] duration-200 ease-out motion-reduce:transition-none",
					"[@media(hover:hover)]:hover:bg-muted/20",
					"active:scale-[0.96] motion-reduce:active:scale-100",
				)}
			>
				{content}
			</button>
		);
	}

	return <div className={shellClass}>{content}</div>;
}
