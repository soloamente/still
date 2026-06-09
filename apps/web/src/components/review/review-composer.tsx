"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Label } from "@still/ui/components/label";
import { cn } from "@still/ui/lib/utils";
import { Loader2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { create } from "zustand";
import { LogRatingSlider } from "@/components/log/log-rating-slider";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import type { MovieDetailHeroSlide } from "@/components/movie/movie-detail-hero-media";
import { ReviewListingMentionTextarea } from "@/components/review/review-listing-mention-textarea";
import { ReviewReaderStillSection } from "@/components/review/review-reader-still-section";
import {
	type ContentVisibility,
	VisibilitySelect,
} from "@/components/review/visibility-select";
import { ModalSheetScrollScrims } from "@/components/ui/modal-sheet-scroll-scrims";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import { TransitionsModalLayer } from "@/components/ui/transitions-modal-layer";
import { api } from "@/lib/api";
import { MODAL_SHEET_SCROLL_CLASS } from "@/lib/app-modal-layer";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import {
	clampLogRatingDisplay,
	formatStoredLogRatingDisplay,
	logRatingToDisplay,
	logRatingToStored,
} from "@/lib/log-rating";
import { shouldRefreshRouteAfterMutation } from "@/lib/router-refresh-after-mutation";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

const BODY_MAX = 20_000;
const TITLE_MAX = 200;
const DEFAULT_RATING = 7;

const SHEET_EASE = [0.165, 0.84, 0.44, 1] as const;

const SHEET_DIALOG_CLASS =
	"relative flex max-h-[min(92svh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-card px-6 pt-6 pb-0 shadow-2xl md:rounded-[2rem] md:px-8 md:pt-10";

type ComposerStep = "compose" | "spoilers";

type ComposerArgs = {
	movieId: number;
	movieTitle: string;
	posterUrl?: string | null;
	/** TMDb or Sense community average on 0–10 for the slider ghost fill. */
	averageRating?: number | null;
	reviewId?: string;
	/** Latest diary log — when set, review score follows log (no slider). */
	diaryLogId?: string;
	diaryRatingStored?: number | null;
	initialTitle?: string | null;
	initialBody?: string;
	initialContainsSpoilers?: boolean;
	initialVisibility?: ContentVisibility;
	/** Saved TMDb backdrop key — edit flow seeds the composer still picker. */
	initialStillSlideKey?: string | null;
};

type Store = {
	isOpen: boolean;
	args: ComposerArgs | null;
	open: (args: ComposerArgs) => void;
	close: () => void;
	clearArgs: () => void;
};

export const useReviewComposer = create<Store>((set) => ({
	isOpen: false,
	args: null,
	open: (args) => set({ isOpen: true, args }),
	close: () => set({ isOpen: false }),
	clearArgs: () => set({ args: null }),
}));

function posterSrcFromPath(path: string | null | undefined): string | null {
	if (!path) return null;
	if (path.startsWith("http")) return path;
	const fragment = path.startsWith("/") ? path : `/${path}`;
	return `https://image.tmdb.org/t/p/w342${fragment}`;
}

/**
 * Cinematic review sheet — mirrors `QuickLogRoot` layout, motion, and footer chrome.
 * Mounted in `AppShell`; open via `useReviewComposer().open()`.
 */
export function ReviewComposerRoot() {
	const pathname = usePathname();
	const router = useRouter();
	const reduceMotion = useReducedMotion();
	const { isOpen, args, close, clearArgs } = useReviewComposer();
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [ratingDisplay, setRatingDisplay] = useState(DEFAULT_RATING);
	const [containsSpoilers, setContainsSpoilers] = useState(false);
	const [visibility, setVisibility] = useState<ContentVisibility>("public");
	const [visibilityTouched, setVisibilityTouched] = useState(false);
	const [step, setStep] = useState<ComposerStep>("compose");
	const [saving, setSaving] = useState(false);
	const [posterUrl, setPosterUrl] = useState<string | null>(null);
	const [averageRating, setAverageRating] = useState<number | null>(null);
	const [movieScreenshots, setMovieScreenshots] = useState<
		MovieDetailHeroSlide[]
	>([]);
	const [screenshotsLoading, setScreenshotsLoading] = useState(false);
	const [selectedStillKey, setSelectedStillKey] = useState<string | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

	const handleClose = useCallback(() => {
		close();
	}, [close]);

	const handleClosed = useCallback(() => {
		if (!useReviewComposer.getState().isOpen) {
			clearArgs();
		}
	}, [clearArgs]);

	useEffect(() => {
		if (!args) {
			setTitle("");
			setBody("");
			setRatingDisplay(DEFAULT_RATING);
			setContainsSpoilers(false);
			setVisibility("public");
			setVisibilityTouched(false);
			setStep("compose");
			setPosterUrl(null);
			setAverageRating(null);
			setMovieScreenshots([]);
			setScreenshotsLoading(false);
			setSelectedStillKey(null);
		}
	}, [args]);

	useEffect(() => {
		if (!isOpen || !args) return;
		setPosterUrl(posterSrcFromPath(args.posterUrl) ?? null);
		setAverageRating(args.averageRating ?? null);
		const fromDiary = logRatingToDisplay(args.diaryRatingStored);
		setRatingDisplay(fromDiary ?? DEFAULT_RATING);
		setSelectedStillKey(args.initialStillSlideKey ?? null);
		if (args.reviewId) {
			setTitle(args.initialTitle ?? "");
			setBody(args.initialBody ?? "");
			setContainsSpoilers(args.initialContainsSpoilers ?? false);
			setVisibility(args.initialVisibility ?? "public");
			setVisibilityTouched(true);
		}
	}, [isOpen, args]);

	// TMDb backdrops for optional review hero still — same pool as the reader drawer picker.
	useEffect(() => {
		if (!isOpen || !args) return;
		let cancelled = false;
		setScreenshotsLoading(true);
		void api.api
			.movies({ id: String(args.movieId) })
			["review-stills"].get()
			.then((res) => {
				if (cancelled) return;
				const shots = (
					res.data as
						| { screenshots?: MovieDetailHeroSlide[] }
						| null
						| undefined
				)?.screenshots;
				setMovieScreenshots(Array.isArray(shots) ? shots : []);
			})
			.catch(() => {
				if (!cancelled) setMovieScreenshots([]);
			})
			.finally(() => {
				if (!cancelled) setScreenshotsLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [isOpen, args]);

	const diaryScoreLabel = useMemo(() => {
		if (!args) return null;
		return formatStoredLogRatingDisplay(args.diaryRatingStored);
	}, [args]);

	const usesDiaryRating = Boolean(args?.diaryLogId);
	const isEdit = Boolean(args?.reviewId);

	const composeScrollKey = `${usesDiaryRating}-${posterUrl ?? ""}-${selectedStillKey ?? ""}-${movieScreenshots.length}-${body.length}`;
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		isOpen && step === "compose",
		composeScrollKey,
	);

	useEffect(() => {
		if (!args) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape" || !isOpen) return;
			if (step === "spoilers") {
				setStep("compose");
				setContainsSpoilers(false);
				return;
			}
			handleClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [args, isOpen, handleClose, step]);

	const canPublish = useMemo(() => {
		if (!args) return false;
		const trimmed = body.trim();
		if (!trimmed) return false;
		if (body.length > BODY_MAX) return false;
		if (title.length > TITLE_MAX) return false;
		return true;
	}, [args, body, title.length]);

	const stepTransition = reduceMotion
		? { duration: 0 }
		: { duration: 0.18, ease: SHEET_EASE };

	if (!args) return null;

	const spoilerChoice = containsSpoilers ? "yes" : "no";

	// Sheet fields sit on `bg-card` — suppress default Input/Textarea focus ring and border wash.
	const fieldClass =
		"min-h-11 rounded-2xl border-transparent bg-background text-base shadow-none outline-none focus-visible:border-transparent focus-visible:bg-background focus-visible:ring-0 focus-visible:outline-none";

	function handlePublishClick() {
		if (!canPublish) return;
		setContainsSpoilers(false);
		setStep("spoilers");
	}

	async function submit() {
		if (!canPublish || !args || step !== "spoilers") return;
		setSaving(true);
		try {
			const stillPayload = selectedStillKey
				? { stillSlideKey: selectedStillKey }
				: {};
			const patchBody = {
				title: title.trim() || undefined,
				body: body.trim(),
				containsSpoilers,
				...(visibilityTouched ? { visibility } : {}),
				...stillPayload,
				...(!usesDiaryRating
					? { rating: logRatingToStored(ratingDisplay) ?? undefined }
					: {}),
			};
			if (isEdit && args.reviewId) {
				await api.api.reviews({ id: args.reviewId }).patch(patchBody);
				toast.success("Review updated");
			} else {
				const rating = usesDiaryRating
					? (args.diaryRatingStored ?? undefined)
					: (logRatingToStored(ratingDisplay) ?? undefined);
				await api.api.reviews.post({
					movieId: args.movieId,
					logId: args.diaryLogId,
					title: title.trim() || undefined,
					body: body.trim(),
					rating,
					containsSpoilers,
					...(visibilityTouched ? { visibility } : {}),
					...stillPayload,
				});
				toast.success("Review published");
			}
			if (shouldRefreshRouteAfterMutation(pathname)) {
				router.refresh();
			}
			handleClose();
		} catch (err) {
			console.error(err);
			toast.error(
				isEdit ? "Couldn't save — try again" : "Couldn't publish — try again",
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<TransitionsModalLayer
			open={isOpen}
			onClose={handleClose}
			onClosed={handleClosed}
			aria-labelledby="review-composer-title"
			dialogClassName={SHEET_DIALOG_CLASS}
		>
			<div className="mb-4 flex justify-end">
				<Button
					variant="ghost"
					size="icon-pill"
					onClick={handleClose}
					aria-label="Close"
					className="text-muted-foreground"
				>
					<X className="size-4" />
				</Button>
			</div>

			<div className="relative">
				<div ref={scrollRef} className={MODAL_SHEET_SCROLL_CLASS}>
					<AnimatePresence mode="wait" initial={false}>
						{step === "compose" ? (
							<motion.div
								key="review-compose"
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -6 }}
								transition={stepTransition}
							>
								{screenshotsLoading ? (
									<div
										className="mb-6 aspect-video w-full animate-pulse rounded-[1.5rem] bg-background"
										aria-hidden
									/>
								) : movieScreenshots.length > 0 ? (
									<ReviewReaderStillSection
										slides={movieScreenshots}
										selectedKey={selectedStillKey}
										isOwner
										saving={false}
										onSelect={setSelectedStillKey}
									/>
								) : posterUrl ? (
									<div className="mx-auto mb-5 flex justify-center">
										<div className="relative aspect-[2/3] w-[7.5rem] overflow-hidden rounded-2xl bg-muted/30 shadow-lg">
											<Image
												src={posterUrl}
												alt=""
												fill
												sizes="120px"
												className="object-cover"
												unoptimized
											/>
										</div>
									</div>
								) : null}

								<h2
									id="review-composer-title"
									className="mb-2 text-balance text-center font-semibold text-foreground text-xl sm:text-2xl"
								>
									{isEdit ? "Edit your review" : "Share your review"}
								</h2>
								<p
									className={cn(
										"text-balance text-center font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base",
										usesDiaryRating ? "mb-2" : "mb-6",
									)}
								>
									{args.movieTitle}
								</p>

								{usesDiaryRating && diaryScoreLabel ? (
									<p className="mb-6 text-center font-semibold text-2xl text-foreground tabular-nums tracking-tight">
										{diaryScoreLabel}
									</p>
								) : usesDiaryRating ? null : (
									<LogRatingSlider
										value={clampLogRatingDisplay(ratingDisplay)}
										onChange={setRatingDisplay}
										averageRating={averageRating}
										className="mb-6"
									/>
								)}

								<fieldset className="mb-6 flex flex-col items-center space-y-2 border-0 p-0 text-sm">
									<legend className="w-full text-center text-muted-foreground text-xs">
										Who can see this
									</legend>
									<VisibilitySelect
										id="review-visibility"
										variant="pills"
										value={visibility}
										onChange={(next) => {
											setVisibility(next);
											setVisibilityTouched(true);
										}}
									/>
								</fieldset>

								<div className="mb-5 space-y-2">
									<Label
										htmlFor="review-title"
										className="w-full justify-center text-center text-muted-foreground text-xs"
									>
										Headline (optional)
									</Label>
									<Input
										id="review-title"
										value={title}
										onChange={(e) => setTitle(e.target.value)}
										maxLength={TITLE_MAX}
										placeholder="A line for your take"
										autoComplete="off"
										spellCheck
										className={fieldClass}
									/>
								</div>

								<div className="mb-5 space-y-2">
									<Label
										htmlFor="review-body"
										className="w-full justify-center text-center text-muted-foreground text-xs"
									>
										Your review
									</Label>
									<ReviewListingMentionTextarea
										id="review-body"
										value={body}
										onChange={setBody}
										rows={6}
										placeholder="What stayed with you? Type @ to tag another film or show."
										maxLength={BODY_MAX}
										className={cn(
											fieldClass,
											"min-h-[10rem] resize-y py-3 leading-relaxed",
										)}
									/>
									<p className="text-center text-muted-foreground text-xs">
										Type <span className="font-medium">@</span> to link other
										films or TV shows in your review.
									</p>
									<p className="text-right text-muted-foreground text-xs tabular-nums">
										{body.length.toLocaleString()} / {BODY_MAX.toLocaleString()}
									</p>
								</div>
							</motion.div>
						) : (
							<motion.div
								key="review-spoilers"
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -6 }}
								transition={stepTransition}
								className="flex flex-col items-center justify-center px-2 py-8"
							>
								<h2
									id="review-composer-title"
									className="mb-3 text-balance text-center font-semibold text-foreground text-xl sm:text-2xl"
								>
									One last thing
								</h2>
								<p className="mb-8 max-w-sm text-balance text-center font-editorial text-muted-foreground text-sm leading-relaxed sm:text-base">
									Does your review reveal plot details others may not have seen
									yet?
								</p>
								<SegmentedPillToolbar
									layoutId="review-composer-spoilers"
									aria-label="Spoiler disclosure"
									value={spoilerChoice}
									onChange={(next) => setContainsSpoilers(next === "yes")}
									options={[
										{ id: "no", label: "No spoilers" },
										{ id: "yes", label: "Contains spoilers" },
									]}
								/>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
				{/* Compose-only scrims — siblings of scroll, not measured for layout */}
				{step === "compose" ? (
					<ModalSheetScrollScrims
						showHeaderFade={showHeaderFade}
						showFooterFade={showFooterFade}
					/>
				) : null}
			</div>

			<footer className="absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-3 md:inset-x-4 md:bottom-4">
				<DetailMotionButtonWrap>
					<Button
						type="button"
						variant="ghost"
						size="pill"
						className={cn(
							"h-auto min-h-10 min-w-[5.5rem] border-transparent bg-background py-2.5 text-muted-foreground",
							DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
						)}
						disabled={saving}
						onClick={() => {
							if (step === "spoilers") {
								setStep("compose");
								setContainsSpoilers(false);
								return;
							}
							handleClose();
						}}
					>
						{step === "spoilers" ? "Back" : "Cancel"}
					</Button>
				</DetailMotionButtonWrap>
				<DetailMotionButtonWrap>
					<Button
						type="button"
						variant="default"
						size="pill"
						className="hover:!bg-foreground hover:!text-background h-auto min-h-10 min-w-[8.5rem] bg-foreground px-5 py-2.5 text-background text-base [@media(hover:hover)]:hover:bg-foreground [@media(hover:hover)]:hover:text-background"
						disabled={
							(step === "compose" && !canPublish) ||
							(step === "spoilers" && saving)
						}
						onClick={() => {
							if (step === "compose") {
								handlePublishClick();
								return;
							}
							void submit();
						}}
					>
						{saving ? (
							<Loader2 className="size-3.5 animate-spin" aria-hidden />
						) : null}
						{step === "spoilers"
							? isEdit
								? "Save changes"
								: "Publish now"
							: isEdit
								? "Continue"
								: "Publish"}
					</Button>
				</DetailMotionButtonWrap>
			</footer>
		</TransitionsModalLayer>
	);
}
