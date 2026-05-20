import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

/** Asymmetric section — title rail left, fields right (DESIGN_VARIANCE 8). */
export function MeFormSection({
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
		<section
			className={cn(
				"grid gap-6 md:grid-cols-[minmax(0,10.5rem)_minmax(0,1fr)] md:gap-x-10 md:gap-y-4",
				className,
			)}
		>
			<div className="space-y-2 md:pt-0.5">
				<h2 className="font-semibold text-base text-foreground tracking-tight md:text-lg">
					{title}
				</h2>
				{description ? (
					<p className="max-w-prose text-balance text-muted-foreground text-sm leading-relaxed">
						{description}
					</p>
				) : null}
			</div>
			<div className="min-w-0 space-y-4">{children}</div>
		</section>
	);
}
