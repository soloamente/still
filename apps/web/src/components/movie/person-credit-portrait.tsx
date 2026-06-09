import { cn } from "@still/ui/lib/utils";
import { UserRound } from "lucide-react";
import Image from "next/image";

/**
 * TMDb headshot when available; otherwise a background tile with a person icon.
 */
export function PersonCreditPortrait({
	name,
	profilePath,
	className,
	imageClassName,
	sizes = "(max-width: 640px) 45vw, 180px",
	grayscale = false,
}: {
	name: string;
	profilePath: string | null;
	className?: string;
	imageClassName?: string;
	sizes?: string;
	/** When true, headshots are grayscale until the parent `.group` is hovered. */
	grayscale?: boolean;
}) {
	if (profilePath) {
		return (
			<Image
				src={`https://image.tmdb.org/t/p/w342${profilePath}`}
				alt=""
				width={342}
				height={513}
				className={cn(
					"size-full object-cover",
					grayscale &&
						"grayscale [@media(hover:hover)]:group-hover:grayscale-0",
					imageClassName,
				)}
				sizes={sizes}
			/>
		);
	}

	return (
		<div
			className={cn(
				"flex size-full flex-col items-center justify-center bg-background text-card",
				className,
			)}
			aria-hidden
		>
			<UserRound className="size-10 stroke-[1.25] sm:size-12" aria-hidden />
			<span className="sr-only">No photo for {name}</span>
		</div>
	);
}
