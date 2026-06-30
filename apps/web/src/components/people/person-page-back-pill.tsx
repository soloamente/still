"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

/** Shared rounded-full bg-card pill language used by the person page chrome (back + TMDb). */
export const PERSON_PAGE_PILL_CLASS =
	"inline-flex min-h-10 items-center gap-2 rounded-full bg-card px-4 py-2 font-medium text-foreground text-sm transition-colors duration-200 ease-out [@media(hover:hover)]:hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Back-pill for the person detail page — returns to the previous view, /home as fallback. */
export function PersonPageBackPill() {
	const router = useRouter();
	return (
		<button
			type="button"
			className={PERSON_PAGE_PILL_CLASS}
			onClick={() => {
				if (typeof window !== "undefined" && window.history.length > 1) {
					router.back();
				} else {
					router.push("/home");
				}
			}}
		>
			<ChevronLeft className="size-4 shrink-0" aria-hidden />
			Back
		</button>
	);
}
