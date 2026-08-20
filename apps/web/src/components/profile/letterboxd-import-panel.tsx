"use client";

/**
 * Shared Letterboxd CSV dropzone + import fetch.
 * Settings chrome (section, how-to, Import/Clear) vs onboarding body via `variant`.
 */
import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { Check, CircleAlert, FileSpreadsheet, Upload, X } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import type { ImportPanelRunner } from "@/components/profile/import-panel-runner";
import {
	MeSettingsPanel,
	MeSettingsSection,
} from "@/components/profile/me-settings-layout";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { stillApiOrigin } from "@/lib/still-api-origin";

export type LetterboxdImportPanelProps = {
	variant: "settings" | "onboarding";
	onImported?: () => void;
	onRunnerChange?: (runner: ImportPanelRunner) => void;
};

/** Recognized Letterboxd export filenames (basename match, case-insensitive). */
const LETTERBOXD_RECOGNIZED_FILES = new Set([
	"diary.csv",
	"ratings.csv",
	"watched.csv",
	"watchlist.csv",
	"reviews.csv",
	"films.csv",
]);

/** Files we surface in the UI; other `.csv` files in the export folder are ignored. */
const LETTERBOXD_PICK_FILES = [
	{
		fileName: "diary.csv",
		title: "diary.csv",
		detail: "Watch dates, rewatches, and diary entries",
		label: "Recommended",
	},
	{
		fileName: "ratings.csv",
		title: "ratings.csv",
		detail: "Star ratings — merged into matching diary rows",
		label: "Optional",
	},
	{
		fileName: "watched.csv",
		title: "watched.csv",
		detail:
			"Films marked watched without a diary entry — fills gaps after diary import",
		label: "Optional",
	},
	{
		fileName: "watchlist.csv",
		title: "watchlist.csv",
		detail: "Films to watch — skipped when already in your diary",
		label: "Optional",
	},
	{
		fileName: "reviews.csv",
		title: "reviews.csv",
		detail: "Long-form reviews with ratings and dates",
		label: "Optional",
	},
	{
		fileName: "films.csv",
		title: "films.csv",
		detail: "Liked films from the likes/ folder in your export",
		label: "Optional",
	},
] as const;

type ImportCountGroup = {
	imported?: number;
	updated?: number;
	skipped: number;
	unmatched: number;
	favorited?: number;
	logsCreated?: number;
};

type ImportResult = {
	imported: number;
	skipped: number;
	unmatched: number;
	totalRows?: number;
	diary?: ImportCountGroup;
	watched?: ImportCountGroup;
	watchlist?: ImportCountGroup;
	reviews?: ImportCountGroup;
	likes?: ImportCountGroup;
};

function fileKey(file: File) {
	return `${file.name}:${file.size}:${file.lastModified}`;
}

function mergePickedFiles(prev: File[], incoming: File[]): File[] {
	const map = new Map<string, File>();
	for (const file of prev) map.set(fileKey(file), file);
	for (const file of incoming) {
		if (!file.name.toLowerCase().endsWith(".csv")) continue;
		map.set(fileKey(file), file);
	}
	return [...map.values()];
}

function hasRecognizedLetterboxdFile(files: File[]) {
	return files.some((f) =>
		LETTERBOXD_RECOGNIZED_FILES.has(f.name.toLowerCase()),
	);
}

function readTextSwapDurationMs(): number {
	if (typeof document === "undefined") return 150;
	const parsed = Number.parseFloat(
		getComputedStyle(document.documentElement)
			.getPropertyValue("--text-swap-dur")
			.trim(),
	);
	return Number.isFinite(parsed) ? parsed : 150;
}

/** transitions.dev text-states-swap — dropzone title and Import label. */
function runTextStateSwap(el: HTMLElement, next: string) {
	const dur = readTextSwapDurationMs();
	el.classList.add("is-exit");
	window.setTimeout(() => {
		el.textContent = next;
		el.classList.remove("is-exit");
		el.classList.add("is-enter-start");
		void el.offsetHeight;
		el.classList.remove("is-enter-start");
	}, dur);
}

