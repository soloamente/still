"use client";

import { animate, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

/** Wait for scroll momentum to settle before easing to the target slide. */
export const EDITORIAL_RAIL_SNAP_SETTLE_MS = 120;

/** Movement past this threshold counts as a drag (suppresses accidental slide clicks). */
const EDITORIAL_RAIL_DRAG_THRESHOLD_PX = 6;

/** Selectors that should keep their native click — not start a rail drag. */
const EDITORIAL_RAIL_DRAG_IGNORE_SELECTOR =
	"button, a, input, textarea, select, [data-rail-nav]";

/** Snap tween — editorial deceleration; slower than page-slide for large slide gaps. */
export const EDITORIAL_RAIL_SNAP_TWEEN = {
	type: "tween" as const,
	duration: 0.58,
	ease: [0.22, 1, 0.36, 1] as const,
};

function slideTargetScrollLeft(rail: HTMLElement, slide: HTMLElement) {
	return slide.offsetLeft + slide.offsetWidth / 2 - rail.clientWidth / 2;
}

/** Midpoint + velocity bias — easier to advance without dragging the full gap. */
function resolveSnapSlideIndex(
	slides: HTMLElement[],
	rail: HTMLElement,
	scrollLeft: number,
	velocity: number,
) {
	if (slides.length === 0) return 0;

	const viewportCenter = scrollLeft + rail.clientWidth / 2;
	const centers = slides.map(
		(slide) => slide.offsetLeft + slide.offsetWidth / 2,
	);

	let index = 0;
	for (let i = 0; i < centers.length - 1; i++) {
		const left = centers[i];
		const right = centers[i + 1];
		if (left === undefined || right === undefined) continue;
		if (viewportCenter > (left + right) / 2) index = i + 1;
	}

	if (velocity > 4 && index < slides.length - 1) index += 1;
	if (velocity < -4 && index > 0) index -= 1;

	return Math.max(0, Math.min(slides.length - 1, index));
}

function readActiveSlideIndex(rail: HTMLElement, slideSelector: string) {
	const slides = rail.querySelectorAll<HTMLElement>(slideSelector);
	if (slides.length === 0) return 0;
	return resolveSnapSlideIndex(Array.from(slides), rail, rail.scrollLeft, 0);
}

/** Normalize wheel delta to pixels for rail / page scrolling. */
function wheelDeltaPixels(event: WheelEvent, axis: "x" | "y") {
	let delta = axis === "x" ? event.deltaX : event.deltaY;
	if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
		delta *= 16;
	} else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
		delta *= axis === "x" ? window.innerWidth : window.innerHeight;
	}
	return delta;
}

/**
 * Shared smooth-snap rail for movie/TV detail carousels (reviews, screenshots).
 * Vertical wheel passes through; Shift+scroll / horizontal wheel paginates slides.
 */
