"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Dismiss an open sheet when Next.js client navigation changes the pathname.
 * In-drawer `<Link>` taps update the page underneath but leave Vaul overlays open without this.
 */
export function useDismissSheetOnRouteChange(
	isOpen: boolean,
	onDismiss: () => void,
): void {
	const pathname = usePathname();
	const previousPathname = useRef(pathname);

	useEffect(() => {
		if (previousPathname.current === pathname) return;
		previousPathname.current = pathname;
		if (isOpen) {
			onDismiss();
		}
	}, [pathname, isOpen, onDismiss]);
}
