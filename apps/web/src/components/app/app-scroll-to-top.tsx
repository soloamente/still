"use client";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — AppScrollToTop
 *
 * Read top-to-bottom. Two triggers: scroll threshold + pointer/focus.
 *
 * A) Scroll reveal (scrollY > SCROLL.showAfterPx)
 *    0ms   control unmounted
 *  200ms   chrome enters — opacity 0 → 1, y CHROME.enterOffsetY → 0
 *  200ms   chrome exits on scroll up — opacity 1 → 0, y 0 → CHROME.exitOffsetY
 *
 * B) Pill hover / focus (while chrome visible)
 *    0ms   collapsed — width PILL.collapsedWidth, label hidden
 *          width springs collapsed → measured (PILL.widthSpring)
 *          label trails width — opacity 0 → 1, x LABEL.hiddenOffsetX → 0
 *                (LABEL.revealDelay after hover starts)
 *    0ms   collapse on leave — width + label reverse in parallel
 *
 * C) Press (any time button is shown)
 *          hover scale PRESS.hoverScale, tap scale PRESS.tapScale (spring)
 * ───────────────────────────────────────────────────────── */

import { cn } from "@still/ui/lib/utils";
import { useLenis } from "lenis/react";
import { ChevronUp } from "lucide-react";
import {
	AnimatePresence,
	motion,
	type Transition,
	useReducedMotion,
} from "motion/react";
import {
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

import {
	DETAIL_BUTTON_SPRING,
	DETAIL_MOTION_PRESSABLE_CLASS,
} from "@/lib/detail-action-motion";

/** Scroll gate — when the floating control may appear. */
const SCROLL = {
	showAfterPx: 480,
	scrollToDuration: 0.9,
} as const;

/** Fixed wrapper fade/slide above the bottom nav inset. */
const CHROME = {
	enterOffsetY: 10,
	exitOffsetY: 8,
	transition: {
		duration: 0.2,
		ease: [0.165, 0.84, 0.44, 1],
	} satisfies Transition,
} as const;

/** Expanding pill — width-only choreography; icon stays in the trailing well. */
const PILL = {
	collapsedWidth: 44,
	expandedFallback: 128,
	height: 44,
	iconWell: 44,
	labelPaddingLeft: 12,
	/** Tailwind arbitrary shadow — must stay a literal utility in JSX. */
	shadowClass: "shadow-[0_10px_36px_rgba(6,6,10,0.42)]",
	widthSpring: {
		type: "spring" as const,
		stiffness: 420,
		damping: 34,
		mass: 0.85,
	},
} as const;

/** Label copy revealed inside the widening pill. */
const LABEL = {
	copy: "Back to top",
	hiddenOffsetX: 4,
	revealDelay: 0.045,
	revealTransition: {
		duration: 0.16,
		ease: [0.165, 0.84, 0.44, 1],
	} satisfies Transition,
} as const;

/** Trailing chevron — pinned in the well while width animates. */
const ICON = {
	size: 20,
	well: PILL.iconWell,
	opacity: 0.9,
} as const;

/** Shared detail press feel (hero / chrome controls). */
const PRESS = {
	hoverScale: 1.05,
	tapScale: 0.95,
	transformOrigin: "center center" as const,
	spring: { type: "spring" as const, ...DETAIL_BUTTON_SPRING },
} as const;

/** Off-screen row used to measure content-hugging expanded width. */
function ScrollTopWidthProbe({
	measureRef,
}: {
	measureRef: RefObject<HTMLDivElement | null>;
}) {
	return (
		<div
			ref={measureRef}
			aria-hidden
			className="pointer-events-none fixed top-0 left-[-9999px] z-[-1] flex h-11 items-center opacity-0"
		>
			<span
				className="shrink-0 whitespace-nowrap font-medium text-sm"
				style={{ paddingLeft: PILL.labelPaddingLeft }}
			>
				{LABEL.copy}
			</span>
			<span
				className="flex h-11 shrink-0 items-center justify-center"
				style={{ width: PILL.iconWell }}
			>
				<ChevronUp
					className="shrink-0"
					style={{ width: ICON.size, height: ICON.size }}
					aria-hidden
				/>
			</span>
		</div>
	);
}

function useExpandedPillWidth() {
	const measureRef = useRef<HTMLDivElement>(null);
	const [expandedWidth, setExpandedWidth] = useState(PILL.expandedFallback);

	const measure = useCallback(() => {
		const node = measureRef.current;
		if (!node) return;
		const next = Math.ceil(node.getBoundingClientRect().width);
		if (next > PILL.collapsedWidth) {
			setExpandedWidth(next);
		}
	}, []);

	useLayoutEffect(() => {
		measure();
		const node = measureRef.current;
		if (!node) return;
		const observer = new ResizeObserver(measure);
		observer.observe(node);
		return () => observer.disconnect();
	}, [measure]);

	return { measureRef, expandedWidth };
}

interface ScrollTopPillProps {
	expandedWidth: number;
	reduceMotion: boolean | null;
	onScrollToTop: () => void;
}

/**
 * Stage B + C: collapsed circle → measured pill on hover/focus; press scale on tap.
 */
function ScrollTopPill({
	expandedWidth,
	reduceMotion,
	onScrollToTop,
}: ScrollTopPillProps) {
	const [expanded, setExpanded] = useState(false);

	const open = useCallback(() => setExpanded(true), []);
	const close = useCallback(() => setExpanded(false), []);

	const pillWidth = expanded ? expandedWidth : PILL.collapsedWidth;
	const instant = { duration: 0 } as const;

	return (
		<motion.button
			type="button"
			aria-label={LABEL.copy}
			initial={false}
			animate={{
				width: pillWidth,
				scale: 1,
			}}
			whileHover={reduceMotion ? undefined : { scale: PRESS.hoverScale }}
			whileTap={reduceMotion ? undefined : { scale: PRESS.tapScale }}
			transition={
				reduceMotion
					? instant
					: {
							width: PILL.widthSpring,
							scale: PRESS.spring,
						}
			}
			style={{
				height: PILL.height,
				transformOrigin: PRESS.transformOrigin,
			}}
			className={cn(
				"pointer-events-auto relative min-h-11 min-w-11 overflow-hidden rounded-full bg-background text-foreground",
				PILL.shadowClass,
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
				DETAIL_MOTION_PRESSABLE_CLASS,
			)}
			onPointerEnter={open}
			onPointerLeave={close}
			onFocus={open}
			onBlur={close}
			onClick={onScrollToTop}
		>
			<motion.span
				initial={false}
				animate={{
					opacity: expanded ? 1 : 0,
					x: expanded ? 0 : LABEL.hiddenOffsetX,
				}}
				transition={
					reduceMotion
						? instant
						: {
								...LABEL.revealTransition,
								delay: expanded ? LABEL.revealDelay : 0,
							}
				}
				className="absolute inset-y-0 left-0 flex items-center overflow-hidden whitespace-nowrap font-medium text-sm"
				style={{
					paddingLeft: PILL.labelPaddingLeft,
					right: PILL.iconWell,
				}}
				aria-hidden
			>
				{LABEL.copy}
			</motion.span>
			<span
				className="absolute inset-y-0 right-0 z-10 flex items-center justify-center"
				style={{ width: PILL.iconWell }}
			>
				<ChevronUp
					className="shrink-0"
					style={{
						width: ICON.size,
						height: ICON.size,
						opacity: ICON.opacity,
					}}
					aria-hidden
				/>
			</span>
		</motion.button>
	);
}

/**
 * Floating back-to-top for authenticated app routes — sits above the bottom nav inset.
 * Uses Lenis `scrollTo` when available; falls back to native smooth scroll.
 */
export function AppScrollToTop() {
	const reduceMotion = useReducedMotion();
	const lenis = useLenis();
	const [visible, setVisible] = useState(false);
	const { measureRef, expandedWidth } = useExpandedPillWidth();

	const syncVisibility = useCallback((scrollY: number) => {
		const next = scrollY > SCROLL.showAfterPx;
		setVisible((prev) => (prev === next ? prev : next));
	}, []);

	useLenis((instance) => {
		syncVisibility(instance.scroll);
	});

	useEffect(() => {
		const onScroll = () => syncVisibility(window.scrollY);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, [syncVisibility]);

	const scrollToTop = useCallback(() => {
		if (lenis) {
			lenis.scrollTo(0, {
				immediate: Boolean(reduceMotion),
				duration: reduceMotion ? 0 : SCROLL.scrollToDuration,
			});
			return;
		}
		window.scrollTo({
			top: 0,
			behavior: reduceMotion ? "auto" : "smooth",
		});
	}, [lenis, reduceMotion]);

	const fixedChromeClass = cn(
		"pointer-events-none fixed right-3 z-40 sm:right-11",
		"bottom-[max(2.25rem,calc(0.75rem+env(safe-area-inset-bottom)))]",
	);

	const chromeInstant = reduceMotion ?? false;

	return (
		<>
			<ScrollTopWidthProbe measureRef={measureRef} />

			<AnimatePresence>
				{visible ? (
					<motion.div
						key="scroll-top-chrome"
						className={fixedChromeClass}
						initial={
							chromeInstant ? false : { opacity: 0, y: CHROME.enterOffsetY }
						}
						animate={chromeInstant ? undefined : { opacity: 1, y: 0 }}
						exit={
							chromeInstant ? undefined : { opacity: 0, y: CHROME.exitOffsetY }
						}
						transition={chromeInstant ? { duration: 0 } : CHROME.transition}
					>
						<ScrollTopPill
							expandedWidth={expandedWidth}
							reduceMotion={reduceMotion}
							onScrollToTop={scrollToTop}
						/>
					</motion.div>
				) : null}
			</AnimatePresence>
		</>
	);
}
