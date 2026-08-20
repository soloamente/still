"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { ArrowUpRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import {
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { DetailDrawerScrollBody } from "@/components/movie/detail-drawer-scroll-body";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import { SheetScrollScrims } from "@/components/movie/sheet-scroll-scrims";
import {
	getAppMobileVaulServerSnapshot,
	getAppMobileVaulSnapshot,
	subscribeAppMobileVaul,
} from "@/lib/app-mobile-vaul";
import { APP_MODAL_OVERLAY_CLASS } from "@/lib/app-modal-layer";
import {
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	DETAIL_MOTION_PRESSABLE_CLASS,
} from "@/lib/detail-action-motion";
import { whatsNewReleasePillLabel } from "@/lib/product-changelog";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";
import type {
	WhatsNewRelease,
	WhatsNewSlide,
	WhatsNewSlideMedia,
} from "@/lib/whats-new-releases";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;

const footerNavButtonClass = cn(
	"h-auto min-h-9 shrink-0 rounded-full px-3.5 py-1.5 font-medium text-xs sm:text-sm",
	DETAIL_MOTION_PRESSABLE_CLASS,
);

/** Changelog CTA — canvas pill on card; last step only. */
const fullReleasePillClass = cn(
	footerNavButtonClass,
	"inline-flex w-fit gap-1.5 bg-background text-muted-foreground",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
);

/** Mobile tab bar routes — Vaul drawer below Tailwind `md`. */
function useMobileWhatsNewVaul() {
	return useSyncExternalStore(
		subscribeAppMobileVaul,
		getAppMobileVaulSnapshot,
		getAppMobileVaulServerSnapshot,
	);
}

/** Release date/version kicker — same track as home filter chips. */
function WhatsNewReleasePill({ label }: { label: string }) {
	return (
		<span className="mb-3 inline-flex min-h-7 w-fit items-center rounded-full bg-background px-3.5 py-1 font-medium text-[11px] text-muted-foreground tabular-nums tracking-wide">
			{label}
		</span>
	);
}

/** Autoplaying teaser — muted + playsInline for iOS autoplay policy. */
function WhatsNewVideoPanel({
	src,
	ariaLabel,
	variant = "desktop",
}: {
	src: string;
	ariaLabel: string;
	variant?: "desktop" | "mobile";
}) {
	const videoRef = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		void video.play().catch(() => {
			// Ignore play rejection when the browser blocks autoplay.
		});
	}, [src]);

	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-2xl bg-background",
				variant === "mobile"
					? "mx-auto flex w-fit max-w-full justify-center"
					: "flex h-full min-h-[220px] w-full flex-col md:min-h-0",
			)}
		>
			<video
				ref={videoRef}
				className={cn(
					variant === "mobile"
						? "block h-auto max-h-[min(54svh,520px)] w-auto max-w-full object-contain"
						: "size-full object-cover",
				)}
				src={src}
				autoPlay
				muted
				playsInline
				loop
				preload="auto"
				aria-label={ariaLabel}
			/>
		</div>
	);
}

function mediaStableKey(media: WhatsNewSlideMedia | undefined): string {
	if (!media) return "none";
	return media.kind === "video" ? `video:${media.src}` : `image:${media.src}`;
}

function WhatsNewMediaPanel({
	media,
	variant,
}: {
	media: WhatsNewSlideMedia;
	variant: "desktop" | "mobile";
}) {
	if (media.kind === "video") {
		return (
			<WhatsNewVideoPanel
				src={media.src}
				ariaLabel={media.ariaLabel}
				variant={variant}
			/>
		);
	}

	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-2xl bg-background",
				variant === "mobile"
					? "mx-auto aspect-16/10 w-full max-w-md"
					: "relative flex h-full min-h-[220px] w-full flex-col md:min-h-0",
			)}
		>
			<Image
				src={media.src}
				alt={media.alt}
				fill
				className="object-cover"
				sizes={
					variant === "mobile"
						? "(max-width: 768px) 100vw, 480px"
						: "(max-width: 768px) 100vw, 520px"
				}
				unoptimized
			/>
		</div>
	);
}

