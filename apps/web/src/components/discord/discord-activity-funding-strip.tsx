"use client";

import { Button } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import type { DiscordActivityFundingPayload } from "@/lib/discord-activity-funding";
import { clampFundingProgress } from "@/lib/discord-activity-funding-progress";
import { openPolarCustomerPortal } from "@/lib/polar-checkout";

type DiscordActivityFundingStripProps = {
	funding: DiscordActivityFundingPayload | null;
	loading?: boolean;
	/** When true, primary CTA opens Polar portal — Pricing passes canManagePolarBilling. */
	canManageBilling?: boolean;
	/**
	 * `full` (default): title + body + progress + CTA.
	 * `progress`: bar only — Settings already owns the Discord diagram + pitch.
	 */
	layout?: "full" | "progress";
	className?: string;
};

const FUNDING_STRIP_TITLE = "Discord activity for Pro";
const FUNDING_STRIP_BODY =
	"Listening and Playing on your profile — ships for every Pro member once Sense can fund the presence server.";

/** Shared Pro funding strip for Pricing and Settings — unmounts after production ship. */
export function DiscordActivityFundingStrip({
	funding,
	loading = false,
	canManageBilling = false,
	layout = "full",
	className,
}: DiscordActivityFundingStripProps) {
	const [portalLoading, setPortalLoading] = useState(false);

	// Post-ship: hide the funding campaign entirely.
	if (funding?.productionEnabled) {
		return null;
	}

	const progress =
		funding != null
			? clampFundingProgress(funding.current, funding.target)
			: null;

	async function handleManagePlan() {
		setPortalLoading(true);
		try {
			await openPolarCustomerPortal();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Could not open billing portal";
			toast.error(message);
		} finally {
			setPortalLoading(false);
		}
	}

	const progressOnly = layout === "progress";

	return (
		<section
			className={cn(
				"flex flex-col gap-4",
				progressOnly
					? "rounded-2xl bg-card px-5 py-4 sm:px-6"
					: "rounded-2xl bg-card p-5 sm:p-6",
				className,
			)}
			aria-busy={loading || undefined}
			aria-label={progressOnly ? "Pro funding progress" : undefined}
		>
			{progressOnly ? null : (
				<div className="flex flex-col gap-2">
					<h2 className="font-sans font-semibold text-lg leading-snug tracking-[-0.02em]">
						{FUNDING_STRIP_TITLE}
					</h2>
					<p className="text-muted-foreground text-sm leading-relaxed">
						{FUNDING_STRIP_BODY}
					</p>
				</div>
			)}

			{loading ? (
				<div
					className="h-2 w-full max-w-md animate-pulse rounded-full bg-background"
					aria-hidden
				/>
			) : funding == null ? (
				<p className="text-muted-foreground text-sm">Progress unavailable</p>
			) : (
				<div className="flex max-w-md flex-col gap-2">
					<p className="font-medium text-foreground text-sm tabular-nums">
						{progress?.labelCurrent} of {progress?.labelTarget} Pro members
					</p>
					<div
						className="relative h-2 w-full overflow-hidden rounded-full bg-background"
						role="progressbar"
						aria-valuemin={0}
						aria-valuenow={Math.min(funding.current, funding.target)}
						aria-valuemax={funding.target}
						aria-label={`${funding.current} of ${funding.target} Pro members`}
					>
						<div
							className="h-full rounded-full bg-foreground/80 motion-reduce:transition-none"
							style={{ width: `${(progress?.ratio ?? 0) * 100}%` }}
						/>
					</div>
				</div>
			)}

			{progressOnly ? null : canManageBilling ? (
				<Button
					type="button"
					variant="secondary"
					className={cn(
						"h-11 w-fit rounded-full bg-background px-6",
						DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
					)}
					disabled={portalLoading}
					onClick={() => void handleManagePlan()}
				>
					{portalLoading ? "Opening billing…" : "Manage plan"}
				</Button>
			) : (
				<Link
					href="/pricing"
					className={cn(
						"inline-flex h-11 w-fit items-center justify-center rounded-full bg-background px-6 font-medium text-foreground text-sm",
						DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
					)}
				>
					Support with Pro
				</Link>
			)}
		</section>
	);
}
