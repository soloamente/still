"use client";

import { Button } from "@still/ui/components/button";
import { Check, CircleAlert, Download } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import {
	MeSettingsPanel,
	MeSettingsSection,
} from "@/components/profile/me-settings-layout";
import { stillApiOrigin } from "@/lib/still-api-origin";

type ExportState =
	| { phase: "idle" }
	| { phase: "generating" }
	| { phase: "done"; filename: string }
	| { phase: "error"; message: string };

function filenameFromDisposition(header: string | null): string {
	const match = header?.match(/filename="([^"]+)"/);
	return match?.[1] ?? "sense-export.zip";
}

/**
 * Patron data export (Data settings) — synchronous ZIP download of
 * Letterboxd-style CSVs from `GET /api/me/export`.
 */
export function MeDataExportPanel() {
	const reduceMotion = useReducedMotion();
	const [state, setState] = useState<ExportState>({ phase: "idle" });

	const feedbackMotion = reduceMotion
		? { duration: 0 }
		: { duration: 0.2, ease: [0.165, 0.84, 0.44, 1] as const };

	async function runExport() {
		if (state.phase === "generating") return;
		setState({ phase: "generating" });
		try {
			const res = await fetch(`${stillApiOrigin()}/api/me/export`, {
				credentials: "include",
			});
			if (res.status === 429) {
				setState({
					phase: "error",
					message: "Export limit reached — try again in an hour.",
				});
				return;
			}
			if (!res.ok) {
				setState({
					phase: "error",
					message: "Export failed — please try again.",
				});
				return;
			}
			const filename = filenameFromDisposition(
				res.headers.get("content-disposition"),
			);
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = filename;
			anchor.click();
			URL.revokeObjectURL(url);
			setState({ phase: "done", filename });
		} catch {
			setState({
				phase: "error",
				message: "Export failed — check your connection and try again.",
			});
		}
	}

	return (
		<div id="me-data-export-panel">
			<MeSettingsSection
				title="Export"
				description="Download everything you've added to Sense as CSV files — diary, ratings, watchlist, reviews, lists, and TV progress."
			>
				<MeSettingsPanel className="flex flex-col gap-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<p className="max-w-prose text-muted-foreground text-sm leading-relaxed">
							Film CSVs use the Letterboxd layout, so they re-import anywhere.
							TV data ships in separate files.
						</p>
						<Button
							type="button"
							size="pill"
							onClick={() => void runExport()}
							disabled={state.phase === "generating"}
							className="min-w-44"
						>
							<Download className="size-4" aria-hidden />
							{state.phase === "generating" ? "Preparing…" : "Export my data"}
						</Button>
					</div>
					<AnimatePresence mode="wait" initial={false}>
						{state.phase === "done" ? (
							<motion.p
								key="done"
								initial={{ opacity: 0, y: 4 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0 }}
								transition={feedbackMotion}
								className="flex items-center gap-2 text-emerald-500 text-sm"
							>
								<Check className="size-4" aria-hidden />
								Saved {state.filename}
							</motion.p>
						) : null}
						{state.phase === "error" ? (
							<motion.p
								key="error"
								initial={{ opacity: 0, y: 4 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0 }}
								transition={feedbackMotion}
								className="flex items-center gap-2 text-destructive text-sm"
							>
								<CircleAlert className="size-4" aria-hidden />
								{state.message}
							</motion.p>
						) : null}
					</AnimatePresence>
				</MeSettingsPanel>
			</MeSettingsSection>
		</div>
	);
}
