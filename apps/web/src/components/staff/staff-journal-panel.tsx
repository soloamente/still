"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Label } from "@still/ui/components/label";
import { Textarea } from "@still/ui/components/textarea";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import { api } from "@/lib/api";
import { normalizeJournalSlug } from "@/lib/journal-slug";
import { errorMessage } from "@/lib/staff-error-message";

type JournalStatus = "draft" | "published";

type StaffJournalPost = {
	id: string;
	slug: string;
	title: string;
	dek: string | null;
	body: string;
	heroImageUrl: string | null;
	status: JournalStatus;
	publishedAt: string | null;
	tags: string[];
	createdAt: string;
	updatedAt: string;
};

type JournalFormState = {
	title: string;
	slug: string;
	dek: string;
	heroImageUrl: string;
	body: string;
	tags: string;
	status: JournalStatus;
};

const EMPTY_FORM: JournalFormState = {
	title: "",
	slug: "",
	dek: "",
	heroImageUrl: "",
	body: "",
	tags: "",
	status: "draft",
};

function postToForm(post: StaffJournalPost): JournalFormState {
	return {
		title: post.title,
		slug: post.slug,
		dek: post.dek ?? "",
		heroImageUrl: post.heroImageUrl ?? "",
		body: post.body,
		tags: post.tags.join(", "),
		status: post.status,
	};
}

function parseTagsInput(raw: string): string[] {
	return raw
		.split(",")
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0);
}

function statusBadgeClass(status: JournalStatus): string {
	return status === "published" ? "text-foreground" : "text-muted-foreground";
}

/**
 * Staff journal editor — create, draft, publish, and patch editorial posts.
 * Lists every row via `GET /api/journal/manage` (includes drafts).
 */
