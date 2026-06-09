"use client";

import { Button } from "@still/ui/components/button";
import { Textarea } from "@still/ui/components/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/staff-error-message";

export type StaffUserNote = {
	id: string;
	userId: string;
	authorId: string;
	body: string;
	createdAt: string | Date | null;
};

function formatDate(value: string | Date | null): string {
	if (!value) return "";
	const d = value instanceof Date ? value : new Date(value);
	return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

/**
 * Internal staff notes for a single user: newest-first list plus a composer
 * for staff with `user:note`. Only rendered when the viewer holds `user:note`
 * (Owner + Admin per the access-control matrix).
 */
export function StaffUserNotes({
	userId,
	notes,
	canNote,
	onNoteAdded,
}: {
	userId: string;
	notes: StaffUserNote[];
	canNote: boolean;
	onNoteAdded: (note: StaffUserNote) => void;
}) {
	const [body, setBody] = useState("");
	const [submitting, setSubmitting] = useState(false);

	async function handleSubmit() {
		const trimmed = body.trim();
		if (!trimmed) return;
		setSubmitting(true);
		try {
			const res = await api.api.staff.users({ id: userId }).notes.post({
				body: trimmed,
			});
			if (res.error) {
				toast.error(errorMessage(res.error.value, "Could not add note"));
				return;
			}
			const data = res.data as { note: StaffUserNote } | null;
			if (data?.note) {
				onNoteAdded(data.note);
				setBody("");
				toast.success("Note added");
			}
		} catch (err) {
			toast.error(errorMessage(err, "Could not add note"));
		} finally {
			setSubmitting(false);
		}
	}

	if (!canNote) return null;

	return (
		<div className="space-y-3">
			<h4 className="font-medium text-sm">Staff notes</h4>
			{notes.length === 0 ? (
				<p className="text-muted-foreground text-xs">No notes yet.</p>
			) : (
				<ul className="space-y-2">
					{notes.map((note) => (
						<li
							key={note.id}
							className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
						>
							<p className="whitespace-pre-wrap">{note.body}</p>
							<p className="mt-1 text-muted-foreground text-xs">
								{note.authorId} · {formatDate(note.createdAt)}
							</p>
						</li>
					))}
				</ul>
			)}
			<div className="space-y-2">
				<Textarea
					value={body}
					onChange={(e) => setBody(e.target.value)}
					placeholder="Add an internal note about this account…"
					rows={3}
					maxLength={2000}
				/>
				<Button
					type="button"
					size="sm"
					disabled={submitting || !body.trim()}
					onClick={handleSubmit}
				>
					{submitting ? "Adding…" : "Add note"}
				</Button>
			</div>
		</div>
	);
}
