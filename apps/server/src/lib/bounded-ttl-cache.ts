/**
 * Small in-process TTL cache with a hard entry cap. Map insertion order doubles
 * as age order, so eviction drops the oldest write first — the cache can never
 * grow past `maxEntries` no matter how many patrons hit it.
 */
export class BoundedTtlCache<V> {
	private readonly entries = new Map<string, { at: number; value: V }>();

	constructor(
		private readonly ttlMs: number,
		private readonly maxEntries: number,
		private readonly now: () => number = Date.now,
	) {}

	get(key: string): V | undefined {
		const hit = this.entries.get(key);
		if (!hit) return undefined;
		if (this.now() - hit.at >= this.ttlMs) {
			this.entries.delete(key);
			return undefined;
		}
		return hit.value;
	}

	set(key: string, value: V): void {
		// Re-insert so a refreshed key moves to the young end of the order.
		this.entries.delete(key);
		while (this.entries.size >= this.maxEntries) {
			const oldest = this.entries.keys().next();
			if (oldest.done) break;
			this.entries.delete(oldest.value);
		}
		this.entries.set(key, { at: this.now(), value });
	}

	delete(key: string): void {
		this.entries.delete(key);
	}

	/** Drop every key starting with `prefix` (e.g. all of one patron's slices). */
	deletePrefix(prefix: string): void {
		for (const key of [...this.entries.keys()]) {
			if (key.startsWith(prefix)) this.entries.delete(key);
		}
	}

	get size(): number {
		return this.entries.size;
	}
}
