#!/usr/bin/env bun
/** Store zip — rebuilds so manifest.json never includes a `key` field. */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);

const build = spawnSync("bun", ["x", "wxt", "zip"], {
	cwd: packageRoot,
	stdio: "inherit",
	env: process.env,
	shell: true,
});

if (build.status !== 0) {
	process.exit(build.status ?? 1);
}

const manifestPath = path.join(
	packageRoot,
	".output",
	"chrome-mv3",
	"manifest.json",
);
if (!existsSync(manifestPath)) {
	console.error("Sense Companion: missing build output at", manifestPath);
	process.exit(1);
}

const manifest = readFileSync(manifestPath, "utf8");
if (manifest.includes('"key"')) {
	console.error(
		"Sense Companion: manifest still contains `key` — aborting store zip.",
	);
	process.exit(1);
}

console.info("Sense Companion: store zip OK (no manifest.key).");
