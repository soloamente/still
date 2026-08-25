import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beamToastSonnerOptions } from "./still-toast-beam";

describe("beamToastSonnerOptions", () => {
	test("strips icon so Sonner does not paint a second leading mark", () => {
		const options = beamToastSonnerOptions({
			icon: "pencil",
			duration: 3800,
			className: "extra",
		});
		expect(options.icon).toBeUndefined();
		expect(options.duration).toBe(3800);
		expect(options.unstyled).toBe(true);
		expect(String(options.className)).toContain("still-toast-beam-host");
		expect(String(options.className)).not.toContain("!m-0");
	});
});

describe("StillToastBeamFrame beam mode", () => {
	test("uses rotate sm with hue-shift pulse (staticColors only on error)", () => {
		const frame = readFileSync(
			join(import.meta.dir, "../components/app/still-toast-beam-frame.tsx"),
			"utf8",
		);
		expect(frame).toContain('size="sm"');
		expect(frame).toContain('staticColors={type === "error"}');
		expect(frame).toContain("hueRange={30}");
	});
});

describe("beam toast host CSS", () => {
	test("hides Sonner [data-icon] on custom beam hosts", () => {
		const globals = readFileSync(
			join(import.meta.dir, "../../../../packages/ui/src/styles/globals.css"),
			"utf8",
		);
		expect(globals).toContain(".still-toast-beam-host [data-icon]");
	});
});
