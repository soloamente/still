import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "@still/env/server";
import { AwsClient } from "aws4fetch";

import type { ImageBody } from "./asset-store";

const SERVER_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const DEFAULT_ASSETS_BUCKET = "cue-assets";

/** Short-lived dev cache — wrangler pipe is slow (~3–5s per object). */
const devCliCache = new Map<
	string,
	{ bytes: Uint8Array; contentType: string; cachedAt: number }
>();
const DEV_CLI_CACHE_TTL_MS = 5 * 60_000;

function inferImageContentType(key: string): string {
	const lower = key.toLowerCase();
	if (lower.endsWith(".gif")) return "image/gif";
	if (lower.endsWith(".png")) return "image/png";
	if (lower.endsWith(".webp")) return "image/webp";
	if (lower.endsWith(".avif")) return "image/avif";
	return "image/jpeg";
}

/** DB keys may be partially URL-encoded (`giphy%20(2).gif`). */
export function r2KeyCandidates(key: string): string[] {
	const out: string[] = [];
	const add = (candidate: string) => {
		const trimmed = candidate.trim();
		if (trimmed && !out.includes(trimmed)) out.push(trimmed);
	};

	add(key);
	try {
		add(decodeURIComponent(key));
	} catch {
		// Keep the raw key only.
	}
	// Some uploads landed in R2 with literal `%2520` while the DB row kept `%20`.
	if (key.includes("%20")) {
		add(key.replaceAll("%20", "%2520"));
	}
	if (key.includes(" ")) {
		add(key.replaceAll(" ", "%2520"));
	}

	return out;
}

function bodyFromBytes(bytes: Uint8Array, contentType: string): ImageBody {
	// Normalize to a plain ArrayBuffer-backed view so DOM BlobPart typings used by
	// Next.js typecheck don't reject ArrayBufferLike/SharedArrayBuffer unions.
	const normalizedBytes = Uint8Array.from(bytes);
	return {
		body: new Blob([normalizedBytes.buffer]).stream(),
		contentType,
	};
}

function r2S3Credentials(): {
	accountId: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
} | null {
	const accountId = env.R2_ACCOUNT_ID?.trim();
	const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
	const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
	if (!accountId || !accessKeyId || !secretAccessKey) return null;
	return {
		accountId,
		accessKeyId,
		secretAccessKey,
		bucket: env.R2_ASSETS_BUCKET?.trim() || DEFAULT_ASSETS_BUCKET,
	};
}

let s3Client: AwsClient | null = null;
let s3ClientKey = "";

/** Fast path when R2 S3 API keys are configured in apps/server/.env. */
async function fetchR2AssetViaS3(key: string): Promise<ImageBody | null> {
	const creds = r2S3Credentials();
	if (!creds) return null;

	const clientKey = `${creds.accountId}:${creds.accessKeyId}`;
	if (!s3Client || s3ClientKey !== clientKey) {
		s3Client = new AwsClient({
			accessKeyId: creds.accessKeyId,
			secretAccessKey: creds.secretAccessKey,
			service: "s3",
			region: "auto",
		});
		s3ClientKey = clientKey;
	}

	for (const candidate of r2KeyCandidates(key)) {
		// Path-style R2 URL — avoid encodeURIComponent on segments that already
		// contain literal `%2520` (would become `%252520`).
		const objectPath = candidate
			.split("/")
			.map((segment) =>
				segment.replace(
					/[^A-Za-z0-9._~-]/g,
					(char) =>
						`%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
				),
			)
			.join("/");
		const url = `https://${creds.accountId}.r2.cloudflarestorage.com/${creds.bucket}/${objectPath}`;
		const response = await s3Client.fetch(url);
		if (!response.ok || !response.body) continue;
		return {
			body: response.body,
			contentType:
				response.headers.get("content-type") ??
				inferImageContentType(candidate),
		};
	}

	return null;
}

/** Dev fallback using logged-in wrangler OAuth — no R2 API token required. */
async function fetchR2AssetViaWranglerCli(
	key: string,
): Promise<ImageBody | null> {
	if (env.NODE_ENV !== "development") return null;

	const bucket = env.R2_ASSETS_BUCKET?.trim() || DEFAULT_ASSETS_BUCKET;

	for (const candidate of r2KeyCandidates(key)) {
		const cacheKey = `${bucket}/${candidate}`;
		const cached = devCliCache.get(cacheKey);
		if (cached && Date.now() - cached.cachedAt < DEV_CLI_CACHE_TTL_MS) {
			return bodyFromBytes(cached.bytes, cached.contentType);
		}

		const proc = Bun.spawn(
			[
				"bun",
				"wrangler",
				"r2",
				"object",
				"get",
				`${bucket}/${candidate}`,
				"--remote",
				"--pipe",
			],
			{
				cwd: SERVER_ROOT,
				stdout: "pipe",
				stderr: "pipe",
			},
		);

		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(proc.stdout).arrayBuffer(),
			new Response(proc.stderr).text(),
			proc.exited,
		]);

		if (exitCode !== 0) {
			console.warn(
				"[asset-store] wrangler r2 get failed",
				cacheKey,
				stderr.trim() || `exit ${exitCode}`,
			);
			continue;
		}

		const bytes = new Uint8Array(stdout);
		if (bytes.byteLength === 0) continue;

		const contentType = inferImageContentType(candidate);
		devCliCache.set(cacheKey, { bytes, contentType, cachedAt: Date.now() });
		return bodyFromBytes(bytes, contentType);
	}

	return null;
}

/**
 * Local Bun dev cannot bind the private `cue-assets` R2 bucket. Resolve keys via
 * S3 API credentials (preferred) or `wrangler r2 object get --remote --pipe`.
 */
export async function fetchR2AssetDevFallback(
	key: string,
): Promise<ImageBody | null> {
	const viaS3 = await fetchR2AssetViaS3(key);
	if (viaS3) return viaS3;
	return fetchR2AssetViaWranglerCli(key);
}
