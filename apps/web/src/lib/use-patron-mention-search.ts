"use client";

import { useProfileSearch } from "@/lib/use-profile-search";

/** Debounced patron profile typeahead for `@handle`-like mention queries. */
export function usePatronMentionSearch(query: string, enabled: boolean) {
	return useProfileSearch(query, enabled);
}
