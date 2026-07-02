import type { ListingPresenceRedis } from "./listing-presence";
import { isRealtimePublishEnabled } from "./realtime-redis";

type ZsetEntry = { score: number; member: string };

/** Survive Bun dev reload — one in-process presence store per process. */
const globalForPresenceDev = globalThis as typeof globalThis & {
	__stillPresenceDevStore?: PresenceDevStore;
};

/**
 * In-memory ZSET + HASH shim for local dev when Upstash env is unset.
 * Mirrors the Redis surface used by listing / patron presence heartbeats.
 */
class PresenceDevStore implements ListingPresenceRedis {
	private readonly zsets = new Map<string, ZsetEntry[]>();
	private readonly hashes = new Map<string, Map<string, string>>();

	async zadd(
		key: string,
		entry: { score: number; member: string },
	): Promise<void> {
		const rows = this.zsets.get(key) ?? [];
		const without = rows.filter((row) => row.member !== entry.member);
		without.push(entry);
		without.sort((a, b) => a.score - b.score);
		this.zsets.set(key, without);
	}

	async zremrangebyscore(key: string, min: number, max: number): Promise<void> {
		const rows = this.zsets.get(key);
		if (!rows) return;
		this.zsets.set(
			key,
			rows.filter((row) => row.score < min || row.score > max),
		);
	}

	async zrem(key: string, member: string): Promise<void> {
		const rows = this.zsets.get(key);
		if (!rows) return;
		this.zsets.set(
			key,
			rows.filter((row) => row.member !== member),
		);
	}

	async zcard(key: string): Promise<number> {
		return this.zsets.get(key)?.length ?? 0;
	}

	async zrange(key: string, start: number, stop: number): Promise<string[]> {
		const rows = this.zsets.get(key) ?? [];
		const end = stop < 0 ? rows.length + stop + 1 : stop + 1;
		return rows.slice(start, end).map((row) => row.member);
	}

	/** TTL is a no-op locally — stale members are pruned on read via zremrangebyscore. */
	async expire(_key: string, _seconds: number): Promise<void> {}

	async hset(key: string, values: Record<string, string>): Promise<void> {
		const hash = this.hashes.get(key) ?? new Map<string, string>();
		for (const [field, value] of Object.entries(values)) {
			hash.set(field, value);
		}
		this.hashes.set(key, hash);
	}

	async hget(key: string, field: string): Promise<string | null> {
		return this.hashes.get(key)?.get(field) ?? null;
	}

	async hdel(key: string, field: string): Promise<void> {
		this.hashes.get(key)?.delete(field);
	}
}

function getPresenceDevStore(): PresenceDevStore {
	if (!globalForPresenceDev.__stillPresenceDevStore) {
		globalForPresenceDev.__stillPresenceDevStore = new PresenceDevStore();
	}
	return globalForPresenceDev.__stillPresenceDevStore;
}

/** True when presence heartbeats should use the in-process dev store. */
export function shouldUsePresenceDevStore(): boolean {
	return process.env.NODE_ENV !== "production" && !isRealtimePublishEnabled();
}

/** Dev-only Redis shim — null in production when Upstash is unset. */
export function getPresenceDevStoreIfEnabled(): ListingPresenceRedis | null {
	if (!shouldUsePresenceDevStore()) return null;
	return getPresenceDevStore();
}
