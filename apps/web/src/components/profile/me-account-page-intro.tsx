"use client";

import { cn } from "@still/ui/lib/utils";

import { MeAccountRevealItem } from "@/components/profile/me-account-content-reveal";

/** Left-aligned page lede — title lives in sticky top bar. */
export function MeAccountPageIntro({
	lede,
	handle,
	className,
}: {
	lede: string;
	handle?: string;
	className?: string;
}) {
	return (
		<MeAccountRevealItem>
			<header className={cn("space-y-2", className)}>
				{handle ? (
					<p className="font-medium text-foreground/80 text-xs tracking-wide">
						@{handle}
					</p>
				) : null}
				<p className="max-w-prose text-balance text-muted-foreground text-sm leading-relaxed md:text-base">
					{lede}
				</p>
			</header>
		</MeAccountRevealItem>
	);
}
