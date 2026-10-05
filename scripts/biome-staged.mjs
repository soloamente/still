#!/usr/bin/env bun
/**
 * Pre-commit Biome runner. Reads staged paths from git so Windows never splits
 * `HBO Max/presence.ts` into separate argv tokens for Biome.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);

const BIOME_GLOB = /\.(js|ts|cjs|mjs|d\.cts|d\.mts|jsx|tsx|json|jsonc)$/i;

/** Skip paths Biome should never touch (matches biome.json excludes). */
function shouldSkip(relativePath) {
	const normalized = relativePath.replace(/\\/g, "/");
	if (normalized.includes("/vendor/premid-activities/")) return true;
	if (normalized.startsWith("apps/sense-companion/vendor/")) return true;
	if (normalized.startsWith(".claude/")) return true;
	if (normalized.startsWith(".agents/")) return true;
	if (normalized.startsWith(".worktrees/")) return true;
	if (normalized.includes("/.next/")) return true;
	if (normalized.includes("/.output/")) return true;
	return false;
}

const listed = spawnSync(
	"git",
	["diff", "--cached", "--name-only", "--diff-filter=ACM", "-z"],
	{ cwd: repoRoot, encoding: "utf8" },
);

if (listed.status !== 0) {
	process.exit(listed.status ?? 1);
}

const files = listed.stdout
	.split("\0")
	.filter(Boolean)
	.filter((relative) => BIOME_GLOB.test(relative))
	.filter((relative) => !shouldSkip(relative))
	.map((relative) => path.join(repoRoot, relative))
	.filter((absolute) => existsSync(absolute));

if (files.length === 0) {
	process.exit(0);
}

const result = spawnSync(
	process.execPath,
	[
		"biome",
		"check",
		"--write",
		"--no-errors-on-unmatched",
		"--files-ignore-unknown=true",
		...files,
	],
	{
		cwd: repoRoot,
		stdio: "inherit",
		shell: false,
	},
);

process.exit(result.status ?? 1);