function WhatsNewCopyBlock({
	slide,
	releasePillLabel,
	showReleasePill,
	showFullReleaseCta,
	fullReleaseHref,
	onCta,
	titleId,
	descriptionId,
	layout,
}: {
	slide: WhatsNewSlide;
	releasePillLabel: string;
	showReleasePill: boolean;
	/** Changelog pill — only on the final step. */
	showFullReleaseCta: boolean;
	fullReleaseHref: string;
	onCta: () => void;
	titleId: string;
	descriptionId: string;
	layout: "desktop" | "mobile";
}) {
	const isMobile = layout === "mobile";
	const bodyClass = cn(
		"text-pretty text-muted-foreground leading-relaxed",
		isMobile ? "text-base" : "text-sm sm:text-base",
	);
	const paragraphs =
		slide.bodyParagraphs && slide.bodyParagraphs.length > 0
			? slide.bodyParagraphs
			: [slide.description];
	const thanks = slide.thanks;

	return (
		<div className="flex min-h-0 flex-col">
			{showReleasePill ? (
				<WhatsNewReleasePill label={releasePillLabel} />
			) : null}
			<h2
				id={titleId}
				className={cn(
					"text-balance font-semibold text-foreground tracking-tight",
					isMobile ? "text-2xl" : "text-xl sm:text-2xl",
				)}
			>
				{slide.title}
			</h2>
			<div id={descriptionId} className={cn("mt-3 space-y-3", bodyClass)}>
				{paragraphs.map((paragraph) => (
					<p key={paragraph.slice(0, 48)}>{paragraph}</p>
				))}
				{thanks ? (
					<p>
						Thanks to{" "}
						<Link
							href={`/profile/${encodeURIComponent(thanks.handle)}`}
							className="font-medium text-foreground underline-offset-2 hover:underline"
							onClick={onCta}
						>
							@{thanks.handle}
						</Link>{" "}
						{thanks.for}
					</p>
				) : null}
			</div>
			{slide.detailCard ? (
				<div className="mt-5 rounded-2xl bg-background px-4 py-3">
					<p
						className={cn(
							"font-medium text-foreground",
							isMobile ? "text-base" : "text-sm",
						)}
					>
						{slide.detailCard.title}
					</p>
					<p
						className={cn(
							"mt-1 text-balance text-muted-foreground leading-relaxed",
							isMobile ? "text-base" : "text-sm",
						)}
					>
						{slide.detailCard.body}
					</p>
				</div>
			) : null}
			{showFullReleaseCta ? (
				<div className="mt-5">
					<DetailMotionButtonWrap>
						<Button
							render={<Link href={fullReleaseHref} />}
							nativeButton={false}
							variant="ghost"
							size="pill"
							className={fullReleasePillClass}
							onClick={onCta}
						>
							See full release
							<ArrowUpRight
								className="size-3.5 shrink-0 opacity-80"
								aria-hidden
							/>
						</Button>
					</DetailMotionButtonWrap>
				</div>
			) : null}
		</div>
	);
}

