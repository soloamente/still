"use client";

import {
	Component,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";

import { MonthRecapDialog } from "@/components/app/month-recap-dialog";
import { fetchMonthRecapClient } from "@/lib/fetch-month-recap-client";
import { isWatchRegionPromptActive } from "@/lib/first-run-prompt-keys";
import { resolveClientCelebratedMonth } from "@/lib/month-recap-month-key";
import {
	markMonthRecapSeen,
	shouldShowMonthRecap,
} from "@/lib/month-recap-seen";
import type { MonthRecapPayload } from "@/lib/month-recap-types";
import { getActiveWhatsNewRelease } from "@/lib/whats-new-releases";
import { shouldShowWhatsNewRelease } from "@/lib/whats-new-seen";

const OPEN_DELAY_MS = 2_500;
const REGION_PROMPT_POLL_MS = 300;
/** Never block month recap forever if first-run modals fail to unmount. */
const REGION_PROMPT_MAX_WAIT_MS = 45_000;

/**
 * Isolates carousel render failures — a bad slide must not take down the app shell.
 */
class MonthRecapErrorBoundary extends Component<
	{ children: ReactNode; onFailed: () => void },
	{ failed: boolean }
> {
	override state = { failed: false };

	static getDerivedStateFromError(): { failed: boolean } {
		return { failed: true };
	}

	override componentDidCatch(error: Error): void {
		console.error("[month-recap] render failed", error);
		this.props.onFailed();
	}

	override render(): ReactNode {
		if (this.state.failed) return null;
		return this.props.children;
	}
}

/** True while What's New still needs to show for this patron. */
function isWhatsNewBlocking(userId: string): boolean {
	const release = getActiveWhatsNewRelease();
	if (!release) return false;
	return shouldShowWhatsNewRelease(userId, release.id);
}

/** One-time per celebrated month — global winners carousel after What's New. */
export function MonthRecapDialogRoot({ userId }: { userId: string }) {
	const celebrated = useMemo(() => resolveClientCelebratedMonth(), []);
	const monthKey = celebrated.monthKey;
	const [payload, setPayload] = useState<MonthRecapPayload | null>(null);
	const [open, setOpen] = useState(false);

	const dismiss = useCallback(() => {
		markMonthRecapSeen(userId, monthKey);
		setOpen(false);
	}, [userId, monthKey]);

	const dismissFromBoundary = useCallback(() => {
		markMonthRecapSeen(userId, monthKey);
		setOpen(false);
		setPayload(null);
	}, [userId, monthKey]);

	useEffect(() => {
		if (!shouldShowMonthRecap(userId, monthKey)) return;

		let cancelled = false;
		const startedAt = Date.now();
		let pollId: number | undefined;

		// Defer past watch-region prompt, What's New, and home shell hydration.
		const tryLoadAndOpen = async () => {
			if (cancelled) return;

			const regionBlocking =
				isWatchRegionPromptActive() &&
				Date.now() - startedAt < REGION_PROMPT_MAX_WAIT_MS;
			if (regionBlocking) {
				pollId = window.setTimeout(() => {
					void tryLoadAndOpen();
				}, REGION_PROMPT_POLL_MS);
				return;
			}

			if (isWhatsNewBlocking(userId)) {
				pollId = window.setTimeout(() => {
					void tryLoadAndOpen();
				}, REGION_PROMPT_POLL_MS);
				return;
			}

			const data = await fetchMonthRecapClient(celebrated.timeZone);
			if (cancelled) return;
			if (!data || data.categories.length === 0) return;

			setPayload(data);
			setOpen(true);
		};

		const timeoutId = window.setTimeout(() => {
			void tryLoadAndOpen();
		}, OPEN_DELAY_MS);

		return () => {
			cancelled = true;
			window.clearTimeout(timeoutId);
			if (pollId !== undefined) window.clearTimeout(pollId);
		};
	}, [userId, monthKey, celebrated.timeZone]);

	if (!payload) return null;

	return (
		<MonthRecapErrorBoundary onFailed={dismissFromBoundary}>
			<MonthRecapDialog open={open} payload={payload} onDismiss={dismiss} />
		</MonthRecapErrorBoundary>
	);
}
