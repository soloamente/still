"use client";

import { cn } from "@still/ui/lib/utils";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	AUTH_BACKGROUND_CROSSFADE_BLUR_PX,
	AUTH_BACKGROUND_CROSSFADE_MS,
	AUTH_BACKGROUND_INTERVAL_MS,
	AUTH_PAGE_BACKDROP_PATHS,
	authBackdropUrl,
} from "@/lib/auth-page-backgrounds";

const AUTH_BACKDROP_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Fisher–Yates shuffle so each visit gets a different slide order. */
function shufflePaths(paths: readonly string[]): string[] {
	const order = [...paths];
	for (let i = order.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const tmp = order[i];
		order[i] = order[j] as string;
		order[j] = tmp as string;
	}
	return order;
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
 * Full-bleed auth backdrop carousel: preloads slides, drops broken TMDB URLs, smooth
 * opacity + blur cross-fade (all layers stay mounted so the outgoing still can fade out).
 */
export function AuthBackgroundCarousel({ className }: { className?: string }) {
	const reduceMotion = useReducedMotion();
	const [slides, setSlides] = useState<string[]>([]);
	const [activeIndex, setActiveIndex] = useState(0);
	const indexRef = useRef(0);

	const dropSlide = useCallback((path: string) => {
		setSlides((current) => {
			const next = current.filter((p) => p !== path);
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
			const loaded: string[] = [];
			for (const path of shufflePaths(AUTH_PAGE_BACKDROP_PATHS)) {
				if (cancelled) return;
				if (await preloadBackdrop(path)) loaded.push(path);
			}
			if (cancelled) return;
			setSlides(loaded.length > 0 ? loaded : [AUTH_PAGE_BACKDROP_PATHS[0]]);
			indexRef.current = 0;
			setActiveIndex(0);
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (reduceMotion || slides.length < 2) return;

		const id = window.setInterval(() => {
			setActiveIndex((prev) => {
				const next = (prev + 1) % slides.length;
				indexRef.current = next;
				return next;
			});
		}, AUTH_BACKGROUND_INTERVAL_MS);

		return () => window.clearInterval(id);
	}, [reduceMotion, slides.length]);

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
			{slides.map((path, index) => {
				const isActive = index === activeIndex;
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
						key={path}
						onError={() => dropSlide(path)}
						src={authBackdropUrl(path)}
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
