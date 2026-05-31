"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";

import { LIST_DESCRIPTION_PUBLIC_HINT } from "@/lib/list-quality";

/**
 * Owner-only banner when a public list has no discoverability description yet.
 */
export function ListDetailDiscoverabilityNudge({
	className,
	onEditDetails,
}: {
	className?: string;
	onEditDetails: () => void;
}) {
	return (
		<div
			className={cn(
				"mt-4 w-full max-w-md rounded-2xl bg-background px-4 py-3 text-center",
				className,
			)}
		>
			<p className="text-balance text-muted-foreground text-sm leading-relaxed">
				{LIST_DESCRIPTION_PUBLIC_HINT}
			</p>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="mt-2"
				onClick={onEditDetails}
			>
				Add description
			</Button>
		</div>
	);
}
