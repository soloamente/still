import { LEGAL_NAV, type LegalPolicyId } from "@/lib/legal-policy-bodies";

/** Public legal document surfaces that share chrome + peer page-slide. */
export type LegalSurfaceId = LegalPolicyId | "trust";

/** Footer peer links — Trust always last (Privacy · Terms · Cookies · Trust). */
export const LEGAL_FOOTER_NAV: {
	id: LegalSurfaceId;
	href: string;
	label: string;
}[] = [...LEGAL_NAV, { id: "trust", href: "/trust", label: "Trust" }];

const SURFACE_ORDER = LEGAL_FOOTER_NAV.map((item) => item.id);

export function legalSurfaceFromPath(pathname: string): LegalSurfaceId | null {
	const segment = pathname.replace(/\/$/, "").split("/").pop() ?? "";
	if (SURFACE_ORDER.includes(segment as LegalSurfaceId)) {
		return segment as LegalSurfaceId;
	}
	return null;
}

export function legalSurfaceSlideDirection(
	from: LegalSurfaceId,
	to: LegalSurfaceId,
): "forward" | "back" {
	const prevIndex = SURFACE_ORDER.indexOf(from);
	const nextIndex = SURFACE_ORDER.indexOf(to);
	return nextIndex >= prevIndex ? "forward" : "back";
}

export function isLegalPolicySurface(
	surface: LegalSurfaceId,
): surface is LegalPolicyId {
	return surface !== "trust";
}
