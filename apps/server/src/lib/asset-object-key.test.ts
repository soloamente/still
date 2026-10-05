import { describe, expect, test } from "bun:test";

import { r2ObjectKeyFilename } from "./asset-object-key";

describe("r2ObjectKeyFilename", () => {
	test("strips spaces and parentheses from Windows download names", () => {
		expect(r2ObjectKeyFilename("Download (44).jpg")).toBe("Download-44.jpg");
	});

	test("keeps a safe extension or defaults to .jpg", () => {
		expect(r2ObjectKeyFilename("photo.PNG")).toBe("photo.png");
		expect(r2ObjectKeyFilename("noext")).toBe("noext.jpg");
	});
});
