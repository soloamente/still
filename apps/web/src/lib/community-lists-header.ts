/** Community lists subsection — `{n} popular lists` under the period filter. */
export function formatCommunityListsHeader(total: number): string {
	const n = Math.max(0, Math.floor(total));
	const formatted = n.toLocaleString("en-US");
	return `${formatted} popular list${n === 1 ? "" : "s"}`;
}