function WhatsNewStepDots({
	slides,
	slideIndex,
	onSelect,
}: {
	slides: WhatsNewSlide[];
	slideIndex: number;
	onSelect: (index: number) => void;
}) {
	if (slides.length <= 1) return null;

	return (
		<div
			className="flex justify-center gap-1.5"
			role="tablist"
			aria-label="What's new slides"
		>
			{slides.map((s, index) => (
				<button
					key={s.title}
					type="button"
					role="tab"
					aria-selected={index === slideIndex}
					aria-label={`Slide ${index + 1} of ${slides.length}: ${s.title}`}
					className={cn(
						"min-h-10 min-w-10 rounded-full px-2 py-2 transition-colors duration-200 ease-out motion-reduce:transition-none",
						index === slideIndex
							? "text-foreground"
							: "text-muted-foreground/60 [@media(hover:hover)]:hover:text-muted-foreground",
					)}
					onClick={() => onSelect(index)}
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
	);
}

function WhatsNewFooterNav({
	slideIndex,
	isLastSlide,
	onBack,
	onNext,
	onDismiss,
	layout,
}: {
	slideIndex: number;
	isLastSlide: boolean;
	onBack: () => void;
	onNext: () => void;
	onDismiss: () => void;
	layout: "desktop" | "mobile";
}) {
	const isMobile = layout === "mobile";
	const mobileBtn = isMobile ? "min-h-12 px-5 py-4 text-base" : undefined;

	return (
		<div className="flex shrink-0 items-center justify-between gap-2">
			{slideIndex > 0 ? (
				<DetailMotionButtonWrap>
					<Button
						type="button"
						variant="ghost"
						size="pill"
						className={cn(
							footerNavButtonClass,
							"gap-1 bg-background text-muted-foreground",
							DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
							mobileBtn,
						)}
						onClick={onBack}
					>
						<ChevronLeft className="size-3.5" aria-hidden />
						Back
					</Button>
				</DetailMotionButtonWrap>
			) : (
				<span aria-hidden className="size-0" />
			)}

			<DetailMotionButtonWrap>
				{isLastSlide ? (
					<Button
						type="button"
						variant="default"
						size="pill"
						className={cn(
							footerNavButtonClass,
							"bg-foreground font-semibold text-background",
							mobileBtn,
						)}
						onClick={onDismiss}
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
							mobileBtn,
						)}
						onClick={onNext}
					>
						Next
						<ChevronRight className="size-3.5" aria-hidden />
					</Button>
				)}
			</DetailMotionButtonWrap>
		</div>
	);
}

function WhatsNewDrawer({
	open,
	release,
	slide,
	slideIndex,
	isLastSlide,
	releasePillLabel,
	titleId,
	descriptionId,
	onDismiss,
	onBack,
	onNext,
	onSelectSlide,
}: {
	open: boolean;
	release: WhatsNewRelease;
	slide: WhatsNewSlide;
	slideIndex: number;
	isLastSlide: boolean;
	releasePillLabel: string;
	titleId: string;
	descriptionId: string;
	onDismiss: () => void;
	onBack: () => void;
	onNext: () => void;
	onSelectSlide: (index: number) => void;
}) {
	const reduceMotion = useReducedMotion();
	const scrollRef = useRef<HTMLDivElement>(null);
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		open,
	);
	const slideTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.18, ease: PANEL_EASE };
	const mediaKey = mediaStableKey(slide.media);

	return (
		<DetailVaulSheet
			open={open}
			onOpenChange={(next) => {
				if (!next) onDismiss();
			}}
			appStack
			// Stable label — per-slide titles live in the body so Vaul doesn't churn.
			title="What's new"
			description={slide.description}
		>
			<div className="flex min-h-0 w-full flex-1 flex-col">
				<div className="relative isolate flex min-h-0 flex-1 flex-col">
					<DetailDrawerScrollBody scrollRef={scrollRef}>
						<div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pt-2 pb-6">
							{/* Media stays mounted across steps that share the same src. */}
							{slide.media ? (
								<div className="flex flex-col">
									<AnimatePresence mode="popLayout" initial={false}>
										<motion.div
											key={mediaKey}
											initial={reduceMotion ? false : { opacity: 0 }}
											animate={{ opacity: 1 }}
											exit={reduceMotion ? undefined : { opacity: 0 }}
											transition={slideTransition}
										>
											<WhatsNewMediaPanel
												media={slide.media}
												variant="mobile"
											/>
										</motion.div>
									</AnimatePresence>
								</div>
							) : null}
							<AnimatePresence mode="popLayout" initial={false}>
								<motion.div
									key={slideIndex}
									initial={reduceMotion ? false : { opacity: 0, y: 6 }}
									animate={{ opacity: 1, y: 0 }}
									exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
									transition={slideTransition}
								>
									<WhatsNewCopyBlock
										slide={slide}
										releasePillLabel={releasePillLabel}
										showReleasePill={slideIndex === 0}
										showFullReleaseCta={isLastSlide}
										fullReleaseHref={release.fullReleaseHref}
										onCta={onDismiss}
										titleId={titleId}
										descriptionId={descriptionId}
										layout="mobile"
									/>
								</motion.div>
							</AnimatePresence>
							<WhatsNewStepDots
								slides={release.slides}
								slideIndex={slideIndex}
								onSelect={onSelectSlide}
							/>
						</div>
					</DetailDrawerScrollBody>
					<SheetScrollScrims
						showHeaderFade={showHeaderFade}
						showFooterFade={showFooterFade}
						footerTone="filmography"
					/>
				</div>
				<div className="relative z-10 shrink-0 bg-card px-4 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
					<WhatsNewFooterNav
						slideIndex={slideIndex}
						isLastSlide={isLastSlide}
						onBack={onBack}
						onNext={onNext}
						onDismiss={onDismiss}
						layout="mobile"
					/>
				</div>
			</div>
		</DetailVaulSheet>
	);
}

