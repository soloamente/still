"use client";

import { Loader2 } from "lucide-react";
import type { RefObject } from "react";

export function CommunityInfiniteFooter({
	footerState,
	sentinelRef,
	retry,
	loadingLabel,
}: {
	footerState: "idle" | "loading" | "exhausted" | "error";
	sentinelRef: RefObject<HTMLDivElement | null>;
	retry: () => void;
	loadingLabel: string;
}) {
	return (
		<>
			{footerState !== "exhausted" ? (
				<div
					ref={sentinelRef}
					className="pointer-events-none h-px w-full shrink-0"
					aria-hidden
				/>
			) : null}
			<div
				className="flex min-h-10 justify-center pt-4 pb-8"
				aria-live="polite"
				aria-busy={footerState === "loading"}
			>
				{footerState === "loading" ? (
					<>
						<Loader2
							className="size-7 animate-spin text-muted-foreground"
							aria-hidden
						/>
						<span className="sr-only">{loadingLabel}</span>
					</>
				) : null}
				{footerState === "error" ? (
					<p className="text-center text-muted-foreground text-sm">
						Something jammed loading more —{" "}
						<button
							type="button"
							className="underline decoration-dashed underline-offset-2 hover:text-foreground"
							onClick={retry}
						>
							try again
						</button>
						.
					</p>
				) : null}
			</div>
		</>
	);
}
