"use client";

import { Input } from "@still/ui/components/input";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { ListCollaboratorSummary } from "@/components/list/list-detail-collaborators-byline";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { api } from "@/lib/api";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";

/** Owner invites a patron by @handle to edit this list. */
export function ListCollaboratorInvite({
	listId,
	initialCollaborators,
}: {
	listId: string;
	initialCollaborators: ListCollaboratorSummary[];
}) {
	const router = useRouter();
	const [handle, setHandle] = useState("");
	const [collaborators, setCollaborators] = useState(initialCollaborators);
	const [pending, setPending] = useState(false);

	async function handleInvite(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = handle.trim().replace(/^@/, "");
		if (!trimmed) return;
		setPending(true);
		try {
			const res = await api.api.lists({ id: listId }).collaborators.post({
				handle: trimmed,
			});
			if (res.error) {
				const message =
					typeof res.error === "object" &&
					res.error !== null &&
					"value" in res.error
						? String((res.error as { value: unknown }).value)
						: "Couldn't invite collaborator";
				toast.error(message);
				return;
			}
			const payload = res.data as { collaborators?: ListCollaboratorSummary[] };
			if (payload.collaborators) setCollaborators(payload.collaborators);
			setHandle("");
			toast.success("Collaborator added");
			router.refresh();
		} catch (err) {
			console.error(err);
			toast.error("Couldn't invite collaborator");
		} finally {
			setPending(false);
		}
	}

	async function handleRemove(collaboratorUserId: string) {
		setPending(true);
		try {
			const res = await api.api
				.lists({ id: listId })
				.collaborators({ collaboratorUserId })
				.delete();
			if (res.error) {
				toast.error("Couldn't remove collaborator");
				return;
			}
			const payload = res.data as { collaborators?: ListCollaboratorSummary[] };
			if (payload.collaborators) setCollaborators(payload.collaborators);
			toast.success("Collaborator removed");
			router.refresh();
		} catch (err) {
			console.error(err);
			toast.error("Couldn't remove collaborator");
		} finally {
			setPending(false);
		}
	}

	return (
		<div className="flex w-full max-w-md flex-col gap-3 text-left">
			<p className="font-medium text-foreground text-sm">Collaborators</p>
			<p className="text-muted-foreground text-xs leading-relaxed">
				Invite by @handle — they can reorder ranked lists and edit item notes.
			</p>
			<form onSubmit={handleInvite} className="flex gap-2">
				<Input
					value={handle}
					onChange={(e) => setHandle(e.target.value)}
					placeholder="@handle"
					className="min-h-10 flex-1 rounded-full bg-background px-4 text-base"
					autoComplete="off"
					spellCheck={false}
					disabled={pending}
				/>
				<DetailMotionButtonWrap>
					<button
						type="submit"
						disabled={pending || !handle.trim()}
						className={`inline-flex min-h-10 shrink-0 items-center rounded-full bg-background px-4 font-medium text-foreground text-sm disabled:opacity-50 ${DETAIL_CANVAS_ON_CARD_HOVER_CLASS}`}
					>
						Invite
					</button>
				</DetailMotionButtonWrap>
			</form>
			{collaborators.length > 0 ? (
				<ul className="space-y-2">
					{collaborators.map((c) => (
						<li
							key={c.userId}
							className="flex items-center justify-between gap-2 rounded-2xl bg-background px-3 py-2"
						>
							<span className="font-medium text-foreground text-sm">
								@{c.handle}
							</span>
							<button
								type="button"
								disabled={pending}
								onClick={() => handleRemove(c.userId)}
								className="text-muted-foreground text-xs transition-colors duration-200 ease-out disabled:opacity-50 [@media(hover:hover)]:hover:text-foreground"
							>
								Remove
							</button>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
