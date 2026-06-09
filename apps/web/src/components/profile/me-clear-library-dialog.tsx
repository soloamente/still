"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { MeDestructiveConfirmDialog } from "@/components/profile/me-destructive-confirm-dialog";
import { stillApiOrigin } from "@/lib/still-api-origin";

/**
 * Clear library data (Data settings danger zone): wipes diary, ratings,
 * watchlist, TV progress, streaks, and gamification — keeps reviews, lists,
 * follows, and profile. Type-to-confirm gated; nudges export first.
 */
export function MeClearLibraryDialog({
	open,
	onClose,
	onCleared,
	onExportFirst,
}: {
	open: boolean;
	onClose: () => void;
	onCleared: () => void;
	onExportFirst: () => void;
}) {
	const router = useRouter();
	const [isBusy, setIsBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function runClear() {
		setIsBusy(true);
		setError(null);
		try {
			const res = await fetch(`${stillApiOrigin()}/api/me/library`, {
				method: "DELETE",
				credentials: "include",
			});
			if (!res.ok) {
				setError(
					"Couldn't clear your library — nothing was deleted. Try again.",
				);
				return;
			}
			onCleared();
			onClose();
			router.refresh();
		} catch {
			setError("Couldn't clear your library — check your connection.");
		} finally {
			setIsBusy(false);
		}
	}

	return (
		<MeDestructiveConfirmDialog
			open={open}
			title="Clear library data"
			confirmPhrase="clear my library"
			confirmLabel="Clear library"
			busyLabel="Clearing…"
			isBusy={isBusy}
			error={error}
			onClose={onClose}
			onConfirm={() => void runClear()}
		>
			<p className="text-balance leading-tight">
				This permanently removes your diary logs, ratings, watchlist, TV
				progress, streaks, badges, and challenge progress. Your favorites list
				is emptied.
			</p>
			<p className="text-balance leading-tight">
				Your reviews, lists, comments, followers, and profile are kept.
				<br />
				This cannot be undone.
			</p>
			<p className="text-balance leading-tight">
				<button
					type="button"
					className="font-medium text-foreground underline underline-offset-2"
					onClick={onExportFirst}
				>
					Export your data first
				</button>{" "}
				if you want a copy.
			</p>
		</MeDestructiveConfirmDialog>
	);
}
