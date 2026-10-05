import { companionDevice, companionPairCode, db } from "@still/db";
import { and, eq, gt, isNull } from "drizzle-orm";

import type {
	CompanionDeviceRow,
	CompanionPairCodeRow,
	CompanionPairError,
	CompanionPairingStore,
} from "./companion-pairing";

function codeRow(row: {
	userId: string;
	codeHash: string;
	expiresAt: Date;
	consumedAt: Date | null;
}): CompanionPairCodeRow {
	return {
		userId: row.userId,
		codeHash: row.codeHash,
		expiresAt: row.expiresAt.getTime(),
		consumedAt: row.consumedAt ? row.consumedAt.getTime() : null,
	};
}

function deviceRow(row: {
	id: string;
	userId: string;
	tokenHash: string;
	createdAt: Date;
	revokedAt: Date | null;
}): CompanionDeviceRow {
	return {
		id: row.id,
		userId: row.userId,
		tokenHash: row.tokenHash,
		createdAt: row.createdAt.getTime(),
		revokedAt: row.revokedAt ? row.revokedAt.getTime() : null,
	};
}

/** Postgres store. Pairing is rare; now-watching heartbeats stay out of Neon. */
export const drizzleCompanionPairingStore: CompanionPairingStore = {
	async replaceUnusedCodes(userId, row) {
		await db
			.delete(companionPairCode)
			.where(
				and(
					eq(companionPairCode.userId, userId),
					isNull(companionPairCode.consumedAt),
				),
			);
		await db.insert(companionPairCode).values({
			codeHash: row.codeHash,
			userId: row.userId,
			expiresAt: new Date(row.expiresAt),
			consumedAt: null,
		});
	},

	async consumeFreshCode(codeHash, now) {
		const consumed = await db
			.update(companionPairCode)
			.set({ consumedAt: new Date(now) })
			.where(
				and(
					eq(companionPairCode.codeHash, codeHash),
					isNull(companionPairCode.consumedAt),
					gt(companionPairCode.expiresAt, new Date(now)),
				),
			)
			.returning();
		const winner = consumed[0];
		if (winner) return codeRow(winner);

		const existing = await db
			.select()
			.from(companionPairCode)
			.where(eq(companionPairCode.codeHash, codeHash))
			.limit(1);
		const row = existing[0];
		if (!row) return "invalid_code" satisfies CompanionPairError;
		if (row.consumedAt) return "already_used" satisfies CompanionPairError;
		return "expired" satisfies CompanionPairError;
	},

	async saveDevice(row) {
		await db.insert(companionDevice).values({
			id: row.id,
			userId: row.userId,
			tokenHash: row.tokenHash,
			createdAt: new Date(row.createdAt),
			revokedAt: null,
		});
	},

	async findActiveDeviceByTokenHash(tokenHash) {
		const rows = await db
			.select()
			.from(companionDevice)
			.where(
				and(
					eq(companionDevice.tokenHash, tokenHash),
					isNull(companionDevice.revokedAt),
				),
			)
			.limit(1);
		const row = rows[0];
		return row ? deviceRow(row) : null;
	},

	async listActiveDevices(userId) {
		const rows = await db
			.select()
			.from(companionDevice)
			.where(
				and(
					eq(companionDevice.userId, userId),
					isNull(companionDevice.revokedAt),
				),
			);
		return rows.map(deviceRow);
	},

	async revokeActiveDevices(userId, revokedAt) {
		const rows = await db
			.update(companionDevice)
			.set({ revokedAt: new Date(revokedAt) })
			.where(
				and(
					eq(companionDevice.userId, userId),
					isNull(companionDevice.revokedAt),
				),
			)
			.returning({ id: companionDevice.id });
		return rows.length;
	},
};
