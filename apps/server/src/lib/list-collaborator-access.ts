import { db, listCollaborator } from "@still/db";
import { and, eq } from "drizzle-orm";

/** True when the patron may reorder items, edit notes, or add/remove titles. */
export async function canEditList(
	userId: string | undefined,
	listRow: { id: string; userId: string } | null | undefined,
): Promise<boolean> {
	if (!userId || !listRow) return false;
	if (listRow.userId === userId) return true;
	return isListCollaborator(listRow.id, userId);
}

export async function isListCollaborator(
	listId: string,
	userId: string,
): Promise<boolean> {
	const [row] = await db
		.select({ userId: listCollaborator.userId })
		.from(listCollaborator)
		.where(
			and(
				eq(listCollaborator.listId, listId),
				eq(listCollaborator.userId, userId),
			),
		)
		.limit(1);
	return Boolean(row);
}
