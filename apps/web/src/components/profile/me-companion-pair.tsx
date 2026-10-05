"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { useCallback, useEffect, useState } from "react";

import { MePreferenceToggle } from "@/components/profile/me-preference-toggle";
import { useSettingsForm } from "@/components/profile/settings-form-context";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import {
	fetchMeCompanionStatus,
	issueMeCompanionCode,
	type MeCompanionCode,
	type MeCompanionStatus,
	revokeMeCompanion,
	setCompanionWatchingShared,
} from "@/lib/me-companion-api";

function pairedCopy(count: number): string {
	if (count === 1) return "1 browser paired";
	return `${count} browsers paired`;
}

/**
 * Settings → Profile row that shows a short pairing code for Sense Companion
 * and can revoke the stored device token.
 */
export function MeCompanionPair() {
	const { companionWatchingEnabled, pinCompanionWatchingEnabled } =
		useSettingsForm();
	const [status, setStatus] = useState<MeCompanionStatus | null>(null);
	const [loading, setLoading] = useState(true);
	const [code, setCode] = useState<MeCompanionCode | null>(null);
	const [busy, setBusy] = useState<"code" | "revoke" | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		setLoading(true);
		try {
			setStatus(await fetchMeCompanionStatus());
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	async function handleIssue() {
		if (busy) return;
		setBusy("code");
		setMessage(null);
		const result = await issueMeCompanionCode();
		setBusy(null);
		if (!result.ok) {
			setMessage(result.message);
			return;
		}
		setCode(result.code);
	}

	async function handleRevoke() {
		if (busy) return;
		setBusy("revoke");
		setMessage(null);
		const result = await revokeMeCompanion();
		setBusy(null);
		if (!result.ok) {
			setMessage(result.message);
			return;
		}
		setCode(null);
		setStatus({ paired: false, devices: [] });
		setMessage("Disconnected. The extension will show Not paired.");
	}

	async function handleShare(next: boolean) {
		const previous = companionWatchingEnabled;
		pinCompanionWatchingEnabled(next);
		const result = await setCompanionWatchingShared(next);
		if (!result.ok) {
			pinCompanionWatchingEnabled(previous);
			setMessage(result.message);
		}
	}

	const deviceCount = status?.devices.length ?? 0;

	return (
		<div className="flex flex-col gap-4">
			<MePreferenceToggle
				id="companion-watching-shared"
				checked={companionWatchingEnabled}
				onChange={(next) => void handleShare(next)}
				title="Share what I'm watching"
				description="When off, the title you're playing stays off your profile. Online status still follows your presence setting."
				onLabel="On"
				offLabel="Off"
			/>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<p className="text-foreground text-sm">
					{loading
						? "Checking…"
						: deviceCount > 0
							? pairedCopy(deviceCount)
							: "No browser paired"}
				</p>
				<div className="flex flex-wrap items-center gap-3">
					<Button
						type="button"
						className={cn(
							"shrink-0 rounded-full",
							DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
						)}
						disabled={busy !== null}
						onClick={() => void handleIssue()}
					>
						{busy === "code" ? "Creating code…" : "Show pairing code"}
					</Button>
					{deviceCount > 0 ? (
						<button
							type="button"
							className="inline-flex min-h-10 shrink-0 select-none items-center rounded-full px-1 font-medium text-muted-foreground text-sm transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:pointer-events-none disabled:opacity-45 [@media(hover:hover)]:hover:text-destructive"
							disabled={busy !== null}
							onClick={() => void handleRevoke()}
						>
							{busy === "revoke" ? "Disconnecting…" : "Disconnect"}
						</button>
					) : null}
				</div>
			</div>
			{code ? (
				<div className="space-y-1">
					<p className="font-semibold text-2xl text-foreground tabular-nums tracking-widest">
						{code.code}
					</p>
					<p className="text-muted-foreground text-sm">
						Type this in the Sense Companion popup. It expires in 10 minutes.
					</p>
				</div>
			) : (
				<p className="max-w-prose text-muted-foreground text-sm leading-relaxed">
					Open the extension popup and enter the code to pair this browser.
				</p>
			)}
			{message ? (
				<p className="text-foreground text-sm" role="status">
					{message}
				</p>
			) : null}
		</div>
	);
}
