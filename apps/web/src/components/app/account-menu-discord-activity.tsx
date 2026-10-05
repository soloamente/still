"use client";

import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { DISCORD_ACTIVITY_ART_OUTLINE_CLASSNAME } from "@/lib/discord-activity-display";
import { DISCORD_ACTIVITY_POLL_MS } from "@/lib/discord-activity-poll";
import { discordActivitySelfScreenReaderLabel } from "@/lib/discord-activity-self-copy";
import {
	fetchProfileDiscordActivityClient,
	type ProfileDiscordActivity,
} from "@/lib/fetch-profile-discord-activity-client";

/** Poll interval while the account menu stays open. */
const ACCOUNT_MENU_DISCORD_ACTIVITY_POLL_MS = DISCORD_ACTIVITY_POLL_MS;

type AccountMenuDiscordActivityProps = {
	handle: string;
	/** Only fetch/poll while the dropdown is open. */
	menuOpen: boolean;
	className?: string;
};

/**
 * Live Discord activity self-preview under the account menu identity block.
 * Refetches on open and at most every 30s while open.
 */
export function AccountMenuDiscordActivity({
	handle,
	menuOpen,
	className,
}: AccountMenuDiscordActivityProps) {
	const [activity, setActivity] = useState<ProfileDiscordActivity | null>(null);

	useEffect(() => {
		if (!menuOpen || !handle.trim()) {
			setActivity(null);
			return;
		}

		let cancelled = false;

		async function loadDiscordActivity() {
			try {
				const payload = await fetchProfileDiscordActivityClient(handle);
				if (cancelled) return;
				setActivity(payload.visible === true ? payload.activity : null);
			} catch (err) {
				if (cancelled) return;
				console.error("[AccountMenuDiscordActivity] fetch failed:", err);
				setActivity(null);
			}
		}

		void loadDiscordActivity();
		const pollTimer = window.setInterval(
			loadDiscordActivity,
			ACCOUNT_MENU_DISCORD_ACTIVITY_POLL_MS,
		);

		return () => {
			cancelled = true;
			window.clearInterval(pollTimer);
		};
	}, [handle, menuOpen]);

	if (!activity) return null;

	const imageUrl = activity.imageUrl?.trim() || null;
	const screenReaderLabel = discordActivitySelfScreenReaderLabel(activity);
	const companion = activity.activitySource === "companion";
	const companionDetail = activity.detail?.trim() ?? "";
	const title = companion
		? activity.headline?.trim() || activity.label
		: activity.label;
	const episodeMeta =
		companion && companionDetail && companionDetail !== "Paused"
			? companionDetail
			: "";
	const platformMeta =
		companion && activity.source?.trim() ? `On ${activity.source.trim()}` : "";
	const meta = companion
		? ""
		: [activity.detail?.trim(), activity.source?.trim()]
				.filter((part): part is string => Boolean(part))
				.join(" · ");

	return (
		<div
			aria-live="polite"
			aria-atomic="true"
			className={cn(
				"mt-2 flex w-full min-w-0 items-center gap-2 rounded-2xl bg-background px-3 py-2",
				className,
			)}
		>
			{/* Second-person copy for screen readers only — visual line stays third person. */}
			<p className="sr-only">{screenReaderLabel}</p>
			{imageUrl ? (
				<div
					className={cn(
						"relative shrink-0 overflow-hidden",
						DISCORD_ACTIVITY_ART_OUTLINE_CLASSNAME,
						companion ? "aspect-2/3 h-12 rounded-md" : "size-8 rounded-md",
					)}
				>
					<Image
						src={imageUrl}
						alt=""
						fill
						sizes="48px"
						className="object-cover"
						unoptimized
					/>
				</div>
			) : null}
			<div className="min-w-0 flex-1 text-left">
				{activity.href ? (
					<Link
						href={activity.href}
						className="block truncate font-medium text-foreground text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						{title}
					</Link>
				) : (
					<p className="truncate font-medium text-foreground text-sm">
						{title}
					</p>
				)}
				{episodeMeta ? (
					<p className="truncate text-muted-foreground text-xs">
						{episodeMeta}
					</p>
				) : null}
				{platformMeta ? (
					<p className="truncate text-muted-foreground text-xs">
						{platformMeta}
					</p>
				) : null}
				{meta ? (
					<p className="truncate text-muted-foreground text-xs">{meta}</p>
				) : null}
			</div>
		</div>
	);
}
