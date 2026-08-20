import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

/** Settings page section — full-width header, no side-by-side title rail. */
export function MeSettingsSection({
	title,
	description,
	children,
	className,
}: {
	/** Omit when the sticky top bar already owns the page `h1` for this section. */
	title?: string;
	description?: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section
			className={cn(
				// Content-sized by default. `flex-1 min-h-0` in an auto-height
				// column collapses the box so later cards slide under overflowing
				// media (Profile banner + portrait). Pages that need a stretch
				// target opt in via `SettingsSectionPage` `fillFirst`.
				"flex flex-none flex-col gap-5",
				className,
			)}
		>
			{title || description ? (
				<header className="shrink-0 space-y-1">
					{title ? (
						<h2 className="font-semibold text-foreground text-lg tracking-tight">
							{title}
						</h2>
					) : null}
					{description ? (
						<p className="max-w-prose text-balance text-muted-foreground text-sm leading-relaxed">
							{description}
						</p>
					) : null}
				</header>
			) : null}
			{children}
		</section>
	);
}

/** Canvas field group on the raised lobby — stretches with the section by default. */
export function MeSettingsPanel({
	children,
	className,
	featured,
}: {
	children: ReactNode;
	className?: string;
	/** Slightly stronger wash for experimental / spotlight blocks. */
	featured?: boolean;
}) {
	return (
		<div
			className={cn(
				// `rounded-mobbin-3xl` (24px) reads rounder than `rounded-2xl` while staying on the Mobbin radius ladder.
				"flex min-h-0 flex-1 flex-col rounded-mobbin-3xl p-5 sm:p-6",
				featured ? "bg-foreground/4" : "bg-background",
				className,
			)}
		>
			{children}
		</div>
	);
}
