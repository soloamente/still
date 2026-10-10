/**
 * Optional public store listings. Until set, the intro page shows Coming soon
 * and still teaches install + pair.
 */
export function companionChromeStoreUrl(): string | null {
	const value = process.env.NEXT_PUBLIC_COMPANION_CHROME_STORE_URL?.trim();
	return value && value.length > 0 ? value : null;
}

export function companionEdgeStoreUrl(): string | null {
	const value = process.env.NEXT_PUBLIC_COMPANION_EDGE_STORE_URL?.trim();
	return value && value.length > 0 ? value : null;
}
