"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { ArrowUpRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import {
	DetailMotionButtonWrap,
	DetailMotionLink,
} from "@/components/movie/detail-motion-pressable";
import { APP_MODAL_OVERLAY_CLASS } from "@/lib/app-modal-layer";
import {
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
} from "@/lib/detail-action-motion";
import { whatsNewReleasePillLabel } from "@/lib/product-changelog";
import type { WhatsNewRelease, WhatsNewSlide } from "@/lib/whats-new-releases";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;

/** Compact secondary link — not a full-width hero button. */
const fullReleaseLinkClass = cn(
	"inline-flex min-h-9 items-center gap-1 rounded-full px-2 py-1 font-medium text-muted-foreground text-xs transition-colors hover:text-foreground sm:text-sm",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
	DETAIL_MOTION_PRESSABLE_CLASS,
);

const footerNavButtonClass = cn(
	"h-auto min-h-9 shrink-0 rounded-full px-3.5 py-1.5 font-medium text-xs sm:text-sm",
	DETAIL_MOTION_PRESSABLE_CLASS,
);

/** Release date/version kicker — same track as home filter chips (`bg-background` on `bg-card`). */
function WhatsNewReleasePill({ label }: { label: string }) {
	return (
		<span className="mb-3 inline-flex min-h-7 items-center rounded-full bg-background px-3.5 py-1 font-medium text-[11px] text-muted-foreground tabular-nums tracking-wide">
			{label}
		</span>
	);
}

function WhatsNewSlidePanel({
	slide,
	releasePillLabel,
	showReleasePill,
	fullReleaseHref,
	onCta,
}: {
	slide: WhatsNewSlide;
	/** Shown above the intro slide title only — release version + date. */
	releasePillLabel: string;
	showReleasePill: boolean;
	fullReleaseHref: string;
	onCta: () => void;
}) {
	const reduceMotion = useReducedMotion();
	const itemTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.2, ease: PANEL_EASE };

	return (
		<div className="flex min-h-0 flex-1 flex-col items-center text-center">
			{slide.image ? (
				<motion.div
					initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ ...itemTransition, delay: reduceMotion ? 0 : 0 }}
					className="relative mb-6 aspect-16/10 w-full overflow-hidden rounded-2xl bg-background outline-1 outline-white/10"
				>
					<Image
						src={slide.image.src}
						alt={slide.image.alt}
						fill
						className="object-cover"
						sizes="(max-width: 640px) 100vw, 480px"
						unoptimized
					/>
				</motion.div>
			) : null}

			<motion.div
				initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ ...itemTransition, delay: reduceMotion ? 0 : 0.06 }}
				className="flex flex-col items-center"
			>
				{showReleasePill ? (
					<WhatsNewReleasePill label={releasePillLabel} />
				) : null}
				<h2 className="text-balance font-semibold text-foreground text-xl tracking-tight sm:text-2xl">
					{slide.title}
				</h2>
			</motion.div>

			<motion.p
				initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ ...itemTransition, delay: reduceMotion ? 0 : 0.12 }}
				className="mt-3 max-w-prose text-pretty text-muted-foreground text-sm leading-relaxed sm:text-base"
			>
				{slide.description}
			</motion.p>

			<motion.div
				initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ ...itemTransition, delay: reduceMotion ? 0 : 0.18 }}
				className="mt-5"
			>
				<DetailMotionLink
					href={fullReleaseHref}
					className={fullReleaseLinkClass}
					onClick={onCta}
				>
					See full release
					<ArrowUpRight className="size-3.5 shrink-0 opacity-80" aria-hidden />
				</DetailMotionLink>
			</motion.div>
		</div>
	);
}

/**
 * One-time per release carousel for signed-in patrons — hero slide layout on every step.
 */
