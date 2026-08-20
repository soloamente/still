"use client";

import { Button } from "@still/ui/components/button";
import { Check, CircleAlert, Download } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

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

function readTextSwapDurationMs(): number {
	if (typeof document === "undefined") return 150;
	const parsed = Number.parseFloat(
		getComputedStyle(document.documentElement)
			.getPropertyValue("--text-swap-dur")
			.trim(),
	);
	return Number.isFinite(parsed) ? parsed : 150;
}

/** transitions.dev text-states-swap — Export my data ↔ Preparing…. */
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

/**
 * Patron data export (Data settings) — synchronous ZIP download of
 * Letterboxd-style CSVs from `GET /api/me/export`.
 */
export function MeDataExportPanel() {
	const reduceMotion = useReducedMotion();
	const [state, setState] = useState<ExportState>({ phase: "idle" });
	const exportLabelRef = useRef<HTMLSpanElement>(null);
	const exportLabel =
		state.phase === "generating" ? "Preparing…" : "Export my data";
	const prevExportLabel = useRef(exportLabel);
	const [statusOpen, setStatusOpen] = useState(false);
	const showStatus = state.phase === "done" || state.phase === "error";

	useEffect(() => {
		const el = exportLabelRef.current;
		if (!el || prevExportLabel.current === exportLabel) return;
		prevExportLabel.current = exportLabel;
		if (reduceMotion) {
			el.textContent = exportLabel;
			return;
		}
		runTextStateSwap(el, exportLabel);
	}, [exportLabel, reduceMotion]);

	useEffect(() => {
		if (!showStatus) {
			setStatusOpen(false);
			return;
		}
		const frame = window.requestAnimationFrame(() => setStatusOpen(true));
		return () => window.cancelAnimationFrame(frame);
	}, [showStatus]);

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
				className="flex-none"
				title="Export"
				description="Download everything you've added to Sense as CSV files — diary, ratings, watchlist, reviews, lists, and TV progress."
			>
				<MeSettingsPanel className="flex flex-none flex-col gap-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<p className="max-w-prose text-pretty text-muted-foreground text-sm leading-relaxed">
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
							<span ref={exportLabelRef} className="t-text-swap">
								{exportLabel}
							</span>
						</Button>
					</div>
					{state.phase === "done" ? (
						<p
							className="t-panel-slide flex items-center gap-2 text-emerald-500 text-sm [--panel-translate-y:8px]"
							data-open={statusOpen ? "true" : "false"}
							role="status"
						>
							<Check className="size-4" aria-hidden />
							Saved {state.filename}
						</p>
					) : null}
					{state.phase === "error" ? (
						<p
							className="t-panel-slide flex items-center gap-2 text-destructive text-sm [--panel-translate-y:8px]"
							data-open={statusOpen ? "true" : "false"}
							role="status"
						>
							<CircleAlert className="size-4" aria-hidden />
							{state.message}
						</p>
					) : null}
				</MeSettingsPanel>
			</MeSettingsSection>
		</div>
	);
}
