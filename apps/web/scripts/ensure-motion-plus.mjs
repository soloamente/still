/**
 * Ensures apps/web/.cache/motion-plus.tgz exists before `bun install`.
 * Motion+ is a private registry package; the tarball is gitignored and must be
 * fetched on CI (e.g. Vercel) using MOTION_AUTH_TOKEN from motion.dev/dashboard/tokens.
 */
import { access, copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = process.env.MOTION_PLUS_VERSION ?? "2.10.0";
const MIN_BYTES = 1024;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webRoot = join(scriptDir, "..");
const cacheDir = join(webRoot, ".cache");
const stableTarball = join(cacheDir, "motion-plus.tgz");
const versionedTarball = join(cacheDir, `motion-plus-${VERSION}.tgz`);

async function tarballIsValid(filePath) {
	try {
		const info = await stat(filePath);
		return info.isFile() && info.size >= MIN_BYTES;
	} catch {
		return false;
	}
}

async function download(token) {
	const url = `https://api.motion.dev/registry.tgz?package=motion-plus&version=${VERSION}&token=${encodeURIComponent(token)}`;
	console.log(`motion-plus: downloading ${VERSION}…`);
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`motion-plus download failed (${response.status}). Check MOTION_AUTH_TOKEN at https://motion.dev/dashboard/tokens`,
		);
	}
	const buffer = Buffer.from(await response.arrayBuffer());
	if (buffer.length < MIN_BYTES) {
		throw new Error(
			"motion-plus download produced an empty or invalid tarball (token rejected?)",
		);
	}
	await mkdir(cacheDir, { recursive: true });
	await writeFile(versionedTarball, buffer);
	await copyFile(versionedTarball, stableTarball);
	console.log(`motion-plus: saved to ${stableTarball}`);
}

async function main() {
	if (await tarballIsValid(stableTarball)) {
		console.log("motion-plus: using cached tarball");
		return;
	}

	const token = process.env.MOTION_AUTH_TOKEN?.trim();
	if (!token) {
		console.error("");
		console.error(
			"motion-plus: missing apps/web/.cache/motion-plus.tgz and no MOTION_AUTH_TOKEN.",
		);
		console.error(
			"  Local:  $env:MOTION_AUTH_TOKEN='…'; .\\scripts\\install-motion-plus.ps1",
		);
		console.error(
			"  Vercel: add MOTION_AUTH_TOKEN in Project → Settings → Environment Variables",
		);
		console.error("");
		process.exit(1);
	}

	await download(token);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
