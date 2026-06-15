import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { DETAIL_MOTION_PRESSABLE_CLASS } from "@/lib/detail-action-motion";
import type { JournalListItem } from "@/lib/fetch-journal";
import { formatTimeAgoLabel } from "@/lib/format";
import {
	HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";

function JournalCatalogueTile({
	post,
	priority = false,
}: {
	post: JournalListItem;
	priority?: boolean;
}) {
	const imageSizes =
		"(max-width: 640px) 38vw, (max-width: 1024px) 28vw, (max-width: 1536px) 220px, 260px";

	return (
		<Link
			href={`/journal/${post.slug}`}
			className={cn(
				"group block w-full min-w-0",
				HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
				DETAIL_MOTION_PRESSABLE_CLASS,
			)}
			aria-label={post.dek ? `${post.title} — ${post.dek}` : post.title}
		>
			{/* `poster-art` — same hook as film/list lobby grids for future monochrome peers. */}
			<div
				className={cn(
					"poster-art relative aspect-2/3 w-full overflow-hidden border-0 bg-background",
					HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
				)}
			>
				{post.heroImageUrl ? (
					<Image
						src={post.heroImageUrl}
						alt=""
						fill
						sizes={imageSizes}
						className="object-cover"
						priority={priority}
						unoptimized={post.heroImageUrl.startsWith("http")}
					/>
				) : (
					<div className="grid size-full place-items-center p-3">
						<p className="line-clamp-5 max-w-full text-pretty px-2 text-center font-medium text-foreground text-xs leading-snug sm:text-sm">
							{post.title}
						</p>
					</div>
				)}
				<div
					className={cn(
						"pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center bg-linear-to-t from-card/95 via-card/55 to-transparent px-3 pb-3.5 text-center sm:px-4 sm:pb-4",
						post.heroImageUrl ? "pt-14 sm:pt-16" : "pt-8",
					)}
				>
					<p className="line-clamp-2 max-w-[92%] font-medium text-foreground text-xs leading-snug sm:text-sm">
						{post.title}
					</p>
					{post.publishedAt ? (
						<p className="mt-1 font-medium text-[10px] text-muted-foreground tabular-nums tracking-wide">
							{formatTimeAgoLabel(post.publishedAt)}
						</p>
					) : null}
					{post.dek ? (
						<p className="mt-1 line-clamp-2 max-w-[92%] text-pretty text-[10px] text-muted-foreground leading-relaxed sm:text-[11px]">
							{post.dek}
						</p>
					) : null}
				</div>
			</div>
		</Link>
	);
}

/** Journal index — poster-wall catalogue matching `/lists` and `/home` lobby grids. */
export function JournalCatalogueGrid({ posts }: { posts: JournalListItem[] }) {
	if (posts.length === 0) return null;

	return (
		<div className={HOME_LOBBY_CATALOGUE_GRID_CLASSNAME}>
			{posts.map((post, index) => (
				<div key={post.id} className="min-w-0">
					<JournalCatalogueTile post={post} priority={index < 6} />
				</div>
			))}
		</div>
	);
}
