"use client";

import { cn } from "@still/ui/lib/utils";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	AUTH_BACKDROP_LAST_SEEN_KEY,
	AUTH_BACKGROUND_CROSSFADE_BLUR_PX,
	AUTH_BACKGROUND_CROSSFADE_MS,
	AUTH_BACKGROUND_INTERVAL_MS,
	AUTH_PAGE_BACKDROPS,
	type AuthPageBackdrop,
	authBackdropUrl,
} from "@/lib/auth-page-backgrounds";

const AUTH_BACKDROP_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Fisher–Yates shuffle so each visit gets a different slide order. */
function shuffleBackdrops(
	slides: readonly AuthPageBackdrop[],
): AuthPageBackdrop[] {
	const order = [...slides];
	for (let i = order.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const tmp = order[i];
		order[i] = order[j] as AuthPageBackdrop;
		order[j] = tmp as AuthPageBackdrop;
	}
	return order;
}

function readLastSeenPath(): string | null {
	try {
		return window.sessionStorage.getItem(AUTH_BACKDROP_LAST_SEEN_KEY);
	} catch {
		return null;
	}
}

function writeLastSeenPath(path: string): void {
	try {
		window.sessionStorage.setItem(AUTH_BACKDROP_LAST_SEEN_KEY, path);
	} catch {
		// Private mode can block storage; shuffle still randomizes.
	}
}

/** Keep the previous visit's still off the opening frame. */
function orderBackdropsForVisit(
	slides: readonly AuthPageBackdrop[],
): AuthPageBackdrop[] {
	const shuffled = shuffleBackdrops(slides);
	const lastPath = readLastSeenPath();
	if (!lastPath || shuffled.length < 2) return shuffled;
	const lastIndex = shuffled.findIndex((slide) => slide.path === lastPath);
	if (lastIndex <= 0) return shuffled;
	const [last] = shuffled.splice(lastIndex, 1);
	if (last) shuffled.push(last);
	return shuffled;
}

function preloadBackdrop(path: string): Promise<boolean> {
	return new Promise((resolve) => {
		const img = new Image();
		img.decoding = "async";
		img.onload = () => resolve(true);
		img.onerror = () => resolve(false);
		img.src = authBackdropUrl(path);
	});
}

/**
 * Full-bleed auth backdrop carousel: paints the first healthy still immediately,
 * keeps loading the rest, drops broken TMDB URLs, and cross-fades opacity + blur.
 */
export function AuthBackgroundCarousel({
	className,
	onActiveTitleChange,
}: {
	className?: string;
	onActiveTitleChange?: (title: string) => void;
}) {
	const reduceMotion = useReducedMotion();
	const [slides, setSlides] = useState<AuthPageBackdrop[]>([]);
	const [activeIndex, setActiveIndex] = useState(0);
	const indexRef = useRef(0);
	const slidesLenRef = useRef(0);
	slidesLenRef.current = slides.length;
	const onTitleRef = useRef(onActiveTitleChange);
	onTitleRef.current = onActiveTitleChange;

	const dropSlide = useCallback((path: string) => {
		setSlides((current) => {
			const next = current.filter((slide) => slide.path !== path);
			if (next.length === 0) return current;
			const idx = Math.min(indexRef.current, next.length - 1);
			indexRef.current = idx;
			setActiveIndex(idx);
			return next;
		});
	}, []);

	useEffect(() => {
		let cancelled = false;

		void (async () => {
			const loaded: AuthPageBackdrop[] = [];
			for (const slide of orderBackdropsForVisit(AUTH_PAGE_BACKDROPS)) {
				if (cancelled) return;
				if (!(await preloadBackdrop(slide.path))) continue;
				loaded.push(slide);
				if (cancelled) return;
				// Paint as soon as the first still is ready so the pool can keep growing.
				setSlides([...loaded]);
			}
			if (cancelled || loaded.length > 0) return;
			setSlides([AUTH_PAGE_BACKDROPS[0] as AuthPageBackdrop]);
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		const active = slides[activeIndex];
		if (!active) return;
		writeLastSeenPath(active.path);
		onTitleRef.current?.(active.title);
	}, [activeIndex, slides]);

	const canRotate = slides.length >= 2;

	useEffect(() => {
		if (reduceMotion || !canRotate) return;

		const id = window.setInterval(() => {
			setActiveIndex((prev) => {
				const len = slidesLenRef.current;
				if (len < 2) return prev;
				const next = (prev + 1) % len;
				indexRef.current = next;
				return next;
			});
		}, AUTH_BACKGROUND_INTERVAL_MS);

		return () => window.clearInterval(id);
	}, [reduceMotion, canRotate]);

	if (slides.length === 0) {
		return (
			<div
				aria-hidden
				className={cn(
					"absolute inset-0 isolate overflow-hidden bg-background",
					className,
				)}
			/>
		);
	}

	return (
		<div
			aria-hidden
			className={cn(
				"absolute inset-0 isolate overflow-hidden bg-background",
				className,
			)}
			style={{ contain: "paint" }}
		>
			{slides.map((slide, index) => {
				const isActive = index === activeIndex;
				const isOutgoing =
					slides.length > 1 &&
					index === (activeIndex - 1 + slides.length) % slides.length;
				if (!isActive && !isOutgoing) return null;
				const crossfade = reduceMotion
					? "none"
					: `opacity ${AUTH_BACKGROUND_CROSSFADE_MS}ms ${AUTH_BACKDROP_EASE}, filter ${AUTH_BACKGROUND_CROSSFADE_MS}ms ${AUTH_BACKDROP_EASE}`;
				return (
					// biome-ignore lint/performance/noImgElement: cross-fading local backdrops; next/image adds layout cost here
					<img
						alt=""
						className="pointer-events-none absolute inset-0 size-full object-cover object-center"
						decoding="async"
						fetchPriority={isActive ? "high" : "low"}
						key={slide.path}
						onError={() => dropSlide(slide.path)}
						src={authBackdropUrl(slide.path)}
						style={{
							opacity: isActive ? 1 : 0,
							filter: isActive
								? "blur(0px)"
								: `blur(${AUTH_BACKGROUND_CROSSFADE_BLUR_PX}px)`,
							zIndex: isActive ? 1 : 0,
							transition: crossfade,
						}}
					/>
				);
			})}
		</div>
	);
}
