"use client";

import { useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";

type ContentType = "review" | "list" | "post" | "log";

/** Hiding is available to every staff role (content:hide). */
const HIDE_ROLES = ["owner", "admin", "moderator", "support"];
/** Delete / restore are owner/admin/moderator only (support excluded). */
const DELETE_ROLES = ["owner", "admin", "moderator"];

type Op = "hide" | "delete" | "restore";

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
	onChanged,
}: {
	type: ContentType;
	id: string;
	role: string;
	isRemoved?: boolean;
	onChanged?: () => void;
}) {
	const [busy, setBusy] = useState(false);
	const canHide = HIDE_ROLES.includes(role);
	const canDelete = DELETE_ROLES.includes(role);
	if (!canHide) return null;

	async function act(op: Op) {
		setBusy(true);
		try {
			const res = await api.api.staff
				.content({ type })({ id })({ op })
				.post({ reason: "" });
			if (res.error) {
				toast.error("Action failed");
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
