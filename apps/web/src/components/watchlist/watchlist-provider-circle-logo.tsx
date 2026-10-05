"use client";

import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import { type CSSProperties, useEffect, useState } from "react";

/** Circular provider mark — `object-cover` fills the frame (platform row + filter pill). */
export function WatchlistProviderCircleLogo({
	src,
	name,
	fallbackLabel,
	className,
	fallbackClassName = "text-xs",
	style,
	dataWatchlistLogo,
	providerId,
}: {
	src: string | null;
	name: string;
	/** Defaults to first two letters of `name`. */
	fallbackLabel?: string;
	className?: string;
	fallbackClassName?: string;
	style?: CSSProperties;
	/** Measurement hook for row → pill flight. */
	dataWatchlistLogo?: "row" | "pill";
	providerId?: number;
}) {
	const [imageFailed, setImageFailed] = useState(false);

	useEffect(() => {
		setImageFailed(false);
	}, [src]);

	const showImage = Boolean(src?.trim()) && !imageFailed;

	return (
		<span
			style={style}
			data-watchlist-row-logo={dataWatchlistLogo === "row" ? true : undefined}
			data-watchlist-pill-logo={
				dataWatchlistLogo === "pill" && providerId != null
					? providerId
					: undefined
			}
			className={cn(
				"relative inline-flex shrink-0 overflow-hidden rounded-full bg-card",
				className,
			)}
		>
			{showImage ? (
				<Image
					src={src!}
					alt=""
					fill
					sizes="2.25rem"
					className="object-cover"
					unoptimized
					onError={() => setImageFailed(true)}
				/>
			) : (
				<span
					className={cn(
						"flex size-full items-center justify-center font-medium text-foreground",
						fallbackClassName,
					)}
				>
					{(fallbackLabel ?? name.slice(0, 2)).toUpperCase()}
				</span>
			)}
		</span>
	);
}
