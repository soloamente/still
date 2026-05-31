"use client";

import IconListPlay from "@still/ui/icons/list-play";
import { cn } from "@still/ui/lib/utils";

/**
 * Subtle curator designation on patron profiles (SN.11).
 */
export function ProfileCuratorBadge({
	headline,
	className,
}: {
	headline?: string | null;
	className?: string;
}) {
	return (
		<div className={cn("mt-2 flex flex-col items-center gap-1", className)}>
			<span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-background px-3 py-1 font-medium text-[11px] text-desert-orange tracking-wide">
				<IconListPlay className="size-3.5 shrink-0 opacity-90" aria-hidden />
				Curator
			</span>
			{headline?.trim() ? (
				<p className="max-w-sm text-balance text-center text-muted-foreground text-xs tabular-nums leading-relaxed">
					{headline.trim()}
				</p>
			) : null}
		</div>
	);
}
