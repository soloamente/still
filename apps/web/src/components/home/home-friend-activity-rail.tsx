"use client";

import { cn } from "@still/ui/lib/utils";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { HomeFriendRailEntry } from "@/lib/home-friend-rail";

const STORAGE_KEY = "still.home.friendRail.collapsed";

/**
 * Desktop-only companion column: recent unique friends from the feed window,
 * with a collapse control so dense layouts can hide the strip without losing access.
 */
export function HomeFriendActivityRail({
	entries,
}: {
	entries: HomeFriendRailEntry[];
}) {
	const [collapsed, setCollapsed] = useState(false);

	useEffect(() => {
		try {
			setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
		} catch {
			/* private mode or blocked storage — default expanded */
		}
	}, []);

	const persist = (next: boolean) => {
		setCollapsed(next);
		try {
			localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
		} catch {
			/* ignore */
		}
	};

	return (
		<aside
			aria-label="Friend activity"
			className={cn(
				"hidden min-h-0 shrink-0 flex-col rounded-2xl border border-border bg-surface-raised/50 lg:flex",
				collapsed ? "w-12 self-stretch" : "w-full min-w-0 lg:w-72",
			)}
		>
			<div
				className={cn(
					"flex items-center gap-1 border-border/70 border-b p-2",
					collapsed ? "justify-center" : "",
				)}
			>
				{!collapsed ? (
					<>
						<Users
							className="ml-1 size-4 shrink-0 text-muted-foreground"
							aria-hidden
						/>
						<h3 className="min-w-0 flex-1 truncate font-display font-medium text-sm tracking-tight">
							Friend activity
						</h3>
					</>
				) : null}
				<button
					type="button"
					onClick={() => persist(!collapsed)}
					className={cn(
						"inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors",
						"hover:bg-surface-overlay/60 hover:text-foreground",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-desert-orange/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
					)}
					aria-expanded={!collapsed}
					aria-controls="home-friend-rail-list"
					title={collapsed ? "Show friend activity" : "Hide friend activity"}
				>
					{collapsed ? (
						<ChevronLeft className="size-4" aria-hidden />
					) : (
						<ChevronRight className="size-4" aria-hidden />
					)}
				</button>
			</div>

			{!collapsed && entries.length === 0 ? (
				<p className="p-3 text-muted-foreground text-xs leading-relaxed">
					Follow people you trust — their logs and lists surface here as a quick
					pulse beside the main feed.
				</p>
			) : null}

			{!collapsed && entries.length > 0 ? (
				<ul
					id="home-friend-rail-list"
					className="max-h-[min(28rem,70vh)] space-y-1 overflow-y-auto overscroll-y-contain p-2 [scrollbar-width:thin]"
				>
					{entries.map((e) => (
						<li key={e.handle}>
							<Link
								href={`/profile/${e.handle}`}
								className="flex gap-2 rounded-xl p-2 transition-colors hover:bg-surface-overlay/50"
							>
								<span className="relative size-9 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
									{e.image ? (
										<Image
											src={e.image}
											alt=""
											fill
											className="object-cover"
											sizes="36px"
										/>
									) : (
										<span className="flex h-full w-full items-center justify-center font-semibold text-[10px] text-muted-foreground uppercase">
											{railInitials(e.displayName)}
										</span>
									)}
								</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate font-medium text-foreground text-sm">
										{e.displayName}
									</span>
									<span className="mt-0.5 block truncate text-muted-foreground text-xs">
										{e.snippet}
									</span>
								</span>
							</Link>
						</li>
					))}
				</ul>
			) : null}
		</aside>
	);
}

function railInitials(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length >= 2) {
		const a = parts[0]?.charAt(0) ?? "";
		const b = parts[1]?.charAt(0) ?? "";
		return `${a}${b}`.toUpperCase();
	}
	return (parts[0] ?? "?").slice(0, 2).toUpperCase();
}
