"use client";

import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { create } from "zustand";

import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import { api } from "@/lib/api";

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

	useEffect(() => {
		if (!active) return;
		let cancelled = false;
		void (async () => {
			try {
				const res =
					tab === "followers"
						? await api.api.follows.of({ userId: targetUserId }).followers.get()
						: await api.api.follows
								.of({ userId: targetUserId })
								.following.get();
				if (cancelled) return;
				const rows = (res.data as unknown as FollowsListRow[]) ?? [];
				if (tab === "followers") setFollowers(rows);
				else setFollowing(rows);
			} catch {
				if (!cancelled) {
					if (tab === "followers") setFollowers([]);
					else setFollowing([]);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [active, tab, targetUserId]);

	const rows = tab === "followers" ? followers : following;

	return (
		<div className="flex h-full flex-col">
			<div className="flex justify-center px-3 pt-1 pb-2">
				<div className="flex w-fit gap-1 rounded-full bg-background p-1">
					<TabButton
						active={tab === "followers"}
						onClick={() => onTab("followers")}
					>
						Followers
					</TabButton>
					<TabButton
						active={tab === "following"}
						onClick={() => onTab("following")}
					>
						Following
					</TabButton>
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
				{rows == null ? (
					<p className="px-3 py-8 text-center text-muted-foreground text-sm">
						Loading…
					</p>
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

function TabButton({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-current={active ? "page" : undefined}
			className={cn(
				"relative inline-flex min-h-10 items-center justify-center rounded-full px-4 py-2 text-center font-medium text-sm transition-colors duration-200 ease-out",
				active
					? "bg-card text-foreground"
					: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
			)}
		>
			{children}
		</button>
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
			{row.user?.image ? (
				// biome-ignore lint/performance/noImgElement: small avatars from mixed remote hosts.
				<img
					src={row.user.image}
					alt=""
					className="size-10 shrink-0 rounded-full object-cover"
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