export function StaffJournalPanel() {
	const [posts, setPosts] = useState<StaffJournalPost[]>([]);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [form, setForm] = useState<JournalFormState>(EMPTY_FORM);
	const fieldIdBase = useId();

	const loadPosts = useCallback(async () => {
		setLoading(true);
		try {
			const res = await api.api.journal.manage.get();
			if (res.error) {
				toast.error(
					errorMessage(res.error.value, "Could not load journal posts"),
				);
				return;
			}
			const data = res.data as { items?: StaffJournalPost[] } | null;
			setPosts(data?.items ?? []);
		} catch {
			toast.error("Could not load journal posts");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadPosts();
	}, [loadPosts]);

	const selectPost = (post: StaffJournalPost) => {
		setSelectedId(post.id);
		setForm(postToForm(post));
	};

	const startNewPost = () => {
		setSelectedId(null);
		setForm(EMPTY_FORM);
	};

	const updateField = <K extends keyof JournalFormState>(
		key: K,
		value: JournalFormState[K],
	) => {
		setForm((prev) => {
			const next = { ...prev, [key]: value };
			// Auto-slug from title while composing a new post (staff can override).
			if (key === "title" && selectedId == null) {
				next.slug = normalizeJournalSlug(String(value));
			}
			return next;
		});
	};

	const buildPayload = (status: JournalStatus) => ({
		title: form.title.trim(),
		slug: form.slug.trim() || undefined,
		dek: form.dek.trim() || null,
		body: form.body,
		heroImageUrl: form.heroImageUrl.trim() || null,
		status,
		tags: parseTagsInput(form.tags),
	});

	async function save(status: JournalStatus) {
		if (!form.title.trim()) {
			toast.error("Title is required");
			return;
		}
		if (!form.body.trim()) {
			toast.error("Body is required");
			return;
		}

		setBusy(true);
		try {
			const payload = buildPayload(status);

			if (selectedId) {
				const res = await api.api.journal
					.posts({ id: selectedId })
					.patch(payload);
				if (res.error) {
					toast.error(errorMessage(res.error.value, "Could not save post"));
					return;
				}
				const updated = res.data as unknown as StaffJournalPost;
				setPosts((prev) =>
					prev.map((row) => (row.id === updated.id ? updated : row)),
				);
				setForm(postToForm(updated));
				toast.success(
					status === "published" ? "Post published" : "Draft saved",
				);
			} else {
				const res = await api.api.journal.post(payload);
				if (res.error) {
					toast.error(errorMessage(res.error.value, "Could not create post"));
					return;
				}
				const created = res.data as unknown as StaffJournalPost;
				setPosts((prev) => [created, ...prev]);
				setSelectedId(created.id);
				setForm(postToForm(created));
				toast.success(
					status === "published" ? "Post published" : "Draft created",
				);
			}
		} catch {
			toast.error("Save failed");
		} finally {
			setBusy(false);
		}
	}

	async function removeSelected() {
		if (!selectedId) return;
		if (!window.confirm("Delete this journal post? This cannot be undone.")) {
			return;
		}

		setBusy(true);
		try {
			const res = await api.api.journal.posts({ id: selectedId }).delete();
			if (res.error) {
				toast.error(errorMessage(res.error.value, "Could not delete post"));
				return;
			}
			setPosts((prev) => prev.filter((row) => row.id !== selectedId));
			startNewPost();
			toast.success("Post deleted");
		} catch {
			toast.error("Delete failed");
		} finally {
			setBusy(false);
		}
	}

	const selectedPost = selectedId
		? posts.find((row) => row.id === selectedId)
		: null;

	return (
		<section className="mb-10">
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="font-medium text-lg">Journal</h2>
					<p className="text-muted-foreground text-sm">
						Editorial posts for the public `/journal` index and home rail.
					</p>
				</div>
				<Button
					type="button"
					variant="secondary"
					size="sm"
					onClick={startNewPost}
				>
					New article
				</Button>
			</div>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
				<div className="rounded-2xl bg-background p-2">
					{loading ? (
						<p className="px-2 py-3 text-muted-foreground text-sm">Loading…</p>
					) : posts.length === 0 ? (
						<p className="px-2 py-3 text-muted-foreground text-sm">
							No posts yet — compose the first article.
						</p>
					) : (
						<ul className="space-y-1">
							{posts.map((post) => {
								const active = post.id === selectedId;
								return (
									<li key={post.id}>
										<button
											type="button"
											className={cn(
												"flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition-colors duration-200",
												active
													? "bg-card text-foreground"
													: "text-muted-foreground [@media(hover:hover)]:hover:bg-card/60 [@media(hover:hover)]:hover:text-foreground",
											)}
											onClick={() => selectPost(post)}
										>
											<span className="line-clamp-2 font-medium text-sm">
												{post.title}
											</span>
											<span
												className={cn(
													"mt-0.5 text-[11px] uppercase tracking-wide",
													statusBadgeClass(post.status),
												)}
											>
												{post.status}
											</span>
										</button>
									</li>
								);
							})}
						</ul>
					)}
				</div>

				<form
					className="space-y-4 rounded-2xl bg-background p-4 sm:p-5"
					onSubmit={(event) => {
						event.preventDefault();
						void save(form.status);
					}}
				>
					<div className="space-y-2">
						<Label htmlFor={`${fieldIdBase}-title`}>Title</Label>
						<Input
							id={`${fieldIdBase}-title`}
							value={form.title}
							onChange={(event) => updateField("title", event.target.value)}
							placeholder="Why taste maps matter"
							required
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor={`${fieldIdBase}-slug`}>Slug</Label>
						<Input
							id={`${fieldIdBase}-slug`}
							value={form.slug}
							onChange={(event) => updateField("slug", event.target.value)}
							placeholder="why-taste-maps-matter"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor={`${fieldIdBase}-dek`}>Dek</Label>
						<Input
							id={`${fieldIdBase}-dek`}
							value={form.dek}
							onChange={(event) => updateField("dek", event.target.value)}
							placeholder="One-line summary for cards and SEO"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor={`${fieldIdBase}-hero`}>Hero image URL</Label>
						<Input
							id={`${fieldIdBase}-hero`}
							value={form.heroImageUrl}
							onChange={(event) =>
								updateField("heroImageUrl", event.target.value)
							}
							placeholder="https://…"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor={`${fieldIdBase}-tags`}>Tags</Label>
						<Input
							id={`${fieldIdBase}-tags`}
							value={form.tags}
							onChange={(event) => updateField("tags", event.target.value)}
							placeholder="culture, editorial"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor={`${fieldIdBase}-body`}>Body (Markdown)</Label>
						<Textarea
							id={`${fieldIdBase}-body`}
							value={form.body}
							onChange={(event) => updateField("body", event.target.value)}
							rows={14}
							className="min-h-[16rem] font-mono text-sm"
							placeholder="## Section heading&#10;&#10;Paragraph copy…"
							required
						/>
					</div>

					<div className="space-y-2">
						<p className="font-medium text-sm">Status</p>
						<SegmentedPillToolbar
							layoutId="staff-journal-status"
							aria-label="Journal post status"
							value={form.status}
							onChange={(next) => updateField("status", next)}
							options={[
								{ id: "draft", label: "Draft" },
								{ id: "published", label: "Published" },
							]}
						/>
					</div>

					<div className="flex flex-wrap items-center gap-2 pt-1">
						<Button type="submit" disabled={busy}>
							{form.status === "published" ? "Publish" : "Save draft"}
						</Button>
						<Button
							type="button"
							variant="secondary"
							disabled={busy}
							onClick={() => void save("published")}
						>
							Publish now
						</Button>
						{selectedPost?.status === "published" ? (
							<Link
								href={`/journal/${selectedPost.slug}`}
								className="text-muted-foreground text-sm transition-colors [@media(hover:hover)]:hover:text-foreground"
								target="_blank"
								rel="noopener noreferrer"
							>
								View live
							</Link>
						) : null}
						{selectedId ? (
							<Button
								type="button"
								variant="destructive"
								className="ml-auto border-transparent"
								disabled={busy}
								onClick={() => void removeSelected()}
							>
								Delete
							</Button>
						) : null}
					</div>
				</form>
			</div>
		</section>
	);
}
