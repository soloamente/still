import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "./src/index.ts",
	format: "esm",
	outDir: "./dist",
	clean: true,
	// Inline workspace packages into the server bundle (was `noExternal`; tsdown ≥0.21 uses `deps.alwaysBundle`).
	deps: {
		alwaysBundle: [/@still\/.*/],
		// App server intentionally bundles third-party deps into one artifact; suppress onlyBundle audit noise.
		onlyBundle: false,
	},
});
