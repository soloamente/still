"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * Same-pathname lobby filter navigation — `router.replace` inside `useTransition`
 * so chips stay interactive while the RSC payload catches up.
 */
export function useLobbyTransition() {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	const navigate = useCallback(
		(href: string) => {
			startTransition(() => {
				router.replace(href, { scroll: false });
			});
		},
		[router],
	);

	return { isPending, navigate };
}