function WhatsNewModal({
	open,
	release,
	slide,
	slideIndex,
	isLastSlide,
	releasePillLabel,
	titleId,
	descriptionId,
	onDismiss,
	onBack,
	onNext,
	onSelectSlide,
}: {
	open: boolean;
	release: WhatsNewRelease;
	slide: WhatsNewSlide;
	slideIndex: number;
	isLastSlide: boolean;
	releasePillLabel: string;
	titleId: string;
	descriptionId: string;
	onDismiss: () => void;
	onBack: () => void;
	onNext: () => void;
	onSelectSlide: (index: number) => void;
}) {
	const reduceMotion = useReducedMotion();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [open]);

	const backdropTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.18, ease: "easeOut" as const };
	const panelTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.25, ease: PANEL_EASE };
	const slideTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.18, ease: PANEL_EASE };
	const mediaKey = mediaStableKey(slide.media);

	if (!mounted) return null;

	return createPortal(
		<AnimatePresence initial={false}>
			{open ? (
				<motion.div
					key="whats-new-backdrop"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={backdropTransition}
					className={cn(
						APP_MODAL_OVERLAY_CLASS,
						"place-items-center px-4 py-6",
					)}
					onClick={onDismiss}
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
							"relative flex max-h-[min(92svh,640px)] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-card text-foreground md:max-h-[min(92svh,680px)]",
							"is-open",
						)}
					>
						<div className="absolute top-3 right-3 z-20 sm:top-4 sm:right-4">
							<Button
								type="button"
								variant="ghost"
								size="icon-pill"
								onClick={onDismiss}
								aria-label="Close what's new"
								className="min-h-10 min-w-10 text-muted-foreground"
							>
								<X className="size-4" aria-hidden />
							</Button>
						</div>

						<div className="flex min-h-0 flex-1 flex-col md:flex-row md:items-stretch">
							<div className="flex min-h-0 flex-1 flex-col justify-between px-6 py-10 sm:px-8 md:max-w-[48%] md:py-8">
								{/* Copy-only swap — keep the shell mounted so Next/Back never replay open. */}
								<div className="relative min-h-0 flex-1">
									<AnimatePresence mode="popLayout" initial={false}>
										<motion.div
											key={slideIndex}
											initial={reduceMotion ? false : { opacity: 0, x: 8 }}
											animate={{ opacity: 1, x: 0 }}
											exit={reduceMotion ? undefined : { opacity: 0, x: -6 }}
											transition={slideTransition}
											className="flex min-h-0 flex-col"
										>
											<WhatsNewCopyBlock
												slide={slide}
												releasePillLabel={releasePillLabel}
												showReleasePill={slideIndex === 0}
												showFullReleaseCta={isLastSlide}
												fullReleaseHref={release.fullReleaseHref}
												onCta={onDismiss}
												titleId={titleId}
												descriptionId={descriptionId}
												layout="desktop"
											/>
										</motion.div>
									</AnimatePresence>
								</div>

								<div className="mt-6 flex flex-col gap-4 md:mt-0">
									<WhatsNewStepDots
										slides={release.slides}
										slideIndex={slideIndex}
										onSelect={onSelectSlide}
									/>
									<WhatsNewFooterNav
										slideIndex={slideIndex}
										isLastSlide={isLastSlide}
										onBack={onBack}
										onNext={onNext}
										onDismiss={onDismiss}
										layout="desktop"
									/>
								</div>
							</div>

							<div className="flex min-h-0 shrink-0 flex-col px-4 pb-6 md:max-w-[52%] md:flex-1 md:px-4 md:py-4 md:pb-4 md:pl-0">
								{/* Key by media src — identical clips across steps stay mounted (no reload flash). */}
								{slide.media ? (
									<AnimatePresence mode="popLayout" initial={false}>
										<motion.div
											key={mediaKey}
											initial={reduceMotion ? false : { opacity: 0 }}
											animate={{ opacity: 1 }}
											exit={reduceMotion ? undefined : { opacity: 0 }}
											transition={slideTransition}
											className="flex min-h-0 flex-1 flex-col"
										>
											<WhatsNewMediaPanel
												media={slide.media}
												variant="desktop"
											/>
										</motion.div>
									</AnimatePresence>
								) : (
									<div
										className="min-h-[220px] flex-1 rounded-2xl bg-background md:min-h-0"
										aria-hidden
									/>
								)}
							</div>
						</div>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>,
		document.body,
	);
}

/**
 * One-time per release carousel — support-campaign split on desktop (copy left,
 * media right), Vaul drawer on mobile. Steps swap title/body/media together.
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
	const isMobileVaul = useMobileWhatsNewVaul();
	const titleId = useId();
	const descriptionId = useId();
	const [slideIndex, setSlideIndex] = useState(0);

	const slideCount = release.slides.length;
	const slide = release.slides[slideIndex];
	const isLastSlide = slideIndex >= slideCount - 1;
	const releasePillLabel = whatsNewReleasePillLabel(release.id);

	const handleDismiss = useCallback(() => {
		onDismiss();
		setSlideIndex(0);
	}, [onDismiss]);

	const goBack = useCallback(() => {
		setSlideIndex((i) => Math.max(i - 1, 0));
	}, []);

	const goNext = useCallback(() => {
		setSlideIndex((i) => Math.min(i + 1, slideCount - 1));
	}, [slideCount]);

	useEffect(() => {
		if (!open) setSlideIndex(0);
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") handleDismiss();
			if (e.key === "ArrowRight" && !isLastSlide) goNext();
			if (e.key === "ArrowLeft" && slideIndex > 0) goBack();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, handleDismiss, isLastSlide, slideIndex, goBack, goNext]);

	if (!slide) return null;

	const shared = {
		open,
		release,
		slide,
		slideIndex,
		isLastSlide,
		releasePillLabel,
		titleId,
		descriptionId,
		onDismiss: handleDismiss,
		onBack: goBack,
		onNext: goNext,
		onSelectSlide: setSlideIndex,
	};

	if (isMobileVaul) {
		return <WhatsNewDrawer {...shared} />;
	}

	return <WhatsNewModal {...shared} />;
}
