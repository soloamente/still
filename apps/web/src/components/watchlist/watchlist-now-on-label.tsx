"use client";

import { cn } from "@still/ui/lib/utils";

import { WatchlistProviderCircleLogo } from "@/components/watchlist/watchlist-provider-circle-logo";

const NOW_ON_PREFIX = /^Now on\s+(.+)$/i;

/** “Now on” plus the service name, with the platform mark left of the name. */
export function WatchlistNowOnLabel({
	label,
	logoUrl,
	className,
	logoClassName = "size-5",
}: {
	label: string;
	logoUrl?: string | null;
	className?: string;
	logoClassName?: string;
}) {
	const match = NOW_ON_PREFIX.exec(label.trim());
	const serviceName = match?.[1]?.trim() ?? null;
	if (!serviceName) {
		return <span className={className}>{label}</span>;
	}

	return (
		<span
			className={cn(
				"inline-flex min-w-0 max-w-full items-center justify-center gap-1.5",
				className,
			)}
		>
			<span className="shrink-0">Now on</span>
			{logoUrl ? (
				<WatchlistProviderCircleLogo
					src={logoUrl}
					name={serviceName}
					className={cn("size-5 shrink-0", logoClassName)}
				/>
			) : null}
			<span className="min-w-0 truncate">{serviceName}</span>
		</span>
	);
}
