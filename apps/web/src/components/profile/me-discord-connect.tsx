"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { CircleAlert, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DiscordActivityFundingStrip } from "@/components/discord/discord-activity-funding-strip";
import { MeDiscordLinkStatus } from "@/components/profile/me-discord-link-status";
import { MePreferenceToggle } from "@/components/profile/me-preference-toggle";
import { MeSettingsPanel } from "@/components/profile/me-settings-layout";
import { useSettingsForm } from "@/components/profile/settings-form-context";
import { authClient } from "@/lib/auth-client";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import {
	type DiscordActivityFundingPayload,
	fetchDiscordActivityFunding,
} from "@/lib/discord-activity-funding";
import { resolveDiscordLinkVisualState } from "@/lib/discord-link-status";
import {
	disconnectMeDiscord,
	fetchMeDiscordStatus,
	finishMeDiscordSetup,
	type MeDiscordStatusResponse,
} from "@/lib/me-discord-api";

const DISCORD_SETTINGS_CALLBACK_PATH = "/me/settings/profile";

/** Idle collapses to zero width so Connect / Finish setup have no empty icon gap. */
function DiscordActionSpinner({ active }: { active: boolean }) {
	return (
		<span
			className={cn(
				"t-icon-swap shrink-0",
				active
					? "mr-2 size-4"
					: "pointer-events-none mr-0 size-0 overflow-hidden",
			)}
			data-state={active ? "b" : "a"}
			aria-hidden
		>
			<span className="t-icon size-4" data-icon="a" />
			<span className="t-icon flex items-center justify-center" data-icon="b">
				<Loader2 className="size-4 animate-spin" />
			</span>
		</span>
	);
}

type MeDiscordConnectProps = {
	/**
	 * `panel` (default): wrap in `MeSettingsPanel` for a standalone settings block.
	 * `plain`: content only — use when a parent already provides the panel (or a sibling
	 * section will wrap this), so we never nest panel-in-panel on Profile.
	 */
	surface?: "panel" | "plain";
	className?: string;
};

/**
 * Settings → Profile Discord section — funding teaser, Pro lock, or connect flow.
 * Always visible: funding strip before production ships; locked or full UI after.
 */
