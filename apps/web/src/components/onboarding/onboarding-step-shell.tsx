"use client";

import { cn } from "@still/ui/lib/utils";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import useMeasure from "react-use-measure";
import { readPageSlideMs } from "@/lib/css-duration";

type SlideLayer = {
	key: string;
	content: ReactNode;
	phase: "enter" | "exit";
};

type OnboardingStepShellProps = {
	stepKey: string;
	direction: number;
	children: ReactNode;
	/** Optional nav row rendered below step content (back / continue). */
	footer?: ReactNode;
};

/**
 * Step container — transitions.dev page side-by-side + card-resize height.
 * Footer stays in flow so Back / Continue do not slide with the copy.
 */
export function OnboardingStepShell({
	stepKey,
	direction,
	children,
	footer,
}: OnboardingStepShellProps) {
	const cacheRef = useRef({ key: stepKey, node: children });
	const childrenRef = useRef(children);
	childrenRef.current = children;
	const [layers, setLayers] = useState<SlideLayer[]>([]);
	const [isActive, setIsActive] = useState(false);
	const [bodyRef, bounds] = useMeasure();
	const [slideMinH, setSlideMinH] = useState(0);
	const [hasMeasured, setHasMeasured] = useState(false);
	const isAnimating = layers.length > 1;

	useLayoutEffect(() => {
		if (bounds.height > 0 && !hasMeasured) setHasMeasured(true);
	}, [bounds.height, hasMeasured]);

	useLayoutEffect(() => {
		if (stepKey === cacheRef.current.key) return;

		const outgoing = cacheRef.current;
		const incoming = childrenRef.current;
		let completed = false;
		setLayers([
			{ key: outgoing.key, content: outgoing.node, phase: "exit" },
			{ key: stepKey, content: incoming, phase: "enter" },
		]);
		setIsActive(false);
		cacheRef.current = { key: stepKey, node: incoming };

		const frame = window.requestAnimationFrame(() => {
			setIsActive(true);
		});
		const timeoutMs = readPageSlideMs();
		const timeoutId = window.setTimeout(() => {
			completed = true;
			setLayers([]);
			setIsActive(false);
		}, timeoutMs);

		return () => {
			window.cancelAnimationFrame(frame);
			window.clearTimeout(timeoutId);
			// Strict Mode re-invokes this effect; restore so the replay can snapshot again.
			if (!completed) cacheRef.current = outgoing;
		};
	}, [stepKey]);

	if (cacheRef.current.key === stepKey) {
		cacheRef.current.node = children;
	}

	const height = bounds.height > 0 ? bounds.height : undefined;
	const slideDir = direction < 0 ? "back" : "forward";
	const displayLayers: SlideLayer[] = isAnimating
		? layers
		: [{ key: stepKey, content: children, phase: "enter" }];

	return (
		<div
			className={cn("w-full overflow-hidden", hasMeasured && "t-resize")}
			style={height != null ? { height } : undefined}
		>
			{/* Inline gutter so AuthMotionInput’s 1.01 focus scale isn’t clipped by overflow-hidden. */}
			<div className="flex flex-col gap-8 px-1.5 py-1" ref={bodyRef}>
				<div
					className={cn(
						"t-page-slide relative w-full",
						isAnimating && "is-animating",
						isAnimating && isActive && "is-active",
						// Auto-height wizard pages — `/me` uses inset:0 to fill a flex pane.
						"[&.is-animating_.t-page]:inset-x-0 [&.is-animating_.t-page]:top-0 [&.is-animating_.t-page]:bottom-auto [&.is-animating_.t-page]:h-auto",
					)}
					data-direction={slideDir}
					style={
						isAnimating && slideMinH > 0 ? { minHeight: slideMinH } : undefined
					}
				>
					{displayLayers.map((layer) => (
						<section
							key={`${layer.key}-${layer.phase}`}
							aria-hidden={layer.phase === "exit"}
							className={cn(
								"t-page w-full",
								layer.phase === "enter" ? "is-enter" : "is-exit",
							)}
							data-page-id={layer.key}
							ref={
								layer.phase === "enter"
									? (node) => {
											const next = node?.offsetHeight ?? 0;
											if (next > 0) {
												setSlideMinH((prev) => (prev === next ? prev : next));
											}
										}
									: undefined
							}
						>
							{layer.content}
						</section>
					))}
				</div>
				{footer ? <div>{footer}</div> : null}
			</div>
		</div>
	);
}
