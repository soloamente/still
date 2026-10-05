# Auto-log countdown toast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show one playback pill that says how many minutes are left before Sense logs the title, then shrinks into a countdown ring that freezes on pause.

**Architecture:** A pure function decides hidden, sentence, or clock from the playhead and a small piece of state. A shadow-DOM pill paints that decision. The Netflix-class content script and the generic video content script call it on the ticks they already emit.

**Tech Stack:** TypeScript, WXT content scripts, `bun test`. No new dependencies.

## Global Constraints

- One pill, two phases. Not two toasts.
- Appear only when remaining time until the log point is **greater than 0** and **at most 15 minutes**.
- Log point stays **90%** of runtime (`COMPANION_AUTO_LOG_RATIO`) and runtime must be **at least 10 minutes** (`COMPANION_AUTO_LOG_MIN_DURATION_SEC`).
- Sentence copy is **Log in** plus a badge such as **12 min**. No **Keep?**.
- Sentence lasts **4 seconds**, then the same pill becomes the clock.
- Clock text is time left (`12:04`, `0:42`). The ring fills across the 15-minute window.
- Pause freezes the digits and the ring. The pill stays.
- Seeking so that more than 15 minutes remain hides the pill. Seeking back in shows the clock only.
- At the log point, or when a logged notice arrives, the pill hides. The existing rate toast is unchanged.
- Unpaired browsers never see the pill. Until pairing is known, it stays hidden.
- Hourglass fill is **`#e8a854`**.
- The width change takes **220ms**, and is instant under `prefers-reduced-motion`.
- Do not change the Watching playback notice, the rate toast, or Discord.

---

### Task 1: Countdown math

**Files:**
- Create: `apps/sense-companion/src/presence/autolog-countdown.ts`
- Test: `apps/sense-companion/src/presence/autolog-countdown.test.ts`

**Interfaces:**
- Consumes: `COMPANION_AUTO_LOG_RATIO` and `COMPANION_AUTO_LOG_MIN_DURATION_SEC` from `apps/sense-companion/src/pairing/now-watching.ts`
- Produces:
  - `AUTOLOG_COUNTDOWN_WINDOW_SEC = 15 * 60`
  - `AUTOLOG_SENTENCE_MS = 4_000`
  - `emptyAutologCountdownState(): AutologCountdownState`
  - `autologRemainingSec(positionSec: number | null, durationSec: number | null): number | null`
  - `formatAutologMinutes(remainingSec: number): string`
  - `formatAutologClock(remainingSec: number): string`
  - `autologRingProgress(remainingSec: number): number`
  - `nextAutologCountdown(input: { state: AutologCountdownState; now: number; paired: boolean; paused: boolean; logged: boolean; media: AutologMediaClock | null }): { state: AutologCountdownState; phase: "hidden" | "sentence" | "clock"; remainingSec: number | null }`
  - `AutologCountdownState` is `{ key: string | null; sentenceShown: boolean; sentenceStartedAt: number | null; frozenRemainingSec: number | null }`
  - `AutologMediaClock` is `{ provider: string; kind: string; title: string; season: number | null; episode: number | null; positionSec: number | null; durationSec: number | null }`

- [ ] **Step 1: Write the failing test**

