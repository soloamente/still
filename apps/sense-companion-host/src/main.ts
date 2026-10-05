import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { isCompanionRelay, isDiscordStatusRequest } from "./companion-message";
import {
	companionMessageFromNative,
	decideDiscordPresence,
	encodeNativeMessage,
	readNativeMessagesFromBuffer,
} from "./discord-presence";
import { DiscordPresenceSession, openDiscordPipe } from "./discord-session";
import {
	postSenseProfile,
	readProfileToken,
	SENSE_PROFILE_MIN_INTERVAL_MS,
	SENSE_PROFILE_ORIGIN,
	type SenseLoggedNotice,
	senseProfileKey,
	shouldSendSenseProfile,
} from "./sense-profile";
import {
	pickSharedWatch,
	readSharedWatch,
	readSourceId,
	sharedWatchDirectory,
	snapshotWithoutToken,
	writeSourceSnapshot,
} from "./shared-watch";

/**
 * Chrome starts this process for `com.sense.companion` and kills it when the
 * extension port closes. Closing the Discord pipe clears the status.
 * stdout is the native-messaging channel — logs go to stderr only.
 */

function readClientId(): string | null {
	const fromEnv = process.env.SENSE_DISCORD_CLIENT_ID?.trim();
	if (fromEnv) return fromEnv;

	const flag = process.argv.indexOf("--config");
	const fromFlag =
		flag >= 0 && process.argv[flag + 1] ? process.argv[flag + 1] : null;
	const candidates = [
		fromFlag,
		path.join(import.meta.dir, "..", "discord-application.json"),
		path.join(path.dirname(process.execPath), "discord-application.json"),
	].filter((candidate): candidate is string => Boolean(candidate));

	for (const candidate of candidates) {
		try {
			const parsed = JSON.parse(readFileSync(candidate, "utf8")) as {
				clientId?: unknown;
			};
			if (
				typeof parsed.clientId === "string" &&
				/^\d{17,20}$/.test(parsed.clientId)
			) {
				return parsed.clientId;
			}
		} catch {
			// Try the next location. A missing file is the usual case before setup.
		}
	}
	return null;
}

let session: DiscordPresenceSession | null = null;
let pausedSince: number | null = null;
let loggedMissingDiscord = false;
let loggedMissingClient = false;
let chain: Promise<void> = Promise.resolve();
let lastProfileAt: number | null = null;
let lastProfileKey: string | null = null;
/** Pairing token from this browser. The other browser's title is posted with it. */
let pairedToken: string | null = null;
let loggedUnpaired = false;

/** stderr is invisible once Chrome starts the helper. This file sits next to the exe. */
function noteProfileSave(line: string): void {
	try {
		appendFileSync(
			path.join(path.dirname(process.execPath), "sense-profile.log"),
			`${new Date().toISOString()} ${line}\n`,
		);
	} catch {
		// A log failure must not stop Discord presence.
	}
}

async function ensureSession(
	clientId: string,
): Promise<DiscordPresenceSession | null> {
	if (session) return session;
	const socket = await openDiscordPipe();
	if (!socket) {
		if (!loggedMissingDiscord) {
			console.error(
				"Sense Companion: Discord desktop is not running, so Watching stays off.",
			);
			loggedMissingDiscord = true;
		}
		return null;
	}
	loggedMissingDiscord = false;
	socket.on("close", () => {
		session = null;
	});
	session = new DiscordPresenceSession(socket, clientId, process.pid);
	return session;
}

function rememberToken(value: unknown): void {
	const token = readProfileToken(value);
	if (token) pairedToken = token;
}

/**
 * Publish whichever browser is actually playing. This helper may be the idle
 * paired one; the title itself was written by the browser that is watching.
 */
