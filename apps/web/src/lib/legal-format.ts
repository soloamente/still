import { getLegalPolicy, type LegalPolicyId } from "@/lib/legal-policy-bodies";
import type { MovieDetailSectionNavItem } from "@/lib/movie-detail-sections";

/** Shared date label for legal page headers (UTC calendar day). */
export function formatLegalLastUpdated(isoDate: string): string {
	const parsed = new Date(`${isoDate}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime())) return isoDate;
	return new Intl.DateTimeFormat("en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	}).format(parsed);
}

/** DOM id for a legal section heading — keep in sync with `LegalPolicyContent`. */
export function legalSectionAnchorId(heading: string): string {
	return heading
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/** Right-rail jump targets for the full-page legal document (movie-detail legend). */
export function buildLegalSectionNavItems(
	policyId: LegalPolicyId,
): MovieDetailSectionNavItem[] {
	return getLegalPolicy(policyId).sections.map((section) => ({
		id: legalSectionAnchorId(section.heading),
		label: section.heading,
	}));
}
