import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { PatronPortraitWithMetalTier } from "@/components/profile/patron-portrait-with-metal-tier";
import type { DiaryMetalTier } from "@/lib/diary-metal-tier";
import { inferAnimatedFromProfileUrl } from "@/lib/profile-media";

export type FeedPerson = {
	user: { id: string; name: string; image: string | null } | null;
	profile: {
		handle: string;
		displayName: string;
		avatarIsAnimated?: boolean;
		diaryMetalTier?: DiaryMetalTier | null;
	} | null;
};

/**
 * Circular profile image for feed rows and the home “friend activity” rail.
 * Uses the same avatar proxy as nav / profile (`PatronPortraitWithMetalTier`) — raw
 * `user.image` blob URLs are not fetchable by Next `<Image>` (403 on private blob).
 */
export function FeedPersonAvatar({
	person,
	size = "md",
	className,
}: {
	person: FeedPerson;
	/** `md` = 44px tap target; `sm` / `xs` for inline feed bylines. */
	size?: "md" | "sm" | "xs";
	className?: string;
}) {
	const handle = person.profile?.handle ?? person.user?.id ?? "user";
	const name = person.profile?.displayName ?? person.user?.name ?? "Someone";
	const hasMetalTier = Boolean(person.profile?.diaryMetalTier);
	const px = size === "md" ? 44 : size === "sm" ? 36 : 32;
	const box =
		size === "md"
			? "size-11 min-h-11 min-w-11"
			: size === "sm"
				? "size-9 min-h-9 min-w-9"
				: "size-8 min-h-8 min-w-8";

	return (
		<Link
			href={`/profile/${handle}`}
			className={cn(
				"relative isolate shrink-0 rounded-full",
				hasMetalTier
					? "overflow-visible bg-transparent"
					: "overflow-visible bg-muted",
				"transition-[transform,colors] duration-[var(--aker-duration)] ease-[var(--aker-ease)]",
				"[@media(hover:hover)]:hover:bg-foreground/10",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-desert-orange/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
				"select-none active:scale-[0.96] motion-reduce:active:scale-100",
				box,
				className,
			)}
			aria-label={`${name} profile`}
		>
			<PatronPortraitWithMetalTier
				handle={handle}
				avatarUrl={person.user?.image}
				name={name}
				width={px}
				height={px}
				className="size-full rounded-full"
				isAnimated={inferAnimatedFromProfileUrl(
					person.user?.image,
					person.profile?.avatarIsAnimated,
				)}
				diaryMetalTier={person.profile?.diaryMetalTier ?? null}
			/>
		</Link>
	);
}
