"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { create } from "zustand";

import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import { PatronPortraitAvatar } from "@/components/profile/patron-portrait-avatar";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import { api } from "@/lib/api";

const PROFILE_FOLLOWS_TAB_OPTIONS = [
	{ id: "followers" as const, label: "Followers" },
	{ id: "following" as const, label: "Following" },
];

/** Stable keys for the follows drawer loading placeholders. */
const FOLLOWS_ROW_SKELETON_IDS = [
	"follows-skeleton-a",
	"follows-skeleton-b",
	"follows-skeleton-c",
	"follows-skeleton-d",
	"follows-skeleton-e",
	"follows-skeleton-f",
] as const;

type FollowsTab = "followers" | "following";

type FollowsListRow = {
	userId: string;
	user: { id: string; name: string | null; image: string | null } | null;
	profile: { handle: string; displayName: string } | null;
	viewerFollows: boolean;
};

type Store = {
	isOpen: boolean;
	targetUserId: string | null;
	tab: FollowsTab;
	open: (args: { targetUserId: string; tab: FollowsTab }) => void;
	setTab: (tab: FollowsTab) => void;
	close: () => void;
};

const useProfileFollows = create<Store>((set) => ({
	isOpen: false,
	targetUserId: null,
	tab: "followers",
	open: ({ targetUserId, tab }) => set({ isOpen: true, targetUserId, tab }),
	setTab: (tab) => set({ tab }),
	close: () => set({ isOpen: false, targetUserId: null }),
}));

/** Open the followers/following sheet from the profile byline counts. */
export function openProfileFollows(args: {
	targetUserId: string;
	tab: FollowsTab;
}) {
	useProfileFollows.getState().open(args);
}

/** Tappable follower/following counts under the profile identity block. */
export function ProfileFollowsTrigger({
	targetUserId,
	followers,
	following,
}: {
	targetUserId: string;
	followers: number;
	following: number;
}) {
	return (
		<span className="tabular-nums">
			<button
				type="button"
				className="rounded-sm [@media(hover:hover)]:hover:underline"
				onClick={() => openProfileFollows({ targetUserId, tab: "followers" })}
			>
				<span className="font-medium text-foreground">{followers}</span>{" "}
				followers
			</button>
			<span aria-hidden className="mx-1.5 text-muted-foreground/45">
				·
			</span>
			<button
				type="button"
				className="rounded-sm [@media(hover:hover)]:hover:underline"
				onClick={() => openProfileFollows({ targetUserId, tab: "following" })}
			>
				<span className="font-medium text-foreground">{following}</span>{" "}
				following
			</button>
		</span>
	);
}

/** Mounted once per profile page; renders the sheet driven by the store. */
export function ProfileFollowsDrawerRoot({
	viewerId,
}: {
	viewerId: string | null;
}) {
	const { isOpen, targetUserId, tab, close, setTab } = useProfileFollows();
	return (
		<DetailVaulSheet
			open={isOpen}
			onOpenChange={(next) => {
				if (!next) close();
			}}
			title="Followers and following"
		>
			{targetUserId ? (
				<ProfileFollowsPanel
					targetUserId={targetUserId}
					viewerId={viewerId}
					tab={tab}
					onTab={setTab}
					active={isOpen}
				/>
			) : null}
		</DetailVaulSheet>
	);
}

