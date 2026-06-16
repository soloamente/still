import type { PatronActivityState } from "@/lib/patron-activity-tracker";

export const PATRON_ACTIVITY_TAB_CHANNEL = "still:patron-activity";

/** Drop tab entries that stopped heartbeating (crashed tab). */
export const PATRON_ACTIVITY_TAB_STALE_MS = 45_000;

export type PatronActivityTabEntry = {
	state: PatronActivityState;
	at: number;
};

export type PatronActivityTabMessage =
	| {
			type: "state";
			tabId: string;
			state: PatronActivityState;
			at: number;
	  }
	| {
			type: "leave";
			tabId: string;
			at: number;
	  };

/**
 * User-global activity — active when any Sense tab is visible and not idle.
 * Stale tab rows are ignored so crashed tabs do not pin away forever.
 */
export function aggregatePatronActivityFromTabs(
	tabs: ReadonlyMap<string, PatronActivityTabEntry>,
	nowMs: number = Date.now(),
	staleMs: number = PATRON_ACTIVITY_TAB_STALE_MS,
): PatronActivityState {
	let sawLiveTab = false;

	for (const entry of tabs.values()) {
		if (nowMs - entry.at > staleMs) continue;
		sawLiveTab = true;
		if (entry.state === "active") return "active";
	}

	return sawLiveTab ? "away" : "away";
}

function readPersistedTabId(storage: Storage): string | null {
	try {
		const existing = storage.getItem("still:patron-activity-tab-id");
		return existing?.trim() ? existing : null;
	} catch {
		return null;
	}
}

/** Stable per-tab id — survives reloads within the same tab. */
export function resolvePatronActivityTabId(): string {
	if (typeof window === "undefined") return "ssr";

	const storage = window.sessionStorage;
	const existing = readPersistedTabId(storage);
	if (existing) return existing;

	const tabId =
		typeof crypto !== "undefined" && "randomUUID" in crypto
			? crypto.randomUUID()
			: `tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;

	try {
		storage.setItem("still:patron-activity-tab-id", tabId);
	} catch {
		// Private mode — still works for this session with in-memory id only.
	}

	return tabId;
}

type AggregateListener = (state: PatronActivityState) => void;

/**
 * BroadcastChannel sync across Sense tabs — one patron can have many tabs;
 * aggregate active wins over a single hidden tab posting away.
 */
export class PatronActivityTabSync {
	private readonly tabId: string;
	private readonly tabs = new Map<string, PatronActivityTabEntry>();
	private readonly listeners = new Set<AggregateListener>();
	private readonly channel: BroadcastChannel | null;
	private aggregateState: PatronActivityState = "active";

	constructor(tabId: string = resolvePatronActivityTabId()) {
		this.tabId = tabId;

		if (typeof BroadcastChannel !== "undefined") {
			this.channel = new BroadcastChannel(PATRON_ACTIVITY_TAB_CHANNEL);
			this.channel.onmessage = (
				event: MessageEvent<PatronActivityTabMessage>,
			) => {
				this.applyMessage(event.data);
			};
		} else {
			this.channel = null;
		}
	}

	subscribe(listener: AggregateListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	readAggregateState(): PatronActivityState {
		return this.aggregateState;
	}

	/** Local tab state changed — rebroadcast and maybe flip aggregate. */
	publishLocalState(state: PatronActivityState, at: number = Date.now()): void {
		this.tabs.set(this.tabId, { state, at });
		this.broadcast({
			type: "state",
			tabId: this.tabId,
			state,
			at,
		});
		this.recomputeAggregate(at);
	}

	/** Tab closed — drop our row so a visible sibling can keep aggregate active. */
	publishLeave(at: number = Date.now()): void {
		this.tabs.delete(this.tabId);
		this.broadcast({
			type: "leave",
			tabId: this.tabId,
			at,
		});
		this.recomputeAggregate(at);
	}

	destroy(): void {
		this.publishLeave();
		this.channel?.close();
		this.listeners.clear();
	}

	private broadcast(message: PatronActivityTabMessage): void {
		try {
			this.channel?.postMessage(message);
		} catch {
			// Channel closed during teardown.
		}
	}

	private applyMessage(message: PatronActivityTabMessage | undefined): void {
		if (!message?.tabId) return;

		if (message.type === "leave") {
			this.tabs.delete(message.tabId);
		} else {
			this.tabs.set(message.tabId, {
				state: message.state,
				at: message.at,
			});
		}

		this.recomputeAggregate(message.at);
	}

	private recomputeAggregate(at: number): void {
		const next = aggregatePatronActivityFromTabs(this.tabs, at);
		if (next === this.aggregateState) return;
		this.aggregateState = next;
		for (const listener of this.listeners) {
			listener(next);
		}
	}
}
