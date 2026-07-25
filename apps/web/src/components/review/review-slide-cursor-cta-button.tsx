"use client";

import { cn } from "@still/ui/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
	type ComponentPropsWithoutRef,
	type MutableRefObject,
	type ReactNode,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";

/** Trailing lag for the cursor pill — lower feels floatier. */
const CURSOR_CTA_LERP = 0.1;

const CURSOR_CTA_ENTER_TRANSITION = {
	duration: 0.16,
	ease: [0.22, 1, 0.36, 1] as const,
};

const CURSOR_CTA_EXIT_TRANSITION = {
	duration: 0.12,
	ease: [0.4, 0, 1, 1] as const,
};

type Point = { x: number; y: number };

function applyCursorCtaPosition(
	element: HTMLSpanElement | null,
	x: number,
	y: number,
): void {
	if (!element) return;
	element.style.left = `${x}px`;
	element.style.top = `${y}px`;
}

function CursorCtaPill({
	label,
	active,
	targetRef,
	displayRef,
}: {
	label: string;
	active: boolean;
	targetRef: MutableRefObject<Point>;
	displayRef: MutableRefObject<Point>;
}) {
	const reducedMotion = useReducedMotion();
	const pillRef = useRef<HTMLSpanElement>(null);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	useLayoutEffect(() => {
		applyCursorCtaPosition(
			pillRef.current,
			displayRef.current.x,
			displayRef.current.y,
		);
	}, [displayRef]);

	useEffect(() => {
		if (!active || reducedMotion) return undefined;

		let raf = 0;
		const tick = () => {
			const target = targetRef.current;
			const current = displayRef.current;
			current.x += (target.x - current.x) * CURSOR_CTA_LERP;
			current.y += (target.y - current.y) * CURSOR_CTA_LERP;
			applyCursorCtaPosition(pillRef.current, current.x, current.y);
			raf = window.requestAnimationFrame(tick);
		};

		raf = window.requestAnimationFrame(tick);
		return () => {
			window.cancelAnimationFrame(raf);
		};
	}, [active, displayRef, reducedMotion, targetRef]);

	if (!mounted) return null;

	return createPortal(
		<AnimatePresence>
			{active ? (
				<motion.span
					ref={pillRef}
					key="review-slide-cursor-cta"
					className="t-review-slide__cta-label pointer-events-none fixed z-220 -translate-x-1/2 -translate-y-1/2 will-change-[transform,opacity,left,top]"
					initial={
						reducedMotion
							? false
							: { opacity: 0, scale: 0.25, filter: "blur(2px)" }
					}
					animate={{
						opacity: 1,
						scale: 1,
						filter: "blur(0px)",
					}}
					exit={
						reducedMotion
							? undefined
							: {
									opacity: 0,
									scale: 0.25,
									filter: "blur(2px)",
									transition: CURSOR_CTA_EXIT_TRANSITION,
								}
					}
					transition={CURSOR_CTA_ENTER_TRANSITION}
					aria-hidden
				>
					{label}
				</motion.span>
			) : null}
		</AnimatePresence>,
		document.body,
	);
}

/**
 * Truncated review-slide trigger — on pointer devices the CTA pill follows the
 * cursor instead of sitting fixed in the block center (hero synopsis pattern).
 */
export function ReviewSlideCursorCtaButton({
	label,
	className,
	children,
	onPointerEnter,
	onPointerMove,
	onPointerLeave,
	...rest
}: {
	label: string;
	children: ReactNode;
} & ComponentPropsWithoutRef<"button">) {
	const reducedMotion = useReducedMotion();
	const [hoverCapable, setHoverCapable] = useState(false);
	const [cursorCtaActive, setCursorCtaActive] = useState(false);
	const targetRef = useRef<Point>({ x: 0, y: 0 });
	const displayRef = useRef<Point>({ x: 0, y: 0 });
	const useCursorCta = !reducedMotion && hoverCapable;

	useEffect(() => {
		setHoverCapable(window.matchMedia("(hover: hover)").matches);
	}, []);

	const syncPointer = useCallback((x: number, y: number) => {
		targetRef.current = { x, y };
	}, []);

	const handlePointerEnter = useCallback(
		(event: ReactPointerEvent<HTMLButtonElement>) => {
			onPointerEnter?.(event);
			if (!hoverCapable || event.pointerType === "touch") return;
			syncPointer(event.clientX, event.clientY);
			displayRef.current = { x: event.clientX, y: event.clientY };
			setCursorCtaActive(true);
		},
		[hoverCapable, onPointerEnter, syncPointer],
	);

	const handlePointerMove = useCallback(
		(event: ReactPointerEvent<HTMLButtonElement>) => {
			onPointerMove?.(event);
			if (!hoverCapable || event.pointerType === "touch") return;
			syncPointer(event.clientX, event.clientY);
		},
		[hoverCapable, onPointerMove, syncPointer],
	);

	const handlePointerLeave = useCallback(
		(event: ReactPointerEvent<HTMLButtonElement>) => {
			onPointerLeave?.(event);
			setCursorCtaActive(false);
		},
		[onPointerLeave],
	);

	return (
		<>
			<button
				type="button"
				className={cn(className, useCursorCta && "t-review-slide--cursor-cta")}
				onPointerEnter={handlePointerEnter}
				onPointerMove={handlePointerMove}
				onPointerLeave={handlePointerLeave}
				{...rest}
			>
				{children}
				{!useCursorCta ? (
					<div aria-hidden className="t-review-slide__cta">
						<span className="t-review-slide__cta-label">{label}</span>
					</div>
				) : null}
			</button>
			{useCursorCta ? (
				<CursorCtaPill
					label={label}
					active={cursorCtaActive}
					targetRef={targetRef}
					displayRef={displayRef}
				/>
			) : null}
		</>
	);
}
