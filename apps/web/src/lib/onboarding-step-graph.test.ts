import { describe, expect, test } from "bun:test";

import {
	isOnboardingImportStep,
	onboardingProgressFraction,
	previousOnboardingStep,
} from "./onboarding-step-graph";

describe("previousOnboardingStep", () => {
	test("full path: import back is favorites, upload back is import", () => {
		expect(previousOnboardingStep("import", "full")).toBe("favorites");
		expect(previousOnboardingStep("import-upload", "full")).toBe("import");
		expect(previousOnboardingStep("favorites", "full")).toBe("taste");
	});

	test("abbreviated path never returns import steps", () => {
		expect(previousOnboardingStep("handle", "abbreviated")).toBe("name");
		expect(previousOnboardingStep("import", "abbreviated")).toBe(null);
		expect(previousOnboardingStep("import-upload", "abbreviated")).toBe(null);
	});

	test("done / welcome / verify have no back", () => {
		expect(previousOnboardingStep("done", "full")).toBe(null);
		expect(previousOnboardingStep("welcome", "full")).toBe(null);
		expect(previousOnboardingStep("verify", "full")).toBe(null);
	});
});

describe("onboardingProgressFraction", () => {
	test("full path starts at 0 and finishes at 1", () => {
		expect(onboardingProgressFraction("welcome", "full")).toBe(0);
		expect(onboardingProgressFraction("done", "full")).toBe(1);
	});

	test("import-upload shares the import beat", () => {
		expect(onboardingProgressFraction("import-upload", "full")).toBe(
			onboardingProgressFraction("import", "full"),
		);
	});

	test("abbreviated handle is complete", () => {
		expect(onboardingProgressFraction("welcome", "abbreviated")).toBe(0);
		expect(onboardingProgressFraction("name", "abbreviated")).toBe(0.5);
		expect(onboardingProgressFraction("handle", "abbreviated")).toBe(1);
	});

	test("taste sits after verify on the full track", () => {
		expect(onboardingProgressFraction("verify", "full")).toBeLessThan(
			onboardingProgressFraction("taste", "full"),
		);
	});
});

describe("isOnboardingImportStep", () => {
	test("only the two import steps", () => {
		expect(isOnboardingImportStep("import")).toBe(true);
		expect(isOnboardingImportStep("import-upload")).toBe(true);
		expect(isOnboardingImportStep("done")).toBe(false);
		expect(isOnboardingImportStep("favorites")).toBe(false);
	});
});
