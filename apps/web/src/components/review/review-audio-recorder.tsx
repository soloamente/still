"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ReviewVoiceAttachment } from "@/components/review/review-audio-player";
import { ReviewAudioSpectrum } from "@/components/review/review-audio-spectrum";
import {
	ReviewVoiceRecordIcon,
	ReviewVoiceRetryIcon,
	ReviewVoiceStopIcon,
} from "@/components/review/review-voice-play-icon";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import {
	formatReviewAudioDurationLabel,
	REVIEW_AUDIO_MAX_DURATION_MS,
	REVIEW_AUDIO_MIN_DURATION_MS,
} from "@/lib/review-audio-limits";
import {
	createPlaceholderWaveformPeaks,
	extractWaveformPeaksFromBlob,
	REVIEW_AUDIO_WAVEFORM_BAR_COUNT,
	sampleAnalyserPeaks,
} from "@/lib/review-audio-waveform";

type RecorderPhase = "idle" | "recording" | "recorded";

type ReviewAudioRecorderProps = {
	onRecorded: (blob: Blob, durationMs: number) => void;
	onClear: () => void;
	className?: string;
};

const RECORDER_EASE = [0.165, 0.84, 0.44, 1] as const;

const ICON_SWAP_TRANSITION = {
	type: "spring" as const,
	duration: 0.3,
	bounce: 0,
};

/** Pick the first MediaRecorder MIME type this browser supports. */
function pickRecorderMimeType(): string | undefined {
	const candidates = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
	for (const mime of candidates) {
		if (MediaRecorder.isTypeSupported(mime)) return mime;
	}
	return undefined;
}

