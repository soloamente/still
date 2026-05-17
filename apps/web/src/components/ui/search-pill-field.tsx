"use client";

import { cn } from "@still/ui/lib/utils";
import { Search, X } from "lucide-react";
import type { ComponentProps } from "react";

type InputProps = Omit<ComponentProps<"input">, "className">;

/**
 * Track B — pill-shaped search field (Mobbin / Savee pattern; see `/design.md`): icon + optional
 * scope chip + borderless text input + clear control. Keeps `text-base` on small
 * viewports to avoid iOS zoom-on-focus.
 */
export function SearchPillField({
	containerClassName,
	scopeLabel,
	onClearScope,
	showClearQuery = true,
	onClearQuery,
	className,
	...inputProps
}: InputProps & {
	containerClassName?: string;
	/** Static scope (e.g. “Films”) — pass `onClearScope` to make it a dismissible chip. */
	scopeLabel?: string;
	onClearScope?: () => void;
	showClearQuery?: boolean;
	onClearQuery?: () => void;
	className?: string;
}) {
	const value = typeof inputProps.value === "string" ? inputProps.value : "";
	const hasQuery = value.trim().length > 0;

	return (
		<div
			className={cn(
				"flex min-h-12 w-full max-w-2xl items-center gap-2 rounded-full border border-border/80 bg-surface-raised/55 px-3 shadow-sm backdrop-blur-sm sm:gap-3 sm:px-4",
				"focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25",
				containerClassName,
			)}
		>
			<Search
				className="size-4 shrink-0 text-muted-foreground sm:size-[1.125rem]"
				aria-hidden
			/>
			{scopeLabel ? (
				onClearScope ? (
					<button
						type="button"
						onClick={onClearScope}
						className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-foreground text-xs hover:bg-muted"
						aria-label={`Clear scope: ${scopeLabel}`}
					>
						{scopeLabel}
						<X className="size-3 opacity-70" aria-hidden />
					</button>
				) : (
					<span className="shrink-0 rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-muted-foreground text-xs">
						{scopeLabel}
					</span>
				)
			) : null}
			<input
				{...inputProps}
				className={cn(
					"min-h-11 min-w-0 flex-1 border-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/70 md:text-sm",
					className,
				)}
			/>
			{showClearQuery && hasQuery && onClearQuery ? (
				<button
					type="button"
					onClick={onClearQuery}
					className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
					aria-label="Clear search text"
				>
					<X className="size-4" aria-hidden />
				</button>
			) : null}
		</div>
	);
}
