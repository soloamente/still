"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { legalSurfaceFromPath } from "@/lib/legal-surface";

/**
 * Persistent client shell for `/privacy|terms|cookies|trust` so peer switches
 * can page-slide without remounting the whole document chrome.
 */
export function LegalDocumentLayout({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const surfaceId = legalSurfaceFromPath(pathname);

	if (!surfaceId) {
		return children;
	}

	return (
		<>
			<LegalDocumentPage surfaceId={surfaceId} />
			{/* Pages only supply metadata — body lives in LegalDocumentPage. */}
			<div className="hidden" aria-hidden>
				{children}
			</div>
		</>
	);
}
