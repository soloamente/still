"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { CircleAlert, FileJson, Upload } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import {
	MeSettingsPanel,
	MeSettingsSection,
} from "@/components/profile/me-settings-layout";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { stillApiOrigin } from "@/lib/still-api-origin";

type AnilistImportResult = {
	imported: number;
	watchlist: number;
	watches: number;
	watchesUpdated?: number;
	watchlistExisting?: number;
	episodesMarked: number;
	skipped: number;
	unmatched: number;
	totalRows?: number;
	unmatchedTitles?: { anilistId: number; title: string }[];
};

/**
 * Anilist anime list JSON import (SN.17.1) — TV diary, watchlist, and tv_watch progress.
 */
export function MeAnilistImport() {
	const inputId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const reduceMotion = useReducedMotion();
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [isImporting, setIsImporting] = useState(false);
	const [dragActive, setDragActive] = useState(false);
	const [lastResult, setLastResult] = useState<AnilistImportResult | null>(
		null,
	);

	const canImport = selectedFile != null && !isImporting;

	const resultMotion = reduceMotion
		? { duration: 0 }
		: { duration: 0.2, ease: [0.165, 0.84, 0.44, 1] as const };

	function applyPicked(file: File) {
		if (!file.name.toLowerCase().endsWith(".json")) return;
		setSelectedFile(file);
		setLastResult(null);
	}

	async function runImport() {
		if (!canImport || !selectedFile) return;
		setIsImporting(true);
		setLastResult(null);
		try {
			const form = new FormData();
			form.append("file", selectedFile);
			const res = await fetch(
				new URL("/api/import/anilist", stillApiOrigin()),
				{
					method: "POST",
					body: form,
					credentials: "include",
				},
			);
			const data = (await res.json().catch(() => null)) as
				| (AnilistImportResult & { error?: string })
				| null;
			if (!res.ok) {
				toast.error(
					typeof data?.error === "string"
						? data.error
						: "Import failed — check your JSON file",
				);
				return;
			}
			const result: AnilistImportResult = {
				imported: data?.imported ?? 0,
				watchlist: data?.watchlist ?? 0,
				watches: data?.watches ?? 0,
				watchesUpdated: data?.watchesUpdated ?? 0,
				watchlistExisting: data?.watchlistExisting ?? 0,
				episodesMarked: data?.episodesMarked ?? 0,
				skipped: data?.skipped ?? 0,
				unmatched: data?.unmatched ?? 0,
				totalRows: data?.totalRows,
				unmatchedTitles: data?.unmatchedTitles,
			};
			setLastResult(result);
			toast.success(
				`Imported ${result.imported} completed shows · ${result.watches} watching`,
			);
			setSelectedFile(null);
			if (inputRef.current) inputRef.current.value = "";
		} catch (err) {
			console.error("[anilist-import]", err);
			toast.error("Import failed — try again");
		} finally {
			setIsImporting(false);
		}
	}

	return (
		<MeSettingsSection
			title="Import from Anilist"
			description="Bring your anime list into Sense as TV shows — diary entries, watchlist, and episode progress."
		>
			<MeSettingsPanel featured className="space-y-8">
				<ol className="grid gap-6 sm:grid-cols-3 sm:gap-4">
					{[
						{
							step: "1",
							title: "Export your anime list",
							body: (
								<>
									Use a backup tool such as{" "}
									<span className="text-foreground">AniPort</span> or{" "}
									<span className="text-foreground">AniPy</span> to save your
									Anilist anime list as{" "}
									<span className="font-mono text-foreground/90 text-xs">
										.json
									</span>
									. Manga is not imported.
								</>
							),
						},
						{
							step: "2",
							title: "Anime only",
							body: (
								<>
									Sense maps anime to{" "}
									<span className="text-foreground">TV shows</span> on TMDb —
									completed, watching, planning, and dropped statuses sync
									differently.
								</>
							),
						},
						{
							step: "3",
							title: "Upload below",
							body: (
								<>
									Select your export file. Unmatched titles appear in the
									summary — usually a spelling or TMDb gap, not a failed import.
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

				<p className="text-muted-foreground text-xs leading-relaxed">
					Connect Anilist directly (OAuth) is planned — file upload is the v1
					path.
				</p>

				<div className="space-y-3">
					<input
						ref={inputRef}
						id={inputId}
						type="file"
						accept=".json,application/json"
						className="sr-only"
						onChange={(e) => {
							const picked = e.target.files?.[0];
							if (picked) applyPicked(picked);
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
							const file = e.dataTransfer.files[0];
							if (file) applyPicked(file);
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
								{dragActive ? "Drop JSON here" : "Choose or drop JSON file"}
							</span>
							<span className="block text-muted-foreground text-xs">
								Anilist anime list export
							</span>
						</span>
					</label>

					{selectedFile ? (
						<p className="inline-flex max-w-full items-center gap-2 rounded-full bg-background px-3 py-1.5 font-mono text-foreground text-xs">
							<FileJson
								className="size-3.5 shrink-0 text-muted-foreground"
								strokeWidth={1.75}
								aria-hidden
							/>
							<span className="truncate">{selectedFile.name}</span>
							<button
								type="button"
								className="shrink-0 rounded-full px-1 text-muted-foreground text-xs transition-colors [@media(hover:hover)]:hover:text-foreground"
								aria-label={`Remove ${selectedFile.name}`}
								onClick={() => {
									setSelectedFile(null);
									setLastResult(null);
									if (inputRef.current) inputRef.current.value = "";
								}}
							>
								Remove
							</button>
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
					</div>
				</div>

				<AnimatePresence initial={false}>
					{lastResult ? (
						<motion.div
							key="anilist-import-result"
							initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							transition={resultMotion}
							className="rounded-2xl bg-background px-4 py-4"
							role="status"
						>
							<p className="font-medium text-foreground text-sm">Last import</p>
							<dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
								{[
									{
										label: "Diary logs",
										value: lastResult.imported,
									},
									{ label: "Watchlist", value: lastResult.watchlist },
									{ label: "New watching", value: lastResult.watches },
									...(lastResult.watchesUpdated
										? [
												{
													label: "Updated watching",
													value: lastResult.watchesUpdated,
												},
											]
										: []),
									{ label: "Episodes", value: lastResult.episodesMarked },
									...(lastResult.skipped > 0
										? [
												{
													label: "Dupes in file",
													value: lastResult.skipped,
												},
											]
										: []),
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
								<strong className="font-medium text-foreground/90">
									Diary logs
								</strong>{" "}
								land on your profile and{" "}
								<span className="text-foreground/90">/diary</span> TV grid (one
								row per show). Re-importing backfills any show that was only in{" "}
								<span className="text-foreground/90">Watching</span> before.
								Episode progress stays on each{" "}
								<span className="text-foreground/90">/tv/[id]</span> page. Use
								the profile or diary{" "}
								<span className="text-foreground/90">At home</span> venue chip —
								imports log as streaming.
							</p>
							{lastResult.unmatchedTitles &&
							lastResult.unmatchedTitles.length > 0 ? (
								<p className="mt-3 flex items-start gap-2 text-muted-foreground text-xs leading-relaxed">
									<CircleAlert
										className="mt-0.5 size-3.5 shrink-0"
										strokeWidth={1.75}
										aria-hidden
									/>
									<span>
										Could not match:{" "}
										{lastResult.unmatchedTitles
											.slice(0, 5)
											.map((t) => t.title)
											.join(", ")}
										{lastResult.unmatchedTitles.length > 5
											? ` +${lastResult.unmatchedTitles.length - 5} more`
											: ""}
										{lastResult.imported === 0 &&
										lastResult.watchlist === 0 &&
										lastResult.watches === 0 ? (
											<>
												{" "}
												Re-export with full media titles (AniPort / AniPy
												GraphQL backup). Sense tries English, romaji, and
												Japanese on TMDb, then looks up titles from Anilist when
												needed.
											</>
										) : null}
									</span>
								</p>
							) : null}
							<p className="mt-3 text-muted-foreground text-xs leading-relaxed">
								Your taste signature updates after import. Check Watching on TV
								detail pages for episode progress.
							</p>
						</motion.div>
					) : null}
				</AnimatePresence>
			</MeSettingsPanel>
		</MeSettingsSection>
	);
}