/** MediaRecorder UI for the review composer — max 90s, min 3s publish hint. */
export function ReviewAudioRecorder({
	onRecorded,
	onClear,
	className,
}: ReviewAudioRecorderProps) {
	const reduceMotion = useReducedMotion();
	const [phase, setPhase] = useState<RecorderPhase>("idle");
	const [elapsedMs, setElapsedMs] = useState(0);
	const [recordedMs, setRecordedMs] = useState(0);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const previewUrlRef = useRef<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [waveformPeaks, setWaveformPeaks] = useState<number[]>(() =>
		createPlaceholderWaveformPeaks(),
	);
	const [playbackProgress, setPlaybackProgress] = useState(0);
	const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
	const [previewElapsedMs, setPreviewElapsedMs] = useState(0);

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const mediaStreamRef = useRef<MediaStream | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const analyserRafRef = useRef<number | null>(null);
	const chunksRef = useRef<BlobPart[]>([]);
	const startedAtRef = useRef<number>(0);
	const timerRef = useRef<number | null>(null);
	const autoStopRef = useRef<number | null>(null);

	const stopTracks = useCallback(() => {
		for (const track of mediaStreamRef.current?.getTracks() ?? []) {
			track.stop();
		}
		mediaStreamRef.current = null;
	}, []);

	const stopAnalyserLoop = useCallback(() => {
		if (analyserRafRef.current != null) {
			cancelAnimationFrame(analyserRafRef.current);
			analyserRafRef.current = null;
		}
	}, []);

	const closeAudioContext = useCallback(async () => {
		stopAnalyserLoop();
		analyserRef.current = null;
		const context = audioContextRef.current;
		audioContextRef.current = null;
		if (context && context.state !== "closed") {
			await context.close();
		}
	}, [stopAnalyserLoop]);

	const startAnalyserLoop = useCallback(() => {
		stopAnalyserLoop();
		const tick = () => {
			const analyser = analyserRef.current;
			if (analyser) {
				setWaveformPeaks(
					sampleAnalyserPeaks(analyser, REVIEW_AUDIO_WAVEFORM_BAR_COUNT),
				);
			}
			analyserRafRef.current = requestAnimationFrame(tick);
		};
		analyserRafRef.current = requestAnimationFrame(tick);
	}, [stopAnalyserLoop]);

	const clearTimer = useCallback(() => {
		if (timerRef.current != null) {
			window.clearInterval(timerRef.current);
			timerRef.current = null;
		}
		if (autoStopRef.current != null) {
			window.clearTimeout(autoStopRef.current);
			autoStopRef.current = null;
		}
	}, []);

	const revokePreview = useCallback(() => {
		if (previewUrlRef.current) {
			URL.revokeObjectURL(previewUrlRef.current);
			previewUrlRef.current = null;
		}
		setPreviewUrl(null);
	}, []);

	const resetRecording = useCallback(() => {
		clearTimer();
		mediaRecorderRef.current = null;
		chunksRef.current = [];
		stopTracks();
		void closeAudioContext();
		setPhase("idle");
		setElapsedMs(0);
		setRecordedMs(0);
		setPlaybackProgress(0);
		setIsPreviewPlaying(false);
		setPreviewElapsedMs(0);
		setWaveformPeaks(createPlaceholderWaveformPeaks());
		revokePreview();
		onClear();
	}, [clearTimer, closeAudioContext, onClear, revokePreview, stopTracks]);

	const finalizeRecording = useCallback(() => {
		const recorder = mediaRecorderRef.current;
		if (!recorder) return;

		recorder.onstop = () => {
			const durationMs = Math.min(
				REVIEW_AUDIO_MAX_DURATION_MS,
				Math.max(0, Date.now() - startedAtRef.current),
			);
			const mimeType = recorder.mimeType || "audio/webm";
			const blob = new Blob(chunksRef.current, { type: mimeType });
			const url = URL.createObjectURL(blob);
			previewUrlRef.current = url;

			setRecordedMs(durationMs);
			setPreviewUrl(url);
			setPhase("recorded");
			setPlaybackProgress(0);
			setIsPreviewPlaying(false);
			setPreviewElapsedMs(0);
			onRecorded(blob, durationMs);
			clearTimer();
			stopTracks();
			void closeAudioContext();
			void extractWaveformPeaksFromBlob(blob).then((peaks) => {
				setWaveformPeaks(peaks);
			});
			mediaRecorderRef.current = null;
			chunksRef.current = [];
		};

		if (recorder.state !== "inactive") {
			recorder.stop();
		}
	}, [clearTimer, closeAudioContext, onRecorded, stopTracks]);

	const handleStart = useCallback(async () => {
		setError(null);
		revokePreview();
		onClear();

		if (
			typeof window === "undefined" ||
			!navigator.mediaDevices?.getUserMedia
		) {
			setError("Voice recording is not supported in this browser.");
			return;
		}

		const mimeType = pickRecorderMimeType();
		if (!mimeType) {
			setError("This browser does not support voice recording.");
			return;
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			mediaStreamRef.current = stream;
			const audioContext = new AudioContext();
			const analyser = audioContext.createAnalyser();
			analyser.fftSize = 256;
			analyser.smoothingTimeConstant = 0.72;
			const source = audioContext.createMediaStreamSource(stream);
			source.connect(analyser);
			audioContextRef.current = audioContext;
			analyserRef.current = analyser;
			startAnalyserLoop();

			const recorder = new MediaRecorder(stream, { mimeType });
			mediaRecorderRef.current = recorder;
			chunksRef.current = [];
			startedAtRef.current = Date.now();
			setElapsedMs(0);
			setRecordedMs(0);
			setPhase("recording");

			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) chunksRef.current.push(event.data);
			};
			recorder.onerror = () => {
				setError("Recording failed — try again.");
				resetRecording();
			};

			recorder.start(250);
			timerRef.current = window.setInterval(() => {
				setElapsedMs(Date.now() - startedAtRef.current);
			}, 200);
			autoStopRef.current = window.setTimeout(() => {
				finalizeRecording();
			}, REVIEW_AUDIO_MAX_DURATION_MS);
		} catch {
			setError("Microphone access is required to record a voice review.");
			resetRecording();
		}
	}, [
		finalizeRecording,
		onClear,
		resetRecording,
		revokePreview,
		startAnalyserLoop,
	]);

	const handleStop = useCallback(() => {
		finalizeRecording();
	}, [finalizeRecording]);

	useEffect(() => {
		return () => {
			clearTimer();
			stopTracks();
			void closeAudioContext();
			if (previewUrlRef.current) {
				URL.revokeObjectURL(previewUrlRef.current);
				previewUrlRef.current = null;
			}
		};
	}, [clearTimer, closeAudioContext, stopTracks]);

	const handlePreviewPlaybackProgress = useCallback(
		(state: { progress: number; playing: boolean; elapsedMs: number }) => {
			setPlaybackProgress(state.progress);
			setIsPreviewPlaying(state.playing);
			setPreviewElapsedMs(state.elapsedMs);
		},
		[],
	);

	const activeMs =
		phase === "recording"
			? elapsedMs
			: isPreviewPlaying
				? previewElapsedMs
				: recordedMs;
	const timerLabel = formatReviewAudioDurationLabel(activeMs);
	const maxLabel = formatReviewAudioDurationLabel(REVIEW_AUDIO_MAX_DURATION_MS);
	const meetsMinimum = recordedMs >= REVIEW_AUDIO_MIN_DURATION_MS;
	const spectrumProgress =
		phase === "recording"
			? REVIEW_AUDIO_MAX_DURATION_MS > 0
				? Math.min(1, elapsedMs / REVIEW_AUDIO_MAX_DURATION_MS)
				: 0
			: playbackProgress;

	const sectionEnter = reduceMotion
		? { duration: 0 }
		: { duration: 0.18, ease: RECORDER_EASE };
	const sectionMotion = {
		initial: reduceMotion
			? false
			: ({ opacity: 0, y: 8, filter: "blur(4px)" } as const),
		animate: { opacity: 1, y: 0, filter: "blur(0px)" },
		exit: reduceMotion
			? { opacity: 0 }
			: ({ opacity: 0, y: -6, filter: "blur(4px)" } as const),
	};

	const iconTransition = reduceMotion ? { duration: 0 } : ICON_SWAP_TRANSITION;

	const actionButtonClass =
		"rounded-full transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100";

	const cardControlClass = cn(
		"inline-flex h-10 items-center justify-center rounded-full bg-card text-foreground",
		actionButtonClass,
		DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
	);

	return (
		<div
			className={cn(
				"flex min-h-52 flex-col rounded-2xl bg-background p-4 sm:min-h-56",
				className,
			)}
		>
			<div className="flex flex-1 flex-col items-center justify-center gap-3 py-4">
				<div className="flex items-center justify-center gap-2">
					{phase === "recording" ? (
						<span className="relative flex size-2" aria-hidden>
							<span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive/40 motion-reduce:animate-none" />
							<span className="relative inline-flex size-2 rounded-full bg-destructive" />
						</span>
					) : null}
					<span className="font-semibold text-foreground text-sm tabular-nums">
						{timerLabel}
						{phase === "recording" ? (
							<span className="text-muted-foreground"> / {maxLabel}</span>
						) : null}
						{phase === "recorded" && isPreviewPlaying ? (
							<span className="text-muted-foreground">
								{" "}
								/ {formatReviewAudioDurationLabel(recordedMs)}
							</span>
						) : null}
					</span>
				</div>

				<div className="flex min-h-10 flex-wrap items-center justify-center gap-2">
					<AnimatePresence initial={false} mode="wait">
						{phase === "idle" ? (
							<motion.div
								key="recorder-action-idle"
								initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
								animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
								exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
								transition={iconTransition}
							>
								<Button
									type="button"
									className={cn(cardControlClass, "gap-2 px-5")}
									onClick={() => void handleStart()}
								>
									<ReviewVoiceRecordIcon />
									Record
								</Button>
							</motion.div>
						) : null}

						{phase === "recording" ? (
							<motion.div
								key="recorder-action-recording"
								initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
								animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
								exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
								transition={iconTransition}
							>
								<Button
									type="button"
									className={cn(cardControlClass, "gap-2 px-5")}
									onClick={handleStop}
								>
									<ReviewVoiceStopIcon />
									Stop
								</Button>
							</motion.div>
						) : null}

						{phase === "recorded" && previewUrl ? (
							<motion.div
								key="recorder-action-recorded"
								initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
								animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
								exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
								transition={iconTransition}
								className="flex flex-wrap items-center justify-center gap-2"
							>
								<ReviewVoiceAttachment
									audioUrl={previewUrl}
									audioDurationMs={recordedMs}
									stopPropagation
									compact
									controlSize="stage"
									onPlaybackProgress={handlePreviewPlaybackProgress}
								/>
								<Button
									type="button"
									className={cn(
										cardControlClass,
										"gap-1.5 px-4 font-medium text-xs",
									)}
									onClick={resetRecording}
								>
									<ReviewVoiceRetryIcon />
									Re-record
								</Button>
							</motion.div>
						) : null}
					</AnimatePresence>
				</div>

				<AnimatePresence initial={false}>
					{error ? (
						<motion.p
							key="recorder-error"
							{...sectionMotion}
							transition={sectionEnter}
							className="text-center text-destructive text-sm"
							role="alert"
						>
							{error}
						</motion.p>
					) : null}
				</AnimatePresence>

				{phase === "recorded" && !meetsMinimum ? (
					<p className="text-pretty text-center text-muted-foreground text-xs">
						Keep recording — minimum{" "}
						{formatReviewAudioDurationLabel(REVIEW_AUDIO_MIN_DURATION_MS)}.
					</p>
				) : null}
			</div>

			<ReviewAudioSpectrum
				variant="stage"
				className="mt-auto w-full shrink-0"
				peaks={waveformPeaks}
				progress={spectrumProgress}
				showPlayhead={
					phase === "recorded" && (isPreviewPlaying || playbackProgress > 0)
				}
				aria-hidden={phase === "idle"}
			/>
		</div>
	);
}