Create `apps/sense-companion/src/presence/autolog-countdown.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import {
	AUTOLOG_SENTENCE_MS,
	autologRemainingSec,
	autologRingProgress,
	emptyAutologCountdownState,
	formatAutologClock,
	formatAutologMinutes,
	nextAutologCountdown,
	type AutologMediaClock,
} from "./autolog-countdown";

function media(remainingSec: number, episode = 1): AutologMediaClock {
	const durationSec = 6_000;
	return {
		provider: "netflix",
		kind: "episode",
		title: "The Penguin",
		season: 1,
		episode,
		positionSec: durationSec * 0.9 - remainingSec,
		durationSec,
	};
}

describe("autolog countdown", () => {
	test("remaining time is 90 percent of the runtime minus the playhead", () => {
		expect(autologRemainingSec(5_300, 6_000)).toBe(100);
		expect(autologRemainingSec(null, 6_000)).toBeNull();
		expect(autologRemainingSec(100, 500)).toBeNull();
		expect(autologRemainingSec(Number.NaN, 6_000)).toBeNull();
	});

	test("the badge rounds up and the clock pads seconds", () => {
		expect(formatAutologMinutes(12 * 60)).toBe("12 min");
		expect(formatAutologMinutes(61)).toBe("2 min");
		expect(formatAutologMinutes(1)).toBe("1 min");
		expect(formatAutologClock(12 * 60 + 4)).toBe("12:04");
		expect(formatAutologClock(42)).toBe("0:42");
		expect(autologRingProgress(15 * 60)).toBe(0);
		expect(autologRingProgress(0)).toBe(1);
		expect(autologRingProgress(7.5 * 60)).toBeCloseTo(0.5);
	});

	test("the first time inside the window is the sentence", () => {
		const decision = nextAutologCountdown({
			state: emptyAutologCountdownState(),
			now: 1_000,
			paired: true,
			paused: false,
			logged: false,
			media: media(12 * 60),
		});
		expect(decision.phase).toBe("sentence");
		expect(decision.remainingSec).toBe(12 * 60);
		expect(decision.state.sentenceStartedAt).toBe(1_000);
	});

	test("four seconds later the same title is the clock", () => {
		const first = nextAutologCountdown({
			state: emptyAutologCountdownState(),
			now: 1_000,
			paired: true,
			paused: false,
			logged: false,
			media: media(12 * 60),
		});
		const later = nextAutologCountdown({
			state: first.state,
			now: 1_000 + AUTOLOG_SENTENCE_MS,
			paired: true,
			paused: false,
			logged: false,
			media: media(11 * 60),
		});
		expect(later.phase).toBe("clock");
		expect(later.state.sentenceShown).toBe(true);
		expect(later.remainingSec).toBe(11 * 60);
	});

	test("pause keeps the last remaining time", () => {
		const playing = nextAutologCountdown({
			state: emptyAutologCountdownState(),
			now: 1_000,
			paired: true,
			paused: false,
			logged: false,
			media: media(100),
		});
		const paused = nextAutologCountdown({
			state: playing.state,
			now: 2_000,
			paired: true,
			paused: true,
			logged: false,
			media: media(80),
		});
		expect(paused.remainingSec).toBe(100);
		const still = nextAutologCountdown({
			state: paused.state,
			now: 3_000,
			paired: true,
			paused: true,
			logged: false,
			media: media(40),
		});
		expect(still.remainingSec).toBe(100);
	});

	test("seeking out hides the pill and seeking back skips the sentence", () => {
		const first = nextAutologCountdown({
			state: emptyAutologCountdownState(),
			now: 1_000,
			paired: true,
			paused: false,
			logged: false,
			media: media(12 * 60),
		});
		const shown = nextAutologCountdown({
			state: first.state,
			now: 1_000 + AUTOLOG_SENTENCE_MS,
			paired: true,
			paused: false,
			logged: false,
			media: media(12 * 60),
		});
		expect(shown.phase).toBe("clock");
		const outside = nextAutologCountdown({
			state: shown.state,
			now: 9_000,
			paired: true,
			paused: false,
			logged: false,
			media: media(16 * 60),
		});
		expect(outside.phase).toBe("hidden");
		const back = nextAutologCountdown({
			state: outside.state,
			now: 10_000,
			paired: true,
			paused: false,
			logged: false,
			media: media(12 * 60),
		});
		expect(back.phase).toBe("clock");
	});

	test("pause does not restart the sentence timer", () => {
		const first = nextAutologCountdown({
			state: emptyAutologCountdownState(),
			now: 1_000,
			paired: true,
			paused: false,
			logged: false,
			media: media(100),
		});
		const paused = nextAutologCountdown({
			state: first.state,
			now: 1_000 + AUTOLOG_SENTENCE_MS,
			paired: true,
			paused: true,
			logged: false,
			media: media(90),
		});
		expect(paused.phase).toBe("clock");
		expect(paused.remainingSec).toBe(100);
	});

	test("a new episode shows the sentence again", () => {
		const shown = nextAutologCountdown({
			state: emptyAutologCountdownState(),
			now: 5_000,
			paired: true,
			paused: false,
			logged: false,
			media: media(12 * 60, 1),
		});
		const finished = nextAutologCountdown({
			state: shown.state,
			now: 5_000 + AUTOLOG_SENTENCE_MS,
			paired: true,
			paused: false,
			logged: false,
			media: media(12 * 60, 1),
		});
		const nextEpisode = nextAutologCountdown({
			state: finished.state,
			now: 9_000,
			paired: true,
			paused: false,
			logged: false,
			media: media(12 * 60, 2),
		});
		expect(nextEpisode.phase).toBe("sentence");
	});

	test("unpaired, logged, too early, and finished all hide", () => {
		const base = {
			state: emptyAutologCountdownState(),
			now: 1_000,
			paused: false,
			media: media(12 * 60),
		};
		expect(
			nextAutologCountdown({ ...base, paired: false, logged: false }).phase,
		).toBe("hidden");
		expect(
			nextAutologCountdown({ ...base, paired: true, logged: true }).phase,
		).toBe("hidden");
		expect(
			nextAutologCountdown({
				...base,
				paired: true,
				logged: false,
				media: media(16 * 60),
			}).phase,
		).toBe("hidden");
		expect(
			nextAutologCountdown({
				...base,
				paired: true,
				logged: false,
				media: media(0),
			}).phase,
		).toBe("hidden");
		expect(
			nextAutologCountdown({
				...base,
				paired: true,
				logged: false,
				media: null,
			}).phase,
		).toBe("hidden");
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `apps/sense-companion`:

```bash
bun test src/presence/autolog-countdown.test.ts
```

Expected: FAIL because `./autolog-countdown` does not exist.

- [ ] **Step 3: Write the implementation**

Create `apps/sense-companion/src/presence/autolog-countdown.ts`:

```typescript
import {
	COMPANION_AUTO_LOG_MIN_DURATION_SEC,
	COMPANION_AUTO_LOG_RATIO,
} from "../pairing/now-watching";

