"use client";

import { Input } from "@still/ui/components/input";
import { cn } from "@still/ui/lib/utils";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";

import type { ListCollaboratorSummary } from "@/components/list/list-detail-collaborators-byline";
import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { api } from "@/lib/api";

/** Raised-surface hover for `bg-card` controls sitting on a `bg-background` panel. */
const LIST_PANEL_CONTROL_HOVER_CLASS =
	"transition-colors duration-200 ease-out [@media(hover:hover)]:hover:bg-foreground/10 disabled:pointer-events-none";

/** Owner invites a patron by @handle to edit this list. */
export function ListCollaboratorInvite({
	listId,
	initialCollaborators,
	className,
}: {
	listId: string;
	initialCollaborators: ListCollaboratorSummary[];
	className?: string;
}) {
	const router = useRouter();
	const headingId = useId();
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
		<section
			aria-labelledby={headingId}
			className={cn(
				"w-full rounded-3xl bg-background px-4 py-4 text-left sm:px-5 sm:py-5",
				className,
			)}
		>
			<div className="flex flex-col gap-1">
				<h2
					id={headingId}
					className="text-balance font-medium text-foreground text-sm"
				>
					Collaborators
				</h2>
				<p className="text-pretty text-muted-foreground text-xs leading-relaxed">
					Invite by @handle — they can reorder ranked lists and edit item notes.
				</p>
			</div>

			<form
				onSubmit={handleInvite}
				className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"
			>
				<Input
					value={handle}
					onChange={(e) => setHandle(e.target.value)}
					placeholder="@handle"
					className="min-h-10 flex-1 rounded-full border-0 bg-card px-4 text-base shadow-none focus-visible:border-transparent focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/25 md:text-base"
					autoComplete="off"
					spellCheck={false}
					disabled={pending}
				/>
				<DetailMotionButtonWrap>
					<button
						type="submit"
						disabled={pending || !handle.trim()}
						className={cn(
							"inline-flex min-h-10 w-full shrink-0 select-none items-center justify-center rounded-full bg-card px-5 font-medium text-foreground text-sm disabled:opacity-50 sm:w-auto",
							LIST_PANEL_CONTROL_HOVER_CLASS,
						)}
					>
						Invite
					</button>
				</DetailMotionButtonWrap>
			</form>

			{collaborators.length > 0 ? (
				<ul className="mt-4 flex flex-col gap-1.5">
					{collaborators.map((c) => (
						<li
							key={c.userId}
							className="flex min-h-10 items-center justify-between gap-3 rounded-lg bg-card px-3 py-2"
						>
							<span className="min-w-0 truncate font-medium text-foreground text-sm">
								@{c.handle}
							</span>
							<DetailMotionButtonWrap>
								<button
									type="button"
									disabled={pending}
									onClick={() => handleRemove(c.userId)}
									className={cn(
										"inline-flex min-h-10 shrink-0 select-none items-center justify-center rounded-full px-3 font-medium text-muted-foreground text-xs disabled:opacity-50",
										LIST_PANEL_CONTROL_HOVER_CLASS,
										"[@media(hover:hover)]:hover:text-foreground",
									)}
								>
									Remove
								</button>
							</DetailMotionButtonWrap>
						</li>
					))}
				</ul>
			) : (
				<p className="mt-4 text-muted-foreground/80 text-xs">
					No collaborators yet.
				</p>
			)}
		</section>
	);
}
