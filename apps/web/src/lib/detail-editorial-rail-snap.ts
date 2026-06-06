"use client";

import { animate, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

/** Wait for scroll momentum to settle before easing to the target slide. */
export const EDITORIAL_RAIL_SNAP_SETTLE_MS = 120;

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
	const snapLockRef = useRef(false);
	const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pointerDownRef = useRef(false);
	const lastScrollLeftRef = useRef(0);
	const scrollVelocityRef = useRef(0);
	const animationRef = useRef<ReturnType<typeof animate> | null>(null);
	const activeIndexFrameRef = useRef<number | null>(null);
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
			snapLockRef.current = true;
			setActiveSlideIndex(index);

			if (reduceMotion) {
				rail.scrollLeft = targetLeft;
				snapLockRef.current = false;
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
		if (snapLockRef.current || pointerDownRef.current) return;
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

	useEffect(() => {
		const rail = railRef.current;
		if (!rail || slideCount === 0) return;

		lastScrollLeftRef.current = rail.scrollLeft;

		const handleScroll = () => {
			if (snapLockRef.current) {
				lastScrollLeftRef.current = rail.scrollLeft;
				return;
			}

			const delta = rail.scrollLeft - lastScrollLeftRef.current;
			lastScrollLeftRef.current = rail.scrollLeft;
			if (Math.abs(delta) > 0.5) scrollVelocityRef.current = delta;
			scheduleActiveSlideIndexSync();
			scheduleSnapToSettledSlide();
		};

		const handlePointerDown = () => {
			pointerDownRef.current = true;
			cancelSnapAnimation();
			if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
		};

		const handlePointerUp = () => {
			pointerDownRef.current = false;
			scheduleSnapToSettledSlide();
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
		rail.addEventListener("pointerup", handlePointerUp);
		rail.addEventListener("pointercancel", handlePointerUp);
		rail.addEventListener("wheel", handleWheel, wheelOptions);

		return () => {
			rail.removeEventListener("scroll", handleScroll);
			rail.removeEventListener("pointerdown", handlePointerDown);
			rail.removeEventListener("pointerup", handlePointerUp);
			rail.removeEventListener("pointercancel", handlePointerUp);
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

	return {
		railRef,
		activeSlideIndex,
		totalSlides: slideCount,
		gotoSlide,
		nextSlide,
		prevSlide,
	};
}
