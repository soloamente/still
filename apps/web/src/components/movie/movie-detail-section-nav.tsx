"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import type { MovieDetailSectionNavItem } from "@/lib/movie-detail-sections";
import {
	resolveSectionNavActiveId,
	type SectionNavActivation,
	type SectionNavBounds,
	sectionIntersectsActivationBand,
} from "@/lib/resolve-section-nav-active";

/** Fixed inner pill height — avoids height spring fighting position during section changes. */
const THUMB_HEIGHT_PX = 24;

/** Inset inside the outer `bg-background` track pill (`p-1`). */
const TRACK_INSET_PX = 4;

function readSectionBounds(
	sections: MovieDetailSectionNavItem[],
): SectionNavBounds[] {
	const scrollY = window.scrollY;
	const bounds: SectionNavBounds[] = [];
	for (const section of sections) {
		const el = document.getElementById(section.id);
		if (!el) continue;
		const rect = el.getBoundingClientRect();
		const top = rect.top + scrollY;
		bounds.push({
			id: section.id,
			top,
			bottom: top + rect.height,
		});
	}
	return bounds;
}

/**
 * Fixed right-rail scroll legend for the film **About** view — mirrors Mobbin comp:
 * muted labels, active label in foreground, vertical track + sliding thumb.
 *
 * `activation="center"` is for short stacked sections (legal pages): probe near
 * viewport center, scroll targets into the middle, and pin the last section at
 * the document end.
 */
