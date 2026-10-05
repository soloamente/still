import { createHash, randomBytes, randomUUID } from "node:crypto";

/** Pairing codes stay valid for ten minutes, then the extension must ask again. */
export const COMPANION_PAIR_TTL_MS = 10 * 60 * 1000;

/** Crockford-style alphabet so a typed code cannot confuse 0/O or 1/I. */
const COMPANION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type CompanionPairError = "invalid_code" | "expired" | "already_used";

export type CompanionPairCodeRow = {
	userId: string;
	codeHash: string;
	expiresAt: number;
	consumedAt: number | null;
};

export type CompanionDeviceRow = {
	id: string;
	userId: string;
	tokenHash: string;
	createdAt: number;
	revokedAt: number | null;
};

export type CompanionPairingStore = {
	/** Drop unused codes so only the latest one can be typed into the popup. */
	replaceUnusedCodes(userId: string, row: CompanionPairCodeRow): Promise<void>;
	/**
	 * Mark a still-fresh code consumed. Returns the row when this caller won,
	 * or a reason when the code is missing, expired, or already consumed.
	 */
	consumeFreshCode(
		codeHash: string,
		now: number,
	): Promise<CompanionPairCodeRow | CompanionPairError>;
	saveDevice(row: CompanionDeviceRow): Promise<void>;
	findActiveDeviceByTokenHash(
		tokenHash: string,
	): Promise<CompanionDeviceRow | null>;
	listActiveDevices(userId: string): Promise<CompanionDeviceRow[]>;
	revokeActiveDevices(userId: string, revokedAt: number): Promise<number>;
};

export type CompanionPairingOptions = {
	now?: () => number;
	randomCode?: () => string;
	randomToken?: () => string;
	randomId?: () => string;
};

