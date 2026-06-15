/** Share copy toast — includes list title so patrons know what they copied. */
export function listShareCopiedToastMessage(listTitle: string): string {
	const trimmed = listTitle.trim();
	if (!trimmed) return "Copied link";
	return `Copied link · ${trimmed}`;
}
