import { cn } from "@still/ui/lib/utils";
import Image from "next/image";

import { profilePatronAvatarImageUrl } from "@/lib/profile-avatar";

export type PatronPortraitAvatarProps = {
	handle: string;
	/** Raw `user.image` — only used to detect presence; `src` always goes through the API proxy. */
	avatarUrl: string | null | undefined;
	name: string;
	className?: string;
	width?: number;
	height?: number;
};

/**
 * Patron portrait — same loading contract as `ProfilePatronHeader`:
 * proxy via `GET /api/profiles/avatar/:handle` and `unoptimized` (dev localhost is a private IP).
 */
export function PatronPortraitAvatar({
	handle,
	avatarUrl,
	name,
	className,
	width = 72,
	height = 72,
}: PatronPortraitAvatarProps) {
	const initials = name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase())
		.join("");

	const portraitSrc = avatarUrl?.trim()
		? profilePatronAvatarImageUrl(handle)
		: null;

	if (portraitSrc) {
		return (
			<Image
				src={portraitSrc}
				alt=""
				width={width}
				height={height}
				unoptimized
				className={cn("object-cover", className)}
			/>
		);
	}

	return (
		<span
			className={cn(
				"inline-flex items-center justify-center rounded-full bg-soft-stone font-medium text-pure-white",
				className,
			)}
			aria-hidden
		>
			{initials}
		</span>
	);
}
