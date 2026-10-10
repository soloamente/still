import { describe, expect, test } from "bun:test";

import {
	buildLegalSectionNavItems,
	legalSectionAnchorId,
} from "./legal-format";
import {
	getLegalPolicy,
	LEGAL_NAV,
	LEGAL_POLICY_SECTIONS,
	type LegalPolicyId,
} from "./legal-policy-bodies";

describe("legal-policy-bodies", () => {
	test("every nav id has a policy with intro + sections", () => {
		for (const item of LEGAL_NAV) {
			const policy = getLegalPolicy(item.id);
			expect(policy.id).toBe(item.id);
			expect(policy.title.length).toBeGreaterThan(0);
			expect(policy.intro.length).toBeGreaterThan(0);
			expect(policy.sections.length).toBeGreaterThan(0);
			for (const section of policy.sections) {
				expect(section.heading.length).toBeGreaterThan(0);
				expect(section.paragraphs.length).toBeGreaterThan(0);
			}
		}
	});

	test("catalogue covers privacy, terms, and cookies", () => {
		const ids = Object.keys(LEGAL_POLICY_SECTIONS) as LegalPolicyId[];
		expect(ids.sort()).toEqual(
			(["cookies", "privacy", "terms"] as LegalPolicyId[]).sort(),
		);
	});

	test("terms includes refund and cooling-off sections", () => {
		const headings = getLegalPolicy("terms").sections.map((s) => s.heading);
		expect(headings).toContain("Plans, payments, and refunds");
		expect(headings).toContain("Your right to change your mind");
		expect(headings).toContain("How to request a refund");
	});

	test("section nav anchors match policy headings", () => {
		const items = buildLegalSectionNavItems("cookies");
		expect(items.length).toBeGreaterThanOrEqual(2);
		expect(items[0]?.id).toBe(legalSectionAnchorId(items[0]?.label ?? ""));
		expect(items.some((item) => item.id === "categories")).toBe(true);
	});

	test("privacy points to Trust Center instead of naming every vendor", () => {
		const headings = getLegalPolicy("privacy").sections.map((s) => s.heading);
		expect(headings).toContain(
			"Disclosure of personal information to third parties",
		);
		expect(headings).toContain("Third parties we currently use");
		expect(headings).not.toContain("Who else handles it");
		const thirdParties = getLegalPolicy("privacy").sections.find(
			(s) => s.heading === "Third parties we currently use",
		);
		expect(thirdParties?.paragraphs.join(" ")).toContain("Trust Center");
	});
});