/** SHA-256 hex. Plaintext codes and device tokens never land in the store. */
export function hashCompanionSecret(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

/** Strip spaces and hyphens so `ab12-cd34` and `AB12CD34` are the same code. */
export function normalizeCompanionCode(raw: string): string {
	return raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/** `AB12CD34` → `AB12-CD34` for the Settings row. */
export function formatCompanionCode(code: string): string {
	const normalized = normalizeCompanionCode(code);
	if (normalized.length <= 4) return normalized;
	return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

function randomCompanionCode(): string {
	const bytes = randomBytes(8);
	let code = "";
	for (let index = 0; index < 8; index++) {
		const byte = bytes[index] ?? 0;
		code += COMPANION_CODE_ALPHABET[byte % COMPANION_CODE_ALPHABET.length];
	}
	return code;
}

function randomCompanionToken(): string {
	return randomBytes(32).toString("base64url");
}

export class CompanionPairing {
	private readonly now: () => number;
	private readonly randomCode: () => string;
	private readonly randomToken: () => string;
	private readonly randomId: () => string;

	constructor(
		private readonly store: CompanionPairingStore,
		options: CompanionPairingOptions = {},
	) {
		this.now = options.now ?? Date.now;
		this.randomCode = options.randomCode ?? randomCompanionCode;
		this.randomToken = options.randomToken ?? randomCompanionToken;
		this.randomId = options.randomId ?? randomUUID;
	}

	async issueCode(
		userId: string,
	): Promise<{ code: string; expiresAt: string }> {
		const issuedAt = this.now();
		const code = normalizeCompanionCode(this.randomCode());
		const expiresAt = issuedAt + COMPANION_PAIR_TTL_MS;
		await this.store.replaceUnusedCodes(userId, {
			userId,
			codeHash: hashCompanionSecret(code),
			expiresAt,
			consumedAt: null,
		});
		return {
			code: formatCompanionCode(code),
			expiresAt: new Date(expiresAt).toISOString(),
		};
	}

	async exchange(
		rawCode: string,
	): Promise<{ token: string } | { error: CompanionPairError }> {
		const code = normalizeCompanionCode(rawCode);
		if (code.length < 8) return { error: "invalid_code" };
		const consumed = await this.store.consumeFreshCode(
			hashCompanionSecret(code),
			this.now(),
		);
		if (typeof consumed === "string") return { error: consumed };
		return this.issueDevice(consumed.userId);
	}

	/** A browser that is already signed in to Sense. No pairing code. */
	async issueDevice(userId: string): Promise<{ token: string }> {
		const token = this.randomToken();
		const createdAt = this.now();
		await this.store.saveDevice({
			id: this.randomId(),
			userId,
			tokenHash: hashCompanionSecret(token),
			createdAt,
			revokedAt: null,
		});
		return { token };
	}

	async session(
		token: string,
	): Promise<{ ok: true; userId: string; deviceId: string } | null> {
		if (!token) return null;
		const device = await this.store.findActiveDeviceByTokenHash(
			hashCompanionSecret(token),
		);
		if (!device) return null;
		return { ok: true, userId: device.userId, deviceId: device.id };
	}

	async status(userId: string): Promise<{
		paired: boolean;
		devices: { id: string; createdAt: string }[];
	}> {
		const devices = await this.store.listActiveDevices(userId);
		return {
			paired: devices.length > 0,
			devices: devices.map((device) => ({
				id: device.id,
				createdAt: new Date(device.createdAt).toISOString(),
			})),
		};
	}

	async revoke(userId: string): Promise<{ revoked: number }> {
		const revoked = await this.store.revokeActiveDevices(userId, this.now());
		return { revoked };
	}
}

/** In-memory store for route tests. Production uses the Postgres adapter. */
export class MemoryCompanionPairingStore implements CompanionPairingStore {
	private readonly codes = new Map<string, CompanionPairCodeRow>();
	private readonly devices: CompanionDeviceRow[] = [];

	/** True only if a code row stored the typed secret instead of its hash. */
	codesHavePlaintext(plain: string): boolean {
		const normalized = normalizeCompanionCode(plain);
		if (this.codes.has(normalized)) return true;
		return [...this.codes.values()].some((row) => row.codeHash === normalized);
	}

	/** True only if a device row stored the bearer token instead of its hash. */
	devicesHavePlaintext(plain: string): boolean {
		return this.devices.some((row) => row.tokenHash === plain);
	}

	async replaceUnusedCodes(
		userId: string,
		row: CompanionPairCodeRow,
	): Promise<void> {
		for (const [hash, existing] of this.codes) {
			if (existing.userId === userId && existing.consumedAt === null) {
				this.codes.delete(hash);
			}
		}
		this.codes.set(row.codeHash, row);
	}

	async consumeFreshCode(
		codeHash: string,
		now: number,
	): Promise<CompanionPairCodeRow | CompanionPairError> {
		const row = this.codes.get(codeHash);
		if (!row) return "invalid_code";
		if (row.consumedAt !== null) return "already_used";
		if (row.expiresAt <= now) return "expired";
		const consumed = { ...row, consumedAt: now };
		this.codes.set(codeHash, consumed);
		return consumed;
	}

	async saveDevice(row: CompanionDeviceRow): Promise<void> {
		this.devices.push(row);
	}

	async findActiveDeviceByTokenHash(
		tokenHash: string,
	): Promise<CompanionDeviceRow | null> {
		return (
			this.devices.find(
				(row) => row.tokenHash === tokenHash && row.revokedAt === null,
			) ?? null
		);
	}

	async listActiveDevices(userId: string): Promise<CompanionDeviceRow[]> {
		return this.devices.filter(
			(row) => row.userId === userId && row.revokedAt === null,
		);
	}

	async revokeActiveDevices(
		userId: string,
		revokedAt: number,
	): Promise<number> {
		let revoked = 0;
		for (const row of this.devices) {
			if (row.userId === userId && row.revokedAt === null) {
				row.revokedAt = revokedAt;
				revoked += 1;
			}
		}
		return revoked;
	}
}
