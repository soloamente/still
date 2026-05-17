import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * A common header + content shell used across feed, movie, profile.
 * Heading uses `font-display` (Fraunces) so every page-section title reads
 * cinematic; subtitle stays UI sans at body size. Kickers are muted sentence-case
 * labels (wide tracking, no forced uppercase) so dense feeds stay scannable.
 */
export function Section({
	/** Tiny runway line above the title — muted label; authors pass sentence-case cinema phrases. */
	kicker,
	title,
	subtitle,
	rightSlot,
	children,
	className,
}: {
	kicker?: ReactNode;
	title: ReactNode;
	subtitle?: ReactNode;
	rightSlot?: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section className={cn("space-y-5", className)}>
			<header className="flex items-end justify-between gap-3">
				<div>
					{kicker ? (
						/* Quiet runway label (Mobbin-style): sentence case as authored, no marquee caps. */
						<p className="mb-1.5 font-medium text-[11px] text-muted-foreground tracking-wide">
							{kicker}
						</p>
					) : null}
					<h2 className="font-display font-medium text-2xl tracking-[-0.02em] sm:text-[1.65rem] md:text-3xl lg:text-[2.0625rem]">
						{title}
					</h2>
					{subtitle ? (
						<p className="text-muted-foreground text-sm">{subtitle}</p>
					) : null}
				</div>
				{rightSlot}
			</header>
			{children}
		</section>
	);
}
