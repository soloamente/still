import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JournalArticleReveal } from "@/components/journal/journal-article-reveal";
import { JournalMarkdownBody } from "@/components/journal/journal-markdown-body";
import { JournalReadTracker } from "@/components/journal/journal-read-tracker";
import { APP_NAME } from "@/lib/app-brand";
import { fetchJournalPostBySlug } from "@/lib/fetch-journal";
import { formatTimeAgoLabel } from "@/lib/format";
import {
	ogImageMetadataFields,
	ogJournalPath,
} from "@/lib/og/og-image-metadata";

export const revalidate = 300;

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const post = await fetchJournalPostBySlug(slug);
	if (!post) {
		return { title: "Journal", robots: { index: false, follow: false } };
	}

	const title = post.title;
	const description = post.dek?.trim() || post.body.slice(0, 160);
	const canonical = `/journal/${post.slug}`;

	return {
		title,
		description,
		alternates: { canonical },
		robots: { index: true, follow: true },
		openGraph: {
			...ogImageMetadataFields(ogJournalPath(post.slug), title).openGraph,
			title,
			description,
			url: canonical,
			type: "article",
			publishedTime: post.publishedAt ?? undefined,
		},
		twitter: {
			title,
			description,
			...ogImageMetadataFields(ogJournalPath(post.slug), title).twitter,
		},
	};
}

export default async function JournalArticlePage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const post = await fetchJournalPostBySlug(slug);
	if (!post) notFound();

	const authorLabel =
		post.author?.name?.trim() ||
		(post.author?.handle ? `@${post.author.handle}` : `${APP_NAME} editorial`);

	return (
		<>
			<JournalReadTracker postId={post.id} slug={post.slug} />
			<div className="mx-auto w-full max-w-3xl px-0.5 pb-8 sm:px-1">
				<article className="space-y-8 py-2 sm:py-4">
					<JournalArticleReveal className="space-y-8">
						<header className="space-y-4">
							{post.publishedAt ? (
								<p className="font-medium text-[11px] text-muted-foreground tabular-nums tracking-wide">
									{formatTimeAgoLabel(post.publishedAt)}
									<span aria-hidden> · </span>
									<span>{authorLabel}</span>
								</p>
							) : (
								<p className="font-medium text-[11px] text-muted-foreground tracking-wide">
									{authorLabel}
								</p>
							)}
							<h1 className="text-balance font-semibold text-3xl tracking-tight sm:text-4xl">
								{post.title}
							</h1>
							{post.dek ? (
								<p className="max-w-prose text-pretty text-lg text-muted-foreground leading-relaxed">
									{post.dek}
								</p>
							) : null}
						</header>

						{post.heroImageUrl ? (
							<div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-background">
								<Image
									src={post.heroImageUrl}
									alt=""
									fill
									className="object-cover"
									sizes="(max-width: 768px) 100vw, 768px"
									priority
									unoptimized={post.heroImageUrl.startsWith("http")}
								/>
							</div>
						) : null}

						<JournalMarkdownBody body={post.body} />
					</JournalArticleReveal>

					<footer className="pt-4">
						<Link
							href="/journal"
							className="text-muted-foreground text-sm transition-colors [@media(hover:hover)]:hover:text-foreground"
						>
							← All journal posts
						</Link>
					</footer>
				</article>
			</div>
		</>
	);
}
