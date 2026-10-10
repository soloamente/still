import type { ReactNode } from "react";

import { LegalDocumentLayout } from "@/components/legal/legal-document-layout";

export default function LegalRouteLayout({
	children,
}: {
	children: ReactNode;
}) {
	return <LegalDocumentLayout>{children}</LegalDocumentLayout>;
}