function formatImportToast(result: ImportResult) {
	const parts: string[] = [];
	if (result.diary?.imported) {
		parts.push(
			`${result.diary.imported} diary ${result.diary.imported === 1 ? "entry" : "entries"}`,
		);
	}
	if (result.watched?.imported) {
		parts.push(
			`${result.watched.imported} watched ${result.watched.imported === 1 ? "title" : "titles"}`,
		);
	}
	if (result.watchlist?.imported) {
		parts.push(
			`${result.watchlist.imported} watchlist ${result.watchlist.imported === 1 ? "title" : "titles"}`,
		);
	}
	const reviewCount =
		(result.reviews?.imported ?? 0) + (result.reviews?.updated ?? 0);
	if (reviewCount > 0) {
		parts.push(`${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`);
	}
	if (result.likes?.favorited) {
		parts.push(
			`${result.likes.favorited} ${result.likes.favorited === 1 ? "favorite" : "favorites"}`,
		);
	}
	if (parts.length === 0) {
		return "Letterboxd import finished — no new items added";
	}
	return `Imported ${parts.join(" · ")}`;
}

/**
 * Letterboxd CSV import — diary, watched gap-fill, watchlist, reviews, and liked films.
 */
export function LetterboxdImportPanel({
	variant,
	onImported,
	onRunnerChange,
}: LetterboxdImportPanelProps) {
	const inputId = useId();
	const missingHintId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const dropLabelRef = useRef<HTMLSpanElement>(null);
	const importLabelRef = useRef<HTMLSpanElement>(null);
	const missingHintRef = useRef<HTMLParagraphElement>(null);
	const reduceMotion = useReducedMotion();
	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const [isImporting, setIsImporting] = useState(false);
	const [dragActive, setDragActive] = useState(false);
	const [lastResult, setLastResult] = useState<ImportResult | null>(null);
	const [submitAttempted, setSubmitAttempted] = useState(false);

	const selectedNames = new Set(selectedFiles.map((f) => f.name.toLowerCase()));
	const canImport = hasRecognizedLetterboxdFile(selectedFiles) && !isImporting;
	const missingRecognized =
		selectedFiles.length > 0 && !hasRecognizedLetterboxdFile(selectedFiles);
	const isSettings = variant === "settings";
	const dropLabel = dragActive
		? "Drop CSV files here"
		: "Choose or drop CSV files";
	const importLabel = isImporting ? "Importing…" : "Import into Sense";
	const showMissing =
		missingRecognized || (submitAttempted && selectedFiles.length === 0);
	const prevDropLabel = useRef(dropLabel);
	const prevImportLabel = useRef(importLabel);
	const [resultOpen, setResultOpen] = useState(false);

	useEffect(() => {
		if (!lastResult) {
			setResultOpen(false);
			return;
		}
		const frame = window.requestAnimationFrame(() => setResultOpen(true));
		return () => window.cancelAnimationFrame(frame);
	}, [lastResult]);

	useEffect(() => {
		const el = dropLabelRef.current;
		if (!el || prevDropLabel.current === dropLabel) return;
		prevDropLabel.current = dropLabel;
		if (reduceMotion) {
			el.textContent = dropLabel;
			return;
		}
		runTextStateSwap(el, dropLabel);
	}, [dropLabel, reduceMotion]);

	useEffect(() => {
		const el = importLabelRef.current;
		if (!el || prevImportLabel.current === importLabel) return;
		prevImportLabel.current = importLabel;
		if (reduceMotion) {
			el.textContent = importLabel;
			return;
		}
		runTextStateSwap(el, importLabel);
	}, [importLabel, reduceMotion]);

	useEffect(() => {
		if (showMissing) missingHintRef.current?.focus();
	}, [showMissing]);

	function applyPicked(files: FileList | File[]) {
		// Copy synchronously: FileList is live and `e.target.value = ""` (or the
		// drag event ending) empties it before React runs the state updater.
		const picked = Array.from(files);
		setSelectedFiles((prev) => mergePickedFiles(prev, picked));
		setLastResult(null);
		setSubmitAttempted(false);
	}

	// Stable identity so the onRunnerChange effect does not loop on every render.
	const runImport = useCallback(async (): Promise<boolean> => {
		if (!canImport) return false;
		setIsImporting(true);
		setLastResult(null);
		// Isolate onImported from the fetch catch so a parent throw does not toast "Import failed".
		let succeeded = false;
		try {
			const form = new FormData();
			for (const file of selectedFiles) form.append("files", file);
			const res = await fetch(
				new URL("/api/import/letterboxd", stillApiOrigin()),
				{
					method: "POST",
					body: form,
					credentials: "include",
				},
			);
			const data = (await res.json().catch(() => null)) as
				| (ImportResult & { error?: string })
				| null;
			if (!res.ok) {
				toast.error(
					typeof data?.error === "string"
						? data.error
						: "Import failed — check your CSV files",
				);
				return false;
			}
			const result: ImportResult = {
				imported: data?.imported ?? 0,
				skipped: data?.skipped ?? 0,
				unmatched: data?.unmatched ?? 0,
				totalRows: data?.totalRows,
				diary: data?.diary,
				watched: data?.watched,
				watchlist: data?.watchlist,
				reviews: data?.reviews,
				likes: data?.likes,
			};
			setLastResult(result);
			toast.success(formatImportToast(result));
			succeeded = true;
		} catch (err) {
			console.error("[letterboxd-import]", err);
			toast.error("Import failed — try again");
			return false;
		} finally {
			setIsImporting(false);
		}
		if (!succeeded) return false;
		// After successful res.ok, before clearing chips — parent can advance the queue.
		onImported?.();
		setSelectedFiles([]);
		if (inputRef.current) inputRef.current.value = "";
		return true;
	}, [canImport, onImported, selectedFiles]);

	useEffect(() => {
		onRunnerChange?.({ canImport, isImporting, runImport });
	}, [canImport, isImporting, onRunnerChange, runImport]);

	const fileCatalog = (
		<div className="space-y-3">
			<p className="font-medium text-foreground text-sm">Recognized files</p>
			{/* Catalog only — picking happens in the dropzone, not these rows. */}
			<ul className="grid gap-2 sm:grid-cols-2">
				{LETTERBOXD_PICK_FILES.map((spec) => {
					const picked = selectedNames.has(spec.fileName);
					return (
						<li
							key={spec.fileName}
							className="flex gap-3 rounded-2xl bg-background px-4 py-3"
						>
							<span
								className={cn(
									"t-icon-swap mt-0.5 size-5 shrink-0 place-items-center rounded-full",
									picked
										? "bg-foreground text-background"
										: "bg-card text-muted-foreground",
								)}
								data-state={picked ? "b" : "a"}
								aria-hidden
							>
								<span
									className="t-icon flex size-5 items-center justify-center"
									data-icon="a"
								>
									<span className="size-1.5 rounded-full bg-current opacity-40" />
								</span>
								<span
									className="t-icon flex size-5 items-center justify-center"
									data-icon="b"
								>
									<Check className="size-3" strokeWidth={2.5} />
								</span>
							</span>
							<div className="min-w-0 space-y-0.5">
								<p className="font-medium text-foreground text-sm">
									<span className="font-mono text-xs">{spec.title}</span>
									<span className="ml-2 font-normal font-sans text-muted-foreground text-xs">
										{spec.label}
									</span>
								</p>
								<p className="text-pretty text-muted-foreground text-xs leading-relaxed">
									{spec.detail}
								</p>
							</div>
						</li>
					);
				})}
			</ul>
			<p className="max-w-prose text-pretty text-muted-foreground text-xs leading-relaxed">
				Sense reads diary, ratings, watched, watchlist, reviews, and liked
				films. Comments, custom lists, and TV stay out — use Anilist for TV.
			</p>
		</div>
	);

	/** Compact checklist — selected pills remove on click; check → X on hover. */
	const onboardingFileHints = (
		<ul className="flex flex-wrap justify-center gap-2">
			{LETTERBOXD_PICK_FILES.map((spec) => {
				const picked = selectedNames.has(spec.fileName);
				return (
					<li key={spec.fileName}>
						{picked ? (
							<button
								type="button"
								aria-label={`Remove ${spec.fileName}`}
								disabled={isImporting}
								className={cn(
									"group inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full bg-foreground px-1.5 py-1 pr-2.5 font-mono text-[0.65rem] text-background tabular-nums",
									"disabled:pointer-events-none disabled:opacity-60",
								)}
								onClick={() => {
									// Drop every picked file that matches this recognized basename.
									const target = spec.fileName.toLowerCase();
									setSelectedFiles((prev) =>
										prev.filter((f) => f.name.toLowerCase() !== target),
									);
									setLastResult(null);
								}}
							>
								{/* Icon sits in its own inset pill — check flips to X on hover. */}
								<span
									className="relative flex size-4 shrink-0 items-center justify-center rounded-full bg-background text-foreground"
									aria-hidden
								>
									<Check className="size-2.5 stroke-[2.5] transition-opacity duration-150 [@media(hover:hover)]:group-hover:opacity-0" />
									<X className="absolute size-2.5 stroke-[2.5] opacity-0 transition-opacity duration-150 [@media(hover:hover)]:group-hover:opacity-100" />
								</span>
								{spec.fileName}
							</button>
						) : (
							<span className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 font-mono text-[0.65rem] text-muted-foreground tabular-nums">
								{spec.fileName}
							</span>
						)}
					</li>
				);
			})}
		</ul>
	);

	const dropzone = (
		<div className="space-y-3">
			<input
				ref={inputRef}
				id={inputId}
				type="file"
				accept=".csv,text/csv"
				multiple
				className="sr-only"
				onChange={(e) => {
					const picked = e.target.files;
					if (picked?.length) applyPicked(picked);
					e.target.value = "";
				}}
			/>
			<label
				htmlFor={inputId}
				onDragEnter={(e) => {
					e.preventDefault();
					setDragActive(true);
				}}
				onDragOver={(e) => e.preventDefault()}
				onDragLeave={() => setDragActive(false)}
				onDrop={(e) => {
					e.preventDefault();
					setDragActive(false);
					if (e.dataTransfer.files.length) applyPicked(e.dataTransfer.files);
				}}
				className={cn(
					"flex cursor-pointer select-none flex-col items-center justify-center gap-3 rounded-2xl bg-background px-6 py-8 text-center transition-colors duration-200 ease-out motion-reduce:transition-none sm:rounded-3xl",
					isSettings
						? "min-h-48 xl:min-h-64"
						: "min-h-[14rem] sm:min-h-[16rem]",
					DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
					dragActive && "bg-muted/30",
					isImporting && "pointer-events-none opacity-60",
				)}
			>
				<span className="flex size-11 items-center justify-center rounded-full bg-card text-muted-foreground sm:size-12">
					<Upload className="size-5 sm:size-6" strokeWidth={1.75} aria-hidden />
				</span>
				<span className="space-y-1">
					<span
						ref={dropLabelRef}
						className="t-text-swap block font-medium text-foreground text-sm sm:text-base"
					>
						{dropLabel}
					</span>
					<span className="block text-muted-foreground text-xs sm:text-sm">
						From your Letterboxd export folder
					</span>
				</span>
			</label>

			{/* Settings keeps removable chips under the dropzone; onboarding removes via the pills below. */}
			{isSettings && selectedFiles.length > 0 ? (
				<ul className="flex flex-wrap gap-2">
					{selectedFiles.map((file) => (
						<li
							key={fileKey(file)}
							className="inline-flex max-w-full items-center gap-2 rounded-full bg-background px-3 py-1.5 font-mono text-foreground text-xs"
						>
							<FileSpreadsheet
								className="size-3.5 shrink-0 text-muted-foreground"
								strokeWidth={1.75}
								aria-hidden
							/>
							<span className="truncate">{file.name}</span>
							<button
								type="button"
								className="shrink-0 rounded-full px-1 text-muted-foreground text-xs transition-colors [@media(hover:hover)]:hover:text-foreground"
								aria-label={`Remove ${file.name}`}
								onClick={() => {
									setSelectedFiles((prev) =>
										prev.filter((f) => fileKey(f) !== fileKey(file)),
									);
									setLastResult(null);
								}}
							>
								Remove
							</button>
						</li>
					))}
				</ul>
			) : null}

			{showMissing ? (
				<p
					ref={missingHintRef}
					id={missingHintId}
					tabIndex={-1}
					className="flex items-start gap-2 text-muted-foreground text-sm outline-none"
				>
					<CircleAlert
						className="mt-0.5 size-4 shrink-0 text-foreground/70"
						strokeWidth={1.75}
						aria-hidden
					/>
					<span>
						Add at least one recognized file — for example{" "}
						<span className="font-mono text-foreground/90 text-xs">
							diary.csv
						</span>{" "}
						or{" "}
						<span className="font-mono text-foreground/90 text-xs">
							watched.csv
						</span>
						.
					</span>
				</p>
			) : null}

			{isSettings ? (
				<div className="flex flex-wrap items-center gap-3 pt-1">
					<Button
						type="button"
						variant="default"
						size="pill"
						disabled={isImporting}
						aria-describedby={showMissing ? missingHintId : undefined}
						onClick={() => {
							if (!hasRecognizedLetterboxdFile(selectedFiles)) {
								setSubmitAttempted(true);
								return;
							}
							void runImport();
						}}
					>
						<span ref={importLabelRef} className="t-text-swap">
							{importLabel}
						</span>
					</Button>
					{selectedFiles.length > 0 && !isImporting ? (
						<Button
							type="button"
							variant="ghost"
							size="pill"
							className="text-muted-foreground"
							onClick={() => {
								setSelectedFiles([]);
								setLastResult(null);
								setSubmitAttempted(false);
								if (inputRef.current) inputRef.current.value = "";
							}}
						>
							Clear files
						</Button>
					) : null}
				</div>
			) : null}
		</div>
	);

	const importResult = lastResult ? (
		<div
			className="t-panel-slide rounded-2xl bg-background px-4 py-4 [--panel-translate-y:12px]"
			data-open={resultOpen ? "true" : "false"}
			role="status"
		>
			<p className="font-medium text-foreground text-sm">Last import</p>
			<div className="mt-3 space-y-4">
				{[
					{
						title: "Diary",
						rows: [
							{
								label: "Added",
								value: lastResult.diary?.imported ?? lastResult.imported,
							},
							{
								label: "Skipped",
								value: lastResult.diary?.skipped ?? lastResult.skipped,
							},
							{
								label: "Unmatched",
								value: lastResult.diary?.unmatched ?? lastResult.unmatched,
							},
						],
					},
					{
						title: "Watched",
						rows: [
							{
								label: "Added",
								value: lastResult.watched?.imported ?? 0,
							},
							{
								label: "Skipped",
								value: lastResult.watched?.skipped ?? 0,
							},
							{
								label: "Unmatched",
								value: lastResult.watched?.unmatched ?? 0,
							},
						],
					},
					{
						title: "Watchlist",
						rows: [
							{
								label: "Added",
								value: lastResult.watchlist?.imported ?? 0,
							},
							{
								label: "Skipped",
								value: lastResult.watchlist?.skipped ?? 0,
							},
							{
								label: "Unmatched",
								value: lastResult.watchlist?.unmatched ?? 0,
							},
						],
					},
					{
						title: "Reviews",
						rows: [
							{
								label: "Added",
								value: lastResult.reviews?.imported ?? 0,
							},
							{
								label: "Updated",
								value: lastResult.reviews?.updated ?? 0,
							},
							{
								label: "Skipped",
								value: lastResult.reviews?.skipped ?? 0,
							},
							{
								label: "Unmatched",
								value: lastResult.reviews?.unmatched ?? 0,
							},
						],
					},
					{
						title: "Favorites",
						rows: [
							{
								label: "Favorited",
								value: lastResult.likes?.favorited ?? 0,
							},
							{
								label: "Logs created",
								value: lastResult.likes?.logsCreated ?? 0,
							},
							{
								label: "Skipped",
								value: lastResult.likes?.skipped ?? 0,
							},
							{
								label: "Unmatched",
								value: lastResult.likes?.unmatched ?? 0,
							},
						],
					},
				].map((section) => (
					<div key={section.title} className="space-y-2">
						<p className="font-medium text-foreground text-xs">
							{section.title}
						</p>
						<dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
							{section.rows.map((row) => (
								<div key={row.label} className="space-y-0.5">
									<dt className="text-muted-foreground text-xs">{row.label}</dt>
									<dd className="font-medium text-base text-foreground tabular-nums tracking-tight">
										{row.value}
									</dd>
								</div>
							))}
						</dl>
					</div>
				))}
			</div>
			<p className="mt-3 text-muted-foreground text-xs leading-relaxed">
				Your taste signature updates after import. Check your diary or profile
				if anything looks off.
			</p>
		</div>
	) : null;

	const body = (
		<>
			{isSettings ? (
				<ol className="grid gap-5 sm:grid-cols-3 sm:gap-4">
					{[
						{
							step: "1",
							title: "Export on Letterboxd",
							body: (
								<>
									Settings → Import &amp; export →{" "}
									<span className="text-foreground">Export your data</span>.
									Wait for the download.
								</>
							),
						},
						{
							step: "2",
							title: "Open the folder",
							body: (
								<>
									Unzip{" "}
									<span className="font-mono text-foreground/90 text-xs">
										letterboxd-you-…-utc
									</span>{" "}
									if your browser saved a zip.
								</>
							),
						},
						{
							step: "3",
							title: "Add files here",
							body: (
								<>
									Drop{" "}
									<span className="font-mono text-foreground/90 text-xs">
										diary.csv
									</span>{" "}
									plus any optional CSVs from that folder.
								</>
							),
						},
					].map((item) => (
						<li key={item.step} className="space-y-2">
							<div className="flex items-center gap-3">
								<span
									className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card font-medium text-foreground text-sm tabular-nums"
									aria-hidden
								>
									{item.step}
								</span>
								<p className="text-balance font-medium text-foreground text-sm">
									{item.title}
								</p>
							</div>
							<p className="text-pretty text-muted-foreground text-sm leading-relaxed max-sm:pl-11">
								{item.body}
							</p>
						</li>
					))}
				</ol>
			) : null}

			{/* Settings: dropzone leads on the left; catalog sits beside it on xl.
			    Onboarding: tall dropzone specimen + compact filename chips. */}
			<div
				className={
					isSettings
						? "grid gap-8 xl:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)] xl:items-start xl:gap-10"
						: "flex flex-col gap-5"
				}
			>
				{dropzone}
				{isSettings ? fileCatalog : onboardingFileHints}
			</div>

			{importResult}
		</>
	);

	if (isSettings) {
		return (
			<MeSettingsSection
				className="flex-none"
				title="Import from Letterboxd"
				description="Bring your Letterboxd diary into Sense. Export from Letterboxd, then add the CSVs below."
			>
				<MeSettingsPanel featured className="flex-none space-y-8">
					{body}
				</MeSettingsPanel>
			</MeSettingsSection>
		);
	}

	return <div className="space-y-8">{body}</div>;
}
