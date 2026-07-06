"use client";

import {
	Component,
	type ReactNode,
	useCallback,
	useEffect,
	useState,
} from "react";

import { SenseSupportCampaignDialog } from "@/components/app/sense-support-campaign-dialog";
import { isWatchRegionPromptActive } from "@/lib/first-run-prompt-keys";
import type { SenseSupportCampaign } from "@/lib/sense-support-campaign";
import {
	markSenseSupportCampaignSeen,
	shouldShowSenseSupportCampaign,
} from "@/lib/sense-support-campaign-seen";

const OPEN_DELAY_MS = 2_500;
const REGION_PROMPT_POLL_MS = 300;
const REGION_PROMPT_MAX_WAIT_MS = 45_000;

class SenseSupportCampaignErrorBoundary extends Component<
	{ children: ReactNode; onFailed: () => void },
	{ failed: boolean }
> {
	override state = { failed: false };

	static getDerivedStateFromError(): { failed: boolean } {
		return { failed: true };
	}

	override componentDidCatch(error: Error): void {
		console.error("[sense-support-campaign] render failed", error);
		this.props.onFailed();
	}

	override render(): ReactNode {
		if (this.state.failed) return null;
		return this.props.children;
	}
}

/** One-time support campaign — replaces What's New for this release. */
export function SenseSupportCampaignDialogRoot({
	userId,
	campaign,
}: {
	userId: string;
	campaign: SenseSupportCampaign;
}) {
	const [open, setOpen] = useState(false);

	const dismiss = useCallback(() => {
		markSenseSupportCampaignSeen(userId, campaign.id);
		setOpen(false);
	}, [campaign.id, userId]);

	const dismissFromBoundary = useCallback(() => {
		markSenseSupportCampaignSeen(userId, campaign.id);
		setOpen(false);
	}, [campaign.id, userId]);

	useEffect(() => {
		if (!shouldShowSenseSupportCampaign(userId, campaign.id)) return;

		let cancelled = false;
		const startedAt = Date.now();
		let pollId: number | undefined;

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
	}, [campaign.id, userId]);

	return (
		<SenseSupportCampaignErrorBoundary onFailed={dismissFromBoundary}>
			<SenseSupportCampaignDialog
				open={open}
				campaign={campaign}
				onDismiss={dismiss}
			/>
		</SenseSupportCampaignErrorBoundary>
	);
}

/** True while the support campaign still needs to show for this patron. */
export function isSenseSupportCampaignBlocking(
	userId: string,
	campaign: SenseSupportCampaign | null,
): boolean {
	if (!campaign) return false;
	return shouldShowSenseSupportCampaign(userId, campaign.id);
}
