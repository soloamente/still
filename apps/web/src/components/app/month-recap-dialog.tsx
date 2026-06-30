"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { MonthRecapPodium } from "@/components/app/month-recap-podium";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { APP_MODAL_OVERLAY_CLASS } from "@/lib/app-modal-layer";
import {
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
} from "@/lib/detail-action-motion";
import { leaderboardHandleLinkClassName } from "@/lib/home-leaderboard-interactive";
import type {
	MonthRecapCategory,
	MonthRecapEntry,
	MonthRecapPayload,
} from "@/lib/month-recap-types";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;

const footerNavButtonClass = cn(
	"h-auto min-h-9 shrink-0 rounded-full px-3.5 py-1.5 font-medium text-xs sm:text-sm",
	DETAIL_MOTION_PRESSABLE_CLASS,
);

/** Celebrated month kicker — same track as What's New release pill. */
function MonthRecapMonthPill({ label }: { label: string }) {
	return (
		<span className="inline-flex min-h-7 items-center rounded-full bg-background px-3.5 py-1 font-medium text-[11px] text-muted-foreground tabular-nums tracking-wide">
			{label}
		</span>
	);
}

/** Opening cover — month + headline only; category podiums start on slide 2. */
function MonthRecapCoverPanel({ monthLabel }: { monthLabel: string }) {
	const reduceMotion = useReducedMotion();
	const itemTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.2, ease: PANEL_EASE };

	return (
		<div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
			<motion.div
				initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ ...itemTransition, delay: reduceMotion ? 0 : 0.06 }}
				className="flex flex-col items-center"
			>
				<MonthRecapMonthPill label={monthLabel} />
				<h2 className="mt-3 text-balance font-semibold text-foreground text-xl tracking-tight sm:text-2xl">
					Community highlights
				</h2>
			</motion.div>
			<motion.p
				initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ ...itemTransition, delay: reduceMotion ? 0 : 0.12 }}
				className="mt-3 max-w-prose text-pretty text-muted-foreground text-sm leading-relaxed sm:text-base"
			>
				See who led Sense last month — most films watched, most TV, and most
				reviews published.
			</motion.p>
		</div>
	);
}

/** Ordered podium handles for congratulatory byline — 1st, then 2nd, then 3rd. */
function monthRecapPodiumEntries(
	entries: MonthRecapEntry[],
): MonthRecapEntry[] {
	return entries.slice().sort((a, b) => a.rank - b.rank);
}

function MonthRecapCongratulationsByline({
	entries,
}: {
	entries: MonthRecapEntry[];
}) {
	const ordered = monthRecapPodiumEntries(entries);
	if (ordered.length === 0) return null;

	return (
		<p className="mt-2 max-w-prose text-pretty text-muted-foreground text-sm leading-relaxed sm:text-base">
			<span>Congratulations to </span>
			{ordered.map((entry, index) => {
				const isLast = index === ordered.length - 1;
				const isFirst = index === 0;
				let separator: string | null = null;
				if (!isFirst) {
					separator = isLast ? ", and " : ", ";
				}

				return (
					<span key={entry.userId}>
						{separator}
						<Link
							href={`/profile/${entry.handle}`}
							className={leaderboardHandleLinkClassName("text-foreground/90")}
						>
							@{entry.handle}
						</Link>
					</span>
				);
			})}
			<span>!</span>
		</p>
	);
}

function MonthRecapCategoryPanel({
	category,
}: {
	category: MonthRecapCategory;
}) {
	const reduceMotion = useReducedMotion();
	const itemTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.2, ease: PANEL_EASE };

	return (
		<div className="flex min-h-0 flex-1 flex-col items-center text-center">
			<motion.div
				initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ ...itemTransition, delay: reduceMotion ? 0 : 0.06 }}
				className="flex w-full flex-col items-center"
			>
				<h2 className="text-balance font-semibold text-foreground text-xl tracking-tight sm:text-2xl">
					{category.title}
				</h2>
				<MonthRecapCongratulationsByline entries={category.entries} />
			</motion.div>

			<motion.div
				initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ ...itemTransition, delay: reduceMotion ? 0 : 0.14 }}
				className="mt-6 w-full"
			>
				<MonthRecapPodium entries={category.entries} categoryId={category.id} />
			</motion.div>
		</div>
	);
}

type MonthRecapSlide =
	| { kind: "cover"; key: "cover"; title: "Community highlights" }
	| {
			kind: "category";
			key: MonthRecapCategory["id"];
			category: MonthRecapCategory;
	  };

function buildMonthRecapSlides(
	categories: MonthRecapCategory[],
): MonthRecapSlide[] {
	return [
		{ kind: "cover", key: "cover", title: "Community highlights" },
		...categories.map((category) => ({
			kind: "category" as const,
			key: category.id,
			category,
		})),
	];
}

function monthRecapSlideLabel(slide: MonthRecapSlide): string {
	return slide.kind === "cover" ? slide.title : slide.category.title;
}

/**
 * One-time per month carousel — global Community winners for the prior calendar month.
 */
export function MonthRecapDialog({
	open,
	payload,
	onDismiss,
}: {
	open: boolean;
	payload: MonthRecapPayload;
	onDismiss: () => void;
}) {
	const reduceMotion = useReducedMotion();
	const titleId = useId();
	const descriptionId = useId();
	const [mounted, setMounted] = useState(false);
	const [slideIndex, setSlideIndex] = useState(0);

	const slides = useMemo(
		() => buildMonthRecapSlides(payload.categories),
		[payload.categories],
	);
	const slideCount = slides.length;
	const slide = slides[slideIndex];
	const isLastSlide = slideIndex >= slideCount - 1;

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
					key="month-recap-backdrop"
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
								aria-label="Close month recap"
								className="min-h-10 min-w-10 text-muted-foreground"
							>
								<X className="size-4" aria-hidden />
							</Button>
						</div>

						<div className="flex min-h-0 flex-1 flex-col">
							<div className="flex min-h-0 flex-1 flex-col px-6 pt-12 pb-14 sm:px-8 sm:pt-14 sm:pb-16">
								<AnimatePresence mode="wait" initial={false}>
									<motion.div
										key={slide.key}
										id={descriptionId}
										initial={
											reduceMotion ? { opacity: 0 } : { opacity: 0, x: 12 }
										}
										animate={
											reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }
										}
										exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
										transition={slideTransition}
										className="flex min-h-0 flex-1 flex-col"
									>
										<span id={titleId} className="sr-only">
											{monthRecapSlideLabel(slide)}
										</span>
										{slide.kind === "cover" ? (
											<MonthRecapCoverPanel monthLabel={payload.monthLabel} />
										) : (
											<MonthRecapCategoryPanel category={slide.category} />
										)}
									</motion.div>
								</AnimatePresence>

								{slideCount > 1 ? (
									<div
										className="mt-8 flex justify-center gap-1.5"
										role="tablist"
										aria-label="Month recap slides"
									>
										{slides.map((s, index) => (
											<button
												key={s.key}
												type="button"
												role="tab"
												aria-selected={index === slideIndex}
												aria-label={`Slide ${index + 1} of ${slideCount}: ${monthRecapSlideLabel(s)}`}
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