function ProfileFollowsPanel({
	targetUserId,
	viewerId,
	tab,
	onTab,
	active,
}: {
	targetUserId: string;
	viewerId: string | null;
	tab: FollowsTab;
	onTab: (tab: FollowsTab) => void;
	active: boolean;
}) {
	const [followers, setFollowers] = useState<FollowsListRow[] | null>(null);
	const [following, setFollowing] = useState<FollowsListRow[] | null>(null);

	// Drop stale rows when switching profiles so we never flash the previous patron's list.
	useEffect(() => {
		setFollowers(null);
		setFollowing(null);
	}, [targetUserId]);

	useEffect(() => {
		if (!active) return;
		let cancelled = false;

		async function loadFollowsList(
			kind: FollowsTab,
		): Promise<FollowsListRow[]> {
			const res =
				kind === "followers"
					? await api.api.follows.of({ userId: targetUserId }).followers.get()
					: await api.api.follows.of({ userId: targetUserId }).following.get();
			return (res.data as unknown as FollowsListRow[]) ?? [];
		}

		void (async () => {
			try {
				// Prefetch both tabs on open so switching pills does not show a second spinner.
				const [followersRows, followingRows] = await Promise.all([
					loadFollowsList("followers"),
					loadFollowsList("following"),
				]);
				if (cancelled) return;
				setFollowers(followersRows);
				setFollowing(followingRows);
			} catch {
				if (!cancelled) {
					setFollowers([]);
					setFollowing([]);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [active, targetUserId]);

	const rows = tab === "followers" ? followers : following;

	return (
		<div className="flex h-full flex-col">
			<div className="flex justify-center px-3 pt-1 pb-2">
				<SegmentedPillToolbar
					layoutId="profile-follows-drawer-tab"
					aria-label="Followers and following"
					value={tab}
					onChange={onTab}
					options={PROFILE_FOLLOWS_TAB_OPTIONS}
				/>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
				{rows == null ? (
					<ul aria-busy="true" aria-label="Loading follows">
						{FOLLOWS_ROW_SKELETON_IDS.map((skeletonId) => (
							<li
								key={skeletonId}
								className="flex items-center gap-3 px-2 py-2.5"
							>
								<span className="size-10 shrink-0 animate-pulse rounded-full bg-muted/40" />
								<div className="min-w-0 flex-1 space-y-1.5">
									<span className="block h-3.5 w-28 animate-pulse rounded bg-muted/40" />
									<span className="block h-3 w-20 animate-pulse rounded bg-muted/30" />
								</div>
							</li>
						))}
					</ul>
				) : rows.length === 0 ? (
					<p className="px-3 py-8 text-center text-muted-foreground text-sm">
						{tab === "followers"
							? "No followers yet."
							: "Not following anyone yet."}
					</p>
				) : (
					<ul>
						{rows.map((row) => (
							<FollowRow
								key={row.userId}
								row={row}
								isSelf={row.userId === viewerId}
								signedIn={Boolean(viewerId)}
							/>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

function FollowRow({
	row,
	isSelf,
	signedIn,
}: {
	row: FollowsListRow;
	isSelf: boolean;
	signedIn: boolean;
}) {
	const handle = row.profile?.handle ?? null;
	const name = row.profile?.displayName ?? row.user?.name ?? handle ?? "Member";
	const [following, setFollowing] = useState(row.viewerFollows);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		setFollowing(row.viewerFollows);
	}, [row.viewerFollows]);

	async function toggle() {
		if (busy) return;
		setBusy(true);
		const next = !following;
		setFollowing(next);
		try {
			if (next) await api.api.follows({ userId: row.userId }).post();
			else await api.api.follows({ userId: row.userId }).delete();
		} catch {
			setFollowing(!next);
			toast.error("Couldn't update");
		} finally {
			setBusy(false);
		}
	}

	const label = following ? "Following" : "Follow";

	return (
		<li className="flex items-center gap-3 border-white/5 border-t px-2 py-2.5 first:border-t-0">
			{handle ? (
				<PatronPortraitAvatar
					handle={handle}
					avatarUrl={row.user?.image}
					name={name}
					width={40}
					height={40}
					className="size-10 shrink-0 rounded-full"
				/>
			) : (
				<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted/40 font-medium text-foreground/80 text-sm">
					{name.charAt(0).toUpperCase()}
				</span>
			)}
			<div className="min-w-0 flex-1">
				{handle ? (
					<Link href={`/profile/${handle}`} className="block">
						<span className="block truncate font-medium text-foreground text-sm">
							{name}
						</span>
						<span className="block truncate text-muted-foreground text-xs">
							@{handle}
						</span>
					</Link>
				) : (
					<span className="block truncate font-medium text-foreground text-sm">
						{name}
					</span>
				)}
			</div>
			{!isSelf && signedIn ? (
				<button
					type="button"
					disabled={busy}
					onClick={toggle}
					className={cn(
						"shrink-0 rounded-full px-3.5 py-1.5 font-medium text-xs transition-colors disabled:opacity-60",
						following
							? "border border-white/30 text-foreground"
							: "bg-foreground text-background",
					)}
				>
					{label}
				</button>
			) : null}
		</li>
	);
}
