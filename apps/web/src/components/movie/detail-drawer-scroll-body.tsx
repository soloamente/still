"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode, RefObject } from "react";

import {
	MOVIE_DETAIL_DRAWER_SCROLL_CLASSNAME,
	MOVIE_DETAIL_NESTED_DRAWER_SCROLL_CLASSNAME,
} from "@/lib/detail-vaul-drawer";

/** Scrollport for Vaul drawers — full sheet width; `data-vaul-no-drag` keeps scroll off the handle rail. */
export function DetailDrawerScrollBody({
	scrollRef,
	nested = false,
	children,
	className,
}: {
	scrollRef?: RefObject<HTMLDivElement | null>;
	nested?: boolean;
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			ref={scrollRef}
			data-vaul-no-drag
			// Lenis calls preventDefault on touch while stopped (drawer open); wheel-only is not enough on mobile.
			data-lenis-prevent
			className={cn(
				nested
					? MOVIE_DETAIL_NESTED_DRAWER_SCROLL_CLASSNAME
					: MOVIE_DETAIL_DRAWER_SCROLL_CLASSNAME,
				className,
			)}
		>
			{children}
		</div>
	);
}
