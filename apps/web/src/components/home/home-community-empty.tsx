import { buttonVariants } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

/**
 * Full-height centered empty tray for community lobby tabs — matches diary/lists tone.
 */
export function HomeCommunityEmpty({
	title,
	description,
	primaryHref,
	primaryLabel,
	secondaryHref,
	secondaryLabel,
}: {
	title: string;
	description: string;
	primaryHref?: string;
	primaryLabel?: string;
	secondaryHref?: string;
	secondaryLabel?: string;
}) {
	return (
		<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-6 sm:px-4 sm:py-10">
			<div
				className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border border-dashed bg-card/40 px-6 py-12 text-center sm:px-10 sm:py-14"
				role="status"
			>
				<div className="space-y-2">
					<p className="text-balance font-sans font-semibold text-foreground text-lg tracking-tight">
						{title}
					</p>
					<p className="text-balance text-muted-foreground text-sm leading-relaxed">
						{description}
					</p>
				</div>
				{primaryHref && primaryLabel ? (
					<div className="flex flex-wrap items-center justify-center gap-2">
						<Link
							href={primaryHref}
							className={cn(
								buttonVariants({ variant: "default", size: "pill" }),
							)}
						>
							{primaryLabel}
						</Link>
						{secondaryHref && secondaryLabel ? (
							<Link
								href={secondaryHref}
								className={cn(
									buttonVariants({ variant: "outline", size: "pill" }),
								)}
							>
								{secondaryLabel}
							</Link>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	);
}