export const AUTOLOG_COUNTDOWN_WINDOW_SEC = 15 * 60;
export const AUTOLOG_SENTENCE_MS = 4_000;

export type AutologCountdownState = {
	key: string | null;
	sentenceShown: boolean;
	sentenceStartedAt: number | null;
	frozenRemainingSec: number | null;
};

export type AutologMediaClock = {
	provider: string;
	kind: string;
	title: string;
	season: number | null;
	episode: number | null;
	positionSec: number | null;
	durationSec: number | null;
};

export type AutologCountdownPhase = "hidden" | "sentence" | "clock";

export function emptyAutologCountdownState(): AutologCountdownState {
	return {
		key: null,
		sentenceShown: false,
		sentenceStartedAt: null,
		frozenRemainingSec: null,
	};
}

/** Seconds until the 90% log point. Null when this title cannot log. */
export function autologRemainingSec(
	positionSec: number | null,
	durationSec: number | null,
): number | null {
	if (positionSec == null || durationSec == null) return null;
	if (!Number.isFinite(positionSec) || !Number.isFinite(durationSec)) return null;
	if (durationSec < COMPANION_AUTO_LOG_MIN_DURATION_SEC) return null;
	if (positionSec < 0 || positionSec > durationSec + 30) return null;
	return durationSec * COMPANION_AUTO_LOG_RATIO - positionSec;
}

export function formatAutologMinutes(remainingSec: number): string {
	const minutes = Math.max(1, Math.ceil(remainingSec / 60));
	return `${minutes} min`;
}

