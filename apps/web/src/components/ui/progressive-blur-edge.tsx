"use client";

import { cn } from "@still/ui/lib/utils";

/**
 * Stacked blur strips — intensity ramps toward the edge (not one flat scrim).
 * Each slice uses a stronger `backdrop-filter` than the last.
 */
const PROGRESSIVE_BLUR_RIGHT_STRIPS: ReadonlyArray<{
	widthClassName: string;
	blurClassName: string;
}> = [
	{ widthClassName: "w-2", blurClassName: "backdrop-blur-[1px]" },
	{ widthClassName: "w-2.5", blurClassName: "backdrop-blur-[2px]" },
	{ widthClassName: "w-3", blurClassName: "backdrop-blur-[4px]" },
	{ widthClassName: "w-3.5", blurClassName: "backdrop-blur-[6px]" },
	{ widthClassName: "w-4", blurClassName: "backdrop-blur-[10px]" },
	{ widthClassName: "w-5", blurClassName: "backdrop-blur-[16px]" },
];

type ProgressiveBlurEdgeProps = {
	/** When false, the edge is fully hidden. */
	visible: boolean;
	className?: string;
	/** Skip blur strips on software-rendered GPUs — fall back to a soft mask fade. */
	softwareGpu?: boolean;
};

/** Right-edge progressive blur for horizontal poster rails. */
export function ProgressiveBlurEdgeRight({
	visible,
	className,
	softwareGpu = false,
}: ProgressiveBlurEdgeProps) {
	return (
		<div
			aria-hidden
			className={cn(
				"pointer-events-none absolute right-0 z-10 flex h-full w-full flex-row justify-end overflow-hidden transition-opacity duration-200 motion-reduce:transition-none",
				visible ? "opacity-100" : "opacity-0",
				className,
			)}
		>
			{softwareGpu ? (
				<div className="h-full w-16 bg-linear-to-l from-card/0 via-card/40 to-card/75 sm:w-20" />
			) : (
				PROGRESSIVE_BLUR_RIGHT_STRIPS.map((strip) => (
					<div
						key={`${strip.widthClassName}-${strip.blurClassName}`}
						className={cn(
							"h-full shrink-0",
							strip.widthClassName,
							strip.blurClassName,
						)}
					/>
				))
			)}
		</div>
	);
}