async function publishSharedProfile(
	now: number,
): Promise<SenseLoggedNotice | null> {
	const directory = sharedWatchDirectory();
	const message = pickSharedWatch(readSharedWatch(directory, now), now);
	if (!message) return null;
	const token = pairedToken;
	if (!token) {
		if (!loggedUnpaired) {
			noteProfileSave("skipped (browser is not paired)");
			loggedUnpaired = true;
		}
		return null;
	}
	const nextKey = senseProfileKey(message);
	if (
		!shouldSendSenseProfile({
			now,
			lastSentAt: lastProfileAt,
			lastKey: lastProfileKey,
			nextKey,
			minIntervalMs: SENSE_PROFILE_MIN_INTERVAL_MS,
		})
	) {
		return null;
	}
	const saved = await postSenseProfile({
		origin: SENSE_PROFILE_ORIGIN,
		token,
		message,
	});
	if (saved.status === "failed") noteProfileSave("failed");
	if (saved.status === "sent" || saved.status === "failed") {
		lastProfileAt = now;
		lastProfileKey = nextKey;
	}
	return saved.status === "sent" ? saved.logged : null;
}

/** stdout is Chrome's reply channel. One framed JSON object, nothing else. */
function replyNative(payload: unknown): void {
	process.stdout.write(encodeNativeMessage(payload));
}

async function replyDiscordStatus(): Promise<void> {
	const clientId = readClientId();
	if (!clientId) {
		replyNative({
			type: "sense-companion:discord-status",
			connected: false,
			reason: "missing-client",
		});
		return;
	}
	const active = await ensureSession(clientId);
	replyNative({
		type: "sense-companion:discord-status",
		connected: active !== null,
		reason: active ? "connected" : "closed",
	});
}

async function handleMessage(value: unknown): Promise<void> {
	if (isDiscordStatusRequest(value)) {
		await replyDiscordStatus();
		return;
	}
	rememberToken(value);
	if (isCompanionRelay(value)) {
		const logged = await publishSharedProfile(Date.now());
		if (logged) replyNative({ type: "sense-companion:logged", ...logged });
		return;
	}

	const message = companionMessageFromNative(value);
	if (!message) return;

	const now = Date.now();
	const sourceId = readSourceId(value) ?? `host-${process.pid}`;
	try {
		// The native message also carries the pairing token. The shared file
		// is only the title, so a pairing secret is not written to disk.
		writeSourceSnapshot(
			sharedWatchDirectory(),
			sourceId,
			snapshotWithoutToken(message),
			now,
		);
	} catch (error) {
		console.error("Sense Companion shared watch failed", error);
	}
	const logged = await publishSharedProfile(now);
	if (logged) replyNative({ type: "sense-companion:logged", ...logged });

	const clientId = readClientId();
	if (!clientId) {
		if (!loggedMissingClient) {
			console.error(
				"Sense Companion: put your Discord Application ID in discord-application.json (clientId) or SENSE_DISCORD_CLIENT_ID.",
			);
			loggedMissingClient = true;
		}
		return;
	}

	const next = decideDiscordPresence({
		message,
		now: Date.now(),
		pausedSince,
	});
	pausedSince = next.pausedSince;
	const active = await ensureSession(clientId);
	active?.apply(next.decision);
}

let pending = Buffer.alloc(0);
process.stdin.on("data", (chunk: Buffer | string) => {
	pending = Buffer.concat([pending, Buffer.from(chunk)]);
	const read = readNativeMessagesFromBuffer(pending);
	pending = Buffer.from(read.rest);
	for (const value of read.messages) {
		chain = chain
			.then(() => handleMessage(value))
			.catch((error: unknown) => {
				console.error("Sense Companion Discord host failed", error);
				session = null;
			});
	}
});

process.stdin.on("end", () => {
	process.exit(0);
});

// The paired browser keeps this process up. Poll so a title that started in
// the other browser reaches Sense without waiting for a local playback tick.
setInterval(() => {
	if (!pairedToken) return;
	chain = chain
		.then(async () => {
			const logged = await publishSharedProfile(Date.now());
			if (logged) replyNative({ type: "sense-companion:logged", ...logged });
		})
		.catch((error: unknown) => {
			console.error("Sense Companion profile relay failed", error);
		});
}, SENSE_PROFILE_MIN_INTERVAL_MS);
