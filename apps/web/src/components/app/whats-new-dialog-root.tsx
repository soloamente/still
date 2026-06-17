"use client";

import {
	Component,
	type ReactNode,
	useCallback,
	useEffect,
	useState,
} from "react";

import { WhatsNewDialog } from "@/components/app/whats-new-dialog";
import { isWatchRegionPromptActive } from "@/lib/first-run-prompt-keys";
import { getActiveWhatsNewRelease } from "@/lib/whats-new-releases";
import {
	markWhatsNewSeen,
	shouldShowWhatsNewRelease,
} from "@/lib/whats-new-seen";

const OPEN_DELAY_MS = 2_500;
const REGION_PROMPT_POLL_MS = 300;
/** Never block What's New forever if the region modal fails to unmount. */
const REGION_PROMPT_MAX_WAIT_MS = 45_000;

/**
 * Isolates carousel render failures — a bad slide must not take down the app shell.
 */
class WhatsNewErrorBoundary extends Component<
	{ children: ReactNode; onFailed: () => void },
	{ failed: boolean }
> {
	override state = { failed: false };

	static getDerivedStateFromError(): { failed: boolean } {
		return { failed: true };
	}

	override componentDidCatch(error: Error): void {
		console.error("[whats-new] render failed", error);
		this.props.onFailed();
	}

	override render(): ReactNode {
		if (this.state.failed) return null;
		return this.props.children;
	}
}

/** Shows the release carousel once per patron after they enter the authenticated app. */
export function WhatsNewDialogRoot({ userId }: { userId: string }) {
	const release = getActiveWhatsNewRelease();
	const [open, setOpen] = useState(false);

	const dismiss = useCallback(() => {
		if (release) markWhatsNewSeen(userId, release.id);
		setOpen(false);
	}, [release, userId]);

	const dismissFromBoundary = useCallback(() => {
		if (release) markWhatsNewSeen(userId, release.id);
		setOpen(false);
	}, [release, userId]);

	useEffect(() => {
		if (!release) return;
		if (!shouldShowWhatsNewRelease(userId, release.id)) return;

		let cancelled = false;
		const startedAt = Date.now();
		let pollId: number | undefined;

		// Defer past first-run modals (watch region) and home shell hydration.
		const tryOpen = () => {
			if (cancelled) return;
			const regionBlocking =
				isWatchRegionPromptActive() &&
				Date.now() - startedAt < REGION_PROMPT_MAX_WAIT_MS;
			if (regionBlocking) {
				pollId = window.setTimeout(tryOpen, REGION_PROMPT_POLL_MS);
				return;
			}
			setOpen(true);
		};

		const timeoutId = window.setTimeout(tryOpen, OPEN_DELAY_MS);

		return () => {
			cancelled = true;
			window.clearTimeout(timeoutId);
			if (pollId !== undefined) window.clearTimeout(pollId);
		};
	}, [release, userId]);

	if (!release) return null;

	return (
		<WhatsNewErrorBoundary onFailed={dismissFromBoundary}>
			<WhatsNewDialog open={open} release={release} onDismiss={dismiss} />
		</WhatsNewErrorBoundary>
	);
}
