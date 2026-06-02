import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Track B — horizontal chip toolbar (Mobbin-style pills) for browse presets or
 * removable filter tokens. Shape + density reference: repository root `design.md`.
 * Use `role="toolbar"` so SR users get a named group.
 */
export function FilterChipRow({
	className,
	"aria-label": ariaLabel = "Filters",
	children,
}: {
	className?: string;
	"aria-label"?: string;
	children: ReactNode;
}) {
	return (
		<div
			role="toolbar"
			aria-label={ariaLabel}
			className={cn("flex flex-wrap items-center gap-2", className)}
		>
			{children}
		</div>
	);
}

// Pills read as soft tokens on the canvas: no hairline border, background carries the shape.
export const filterChipBaseClass =
	"inline-flex items-center justify-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-[var(--aker-duration)] ease-[var(--aker-ease)]";

export const filterChipIdleClass =
	"bg-background text-muted-foreground hover:bg-muted/45 hover:text-foreground";

const chipSelected = "bg-accent/15 text-foreground";

/** Browse preset that navigates to another catalogue route (e.g. Popular vs Upcoming). */
export function FilterChipLink({
	className,
	selected,
	children,
	...rest
}: ComponentProps<typeof Link> & { selected?: boolean }) {
	return (
		<Link
			className={cn(
				filterChipBaseClass,
				selected ? chipSelected : filterChipIdleClass,
				className,
			)}
			aria-current={selected ? "page" : undefined}
			{...rest}
		>
			{children}
		</Link>
	);
}

/** Dismissible filter token (e.g. clear active text query) — stays keyboard-focusable. */
export function FilterChipButton({
	className,
	children,
	...rest
}: ComponentProps<"button">) {
	return (
		<button
			type="button"
			className={cn(
				filterChipBaseClass,
				filterChipIdleClass,
				"cursor-pointer",
				className,
			)}
			{...rest}
		>
			{children}
		</button>
	);
}
