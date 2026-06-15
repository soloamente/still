import { cn } from "@still/ui/lib/utils";

import {
	type QuoteAttributionFields,
	resolveQuoteAttribution,
} from "@/lib/quote-attribution";

/** Muted speaker + mono timestamp row under quote body. */
export function QuoteAttribution({
	speaker,
	timestampLabel,
	className,
	size = "detail",
}: QuoteAttributionFields & {
	className?: string;
	size?: "detail" | "compact";
}) {
	const resolved = resolveQuoteAttribution({
		speaker,
		timestampLabel,
	});

	if (!resolved.speaker && !resolved.timestampLabel) {
		return null;
	}

	const textSize = size === "compact" ? "text-xs" : "text-sm";

	return (
		<footer
			className={cn(
				"flex flex-wrap items-baseline gap-x-3 gap-y-1 text-muted-foreground",
				textSize,
				className,
			)}
		>
			{resolved.speaker ? (
				<cite className="min-w-0 text-pretty not-italic">
					<span className="font-medium text-foreground/80">
						— {resolved.speaker}
					</span>
				</cite>
			) : null}
			{resolved.timestampLabel ? (
				<time
					className={cn(
						"shrink-0 font-mono text-xs tabular-nums tracking-wide",
						resolved.speaker ? "ml-auto" : undefined,
					)}
					dateTime={resolved.timestampLabel}
				>
					{resolved.timestampLabel}
				</time>
			) : null}
		</footer>
	);
}
