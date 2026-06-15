"use client";

import { cn } from "@still/ui/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

import {
	ReviewVoicePauseIcon,
	ReviewVoicePlayIcon,
} from "@/components/review/review-voice-play-icon";

import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import {
	hasReviewVoiceAudio,
	type ReviewAudioFields,
	resolveReviewAudioDurationMs,
} from "@/lib/review-audio-fields";
import { formatReviewAudioDurationLabel } from "@/lib/review-audio-limits";
import {
	claimReviewAudioPlayback,
	releaseReviewAudioPlayback,
} from "@/lib/review-audio-playback";

type ReviewAudioPlayerProps = {
	src: string;
	durationMs: number;
	className?: string;
	/** Stop click bubbling when nested inside review cards / buttons. */
	stopPropagation?: boolean;
	/** Icon-only control — no duration label or progress (e.g. composer recorder row). */
	compact?: boolean;
	/** Larger tap target for centered recorder stage controls. */
	controlSize?: "default" | "stage";
	/** Composer spectrum sync — fires on play/pause/scrub progress. */
	onPlaybackProgress?: (state: {
		progress: number;
		playing: boolean;
		elapsedMs: number;
	}) => void;
};

/** Tap-to-play voice review — HTMLAudioElement, preload="none", no autoplay. */
export function ReviewAudioPlayer({
	src,
	durationMs,
	className,
	stopPropagation = false,
	compact = false,
	controlSize = "default",
	onPlaybackProgress,
}: ReviewAudioPlayerProps) {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const [playing, setPlaying] = useState(false);
	const [elapsedMs, setElapsedMs] = useState(0);

	const progress = durationMs > 0 ? Math.min(1, elapsedMs / durationMs) : 0;

	const emitPlaybackProgress = useCallback(
		(nextPlaying: boolean, nextElapsedMs: number) => {
			if (!onPlaybackProgress) return;
			const nextProgress =
				durationMs > 0 ? Math.min(1, nextElapsedMs / durationMs) : 0;
			onPlaybackProgress({
				progress: nextProgress,
				playing: nextPlaying,
				elapsedMs: nextElapsedMs,
			});
		},
		[durationMs, onPlaybackProgress],
	);
	const timeLabel = playing
		? `${formatReviewAudioDurationLabel(elapsedMs)} / ${formatReviewAudioDurationLabel(durationMs)}`
		: formatReviewAudioDurationLabel(durationMs);

	const handleToggle = useCallback(async () => {
		const audio = audioRef.current;
		if (!audio) return;

		if (audio.paused) {
			try {
				claimReviewAudioPlayback(audio);
				await audio.play();
				setPlaying(true);
			} catch {
				setPlaying(false);
			}
			return;
		}

		audio.pause();
		setPlaying(false);
	}, []);

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		const onTimeUpdate = () => {
			const nextElapsedMs = Math.floor(audio.currentTime * 1000);
			setElapsedMs(nextElapsedMs);
			emitPlaybackProgress(true, nextElapsedMs);
		};
		const onEnded = () => {
			setPlaying(false);
			setElapsedMs(0);
			audio.currentTime = 0;
			releaseReviewAudioPlayback(audio);
			emitPlaybackProgress(false, 0);
		};
		const onPause = () => {
			setPlaying(false);
			releaseReviewAudioPlayback(audio);
			emitPlaybackProgress(false, Math.floor(audio.currentTime * 1000));
		};
		const onPlay = () => {
			setPlaying(true);
			emitPlaybackProgress(true, Math.floor(audio.currentTime * 1000));
		};

		audio.addEventListener("timeupdate", onTimeUpdate);
		audio.addEventListener("ended", onEnded);
		audio.addEventListener("pause", onPause);
		audio.addEventListener("play", onPlay);

		return () => {
			audio.removeEventListener("timeupdate", onTimeUpdate);
			audio.removeEventListener("ended", onEnded);
			audio.removeEventListener("pause", onPause);
			audio.removeEventListener("play", onPlay);
		};
	}, [emitPlaybackProgress]);

	useEffect(() => {
		const audio = audioRef.current;
		return () => {
			if (audio) {
				audio.pause();
				releaseReviewAudioPlayback(audio);
			}
		};
	}, []);

	// Reset playback when the attachment URL changes (composer re-record).
	// biome-ignore lint/correctness/useExhaustiveDependencies: src must re-run this reset
	useEffect(() => {
		setPlaying(false);
		setElapsedMs(0);
		if (audioRef.current) {
			audioRef.current.pause();
			releaseReviewAudioPlayback(audioRef.current);
			audioRef.current.currentTime = 0;
		}
		emitPlaybackProgress(false, 0);
	}, [emitPlaybackProgress, src]);

	const playControlClass = cn(
		"inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-card text-foreground transition-colors duration-150 ease-out motion-reduce:transition-none",
		controlSize === "stage" ? "size-10" : "size-8",
		DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
		"active:scale-[0.96] motion-reduce:active:scale-100",
	);

	const playControl = (
		// biome-ignore lint/a11y/useSemanticElements: nested inside review card buttons — real button would be invalid HTML
		<span
			role="button"
			tabIndex={0}
			className={playControlClass}
			aria-label={playing ? "Pause voice review" : "Play voice review"}
			onClick={(event) => {
				if (stopPropagation) event.stopPropagation();
				void handleToggle();
			}}
			onKeyDown={(event) => {
				if (event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				if (stopPropagation) event.stopPropagation();
				void handleToggle();
			}}
		>
			{playing ? <ReviewVoicePauseIcon /> : <ReviewVoicePlayIcon />}
		</span>
	);

	const audioElement = (
		// Patron voice note — no caption track (speech-only attachment).
		// biome-ignore lint/a11y/useMediaCaption: voice reviews ship without transcripts in v1
		<audio ref={audioRef} src={src} preload="none" className="hidden" />
	);

	if (compact) {
		return (
			<span className={cn("inline-flex shrink-0", className)}>
				{audioElement}
				{playControl}
			</span>
		);
	}

	return (
		<span
			className={cn(
				"inline-flex max-w-full items-center gap-2.5 rounded-full bg-background px-3 py-1.5",
				className,
			)}
		>
			{audioElement}
			{playControl}
			<span className="min-w-0 truncate font-medium text-foreground text-xs tabular-nums">
				{timeLabel}
			</span>
			<div
				className="hidden h-0.5 w-14 shrink-0 overflow-hidden rounded-full bg-card sm:block"
				aria-hidden
			>
				<div
					className="h-full rounded-full bg-foreground/70 transition-[width] duration-150 ease-out motion-reduce:transition-none"
					style={{ width: `${progress * 100}%` }}
				/>
			</div>
		</span>
	);
}

/** Renders the player when a review has a voice attachment URL. */
export function ReviewVoiceAttachment({
	audioUrl,
	audioDurationMs,
	className,
	stopPropagation,
	compact,
	controlSize,
	onPlaybackProgress,
}: ReviewAudioFields & {
	className?: string;
	stopPropagation?: boolean;
	compact?: boolean;
	controlSize?: ReviewAudioPlayerProps["controlSize"];
	onPlaybackProgress?: ReviewAudioPlayerProps["onPlaybackProgress"];
}) {
	if (!hasReviewVoiceAudio({ audioUrl })) return null;
	return (
		<ReviewAudioPlayer
			src={audioUrl ?? ""}
			durationMs={resolveReviewAudioDurationMs(audioDurationMs)}
			className={className}
			stopPropagation={stopPropagation}
			compact={compact}
			controlSize={controlSize}
			onPlaybackProgress={onPlaybackProgress}
		/>
	);
}
