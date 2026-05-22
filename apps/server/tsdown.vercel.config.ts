import { defineConfig } from "tsdown";

/** Bundle only the HTTP app for Vercel (no background jobs from `local.ts`). */
export default defineConfig({
	entry: {
		vercel: "./src/server/app.ts",
	},
	format: "esm",
	outDir: "./dist",
	clean: true,
	deps: {
		alwaysBundle: [/@still\/.*/],
		onlyBundle: false,
	},
});
