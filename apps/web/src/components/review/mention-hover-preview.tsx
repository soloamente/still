"use client";

import { cn } from "@still/ui/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import {
	type Dispatch,
	type PointerEvent as ReactPointerEvent,
	type SetStateAction,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";

import type { ContentMentionPart } from "@/lib/content-mentions";
import {
	fetchMentionHoverPreview,
	type MentionHoverPreviewPayload,
} from "@/lib/fetch-mention-hover-preview";

type MentionEntityPart = Exclude<ContentMentionPart, { type: "text" }>;

export type MentionHoverPreviewState = MentionHoverPreviewPayload & {
	x: number;
	y: number;
};

const POSTER_WIDTH = 112;
const POSTER_HEIGHT = 168;
const PORTRAIT_SIZE = 88;
const CURSOR_OFFSET = 18;
const VIEWPORT_PAD = 12;
/** Lower = more trailing lag while the chip follows the pointer. */
const CURSOR_FOLLOW_LERP = 0.075;

const PREVIEW_ENTER_TRANSITION = {
	duration: 0.16,
	ease: [0.22, 1, 0.36, 1] as const,
};

const PREVIEW_EXIT_TRANSITION = {
	duration: 0.12,
	ease: [0.4, 0, 1, 1] as const,
};

/** Keep the chip on-screen while trailing the pointer. */
function clampPreviewPosition(
	x: number,
	y: number,
	width: number,
	height: number,
): { left: number; top: number } {
	let left = x + CURSOR_OFFSET;
	let top = y + CURSOR_OFFSET;

	if (left + width + VIEWPORT_PAD > window.innerWidth) {
		left = x - width - CURSOR_OFFSET;
	}
	if (top + height + VIEWPORT_PAD > window.innerHeight) {
		top = y - height - CURSOR_OFFSET;
	}

	left = Math.max(
		VIEWPORT_PAD,
		Math.min(left, window.innerWidth - width - VIEWPORT_PAD),
	);
	top = Math.max(
		VIEWPORT_PAD,
		Math.min(top, window.innerHeight - height - VIEWPORT_PAD),
	);

	return { left, top };
}

function previewDimensions(shape: MentionHoverPreviewPayload["shape"]): {
	width: number;
	height: number;
} {
	if (shape === "poster") {
		return { width: POSTER_WIDTH, height: POSTER_HEIGHT };
	}
	return { width: PORTRAIT_SIZE, height: PORTRAIT_SIZE };
}

function applyPreviewPosition(
	element: HTMLDivElement | null,
	x: number,
	y: number,
	shape: MentionHoverPreviewPayload["shape"],
): void {
	if (!element) return;
	const { width, height } = previewDimensions(shape);
	const { left, top } = clampPreviewPosition(x, y, width, height);
	element.style.left = `${left}px`;
	element.style.top = `${top}px`;
}

function MentionHoverPreviewChip({
	preview,
}: {
	preview: MentionHoverPreviewState;
}) {
	const reducedMotion = useReducedMotion();
	const shellRef = useRef<HTMLDivElement>(null);
	const targetRef = useRef({ x: preview.x, y: preview.y });
	const displayRef = useRef({ x: preview.x, y: preview.y });
	const { width, height } = previewDimensions(preview.shape);

	// Sync the springy follow target whenever the pointer moves.
	useEffect(() => {
		targetRef.current = { x: preview.x, y: preview.y };
		if (reducedMotion) {
			displayRef.current = targetRef.current;
			applyPreviewPosition(
				shellRef.current,
				displayRef.current.x,
				displayRef.current.y,
				preview.shape,
			);
		}
	}, [preview.x, preview.y, preview.shape, reducedMotion]);

	// Trailing cursor follow — lerp display coords toward the live pointer each frame.
	useEffect(() => {
		if (reducedMotion) return undefined;

		let raf = 0;
		const tick = () => {
			const target = targetRef.current;
			const current = displayRef.current;
			current.x += (target.x - current.x) * CURSOR_FOLLOW_LERP;
			current.y += (target.y - current.y) * CURSOR_FOLLOW_LERP;
			applyPreviewPosition(
				shellRef.current,
				current.x,
				current.y,
				preview.shape,
			);
			raf = window.requestAnimationFrame(tick);
		};

		raf = window.requestAnimationFrame(tick);
		return () => {
			window.cancelAnimationFrame(raf);
		};
	}, [preview.shape, reducedMotion]);

	useLayoutEffect(() => {
		applyPreviewPosition(
			shellRef.current,
			displayRef.current.x,
			displayRef.current.y,
			preview.shape,
		);
	}, [preview.shape]);

	return (
		<motion.div
			ref={shellRef}
			className="pointer-events-none fixed z-240 origin-top-left will-change-[transform,opacity,left,top]"
			style={{ width, height }}
			initial={
				reducedMotion ? false : { opacity: 0, scale: 0.86, filter: "blur(6px)" }
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
							scale: 0.94,
							filter: "blur(4px)",
							transition: PREVIEW_EXIT_TRANSITION,
						}
			}
			transition={{
				...PREVIEW_ENTER_TRANSITION,
			}}
			aria-hidden
		>
			<div
				className={cn(
					"relative size-full overflow-hidden bg-card shadow-[0_0_0_1px_color-mix(in_oklab,var(--foreground)_8%,transparent),0_0_28px_4px_rgba(0,0,0,0.42)]",
					preview.shape === "poster" ? "rounded-xl" : "rounded-full",
				)}
			>
				{preview.imageUrl ? (
					<Image
						src={preview.imageUrl}
						alt=""
						fill
						sizes={
							preview.shape === "poster"
								? `${POSTER_WIDTH}px`
								: `${PORTRAIT_SIZE}px`
						}
						className="object-cover"
						unoptimized
					/>
				) : (
					<div className="flex size-full items-center justify-center bg-muted/50 font-semibold text-foreground/70 text-lg">
						{preview.label.trim().charAt(0).toUpperCase() || "?"}
					</div>
				)}
			</div>
		</motion.div>
	);
}

