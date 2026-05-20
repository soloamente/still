"use client";

import type { LucideIcon } from "lucide-react";

/**
 * Centered empty tray inside the profile `bg-card` shell — matches achievements / notifications tone.
 */
export function ProfileSocialEmpty({
	icon: Icon,
	title,
	body,
}: {
	icon: LucideIcon;
	title: string;
	body: string;
}) {
	return (
		<div
			className="flex min-h-[min(36vh,18rem)] flex-1 flex-col items-center justify-center px-4 py-10 text-center"
			role="status"
		>
			<span className="inline-flex size-12 items-center justify-center rounded-full bg-background text-foreground shadow-sm">
				<Icon className="size-5 opacity-90" strokeWidth={1.5} aria-hidden />
			</span>
			<p className="mt-4 font-medium text-base text-foreground">{title}</p>
			<p className="mx-auto mt-2 max-w-[18rem] text-balance text-muted-foreground text-sm leading-relaxed">
				{body}
			</p>
		</div>
	);
}
