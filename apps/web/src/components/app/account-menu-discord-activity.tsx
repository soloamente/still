"use client";

import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import { useEffect, useState } from "react";

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
				<div className="relative size-8 shrink-0 overflow-hidden rounded-md">
					<Image
						src={imageUrl}
						alt=""
						width={32}
						height={32}
						className="size-full object-cover"
						unoptimized
					/>
				</div>
			) : null}
			<div className="min-w-0 flex-1 text-left">
				<p className="truncate font-medium text-foreground text-sm">
					{activity.label}
				</p>
				{activity.detail?.trim() ? (
					<p className="truncate text-muted-foreground text-xs">
						{activity.detail}
					</p>
				) : null}
			</div>
		</div>
	);
}
