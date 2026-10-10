"use client";

import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import type { LegalPolicyId } from "@/lib/legal-policy-bodies";

/**
 * Public legal routes — full Mobbin-style document page (not a Vaul sheet).
 * Auth signup still opens Privacy / Terms in-place via AuthLegalDrawerProvider.
 */
export function LegalPageShell({ policyId }: { policyId: LegalPolicyId }) {
	return <LegalDocumentPage surfaceId={policyId} />;
}
