"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import {
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
import type { SenseSupportCampaign } from "@/lib/sense-support-campaign";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

const PANEL_EASE = [0.165, 0.84, 0.44, 1] as const;

const footerButtonClass = cn(
	"h-auto shrink-0 rounded-full font-medium",
	DETAIL_MOTION_PRESSABLE_CLASS,
);

function footerButtonClassForLayout(layout: "desktop" | "mobile") {
	return cn(
		footerButtonClass,
		layout === "mobile"
			? "min-h-12 px-5 py-4 text-base"
			: "min-h-11 px-4 py-3 text-sm",
	);
}

/** Mobile tab bar routes — Vaul drawer below Tailwind `md`. */
function useMobileCampaignVaul() {
	return useSyncExternalStore(
		subscribeAppMobileVaul,
		getAppMobileVaulSnapshot,
		getAppMobileVaulServerSnapshot,
	);
}

/** Autoplaying vertical teaser — muted + playsInline for iOS autoplay policy. */
function CampaignVideoPanel({
	src,
	variant = "desktop",
}: {
	src: string;
	variant?: "desktop" | "mobile";
}) {
	const videoRef = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		// Nudge play after mount — sheet entrance can delay native autoPlay.
		void video.play().catch(() => {
			// Ignore play rejection when the browser blocks autoplay.
		});
	}, []);

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
				aria-label="Sense mobile app preview"
			/>
		</div>
	);
}

function CampaignCopyBlock({
	campaign,
	titleId,
	descriptionId,
	layout,
}: {
	campaign: SenseSupportCampaign;
	titleId: string;
	descriptionId: string;
	layout: "desktop" | "mobile";
}) {
	const isMobile = layout === "mobile";

	return (
		<div className="flex min-h-0 flex-col">
			<h2
				id={titleId}
				className={cn(
					"text-balance font-semibold text-foreground tracking-tight",
					isMobile ? "text-2xl" : "text-xl sm:text-2xl",
				)}
			>
				{campaign.title}
			</h2>
			<div
				id={descriptionId}
				className={cn(
					"mt-3 space-y-3 text-pretty text-muted-foreground leading-relaxed",
					isMobile ? "text-base" : "text-sm sm:text-base",
				)}
			>
				{campaign.bodyParagraphs.map((paragraph) => (
					<p key={paragraph.slice(0, 24)}>{paragraph}</p>
				))}
			</div>
			<div className="mt-5 rounded-2xl bg-background px-4 py-3">
				<p
					className={cn(
						"font-medium text-foreground",
						isMobile ? "text-base" : "text-sm",
					)}
				>
					{campaign.learnTitle}
				</p>
				<p
					className={cn(
						"mt-1 text-balance text-muted-foreground leading-relaxed",
						isMobile ? "text-base" : "text-sm",
					)}
				>
					{campaign.learnBody}
				</p>
			</div>
		</div>
	);
}

function CampaignCtaRow({
	campaign,
	onDismiss,
	layout,
}: {
	campaign: SenseSupportCampaign;
	onDismiss: () => void;
	layout: "desktop" | "mobile";
}) {
	return (
		<div
			className={cn(
				"flex shrink-0 flex-col gap-2.5",
				layout === "desktop" &&
					"sm:flex-row sm:items-center sm:justify-between",
			)}
		>
			<DetailMotionButtonWrap>
				<Button
					render={<Link href={campaign.primaryCtaHref} />}
					nativeButton={false}
					variant="default"
					size="pill"
					className={cn(
						footerButtonClassForLayout(layout),
						"w-full bg-foreground font-semibold text-background",
						layout === "desktop" && "sm:w-auto",
					)}
					onClick={onDismiss}
				>
					{campaign.primaryCtaLabel}
				</Button>
			</DetailMotionButtonWrap>
			<DetailMotionButtonWrap>
				<Button
					type="button"
					variant="ghost"
					size="pill"
					className={cn(
						footerButtonClassForLayout(layout),
						"w-full bg-background text-muted-foreground",
						layout === "desktop" && "sm:w-auto",
						DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
					)}
					onClick={onDismiss}
				>
					{campaign.secondaryCtaLabel}
				</Button>
			</DetailMotionButtonWrap>
		</div>
	);
}