export function MeDiscordConnect({
	surface = "panel",
	className,
}: MeDiscordConnectProps = {}) {
	const router = useRouter();
	const { profile, discordActivityEnabled, setDiscordActivityEnabled, saving } =
		useSettingsForm();

	const [funding, setFunding] = useState<DiscordActivityFundingPayload | null>(
		null,
	);
	const [status, setStatus] = useState<MeDiscordStatusResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [connecting, setConnecting] = useState(false);
	const [finishingSetup, setFinishingSetup] = useState(false);
	const [disconnecting, setDisconnecting] = useState(false);

	const refreshData = useCallback(async () => {
		setLoading(true);
		try {
			// Funding drives the three UI states; status also supplies Discord username.
			const [fundingResult, statusResult] = await Promise.all([
				fetchDiscordActivityFunding(),
				fetchMeDiscordStatus(),
			]);
			setFunding(fundingResult);
			setStatus(statusResult);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void refreshData();
	}, [refreshData]);

	// Shared shell — one vertical rhythm owner (`space-y-6`, same as Privacy).
	// Inner blocks use `space-y-1` / `gap-*` only; never nest another `space-y-5/6`.
	const wrap = (body: ReactNode) =>
		surface === "plain" ? (
			<div className={cn("flex flex-col space-y-6", className)}>{body}</div>
		) : (
			<MeSettingsPanel className={cn("space-y-6", className)}>
				{body}
			</MeSettingsPanel>
		);

	// Keep panel height stable while funding/status resolve — never unmount to null.
	if (loading) {
		return wrap(
			<div className="space-y-4" aria-busy="true" aria-live="polite">
				<span className="sr-only">Loading Discord activity settings</span>
				<div className="overflow-hidden rounded-2xl bg-card">
					<div className="flex items-center justify-between gap-3 px-5 py-6 sm:px-6">
						<div className="size-12 animate-pulse rounded-2xl bg-background" />
						<div className="h-px min-w-8 flex-1 bg-background" />
						<div className="h-6 w-24 animate-pulse rounded-full bg-background" />
						<div className="h-px min-w-8 flex-1 bg-background" />
						<div className="size-12 animate-pulse rounded-2xl bg-background" />
					</div>
					<div className="flex items-center justify-between gap-3 px-5 pt-1 pb-4 sm:px-6">
						<div className="h-4 w-48 animate-pulse rounded-md bg-background" />
						<div className="h-11 w-36 animate-pulse rounded-full bg-background" />
					</div>
				</div>
			</div>,
		);
	}

	const productionEnabled = funding?.productionEnabled === true;
	const canUseDiscordActivity = status?.canUseDiscordActivity === true;

	const handleConnect = async () => {
		if (!canUseDiscordActivity) return;

		setConnecting(true);
		try {
			await authClient.linkSocial({
				provider: "discord",
				callbackURL: `${window.location.origin}${DISCORD_SETTINGS_CALLBACK_PATH}`,
			});
		} catch (error) {
			console.error("[MeDiscordConnect] linkSocial failed", error);
			toast.error("Couldn't open Discord sign-in");
			setConnecting(false);
		}
	};

	const handleFinishSetup = async () => {
		setFinishingSetup(true);
		try {
			const result = await finishMeDiscordSetup();
			if (!result.ok) {
				toast.error(result.message);
				return;
			}
			if (result.guildJoined) {
				toast.success("Discord setup complete");
			} else {
				toast.error("Still couldn't add you to the presence guild — try again");
			}
			await refreshData();
			router.refresh();
		} finally {
			setFinishingSetup(false);
		}
	};

	const handleDisconnect = async () => {
		setDisconnecting(true);
		try {
			const result = await disconnectMeDiscord();
			if (!result.ok) {
				toast.error(result.message);
				return;
			}
			toast.success("Discord disconnected");
			setDiscordActivityEnabled(false);
			await refreshData();
			router.refresh();
		} finally {
			setDisconnecting(false);
		}
	};

	const linkStatusProps = {
		handle: profile.handle,
		displayName: profile.displayName,
		hasAvatar: Boolean(profile.hasAvatar),
		discordUsername: status?.discordUsername ?? null,
	};

	const pricingLink = (label: string) => (
		<Link
			href="/pricing"
			className={cn(
				"inline-flex h-11 w-fit shrink-0 items-center justify-center rounded-full bg-background px-6 font-medium text-foreground text-sm",
				DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
			)}
		>
			{label}
		</Link>
	);

	// Pre-production: same Sense ↔ Discord diagram, funding bar under it — no OAuth.
	if (!productionEnabled) {
		return wrap(
			<>
				<MeDiscordLinkStatus
					state="pending"
					{...linkStatusProps}
					footerAction={pricingLink("Support with Pro")}
				/>
				<DiscordActivityFundingStrip
					funding={funding}
					loading={loading}
					layout="progress"
				/>
			</>,
		);
	}

	// Production live but Still tier — upgrade lock, no OAuth.
	if (!canUseDiscordActivity) {
		return wrap(
			<MeDiscordLinkStatus
				state="locked"
				{...linkStatusProps}
				footerAction={pricingLink("View plans")}
			/>,
		);
	}

	const linkState = resolveDiscordLinkVisualState({
		connected: Boolean(status?.connected),
		guildJoined: Boolean(status?.guildJoined),
		activityEnabled: discordActivityEnabled,
	});

	const connectButton = (
		<Button
			type="button"
			className={cn("shrink-0 rounded-full", DETAIL_CANVAS_ON_CARD_HOVER_CLASS)}
			disabled={connecting || saving || !canUseDiscordActivity}
			onClick={() => void handleConnect()}
		>
			<DiscordActionSpinner active={connecting} />
			{connecting ? "Opening Discord…" : "Connect Discord"}
		</Button>
	);

	// Quiet footer text — same slot as Connect, not a standalone destructive pill.
	const disconnectAction = (
		<button
			type="button"
			className={cn(
				"inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-1 font-medium text-muted-foreground text-sm",
				"select-none transition-colors duration-150 ease-out",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
				"disabled:pointer-events-none disabled:opacity-45",
				"[@media(hover:hover)]:hover:text-destructive",
			)}
			disabled={disconnecting || saving}
			onClick={() => void handleDisconnect()}
		>
			<DiscordActionSpinner active={disconnecting} />
			{disconnecting ? "Disconnecting…" : "Disconnect"}
		</button>
	);

	return wrap(
		<>
			<MeDiscordLinkStatus
				state={linkState}
				{...linkStatusProps}
				footerAction={status?.connected ? disconnectAction : connectButton}
			/>

			{status?.connected ? (
				<>
					{!status.guildJoined ? (
						<div className="flex flex-col gap-3 rounded-2xl bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
							<div className="flex gap-3">
								<CircleAlert
									className="mt-0.5 size-5 shrink-0 text-muted-foreground"
									aria-hidden
								/>
								<div className="space-y-1">
									<p className="font-medium text-foreground text-sm">
										Finish Discord setup
									</p>
									<p className="max-w-prose text-muted-foreground text-sm leading-relaxed">
										Couldn&apos;t join the presence guild yet. Retry without
										reconnecting.
									</p>
								</div>
							</div>
							<Button
								type="button"
								variant="secondary"
								className={cn(
									"shrink-0 rounded-full",
									DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
								)}
								disabled={finishingSetup || saving}
								onClick={() => void handleFinishSetup()}
							>
								<DiscordActionSpinner active={finishingSetup} />
								{finishingSetup ? "Retrying…" : "Finish setup"}
							</Button>
						</div>
					) : null}

					<MePreferenceToggle
						id="discord-activity-enabled"
						checked={discordActivityEnabled}
						onChange={setDiscordActivityEnabled}
						title="Show activity on profile"
						description="When off, others won't see Discord activity even while connected."
						onLabel="On"
						offLabel="Off"
					/>
				</>
			) : null}
		</>,
	);
}
