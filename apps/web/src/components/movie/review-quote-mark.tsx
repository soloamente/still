import { cn } from "@still/ui/lib/utils";
import Image from "next/image";

/** Opening curly quote — source asset for review headline framing. */
const REVIEW_QUOTE_LEFT_SRC = "/icons/review-quote-left.png";

/** Intrinsic PNG ratio — wide mark; never force a square box (squishes the curls). */
const REVIEW_QUOTE_MARK_WIDTH = 398;
const REVIEW_QUOTE_MARK_HEIGHT = 266;

/** Small opening quote (top-left of headline). */
export function ReviewQuoteMarkLeft({ className }: { className?: string }) {
	return (
		<Image
			src={REVIEW_QUOTE_LEFT_SRC}
			alt=""
			width={REVIEW_QUOTE_MARK_WIDTH}
			height={REVIEW_QUOTE_MARK_HEIGHT}
			aria-hidden
			unoptimized
			className={cn(
				"h-3 w-auto max-w-none shrink-0 object-contain sm:h-3.5",
				className,
			)}
		/>
	);
}

/** Closing quote — same asset, flipped for the bottom-right corner. */
export function ReviewQuoteMarkRight({ className }: { className?: string }) {
	return (
		<Image
			src={REVIEW_QUOTE_LEFT_SRC}
			alt=""
			width={REVIEW_QUOTE_MARK_WIDTH}
			height={REVIEW_QUOTE_MARK_HEIGHT}
			aria-hidden
			unoptimized
			className={cn(
				"h-3 w-auto max-w-none shrink-0 rotate-180 object-contain sm:h-3.5",
				className,
			)}
		/>
	);
}
