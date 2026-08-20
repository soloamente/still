import { buttonVariants } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

/**
 * Raised empty tray — parent supplies vertical centering via {@link HOME_COMMUNITY_LOBBY_EMPTY_CENTER_CLASSNAME}.
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
		<div
			className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl bg-background px-6 py-12 text-center sm:px-10 sm:py-14"
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
						className={cn(buttonVariants({ variant: "default", size: "pill" }))}
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
	);
}