function SenseSupportCampaignDrawer({
	open,
	campaign,
	titleId,
	descriptionId,
	onDismiss,
}: {
	open: boolean;
	campaign: SenseSupportCampaign;
	titleId: string;
	descriptionId: string;
	onDismiss: () => void;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		open,
	);

	return (
		<DetailVaulSheet
			open={open}
			onOpenChange={(next) => {
				if (!next) onDismiss();
			}}
			appStack
			title={campaign.title}
			description={campaign.bodyParagraphs[0]}
		>
			<div className="flex min-h-0 w-full flex-1 flex-col">
				<div className="relative isolate flex min-h-0 flex-1 flex-col">
					<DetailDrawerScrollBody scrollRef={scrollRef}>
						<div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pt-2 pb-6">
							<CampaignVideoPanel src={campaign.videoSrc} variant="mobile" />
							<CampaignCopyBlock
								campaign={campaign}
								titleId={titleId}
								descriptionId={descriptionId}
								layout="mobile"
							/>
						</div>
					</DetailDrawerScrollBody>
					{/* Scrims scoped to scrollport — not the sticky CTA footer below. */}
					<SheetScrollScrims
						showHeaderFade={showHeaderFade}
						showFooterFade={showFooterFade}
						footerTone="filmography"
					/>
				</div>
				<div className="relative z-10 shrink-0 bg-card px-4 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
					<CampaignCtaRow
						campaign={campaign}
						onDismiss={onDismiss}
						layout="mobile"
					/>
				</div>
			</div>
		</DetailVaulSheet>
	);
}

function SenseSupportCampaignModal({
	open,
	campaign,
	titleId,
	descriptionId,
	onDismiss,
}: {
	open: boolean;
	campaign: SenseSupportCampaign;
	titleId: string;
	descriptionId: string;
	onDismiss: () => void;
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

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onDismiss();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onDismiss]);

	const backdropTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.18, ease: "easeOut" as const };
	const panelTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.25, ease: PANEL_EASE };

	if (!mounted) return null;

	return createPortal(
		<AnimatePresence initial={false}>
			{open ? (
				<motion.div
					key="sense-support-campaign-backdrop"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={backdropTransition}
					aria-hidden
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
								aria-label="Close"
								className="min-h-10 min-w-10 text-muted-foreground"
							>
								<X className="size-4" aria-hidden />
							</Button>
						</div>

						<div className="flex min-h-0 flex-1 flex-col md:flex-row md:items-stretch">
							<div className="flex min-h-0 flex-1 flex-col justify-between px-6 py-10 sm:px-8 md:max-w-[48%] md:py-8">
								<CampaignCopyBlock
									campaign={campaign}
									titleId={titleId}
									descriptionId={descriptionId}
									layout="desktop"
								/>
								<div className="mt-6 md:mt-0">
									<CampaignCtaRow
										campaign={campaign}
										onDismiss={onDismiss}
										layout="desktop"
									/>
								</div>
							</div>

							<div className="flex min-h-0 shrink-0 flex-col px-4 pb-6 md:max-w-[52%] md:flex-1 md:px-4 md:py-4 md:pb-4 md:pl-0">
								<CampaignVideoPanel src={campaign.videoSrc} variant="desktop" />
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
 * One-time support campaign — Vaul drawer on mobile, split modal on desktop.
 */
export function SenseSupportCampaignDialog({
	open,
	campaign,
	onDismiss,
}: {
	open: boolean;
	campaign: SenseSupportCampaign;
	onDismiss: () => void;
}) {
	const isMobileVaul = useMobileCampaignVaul();
	const titleId = useId();
	const descriptionId = useId();

	if (isMobileVaul) {
		return (
			<SenseSupportCampaignDrawer
				open={open}
				campaign={campaign}
				titleId={titleId}
				descriptionId={descriptionId}
				onDismiss={onDismiss}
			/>
		);
	}

	return (
		<SenseSupportCampaignModal
			open={open}
			campaign={campaign}
			titleId={titleId}
			descriptionId={descriptionId}
			onDismiss={onDismiss}
		/>
	);
}
