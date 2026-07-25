"use client";

import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

/** Movement past this threshold counts as a drag (suppresses poster/chip clicks). */
const HORIZONTAL_RAIL_DRAG_THRESHOLD_PX = 6;

/**
 * Mouse / pen grab-drag for overflow-x rails (taste hero posters, chip strips).
 * Touch keeps native `touch-pan-x` scrolling; we only capture after the threshold
 * so taps still activate children.
 */
export function useHorizontalRailPointerDrag(
	railRef: RefObject<HTMLElement | null>,
	enabled = true,
) {
	const [isDragging, setIsDragging] = useState(false);
	const suppressNextClickRef = useRef(false);
	const dragSessionRef = useRef<{
		pointerId: number;
		startX: number;
		startScrollLeft: number;
		moved: boolean;
		/** RTL overflow mirrors scrollLeft vs pointer delta. */
		rtl: boolean;
	} | null>(null);

	/** True once after a drag — clears on read so tile clicks do not fire. */
	const shouldSuppressClick = useCallback(() => {
		if (!suppressNextClickRef.current) return false;
		suppressNextClickRef.current = false;
		return true;
	}, []);

	useEffect(() => {
		const rail = railRef.current;
		if (!rail || !enabled) return;

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
			setIsDragging(false);
		};

		const handlePointerDown = (event: PointerEvent) => {
			if (event.button !== 0) return;
			// Touch / stylus: native overflow scroll is smoother — skip custom drag.
			if (event.pointerType === "touch") return;

			dragSessionRef.current = {
				pointerId: event.pointerId,
				startX: event.clientX,
				startScrollLeft: rail.scrollLeft,
				moved: false,
				rtl: getComputedStyle(rail).direction === "rtl",
			};
		};

		// Poster <img> / Next Image otherwise start a native ghost-drag and steal the gesture.
		const handleDragStart = (event: DragEvent) => {
			event.preventDefault();
		};

		const handlePointerMove = (event: PointerEvent) => {
			const session = dragSessionRef.current;
			if (!session || event.pointerId !== session.pointerId) return;

			const deltaX = event.clientX - session.startX;
			if (!session.moved) {
				if (Math.abs(deltaX) < HORIZONTAL_RAIL_DRAG_THRESHOLD_PX) return;
				session.moved = true;
				setIsDragging(true);
				try {
					rail.setPointerCapture(event.pointerId);
				} catch {
					// Capture can fail on some hybrid inputs — move still updates scroll.
				}
			}

			event.preventDefault();
			// Grab metaphor: content follows the pointer; RTL inverts scrollLeft math.
			rail.scrollLeft = session.rtl
				? session.startScrollLeft + deltaX
				: session.startScrollLeft - deltaX;
		};

		const handlePointerUp = (event: PointerEvent) => {
			endDragSession(event.pointerId);
		};

		const handlePointerCancel = (event: PointerEvent) => {
			endDragSession(event.pointerId);
		};

		rail.addEventListener("pointerdown", handlePointerDown);
		rail.addEventListener("pointermove", handlePointerMove);
		rail.addEventListener("pointerup", handlePointerUp);
		rail.addEventListener("pointercancel", handlePointerCancel);
		rail.addEventListener("dragstart", handleDragStart);

		return () => {
			rail.removeEventListener("pointerdown", handlePointerDown);
			rail.removeEventListener("pointermove", handlePointerMove);
			rail.removeEventListener("pointerup", handlePointerUp);
			rail.removeEventListener("pointercancel", handlePointerCancel);
			rail.removeEventListener("dragstart", handleDragStart);
			dragSessionRef.current = null;
		};
	}, [enabled, railRef]);

	return { isDragging, shouldSuppressClick };
}
