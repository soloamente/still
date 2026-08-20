import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import { MissingArtworkPlaceholder } from "@/components/media/missing-artwork-placeholder";

/**
 * TMDb headshot when available; otherwise canvas + centered “No image” pill.
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
				// Always TMDb CDN — skip Vercel Image Optimization.
				unoptimized
			/>
		);
	}

	return (
		<MissingArtworkPlaceholder
			variant="portrait"
			className={className}
			aria-label={`No photo for ${name}`}
		/>
	);
}