export function MovieDetailSectionNav({
	sections,
	activation = "header",
	/** Fired when the patron jumps via a rail label (not on scroll-spy alone). */
	onNavigateToSection,
}: {
	sections: MovieDetailSectionNavItem[];
	activation?: SectionNavActivation;
	onNavigateToSection?: (id: string) => void;
}) {
	const reduceMotion = useReducedMotion();
	const [activeId, setActiveId] = useState(
		sections[0]?.id ?? "movie-section-about",
	);
	const labelRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
	const trackRef = useRef<HTMLDivElement>(null);
	const [thumbTop, setThumbTop] = useState(0);
	/** While smooth-scrolling to a clicked label, ignore interim scroll spy updates. */
	const scrollLockTargetRef = useRef<string | null>(null);
	const scrollLockReleaseTimerRef = useRef<ReturnType<
		typeof setTimeout
	> | null>(null);

	const syncThumbToActive = useCallback(() => {
		const track = trackRef.current;
		const button = activeId ? labelRefs.current.get(activeId) : null;
		if (!track || !button) return;

		const trackRect = track.getBoundingClientRect();
		const buttonRect = button.getBoundingClientRect();
		const buttonCenter = buttonRect.top + buttonRect.height / 2;
		const trackInnerHeight = trackRect.height - TRACK_INSET_PX * 2;
		const rawTop = buttonCenter - trackRect.top - THUMB_HEIGHT_PX / 2;
		const clampedTop = Math.min(
			Math.max(rawTop, TRACK_INSET_PX),
			TRACK_INSET_PX + trackInnerHeight - THUMB_HEIGHT_PX,
		);

		setThumbTop(clampedTop);
	}, [activeId]);

	const resolveActiveFromScroll = useCallback(() => {
		if (!sections.length || scrollLockTargetRef.current) return;

		const bounds = readSectionBounds(sections);
		const nextActive = resolveSectionNavActiveId(bounds, {
			scrollY: window.scrollY,
			viewportHeight: window.innerHeight,
			documentHeight: document.documentElement.scrollHeight,
			activation,
		});
		if (!nextActive) return;

		setActiveId((prev) => (prev === nextActive ? prev : nextActive));
	}, [activation, sections]);

	const releaseScrollLock = useCallback(() => {
		const lockedId = scrollLockTargetRef.current;
		scrollLockTargetRef.current = null;
		if (scrollLockReleaseTimerRef.current) {
			clearTimeout(scrollLockReleaseTimerRef.current);
			scrollLockReleaseTimerRef.current = null;
		}

		// After a click-scroll, keep the target if it still sits in the activation band
		// so a tight neighbor does not steal the highlight immediately.
		if (lockedId) {
			const bounds = readSectionBounds(sections);
			const locked = bounds.find((row) => row.id === lockedId);
			if (
				locked &&
				sectionIntersectsActivationBand(locked, {
					scrollY: window.scrollY,
					viewportHeight: window.innerHeight,
					activation,
				})
			) {
				setActiveId(lockedId);
				return;
			}
		}

		resolveActiveFromScroll();
	}, [activation, resolveActiveFromScroll, sections]);

	useEffect(() => {
		resolveActiveFromScroll();
		const onScroll = () => resolveActiveFromScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onScroll, { passive: true });
		return () => {
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onScroll);
		};
	}, [resolveActiveFromScroll]);

	useEffect(() => {
		syncThumbToActive();
	}, [syncThumbToActive]);

	useEffect(() => {
		const onResize = () => syncThumbToActive();
		window.addEventListener("resize", onResize, { passive: true });
		return () => window.removeEventListener("resize", onResize);
	}, [syncThumbToActive]);

	useEffect(() => {
		return () => {
			if (scrollLockReleaseTimerRef.current) {
				clearTimeout(scrollLockReleaseTimerRef.current);
			}
		};
	}, []);

	const scrollToSection = useCallback(
		(id: string) => {
			const el = document.getElementById(id);
			if (!el) return;

			scrollLockTargetRef.current = id;
			setActiveId(id);
			onNavigateToSection?.(id);

			if (scrollLockReleaseTimerRef.current) {
				clearTimeout(scrollLockReleaseTimerRef.current);
			}

			el.scrollIntoView({
				behavior: reduceMotion ? "auto" : "smooth",
				// Legal pages use center so the spy and the click land on the same band.
				block: activation === "center" ? "center" : "start",
			});

			if (reduceMotion) {
				releaseScrollLock();
				return;
			}

			const onScrollEnd = () => {
				if (scrollLockReleaseTimerRef.current) {
					clearTimeout(scrollLockReleaseTimerRef.current);
					scrollLockReleaseTimerRef.current = null;
				}
				releaseScrollLock();
			};

			if ("onscrollend" in window) {
				window.addEventListener("scrollend", onScrollEnd, { once: true });
				scrollLockReleaseTimerRef.current = setTimeout(() => {
					window.removeEventListener("scrollend", onScrollEnd);
					onScrollEnd();
				}, 900);
			} else {
				scrollLockReleaseTimerRef.current = setTimeout(releaseScrollLock, 700);
			}
		},
		[activation, onNavigateToSection, reduceMotion, releaseScrollLock],
	);

	if (sections.length < 2) return null;

	const thumbTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	return (
		<nav
			aria-label="On this page"
			className={cn(
				"pointer-events-none fixed top-1/2 right-4 z-40 hidden -translate-y-1/2 xl:block",
				"2xl:right-6",
			)}
		>
			<div className="pointer-events-auto flex items-stretch gap-3">
				<ul className="flex flex-col items-end gap-5">
					{sections.map((section, index) => {
						const isActive = section.id === activeId;
						return (
							<li key={section.id}>
								<DetailMotionButton
									type="button"
									motionVariant="chrome"
									ref={(node) => {
										if (node) labelRefs.current.set(section.id, node);
										else labelRefs.current.delete(section.id);
									}}
									className={cn(
										"text-right font-medium text-sm leading-none transition-colors duration-200 ease-out motion-reduce:transition-none",
										"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
										isActive
											? "text-foreground"
											: "text-muted-foreground/70 [@media(hover:hover)]:hover:text-muted-foreground",
									)}
									aria-current={isActive ? "location" : undefined}
									onClick={() => scrollToSection(section.id)}
								>
									{section.label}
									<span className="sr-only">
										{isActive
											? ", current section"
											: `, section ${index + 1} of ${sections.length}`}
									</span>
								</DetailMotionButton>
							</li>
						);
					})}
				</ul>

				{/* Outer track pill (`bg-background`) + sliding inner pill (`bg-card`). */}
				<div
					ref={trackRef}
					className="relative w-4 shrink-0 self-stretch rounded-full bg-background p-1"
					aria-hidden
				>
					<motion.div
						className="absolute inset-x-1 rounded-full bg-card shadow-sm"
						style={{
							height: THUMB_HEIGHT_PX,
							top: 0,
							transformOrigin: "top center",
						}}
						initial={false}
						animate={{ y: thumbTop }}
						transition={thumbTransition}
					/>
				</div>
			</div>
		</nav>
	);
}
