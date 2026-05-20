import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

/** Settings page section — full-width header, no side-by-side title rail. */
export function MeSettingsSection({
	title,
	description,
	children,
	className,
}: {
	title: string;
	description?: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section className={cn("space-y-5", className)}>
			<header className="space-y-1">
				<h2 className="font-semibold text-foreground text-lg tracking-tight">
					{title}
				</h2>
				{description ? (
					<p className="max-w-prose text-balance text-muted-foreground text-sm leading-relaxed">
						{description}
					</p>
				) : null}
			</header>
			{children}
		</section>
	);
}

/** Raised field group on `bg-card` — depth via background, not borders. */
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
				"rounded-mobbin-3xl p-5 sm:p-6",
				featured ? "bg-foreground/4" : "bg-background",
				className,
			)}
		>
			{children}
		</div>
	);
}