export function formatAutologClock(remainingSec: number): string {
	const total = Math.max(0, Math.ceil(remainingSec));
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** 0 at 15 minutes left, 1 at the log point. */
export function autologRingProgress(remainingSec: number): number {
	const used = 1 - remainingSec / AUTOLOG_COUNTDOWN_WINDOW_SEC;
	return Math.min(1, Math.max(0, used));
}

function titleKey(media: AutologMediaClock): string {
	return [
		media.provider,
		media.kind,
		media.title.trim().toLowerCase(),
		media.season ?? "",
		media.episode ?? "",
	].join("\0");
}

function inWindow(remaining: number | null): remaining is number {
	return (
		remaining != null &&
		remaining > 0 &&
		remaining <= AUTOLOG_COUNTDOWN_WINDOW_SEC
	);
}

export function nextAutologCountdown(input: {
	state: AutologCountdownState;
	now: number;
	paired: boolean;
	paused: boolean;
	logged: boolean;
	media: AutologMediaClock | null;
}): {
	state: AutologCountdownState;
	phase: AutologCountdownPhase;
	remainingSec: number | null;
} {
	if (!input.paired || input.logged || input.media == null) {
		return {
			state: input.media == null ? emptyAutologCountdownState() : input.state,
			phase: "hidden",
			remainingSec: null,
		};
	}
	const key = titleKey(input.media);
	const sameKey = input.state.key === key;
	const live = autologRemainingSec(
		input.media.positionSec,
		input.media.durationSec,
	);
	if (!inWindow(live)) {
		return {
			state: {
				key,
				sentenceShown: sameKey ? input.state.sentenceShown : false,
				sentenceStartedAt: null,
				frozenRemainingSec: null,
			},
			phase: "hidden",
			remainingSec: null,
		};
	}
	const remembered = sameKey ? input.state.frozenRemainingSec : null;
	const remainingSec = input.paused ? (remembered ?? live) : live;
	let sentenceShown = sameKey ? input.state.sentenceShown : false;
	let sentenceStartedAt = sameKey ? input.state.sentenceStartedAt : null;
	let phase: AutologCountdownPhase = "clock";
	if (!sentenceShown) {
		if (sentenceStartedAt == null) sentenceStartedAt = input.now;
		if (input.now - sentenceStartedAt >= AUTOLOG_SENTENCE_MS) {
			sentenceShown = true;
			sentenceStartedAt = null;
			phase = "clock";
		} else {
			phase = "sentence";
		}
	}
	return {
		state: {
			key,
			sentenceShown,
			sentenceStartedAt,
			frozenRemainingSec: remainingSec,
		},
		phase,
		remainingSec,
	};
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run from `apps/sense-companion`:

```bash
bun test src/presence/autolog-countdown.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/sense-companion/src/presence/autolog-countdown.ts apps/sense-companion/src/presence/autolog-countdown.test.ts
git commit -m "feat: decide when the auto-log countdown pill shows"
```

---

### Task 2: Countdown pill

**Files:**
- Create: `apps/sense-companion/src/presence/autolog-countdown-view.ts`
- Modify: none

**Interfaces:**
- Consumes: `formatAutologClock`, `formatAutologMinutes`, `autologRingProgress`, and `AutologCountdownPhase` from Task 1
- Produces: `syncAutologCountdownPill(input: { phase: AutologCountdownPhase; remainingSec: number | null }): void`

The view is painted by the content scripts. Task 1 already locks the words, the clock text, and the ring amount. This task only draws them. There is no DOM test runner in this package.

- [ ] **Step 1: Write the pill**

Create `apps/sense-companion/src/presence/autolog-countdown-view.ts` with a shadow host id `sense-companion-autolog-toast`, placed at `top: 68px; right: 16px` so the Watching notice at `top: 20px` can sit above it.

The host is created once and updated in place. `phase: "hidden"` removes it. `sentence` shows the hourglass, the word **Log in**, and a badge from `formatAutologMinutes`. `clock` hides those three and shows `formatAutologClock`. Set `--progress` on the shell from `autologRingProgress`. The ring is a 2px conic-gradient mask, empty at 0 and full at 1, starting at the top (`from -90deg`).

Hourglass path (fill `currentColor`, color `#e8a854`):

```typescript
const HOURGLASS_PATH =
	"m4.502,3.0625l.1499,2.3984c.0811,1.291.6489,2.4849,1.5991,3.3623l1.2749,1.1768-1.2749,1.1768c-.9502.8774-1.5181,2.0713-1.5991,3.3623l-.1499,2.3984c-.0013.0214.0089.0411.0089.0625h10.9783c0-.0214.0103-.0411.0089-.0625l-.1499-2.3984c-.0811-1.291-.6489-2.4849-1.5991-3.3623l-1.2749-1.1768,1.2749-1.1768c.9502-.8774,1.5181-2.0713,1.5991-3.3623l.1499-2.3984c.0013-.0214-.0089-.0411-.0089-.0625H4.5109c0,.0214-.0103.0411-.0089.0625Zm5.2095,9.4951c.1846-.0771.3926-.0771.5771,0,1.1963.4985,2.0093,1.3179,2.416,2.436.084.23.0503.4863-.0903.6865-.1401.2007-.3696.3198-.6143.3198h-4c-.2446,0-.4741-.1191-.6143-.3198-.1406-.2002-.1743-.4565-.0903-.6865.4067-1.1182,1.2197-1.9375,2.416-2.436Z";
```

Also draw the two caps as lines from `(4,3)` to `(16,3)` and `(4,17)` to `(16,17)`, stroke `#e8a854`, stroke-width 2, round caps. View box `0 0 20 20`, size 20×20.

Shell styles match the playback notice: background `#2e2e30`, white 15px weight 600, line-height 1.35, padding `10px 14px 10px 10px`, `border-radius: 999px`, `font-variant-numeric: tabular-nums`. The badge is `#3a3a3c`, color `#fff`, `border-radius: 999px`, padding `4px 8px`, font-size 13px. The words, badge, and icon use `max-width` plus opacity, transitioning those for 220ms, so the clock phase can collapse them. Under `prefers-reduced-motion: reduce`, that transition is `none`.

`role="status"`. The accessible name is `Log in. 12 min.` during the sentence and `12:04 left to log.` during the clock.

Do not auto-dismiss this host. Do not add the Watching notice’s hover timer.

- [ ] **Step 2: Build**

Run from `apps/sense-companion`:

```bash
bun test src/presence/autolog-countdown.test.ts
bun run build
```

Expected: tests PASS, WXT build finishes without a type error.

- [ ] **Step 3: Commit**

```bash
git add apps/sense-companion/src/presence/autolog-countdown-view.ts
git commit -m "feat: paint the auto-log countdown pill"
```

---

### Task 3: Drive the pill from playback

**Files:**
- Modify: `apps/sense-companion/entrypoints/streaming.content.ts`
- Modify: `apps/sense-companion/entrypoints/generic-video.content.ts`

**Interfaces:**
- Consumes: `emptyAutologCountdownState`, `nextAutologCountdown`, `AutologMediaClock` from Task 1, and `syncAutologCountdownPill` from Task 2
- Produces: no new exports. Both content scripts update the pill on every playback tick.

- [ ] **Step 1: Update the streaming page**

In `streaming.content.ts`, import the Task 1 and Task 2 symbols. Next to `toastState`, add:

```typescript
let autologState = emptyAutologCountdownState();
let autologPaired: boolean | null = null;
let autologLogged = false;
```

Add this function beside `confirmWatchDelivery`:

```typescript
function paintAutolog(
	message: CompanionActivityMessage,
	paused: boolean,
): void {
	const sense = message.type === "sense-companion:activity" ? message.senseMedia : null;
	const media: AutologMediaClock | null = sense
		? {
				provider: sense.provider,
				kind: sense.kind,
				title: sense.title,
				season: sense.season,
				episode: sense.episode,
				positionSec: sense.positionSec,
				durationSec: sense.durationSec,
			}
		: null;
	const decision = nextAutologCountdown({
		state: autologState,
		now: Date.now(),
		paired: autologPaired === true,
		paused,
		logged: autologLogged,
		media,
	});
	if (decision.state.key !== autologState.key) autologLogged = false;
	autologState = decision.state;
	syncAutologCountdownPill(decision);
}
```

In `handleLoggedNotice`, after the existing id check, set `autologLogged = true` and call `syncAutologCountdownPill({ phase: "hidden", remainingSec: null })`.

In the `emit` callback, `paused` is `message.type === "sense-companion:activity" && message.activity.smallImageText === "Paused"` OR the small image key ends with `/pause.png` (the same pause check `activityIsPaused` already uses — import it from `activity-log` and call `activityIsPaused(message.activity)` when the message is an activity). Call `paintAutolog` on every emit, including the branch that returns early for the Watching toast.

When `confirmWatchDelivery` resolves, set `autologPaired = ok` and call `paintAutolog` again so a paired save can reveal the pill without waiting for the next tick.

If `autologPaired` is still `null` and `media` is non-null, call `confirmWatchDelivery` once (keep a `let autologProbe: Promise<void> | null` so ticks do not stack probes). Do not call `showWatchToast` from that probe. The existing Watching toast path still calls `showWatchToast`.

- [ ] **Step 2: Update the generic player**

In `generic-video.content.ts`, add the same `autologState`, `autologPaired`, `autologLogged`, and `paintAutolog`. Copy the `confirmWatchDelivery` / `isWatchResult` pair from `streaming.content.ts` so a probe can learn pairing. Generic playback does not currently ask the helper; the probe is the first time this page learns it.

Call `paintAutolog(message, video.paused)` inside `tick` after the message is built, and on the clear path pass a `sense-companion:clear` message so the pill hides and the state resets. In `handleLoggedNotice`, hide the pill the same way as streaming.

Do not change `showWatchToast(watchToastCopy(watch), true)`.

- [ ] **Step 3: Build**

Run from `apps/sense-companion`:

```bash
bun test src/presence/autolog-countdown.test.ts
bun run build
```

Expected: tests PASS and the WXT build finishes.

- [ ] **Step 4: Manual check**

Reload the unpacked extension from `apps/sense-companion/.output/chrome-mv3`. Play a paired title that is at least 10 minutes long and scrub to about 12 minutes before the 90% mark.

- The pill says **Log in** and a badge like **12 min**, with a gold hourglass.
- About 4 seconds later it shrinks to a ring and a clock such as **12:04**.
- Pause: the digits stay put. Play: they follow the playhead.
- Scrub backward past 15 minutes left: the pill hides. Scrub forward again: the clock returns without the sentence.
- Cross the log point: the clock leaves and the existing rate toast appears.

- [ ] **Step 5: Commit**

```bash
git add apps/sense-companion/entrypoints/streaming.content.ts apps/sense-companion/entrypoints/generic-video.content.ts
git commit -m "feat: show the auto-log countdown on the playing tab"
```
