import { db, list, listCollaborator, profile } from "@still/db";
import { and, desc, eq, isNull } from "drizzle-orm";

import { isListCollaborator } from "./list-collaborator-access";

export type ListPatronRole = "owner" | "collaborator";

export type PatronListLibraryRow = typeof list.$inferSelect & {
	listRole: ListPatronRole;
	ownerHandle?: string;
	ownerDisplayName?: string;
};

export type ListCollaboratorRow = {
	userId: string;
	handle: string;
	displayName: string;
};

/** Lists this patron was invited to edit — for `/lists` lobby and `GET /api/lists/me`. */
export async function fetchCollaboratedListsForPatron(
	userId: string,
): Promise<PatronListLibraryRow[]> {
	const rows = await db
		.select({
			list,
			ownerHandle: profile.handle,
			ownerDisplayName: profile.displayName,
		})
		.from(listCollaborator)
		.innerJoin(list, eq(listCollaborator.listId, list.id))
		.innerJoin(profile, eq(list.userId, profile.userId))
		.where(and(eq(listCollaborator.userId, userId), isNull(list.removedAt)))
		.orderBy(desc(list.updatedAt));

	return rows.map((row) => ({
		...row.list,
		listRole: "collaborator" as const,
		ownerHandle: row.ownerHandle,
		ownerDisplayName: row.ownerDisplayName,
	}));
}

export async function fetchListCollaborators(
	listId: string,
): Promise<ListCollaboratorRow[]> {
	const rows = await db
		.select({
			userId: listCollaborator.userId,
			handle: profile.handle,
			displayName: profile.displayName,
		})
		.from(listCollaborator)
		.innerJoin(profile, eq(listCollaborator.userId, profile.userId))
		.where(eq(listCollaborator.listId, listId));
	return rows;
}

type InviteResult =
	| { ok: true; collaboratorUserId: string }
	| { ok: false; status: 400 | 404 | 409; error: string };

/** Owner invites another patron by @handle — enables `isCollaborative` on the list. */
export async function inviteListCollaboratorByHandle(input: {
	listId: string;
	ownerUserId: string;
	handle: string;
}): Promise<InviteResult> {
	const normalized = input.handle.trim().toLowerCase().replace(/^@/, "");
	if (!normalized) {
		return { ok: false, status: 400, error: "Handle is required" };
	}

	const [target] = await db
		.select({ userId: profile.userId, handle: profile.handle })
		.from(profile)
		.where(eq(profile.handle, normalized))
		.limit(1);
	if (!target) {
		return { ok: false, status: 404, error: "Patron not found" };
	}
	if (target.userId === input.ownerUserId) {
		return { ok: false, status: 400, error: "You already own this list" };
	}

	const [parent] = await db
		.select({ userId: list.userId })
		.from(list)
		.where(eq(list.id, input.listId))
		.limit(1);
	if (!parent || parent.userId !== input.ownerUserId) {
		return { ok: false, status: 404, error: "List not found" };
	}

	const existing = await isListCollaborator(input.listId, target.userId);
	if (existing) {
		return { ok: false, status: 409, error: "Already a collaborator" };
	}

	await db.insert(listCollaborator).values({
		listId: input.listId,
		userId: target.userId,
		invitedById: input.ownerUserId,
	});

	await db
		.update(list)
		.set({ isCollaborative: true })
		.where(eq(list.id, input.listId));

	return { ok: true, collaboratorUserId: target.userId };
}

export async function removeListCollaborator(input: {
	listId: string;
	ownerUserId: string;
	collaboratorUserId: string;
}): Promise<{ ok: true } | { ok: false; status: 404; error: string }> {
	const [parent] = await db
		.select({ userId: list.userId })
		.from(list)
		.where(eq(list.id, input.listId))
		.limit(1);
	if (!parent || parent.userId !== input.ownerUserId) {
		return { ok: false, status: 404, error: "List not found" };
	}

	await db
		.delete(listCollaborator)
		.where(
			and(
				eq(listCollaborator.listId, input.listId),
				eq(listCollaborator.userId, input.collaboratorUserId),
			),
		);

	const remaining = await fetchListCollaborators(input.listId);
	if (remaining.length === 0) {
		await db
			.update(list)
			.set({ isCollaborative: false })
			.where(eq(list.id, input.listId));
	}

	return { ok: true };
}
