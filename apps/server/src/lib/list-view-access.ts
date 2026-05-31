import { isListCollaborator } from "./list-collaborator-access";

/** Minimal list fields needed for read access checks (ST.1 SEO + privacy). */
export type ListViewAccessRow = {
	id: string;
	isPublic: boolean;
	userId: string;
};

/**
 * Public lists are readable by anyone; private lists by the owner or invited collaborators.
 * Returns false for anonymous and non-member viewers (caller should respond 404).
 */
export async function canViewList(
	list: ListViewAccessRow,
	viewerUserId: string | null | undefined,
): Promise<boolean> {
	if (list.isPublic) return true;
	if (!viewerUserId) return false;
	if (viewerUserId === list.userId) return true;
	return isListCollaborator(list.id, viewerUserId);
}
