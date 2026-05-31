"use client";

import { env } from "@still/env/web";
import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { Check, CircleAlert, FileSpreadsheet, Upload } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import {
	MeSettingsPanel,
	MeSettingsSection,
} from "@/components/profile/me-settings-layout";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

/** Files we surface in the UI; other `.csv` files in the export folder are ignored. */
const LETTERBOXD_PICK_FILES = [
	{
		fileName: "diary.csv",
		title: "diary.csv",
		detail: "Watch dates, rewatches, and diary entries",
		required: true,
	},
	{
		fileName: "ratings.csv",
		title: "ratings.csv",
		detail: "Star ratings — merged into matching films",
		required: false,
	},
] as const;

type ImportResult = {
	imported: number;
	skipped: number;
	unmatched: number;
	totalRows?: number;
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

function hasDiaryCsv(files: File[]) {
	return files.some((f) => f.name.toLowerCase() === "diary.csv");
}

/**
 * Letterboxd CSV import (Sense Tier 0).
 * Letterboxd exports a folder of CSVs; patrons upload diary.csv (+ optional ratings.csv).
 */
export function MeLetterboxdImport() {
	const inputId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const reduceMotion = useReducedMotion();
	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const [isImporting, setIsImporting] = useState(false);
	const [dragActive, setDragActive] = useState(false);
	const [lastResult, setLastResult] = useState<ImportResult | null>(null);

	const selectedNames = new Set(selectedFiles.map((f) => f.name.toLowerCase()));
	const canImport = hasDiaryCsv(selectedFiles) && !isImporting;
	const missingDiary = selectedFiles.length > 0 && !hasDiaryCsv(selectedFiles);

	const resultMotion = reduceMotion
		? { duration: 0 }
		: { duration: 0.2, ease: [0.165, 0.84, 0.44, 1] as const };

	function applyPicked(files: FileList | File[]) {
		setSelectedFiles((prev) => mergePickedFiles(prev, [...files]));
		setLastResult(null);
	}

	async function runImport() {
		if (!canImport) return;
		setIsImporting(true);
		setLastResult(null);
		try {
			const form = new FormData();
			for (const file of selectedFiles) form.append("files", file);
			const res = await fetch(
				`${env.NEXT_PUBLIC_SERVER_URL}/api/import/letterboxd`,
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
				return;
			}
			const result: ImportResult = {
				imported: data?.imported ?? 0,
				skipped: data?.skipped ?? 0,
				unmatched: data?.unmatched ?? 0,
				totalRows: data?.totalRows,
			};
			setLastResult(result);
			toast.success(`Imported ${result.imported} films into your diary`);
			setSelectedFiles([]);
			if (inputRef.current) inputRef.current.value = "";
		} catch (err) {
			console.error("[letterboxd-import]", err);
			toast.error("Import failed — try again");
		} finally {
			setIsImporting(false);
		}
	}

	return (
		<MeSettingsSection
			title="Import from Letterboxd"
			description="Bring your watch history into Sense in a few minutes. You only need files from Letterboxd’s data export folder."
		>
			<MeSettingsPanel featured className="space-y-8">
				<ol className="grid gap-6 sm:grid-cols-3 sm:gap-4">
					{[
						{
							step: "1",
							title: "Export on Letterboxd",
							body: (
								<>
									Letterboxd → <span className="text-foreground">Settings</span>{" "}
									→ Import &amp; export →{" "}
									<span className="text-foreground">Export your data</span>.
									Wait for the download to finish.
								</>
							),
						},
						{
							step: "2",
							title: "Open the folder",
							body: (
								<>
									You get a folder named like{" "}
									<span className="font-mono text-foreground/90 text-xs">
										letterboxd-you-2026-05-30-utc
									</span>
									. Unzip first if your browser saved a zip file.
								</>
							),
						},
						{
							step: "3",
							title: "Add files below",
							body: (
								<>
									Select{" "}
									<span className="font-mono text-foreground/90 text-xs">
										diary.csv
									</span>{" "}
									(required). Add{" "}
									<span className="font-mono text-foreground/90 text-xs">
										ratings.csv
									</span>{" "}
									if your diary rows have no stars.
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
								<p className="font-medium text-foreground text-sm">
									{item.title}
								</p>
							</div>
							<p className="text-muted-foreground text-sm leading-relaxed max-sm:pl-11">
								{item.body}
							</p>
						</li>
					))}
				</ol>

				<div className="space-y-3">
					<p className="font-medium text-foreground text-sm">
						Files to include
					</p>
					<ul className="space-y-2">
						{LETTERBOXD_PICK_FILES.map((spec) => {
							const picked = selectedNames.has(spec.fileName);
							return (
								<li
									key={spec.fileName}
									className="flex gap-3 rounded-2xl bg-background/80 px-4 py-3"
								>
									<span
										className={cn(
											"mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
											picked
												? "bg-foreground text-background"
												: "bg-card text-muted-foreground",
										)}
										aria-hidden
									>
										{picked ? (
											<Check className="size-3" strokeWidth={2.5} />
										) : (
											<span className="size-1.5 rounded-full bg-current opacity-40" />
										)}
									</span>
									<div className="min-w-0 space-y-0.5">
										<p className="font-medium text-foreground text-sm">
											<span className="font-mono text-xs">{spec.title}</span>
											{spec.required ? (
												<span className="ml-2 font-normal font-sans text-muted-foreground text-xs">
													Required
												</span>
											) : (
												<span className="ml-2 font-normal font-sans text-muted-foreground text-xs">
													Recommended
												</span>
											)}
										</p>
										<p className="text-muted-foreground text-xs leading-relaxed">
											{spec.detail}
										</p>
									</div>
								</li>
							);
						})}
					</ul>
					<p className="text-muted-foreground text-xs leading-relaxed">
						Other export files (watchlist, reviews, likes) are not imported yet.
					</p>
				</div>

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
							if (e.dataTransfer.files.length)
								applyPicked(e.dataTransfer.files);
						}}
						className={cn(
							"flex min-h-[8.5rem] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl bg-background px-6 py-8 text-center transition-colors duration-200 ease-out motion-reduce:transition-none",
							DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
							dragActive && "bg-muted/30",
							isImporting && "pointer-events-none opacity-60",
						)}
					>
						<span className="flex size-11 items-center justify-center rounded-full bg-card text-muted-foreground">
							<Upload className="size-5" strokeWidth={1.75} aria-hidden />
						</span>
						<span className="space-y-1">
							<span className="block font-medium text-foreground text-sm">
								{dragActive
									? "Drop CSV files here"
									: "Choose or drop CSV files"}
							</span>
							<span className="block text-muted-foreground text-xs">
								From your Letterboxd export folder
							</span>
						</span>
					</label>

					{selectedFiles.length > 0 ? (
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

					{missingDiary ? (
						<p className="flex items-start gap-2 text-muted-foreground text-sm">
							<CircleAlert
								className="mt-0.5 size-4 shrink-0 text-foreground/70"
								strokeWidth={1.75}
								aria-hidden
							/>
							<span>
								Add{" "}
								<span className="font-mono text-foreground/90 text-xs">
									diary.csv
								</span>{" "}
								from the export folder — it is required for the import.
							</span>
						</p>
					) : null}

					<div className="flex flex-wrap items-center gap-3 pt-1">
						<Button
							type="button"
							variant="default"
							size="pill"
							disabled={!canImport}
							onClick={() => void runImport()}
						>
							{isImporting ? "Importing…" : "Import into Sense"}
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
									if (inputRef.current) inputRef.current.value = "";
								}}
							>
								Clear files
							</Button>
						) : null}
					</div>
				</div>

				<AnimatePresence initial={false}>
					{lastResult ? (
						<motion.div
							key="import-result"
							initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							transition={resultMotion}
							className="rounded-2xl bg-background px-4 py-4"
							role="status"
						>
							<p className="font-medium text-foreground text-sm">Last import</p>
							<dl className="mt-2 grid grid-cols-3 gap-3">
								{[
									{ label: "Added", value: lastResult.imported },
									{ label: "Skipped", value: lastResult.skipped },
									{ label: "Unmatched", value: lastResult.unmatched },
								].map((row) => (
									<div key={row.label} className="space-y-0.5">
										<dt className="text-muted-foreground text-xs">
											{row.label}
										</dt>
										<dd className="font-medium text-foreground text-lg tabular-nums tracking-tight">
											{row.value}
										</dd>
									</div>
								))}
							</dl>
							<p className="mt-3 text-muted-foreground text-xs leading-relaxed">
								Your taste signature updates after import. Check your diary or
								profile if anything looks off.
							</p>
						</motion.div>
					) : null}
				</AnimatePresence>
			</MeSettingsPanel>
		</MeSettingsSection>
	);
}
