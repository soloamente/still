"use client";

import { Button } from "@still/ui/components/button";
import IconTrashXmarkFill from "@still/ui/icons/trash-xmark-fill";
import { EyeOff, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DetailIconTooltip } from "@/components/movie/detail-icon-tooltip";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/staff-error-message";

type ContentType = "review" | "list" | "post" | "log";

/** Hiding is available to every staff role (content:hide). */
const HIDE_ROLES = ["owner", "admin", "moderator", "support"];
/** Delete / restore are owner/admin/moderator only (support excluded). */
const DELETE_ROLES = ["owner", "admin", "moderator"];

type Op = "hide" | "delete" | "restore" | "mark-spoiler" | "unmark-spoiler";

function spoilerSuccessMessage(op: "mark-spoiler" | "unmark-spoiler"): string {
	return op === "mark-spoiler"
		? "Review marked as spoiler"
		: "Review spoiler flag removed";
}

/**
 * Inline staff moderation row for a single piece of content. Self-hides for
 * non-staff (returns null when the viewer lacks `content:hide`), so it is safe
 * to always render. Mirrors the app's data idiom (`api.api.staff.*`, `res.error`,
 * `sonner` toasts) — the web app does not wire TanStack Query.
 *
 * The Eden accessor for `POST /api/staff/content/:type/:id/:op` chains one call
 * per path param: `api.api.staff.content({ type })({ id })({ op }).post(body)`.
 */
export function StaffContentActions({
	type,
	id,
	role,
	isRemoved,
	containsSpoilers = false,
	onChanged,
	onSpoilerChanged,
	variant = "inline",
	headerIconButtonClassName,
	headerDeleteIconButtonClassName,
}: {
	type: ContentType;
	id: string;
	role: string;
	isRemoved?: boolean;
	/** Live spoiler flag for review moderation — drives mark vs unmark. */
	containsSpoilers?: boolean;
	onChanged?: () => void;
	onSpoilerChanged?: (containsSpoilers: boolean) => void;
	/** Drawer/detail headers use the same icon pills as patron edit/delete. */
	variant?: "inline" | "header";
	headerIconButtonClassName?: string;
	headerDeleteIconButtonClassName?: string;
}) {
	const [busy, setBusy] = useState(false);
	const canHide = HIDE_ROLES.includes(role);
	const canDelete = DELETE_ROLES.includes(role);
	const canMarkSpoiler = canHide && type === "review" && !isRemoved;
	if (!canHide) return null;

	async function act(op: Op) {
		setBusy(true);
		try {
			// Omit `reason` entirely — sending "" would record an empty-string
			// removalReason / audit reason server-side instead of null.
			const res = await api.api.staff
				.content({ type })({ id })({ op })
				.post({});
			if (res.error) {
				toast.error(errorMessage(res.error.value, "Action failed"));
				return;
			}
			if (op === "mark-spoiler" || op === "unmark-spoiler") {
				const nextContainsSpoilers = op === "mark-spoiler";
				toast.success(spoilerSuccessMessage(op));
				onSpoilerChanged?.(nextContainsSpoilers);
				return;
			}
			toast.success(`Content ${op === "restore" ? "restored" : `${op}d`}`);
			onChanged?.();
		} catch {
			toast.error("Action failed");
		} finally {
			setBusy(false);
		}
	}

	const buttonClassName =
		"rounded-md px-2 py-1 transition-colors [@media(hover:hover)]:hover:text-foreground disabled:opacity-50";

	if (variant === "header") {
		if (!headerIconButtonClassName) {
			return null;
		}

		return (
			<>
				{isRemoved ? (
					canDelete ? (
						<DetailMotionButtonWrap>
							<DetailIconTooltip label="Restore">
								<Button
									type="button"
									variant="ghost"
									size="icon-pill"
									className={headerIconButtonClassName}
									disabled={busy}
									aria-label="Restore content"
									onClick={() => void act("restore")}
								>
									<EyeOff className="size-5 shrink-0 opacity-90" aria-hidden />
								</Button>
							</DetailIconTooltip>
						</DetailMotionButtonWrap>
					) : null
				) : (
					<>
						{canMarkSpoiler && headerIconButtonClassName ? (
							<DetailMotionButtonWrap>
								<DetailIconTooltip
									label={
										containsSpoilers ? "Remove spoiler flag" : "Mark as spoiler"
									}
								>
									<Button
										type="button"
										variant="ghost"
										size="icon-pill"
										className={headerIconButtonClassName}
										disabled={busy}
										aria-label={
											containsSpoilers
												? "Remove spoiler flag"
												: "Mark review as spoiler"
										}
										onClick={() =>
											void act(
												containsSpoilers ? "unmark-spoiler" : "mark-spoiler",
											)
										}
									>
										<ShieldAlert
											className="size-5 shrink-0 opacity-90"
											aria-hidden
										/>
									</Button>
								</DetailIconTooltip>
							</DetailMotionButtonWrap>
						) : null}
						<DetailMotionButtonWrap>
							<DetailIconTooltip label="Hide">
								<Button
									type="button"
									variant="ghost"
									size="icon-pill"
									className={headerIconButtonClassName}
									disabled={busy}
									aria-label="Hide content"
									onClick={() => void act("hide")}
								>
									<EyeOff className="size-5 shrink-0 opacity-90" aria-hidden />
								</Button>
							</DetailIconTooltip>
						</DetailMotionButtonWrap>
						{canDelete && headerDeleteIconButtonClassName ? (
							<DetailMotionButtonWrap>
								<DetailIconTooltip label="Delete">
									<Button
										type="button"
										variant="ghost"
										size="icon-pill"
										className={headerDeleteIconButtonClassName}
										disabled={busy}
										aria-label="Delete content"
										onClick={() => void act("delete")}
									>
										<IconTrashXmarkFill
											size="20px"
											className="shrink-0 opacity-90"
											aria-hidden
										/>
									</Button>
								</DetailIconTooltip>
							</DetailMotionButtonWrap>
						) : null}
					</>
				)}
			</>
		);
	}

	return (
		<div className="flex gap-2 text-muted-foreground text-xs">
			{isRemoved ? (
				canDelete ? (
					<button
						type="button"
						disabled={busy}
						onClick={() => void act("restore")}
						className={buttonClassName}
					>
						Restore
					</button>
				) : null
			) : (
				<>
					{canMarkSpoiler ? (
						<button
							type="button"
							disabled={busy}
							onClick={() =>
								void act(containsSpoilers ? "unmark-spoiler" : "mark-spoiler")
							}
							className={buttonClassName}
						>
							{containsSpoilers ? "Unmark spoiler" : "Mark spoiler"}
						</button>
					) : null}
					<button
						type="button"
						disabled={busy}
						onClick={() => void act("hide")}
						className={buttonClassName}
					>
						Hide
					</button>
					{canDelete ? (
						<button
							type="button"
							disabled={busy}
							onClick={() => void act("delete")}
							className={`${buttonClassName} text-destructive`}
						>
							Delete
						</button>
					) : null}
				</>
			)}
		</div>
	);
}