export function WhatsNewDialog({
	open,
	release,
	onDismiss,
}: {
	open: boolean;
	release: WhatsNewRelease;
	onDismiss: () => void;
}) {
	const reduceMotion = useReducedMotion();
	const titleId = useId();
	const descriptionId = useId();
	const [mounted, setMounted] = useState(false);
	const [slideIndex, setSlideIndex] = useState(0);

	const slideCount = release.slides.length;
	const slide = release.slides[slideIndex];
	const isLastSlide = slideIndex >= slideCount - 1;
	const releasePillLabel = whatsNewReleasePillLabel(release.id);

	const handleDismiss = useCallback(() => {
		onDismiss();
		setSlideIndex(0);
	}, [onDismiss]);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open) setSlideIndex(0);
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") handleDismiss();
			if (e.key === "ArrowRight" && !isLastSlide) {
				setSlideIndex((i) => Math.min(i + 1, slideCount - 1));
			}
			if (e.key === "ArrowLeft" && slideIndex > 0) {
				setSlideIndex((i) => Math.max(i - 1, 0));
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, handleDismiss, isLastSlide, slideCount, slideIndex]);

	const backdropTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.18, ease: "easeOut" as const };
	const panelTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.25, ease: PANEL_EASE };

	const slideTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.22, ease: PANEL_EASE };

	if (!mounted || !slide) return null;

	return createPortal(
		<AnimatePresence initial={false}>
			{open ? (
				<motion.div
					key="whats-new-backdrop"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={backdropTransition}
					aria-hidden
					className={cn(
						APP_MODAL_OVERLAY_CLASS,
						"place-items-center px-4 py-8",
					)}
					onClick={handleDismiss}
				>
					<motion.div
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						aria-describedby={descriptionId}
						initial={{ opacity: 0, scale: 0.96, y: 10 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: 8 }}
						transition={panelTransition}
						onClick={(e) => e.stopPropagation()}
						className={cn(
							"t-modal relative flex max-h-[min(92svh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-[2rem] bg-card text-foreground sm:max-w-xl",
							"is-open",
						)}
					>
						<div className="absolute top-3 right-3 z-10 sm:top-4 sm:right-4">
							<Button
								type="button"
								variant="ghost"
								size="icon-pill"
								onClick={handleDismiss}
								aria-label="Close what's new"
								className="min-h-10 min-w-10 text-muted-foreground"
							>
								<X className="size-4" aria-hidden />
							</Button>
						</div>

						<div className="flex min-h-0 flex-1 flex-col">
							<div className="flex min-h-0 flex-1 flex-col px-6 pt-12 pb-14 sm:px-8 sm:pt-14 sm:pb-16">
								<AnimatePresence mode="wait" initial={false}>
									<motion.div
										key={slideIndex}
										id={descriptionId}
										initial={
											reduceMotion
												? { opacity: 0 }
												: { opacity: 0, x: 12, filter: "blur(2px)" }
										}
										animate={
											reduceMotion
												? { opacity: 1 }
												: { opacity: 1, x: 0, filter: "blur(0px)" }
										}
										exit={
											reduceMotion
												? { opacity: 0 }
												: { opacity: 0, x: -8, filter: "blur(2px)" }
										}
										transition={slideTransition}
										className="flex min-h-0 flex-1 flex-col"
									>
										<span id={titleId} className="sr-only">
											{slide.title}
										</span>
										<WhatsNewSlidePanel
											slide={slide}
											releasePillLabel={releasePillLabel}
											showReleasePill={slideIndex === 0}
											fullReleaseHref={release.fullReleaseHref}
											onCta={handleDismiss}
										/>
									</motion.div>
								</AnimatePresence>

								{slideCount > 1 ? (
									<div
										className="mt-8 flex justify-center gap-1.5"
										role="tablist"
										aria-label="What's new slides"
									>
										{release.slides.map((s, index) => (
											<button
												key={s.title}
												type="button"
												role="tab"
												aria-selected={index === slideIndex}
												aria-label={`Slide ${index + 1} of ${slideCount}: ${s.title}`}
												className={cn(
													"min-h-10 min-w-10 rounded-full px-2 py-2 transition-colors duration-200 ease-out motion-reduce:transition-none",
													index === slideIndex
														? "text-foreground"
														: "text-muted-foreground/60 [@media(hover:hover)]:hover:text-muted-foreground",
												)}
												onClick={() => setSlideIndex(index)}
											>
												<span
													className={cn(
														"mx-auto block size-1.5 rounded-full transition-[transform,background-color] duration-200 ease-out motion-reduce:transition-none",
														index === slideIndex
															? "scale-125 bg-foreground"
															: "bg-muted-foreground/50",
													)}
													aria-hidden
												/>
											</button>
										))}
									</div>
								) : null}
							</div>
						</div>

						{slideIndex > 0 ? (
							<DetailMotionButtonWrap className="absolute bottom-3 left-4 z-10 sm:bottom-3.5 sm:left-5">
								<Button
									type="button"
									variant="ghost"
									size="pill"
									className={cn(
										footerNavButtonClass,
										"gap-1 bg-background text-muted-foreground",
										DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
									)}
									onClick={() => setSlideIndex((i) => Math.max(i - 1, 0))}
								>
									<ChevronLeft className="size-3.5" aria-hidden />
									Back
								</Button>
							</DetailMotionButtonWrap>
						) : null}

						<DetailMotionButtonWrap className="absolute right-4 bottom-3 z-10 sm:right-5 sm:bottom-3.5">
							{isLastSlide ? (
								<Button
									type="button"
									variant="default"
									size="pill"
									className={cn(
										footerNavButtonClass,
										"bg-foreground font-semibold text-background",
									)}
									onClick={handleDismiss}
								>
									Got it
								</Button>
							) : (
								<Button
									type="button"
									variant="default"
									size="pill"
									className={cn(
										footerNavButtonClass,
										"gap-1 bg-foreground font-semibold text-background",
									)}
									onClick={() =>
										setSlideIndex((i) => Math.min(i + 1, slideCount - 1))
									}
								>
									Next
									<ChevronRight className="size-3.5" aria-hidden />
								</Button>
							)}
						</DetailMotionButtonWrap>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>,
		document.body,
	);
}