export function useDetailEditorialRailSnap({
	slideCount,
	slideSelector,
}: {
	slideCount: number;
	slideSelector: string;
}) {
	const railRef = useRef<HTMLDivElement>(null);
	const [activeSlideIndex, setActiveSlideIndex] = useState(0);
	const [isDragging, setIsDragging] = useState(false);
	const snapLockRef = useRef(false);
	const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pointerDownRef = useRef(false);
	const dragSessionRef = useRef<{
		pointerId: number;
		startX: number;
		startScrollLeft: number;
		moved: boolean;
	} | null>(null);
	const suppressNextClickRef = useRef(false);
	const lastScrollLeftRef = useRef(0);
	const scrollVelocityRef = useRef(0);
	const animationRef = useRef<ReturnType<typeof animate> | null>(null);
	const activeIndexFrameRef = useRef<number | null>(null);
	/** Blocks scroll-settle snap while a programmatic ease is running or settling. */
	const allowScrollSettleRef = useRef(true);
	const reduceMotion = useReducedMotion();

	const getSlides = useCallback(
		(rail: HTMLElement) => rail.querySelectorAll<HTMLElement>(slideSelector),
		[slideSelector],
	);

	const syncActiveSlideIndex = useCallback(() => {
		const rail = railRef.current;
		if (!rail) return;
		setActiveSlideIndex(readActiveSlideIndex(rail, slideSelector));
	}, [slideSelector]);

	const scheduleActiveSlideIndexSync = useCallback(() => {
		if (activeIndexFrameRef.current !== null) return;
		activeIndexFrameRef.current = requestAnimationFrame(() => {
			activeIndexFrameRef.current = null;
			syncActiveSlideIndex();
		});
	}, [syncActiveSlideIndex]);

	const cancelSnapAnimation = useCallback(() => {
		animationRef.current?.stop();
		animationRef.current = null;
		snapLockRef.current = false;
		allowScrollSettleRef.current = true;
	}, []);

	const easeToSlideIndex = useCallback(
		(index: number) => {
			const rail = railRef.current;
			if (!rail) return;

			const slides = getSlides(rail);
			const slide = slides[index];
			if (!slide) return;

			const targetLeft = slideTargetScrollLeft(rail, slide);
			if (Math.abs(rail.scrollLeft - targetLeft) < 1.5) return;

			cancelSnapAnimation();
			// Programmatic nav — ignore scroll velocity so CSS snap cannot cascade slides.
			allowScrollSettleRef.current = false;
			scrollVelocityRef.current = 0;
			if (scrollEndTimerRef.current) {
				clearTimeout(scrollEndTimerRef.current);
				scrollEndTimerRef.current = null;
			}

			snapLockRef.current = true;
			setActiveSlideIndex(index);

			const releaseScrollSettle = () => {
				scrollVelocityRef.current = 0;
				if (scrollEndTimerRef.current) {
					clearTimeout(scrollEndTimerRef.current);
					scrollEndTimerRef.current = null;
				}
				// Let CSS scroll-snap finish without velocity-biased re-snaps.
				window.setTimeout(() => {
					allowScrollSettleRef.current = true;
				}, EDITORIAL_RAIL_SNAP_SETTLE_MS);
			};

			if (reduceMotion) {
				rail.scrollLeft = targetLeft;
				snapLockRef.current = false;
				releaseScrollSettle();
				return;
			}

			animationRef.current = animate(rail.scrollLeft, targetLeft, {
				...EDITORIAL_RAIL_SNAP_TWEEN,
				onUpdate: (latest) => {
					rail.scrollLeft = latest;
				},
				onComplete: () => {
					animationRef.current = null;
					snapLockRef.current = false;
					syncActiveSlideIndex();
					releaseScrollSettle();
				},
			});
		},
		[cancelSnapAnimation, getSlides, reduceMotion, syncActiveSlideIndex],
	);

	const snapToSettledSlide = useCallback(() => {
		const rail = railRef.current;
		if (!rail || snapLockRef.current || pointerDownRef.current) return;

		const slides = getSlides(rail);
		if (slides.length === 0) return;

		const index = resolveSnapSlideIndex(
			Array.from(slides),
			rail,
			rail.scrollLeft,
			scrollVelocityRef.current,
		);
		easeToSlideIndex(index);
		scrollVelocityRef.current = 0;
	}, [easeToSlideIndex, getSlides]);

	const scheduleSnapToSettledSlide = useCallback(() => {
		if (
			snapLockRef.current ||
			pointerDownRef.current ||
			!allowScrollSettleRef.current
		) {
			return;
		}
		if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
		scrollEndTimerRef.current = setTimeout(() => {
			snapToSettledSlide();
		}, EDITORIAL_RAIL_SNAP_SETTLE_MS);
	}, [snapToSettledSlide]);

	const paginateSlide = useCallback(
		(direction: 1 | -1) => {
			const rail = railRef.current;
			if (!rail) return;

			const slides = getSlides(rail);
			if (slides.length === 0) return;

			const currentIndex = resolveSnapSlideIndex(
				Array.from(slides),
				rail,
				rail.scrollLeft,
				0,
			);
			const nextIndex = Math.max(
				0,
				Math.min(slides.length - 1, currentIndex + direction),
			);
			easeToSlideIndex(nextIndex);
		},
		[easeToSlideIndex, getSlides],
	);

	const gotoSlide = easeToSlideIndex;

	const nextSlide = useCallback(() => {
		paginateSlide(1);
	}, [paginateSlide]);

	const prevSlide = useCallback(() => {
		paginateSlide(-1);
	}, [paginateSlide]);

	/** True once after a drag — clears on read so slide clicks do not fire. */
	const shouldSuppressRailClick = useCallback(() => {
		if (!suppressNextClickRef.current) return false;
		suppressNextClickRef.current = false;
		return true;
	}, []);

	useEffect(() => {
		const rail = railRef.current;
		if (!rail || slideCount === 0) return;

		lastScrollLeftRef.current = rail.scrollLeft;

		const handleScroll = () => {
			if (snapLockRef.current) {
				lastScrollLeftRef.current = rail.scrollLeft;
				// Ignore animated scroll deltas — they must not bias post-ease snaps.
				scrollVelocityRef.current = 0;
				return;
			}

			const delta = rail.scrollLeft - lastScrollLeftRef.current;
			lastScrollLeftRef.current = rail.scrollLeft;
			if (Math.abs(delta) > 0.5) scrollVelocityRef.current = delta;
			scheduleActiveSlideIndexSync();
			scheduleSnapToSettledSlide();
		};

		const endDragSession = (pointerId: number) => {
			const session = dragSessionRef.current;
			if (!session || session.pointerId !== pointerId) return;

			if (rail.hasPointerCapture(pointerId)) {
				rail.releasePointerCapture(pointerId);
			}

			if (session.moved) {
				suppressNextClickRef.current = true;
			}

			dragSessionRef.current = null;
			pointerDownRef.current = false;
			setIsDragging(false);
			scheduleSnapToSettledSlide();
		};

		const handlePointerDown = (event: PointerEvent) => {
			if (event.button !== 0) return;
			const target = event.target;
			if (
				target instanceof Element &&
				target.closest(EDITORIAL_RAIL_DRAG_IGNORE_SELECTOR)
			) {
				return;
			}

			pointerDownRef.current = true;
			cancelSnapAnimation();
			if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);

			dragSessionRef.current = {
				pointerId: event.pointerId,
				startX: event.clientX,
				startScrollLeft: rail.scrollLeft,
				moved: false,
			};
			// Capture only after the drag threshold — immediate capture steals click
			// targets on review/still slides (open reader, select slide).
		};

		const handlePointerMove = (event: PointerEvent) => {
			const session = dragSessionRef.current;
			if (!session || event.pointerId !== session.pointerId) return;

			const deltaX = event.clientX - session.startX;
			if (!session.moved) {
				if (Math.abs(deltaX) < EDITORIAL_RAIL_DRAG_THRESHOLD_PX) return;
				session.moved = true;
				setIsDragging(true);
				try {
					rail.setPointerCapture(event.pointerId);
				} catch {
					// Pointer capture can fail on some hybrid inputs — drag still works via bubbling moves.
				}
			}

			event.preventDefault();
			rail.scrollLeft = session.startScrollLeft - deltaX;
		};

		const handlePointerUp = (event: PointerEvent) => {
			endDragSession(event.pointerId);
		};

		const handlePointerCancel = (event: PointerEvent) => {
			endDragSession(event.pointerId);
		};

		// Capture Shift+scroll / horizontal wheel only — vertical wheel passes through to the page.
		const handleWheel = (event: WheelEvent) => {
			const horizontalIntent =
				event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);

			if (!horizontalIntent) return;

			event.preventDefault();
			event.stopPropagation();

			const delta = event.shiftKey
				? wheelDeltaPixels(event, "y")
				: wheelDeltaPixels(event, "x");
			if (Math.abs(delta) < 4) return;

			if (snapLockRef.current) cancelSnapAnimation();

			paginateSlide(delta > 0 ? 1 : -1);
		};

		const wheelOptions: AddEventListenerOptions = {
			passive: false,
			capture: true,
		};

		rail.addEventListener("scroll", handleScroll, { passive: true });
		rail.addEventListener("pointerdown", handlePointerDown);
		rail.addEventListener("pointermove", handlePointerMove);
		rail.addEventListener("pointerup", handlePointerUp);
		rail.addEventListener("pointercancel", handlePointerCancel);
		rail.addEventListener("wheel", handleWheel, wheelOptions);

		return () => {
			rail.removeEventListener("scroll", handleScroll);
			rail.removeEventListener("pointerdown", handlePointerDown);
			rail.removeEventListener("pointermove", handlePointerMove);
			rail.removeEventListener("pointerup", handlePointerUp);
			rail.removeEventListener("pointercancel", handlePointerCancel);
			rail.removeEventListener("wheel", handleWheel, wheelOptions);
			if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
			if (activeIndexFrameRef.current !== null) {
				cancelAnimationFrame(activeIndexFrameRef.current);
			}
			cancelSnapAnimation();
		};
	}, [
		slideCount,
		scheduleSnapToSettledSlide,
		scheduleActiveSlideIndexSync,
		cancelSnapAnimation,
		paginateSlide,
	]);

	/** Re-center the active slide when layout width changes (mobile rotation, font load). */
	useEffect(() => {
		const rail = railRef.current;
		if (!rail || slideCount === 0) return;

		const syncScrollPosition = () => {
			if (snapLockRef.current || pointerDownRef.current) return;

			const slides = getSlides(rail);
			if (slides.length === 0) return;

			const index = resolveSnapSlideIndex(
				Array.from(slides),
				rail,
				rail.scrollLeft,
				0,
			);
			const slide = slides[index];
			if (!slide) return;

			const targetLeft = slideTargetScrollLeft(rail, slide);
			if (Math.abs(rail.scrollLeft - targetLeft) > 1.5) {
				rail.scrollLeft = targetLeft;
			}
			setActiveSlideIndex(index);
		};

		syncScrollPosition();
		const raf = requestAnimationFrame(syncScrollPosition);

		const observer = new ResizeObserver(() => {
			syncScrollPosition();
		});
		observer.observe(rail);

		return () => {
			cancelAnimationFrame(raf);
			observer.disconnect();
		};
	}, [slideCount, getSlides]);

	return {
		railRef,
		activeSlideIndex,
		totalSlides: slideCount,
		isDragging,
		gotoSlide,
		nextSlide,
		prevSlide,
		shouldSuppressRailClick,
	};
}
