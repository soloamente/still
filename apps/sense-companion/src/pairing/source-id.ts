/** One id per browser profile, so two browsers do not overwrite each other's title. */
export const COMPANION_SOURCE_ID_KEY = "senseCompanionSourceId";

export type CompanionSourceIdStore = {
	get(): Promise<string | null>;
	set(id: string): Promise<void>;
};

/** Reuse the stored id. A new browser profile gets its own. */
export async function companionSourceId(
	store: CompanionSourceIdStore,
	randomId: () => string = () => crypto.randomUUID(),
): Promise<string> {
	const existing = await store.get();
	if (existing) return existing;
	const id = randomId();
	await store.set(id);
	return id;
}
