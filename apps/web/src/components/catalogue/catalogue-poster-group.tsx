"use client";

import { cn } from "@still/ui/lib/utils";
import { type ComponentProps, useRef } from "react";
import { useAvatarGroupHover } from "@/lib/use-avatar-group-hover";

/**
 * Poster gallery root for transitions.dev avatar-group-hover.
 * Children that own the lift must use `.t-avatar` (see `cataloguePosterHoverShellClassName`).
 */
export function CataloguePosterGroup({
	className,
	children,
	ref,
	...rest
}: ComponentProps<"div">) {
	const localRef = useRef<HTMLDivElement>(null);
	useAvatarGroupHover(localRef);

	return (
		<div
			{...rest}
			ref={(node) => {
				localRef.current = node;
				if (typeof ref === "function") ref(node);
				else if (ref) ref.current = node;
			}}
			className={cn("t-avatar-group", className)}
		>
			{children}
		</div>
	);
}
