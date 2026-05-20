"use client";

import { Button } from "@still/ui/components/button";
import { Textarea } from "@still/ui/components/textarea";
import { cn } from "@still/ui/lib/utils";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { DetailMotionButtonWrap } from "@/components/movie/detail-motion-pressable";
import { api } from "@/lib/api";
import { formatDistanceToNowStrict } from "@/lib/format";
import {
	SHEET_FIELD_CLASS,
	SHEET_PRIMARY_PILL_CLASS,
} from "@/lib/sheet-chrome";

type Kind = "review" | "list" | "post" | "log";

type CommentRow = {
	comment: {
		id: string;
		userId: string;
		body: string;
		createdAt: string;
		replyToId: string | null;
	};
	user: { name: string; image: string | null } | null;
	profile: { handle: string; displayName: string } | null;
};

/**
 * Flat comment list with a single composer at the top. Nested replies
 * are supported on the data model but rendered flat here for clarity —
 * we can switch to a tree view later without changing the API.
 */
export function CommentsThread({
	targetKind,
	targetId,
	initialComments,
	appearance = "default",
}: {
	targetKind: Kind;
	targetId: string;
	initialComments: CommentRow[];
	/** `sheet` — borderless `bg-background` fields + composer primary pill (review reader). */
	appearance?: "default" | "sheet";
}) {
	const [comments, setComments] = useState(initialComments);
	const [body, setBody] = useState("");
	const [busy, setBusy] = useState(false);
	const isSheet = appearance === "sheet";

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!body.trim()) return;
		setBusy(true);
		try {
			const res = await api.api.comments.post({
				parentType: targetKind,
				parentId: targetId,
				body: body.trim(),
			});
			const row = res.data as CommentRow["comment"] | null;
			if (row) {
				setComments((c) => [
					{
						comment: row,
						user: null,
						profile: null,
					} satisfies CommentRow,
					...c,
				]);
			}
			setBody("");
		} catch (err) {
			console.error(err);
			toast.error("Couldn't post comment");
		} finally {
			setBusy(false);
		}
	}

	const commentItemClass = cn(
		"rounded-2xl p-3 text-sm",
		isSheet ? "bg-background" : "bg-card/60",
	);

	return (
		<div className="space-y-6">
			<form onSubmit={submit} className="space-y-3">
				<Textarea
					rows={isSheet ? 4 : 3}
					maxLength={2000}
					placeholder="Share a thought…"
					value={body}
					onChange={(e) => setBody(e.target.value)}
					spellCheck
					className={cn(
						isSheet &&
							cn(
								SHEET_FIELD_CLASS,
								"min-h-[6.5rem] resize-y py-3 leading-relaxed",
							),
					)}
				/>
				<div className={cn("flex", isSheet ? "justify-center" : "justify-end")}>
					{isSheet ? (
						<DetailMotionButtonWrap>
							<Button
								type="submit"
								variant="default"
								size="pill"
								className={SHEET_PRIMARY_PILL_CLASS}
								disabled={busy || !body.trim()}
							>
								{busy ? (
									<Loader2 className="size-3.5 animate-spin" aria-hidden />
								) : null}
								Post
							</Button>
						</DetailMotionButtonWrap>
					) : (
						<Button
							type="submit"
							variant="accent"
							size="pill"
							disabled={busy || !body.trim()}
						>
							Post
						</Button>
					)}
				</div>
			</form>
			<ul className="space-y-3">
				{comments.map(({ comment, profile, user }) => (
					<li key={comment.id} className={commentItemClass}>
						<header className="text-muted-foreground text-xs">
							{profile ? (
								<Link
									href={`/profile/${profile.handle}`}
									className="font-medium text-foreground hover:text-desert-orange"
								>
									{profile.displayName}
								</Link>
							) : (
								<span className="font-medium text-foreground">
									{user?.name ?? "Someone"}
								</span>
							)}{" "}
							· {formatDistanceToNowStrict(new Date(comment.createdAt))} ago
						</header>
						<p className="mt-1 whitespace-pre-wrap text-foreground/90">
							{comment.body}
						</p>
					</li>
				))}
				{comments.length === 0 ? (
					<li className="text-muted-foreground text-sm">No comments yet.</li>
				) : null}
			</ul>
		</div>
	);
}