/** Portal layer — one floating preview shared by all mention links in a body. */
export function MentionHoverPreviewLayer({
	preview,
}: {
	preview: MentionHoverPreviewState | null;
}) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) return null;

	return createPortal(
		<AnimatePresence>
			{preview ? (
				<MentionHoverPreviewChip
					key="mention-hover-preview"
					preview={preview}
				/>
			) : null}
		</AnimatePresence>,
		document.body,
	);
}

/** Pointer hover handlers for inline film/TV/person/patron mention links. */
export function useMentionHoverPreviewHandlers(
	part: MentionEntityPart,
	setPreview: Dispatch<SetStateAction<MentionHoverPreviewState | null>>,
): {
	onPointerEnter: (event: ReactPointerEvent) => void;
	onPointerMove: (event: ReactPointerEvent) => void;
	onPointerLeave: () => void;
} {
	const fetchGenerationRef = useRef(0);
	const rafRef = useRef<number | null>(null);
	const pendingPointRef = useRef<{ x: number; y: number } | null>(null);
	const hoverCapableRef = useRef(false);

	useEffect(() => {
		hoverCapableRef.current = window.matchMedia("(hover: hover)").matches;
		return () => {
			if (rafRef.current != null) {
				window.cancelAnimationFrame(rafRef.current);
			}
		};
	}, []);

	const commitPointer = useCallback(
		(x: number, y: number) => {
			setPreview((current) => {
				if (!current) return current;
				return { ...current, x, y };
			});
		},
		[setPreview],
	);

	const schedulePointerMove = useCallback(
		(x: number, y: number) => {
			pendingPointRef.current = { x, y };
			if (rafRef.current != null) return;
			rafRef.current = window.requestAnimationFrame(() => {
				rafRef.current = null;
				const point = pendingPointRef.current;
				if (!point) return;
				commitPointer(point.x, point.y);
			});
		},
		[commitPointer],
	);

	const onPointerEnter = useCallback(
		(event: ReactPointerEvent) => {
			if (!hoverCapableRef.current || event.pointerType === "touch") return;

			const generation = fetchGenerationRef.current + 1;
			fetchGenerationRef.current = generation;

			setPreview({
				label: part.label,
				imageUrl: null,
				shape: part.type === "listing" ? "poster" : "portrait",
				x: event.clientX,
				y: event.clientY,
			});

			void fetchMentionHoverPreview(part).then((payload) => {
				if (fetchGenerationRef.current !== generation) return;
				setPreview((current) =>
					current
						? {
								...payload,
								x: current.x,
								y: current.y,
							}
						: {
								...payload,
								x: event.clientX,
								y: event.clientY,
							},
				);
			});
		},
		[part, setPreview],
	);

	const onPointerMove = useCallback(
		(event: ReactPointerEvent) => {
			if (!hoverCapableRef.current || event.pointerType === "touch") return;
			schedulePointerMove(event.clientX, event.clientY);
		},
		[schedulePointerMove],
	);

	const onPointerLeave = useCallback(() => {
		fetchGenerationRef.current += 1;
		setPreview(null);
	}, [setPreview]);

	return {
		onPointerEnter,
		onPointerMove,
		onPointerLeave,
	};
}
