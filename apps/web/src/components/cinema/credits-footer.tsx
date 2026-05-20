import { cn } from "@still/ui/lib/utils";

/**
 * “End credits” crawl — stacked small-caps lines for footers on profile, movie, etc.
 * Intentionally understated so it reads as texture, not a second page of content.
 */
export function CreditsFooter({
	lines,
	className,
}: {
	lines: string[];
	className?: string;
}) {
	if (!lines.length) return null;

	return (
		<footer
			className={cn(
				"pt-10 text-center font-medium text-[10px] text-muted-foreground uppercase tracking-[0.35em]",
				className,
			)}
		>
			<p className="mb-3 text-[9px] text-muted-foreground/80 tracking-[0.55em]">
				The end
			</p>
			<ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
				{lines.map((line) => (
					<li key={line} className="tabular-nums">
						{line}
					</li>
				))}
			</ul>
		</footer>
	);
}
