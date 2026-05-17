import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import Link from "next/link";

export type FeedPerson = {
	user: { id: string; name: string; image: string | null } | null;
	profile: { handle: string; displayName: string } | null;
};

/**
 * Circular profile image for feed rows and the home “friend activity” rail.
 * Profile URL is derived from `profile.handle` (fallback: `user.id`).
 */
export function FeedPersonAvatar({
	person,
	size = "md",
	className,
}: {
	person: FeedPerson;
	/** `md` = 44px — matches Track B minimum tap target. */
	size?: "md" | "sm";
	className?: string;
}) {
	const handle = person.profile?.handle ?? person.user?.id ?? "user";
	const name = person.profile?.displayName ?? person.user?.name ?? "Someone";
	const src = person.user?.image;
	const box =
		size === "md" ? "size-11 min-h-11 min-w-11" : "size-9 min-h-9 min-w-9";
	const imgSizes = size === "md" ? "44px" : "36px";

	return (
		<Link
			href={`/profile/${handle}`}
			className={cn(
				"relative isolate shrink-0 overflow-hidden rounded-full border border-border bg-muted ring-offset-background",
				"transition-[box-shadow,transform] duration-[var(--aker-duration)] ease-[var(--aker-ease)]",
				"hover:ring-2 hover:ring-desert-orange/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-desert-orange/60 focus-visible:ring-offset-2",
				"select-none",
				box,
				className,
			)}
			aria-label={`${name} profile`}
		>
			{src ? (
				<Image
					src={src}
					alt=""
					fill
					className="object-cover"
					sizes={imgSizes}
				/>
			) : (
				<span className="flex h-full w-full items-center justify-center font-sans font-semibold text-muted-foreground text-xs uppercase">
					{initials(name)}
				</span>
			)}
		</Link>
	);
}

function initials(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length >= 2) {
		const a = parts[0]?.charAt(0) ?? "";
		const b = parts[1]?.charAt(0) ?? "";
		return `${a}${b}`.toUpperCase();
	}
	const one = parts[0] ?? "?";
	return one.slice(0, 2).toUpperCase();
}
