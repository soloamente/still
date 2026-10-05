# Companion Toast Icon Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Color each playback-notice mark, ignore a pause before the title has played, and say Resuming only after a real pause.

**Architecture:** `nextWatchToast` already decides when a notice appears. It drops a pause until that same movie or episode has been remembered as playing, and it does not store that early pause. `watchToastCopy` uses Watching with the eye for a first play and Resuming with the play mark for a resume. The view paints one solid fill per mark. Streaming and generic-video pages already call these two functions, so they do not change.

**Tech Stack:** TypeScript, Bun tests, a shadow-DOM toast in the Sense Companion extension.

## Global Constraints

- One solid fill per mark, the same way the eye is already green or red.
- Exploring: teal compass, `#3dccc4`.
- Viewing a title page: violet info mark, `#c49bff`.
- First play: green eye, `#3dcc7a`, lead word Watching.
- Failed save: red eye, `#f15b5b`, lead word still Watching.
- Real pause: amber pause bars, `#e8a854`, lead word Paused.
- Resume: blue play mark, `#5aa2ff`, lead word Resuming.
- Pause before play: no notice, and that pause is not remembered.
- After a real pause: Paused, then Resuming if they play the same title again.
- New episode, or leaving and coming back: starts over with Watching and the eye.
- Exploring and viewing copy stay Exploring and Viewing.
- A pause that arrives after a real play still counts, even if it is brief. There is no extra delay.
- An episode with a season number and no episode number waits, and does not count as a play or a pause.
- A failed save on Resuming stays Resuming with the blue play mark.
- Do not recolor the Discord card, the logged-rate toast, or the auto-log countdown.

---

### Task 1: Notice decision

**Files:**
- Modify: `apps/sense-companion/src/presence/watch-toast.ts` (`watchToastCopy` around lines 47–60, `nextWatchToast` around lines 106–131)
- Test: `apps/sense-companion/src/presence/watch-toast.test.ts`

**Interfaces:**
- Consumes: `PopupWatch` from `apps/sense-companion/src/popup/watch-state.ts` (`mode`, `title`, `season`, `episode`, `paused`). `WatchToastState` and `emptyWatchToastState()` in `watch-toast.ts`.
- Produces: `nextWatchToast(state, watch) => { state: WatchToastState; show: boolean; resume: boolean }`. `watchToastCopy(watch, resume) => { lead: string; title: string; detail: string | null; icon: WatchToastIcon }`. A first play has `resume: false`, lead `Watching`, icon `eye`. A resume has `resume: true`, lead `Resuming`, icon `play`.

- [ ] **Step 1: Write the failing tests**

In `apps/sense-companion/src/presence/watch-toast.test.ts`, replace the last assertion of `pause and resume each get their own notice` so a resume expects the full copy:

```typescript
		expect(watchToastCopy(watch(), true)).toEqual({
			lead: "Resuming",
			title: "Stranger Things",
			detail: "S4 E1",
			icon: "play",
		});
```

Add these tests inside the same `describe("watch toast")` block:

```typescript
	test("a pause before play is ignored", () => {
		const paused = nextWatchToast(
			emptyWatchToastState(),
			watch({ paused: true, mode: "paused" }),
		);
		expect(paused.show).toBe(false);
		expect(paused.resume).toBe(false);
		expect(paused.state).toEqual(emptyWatchToastState());
		const started = nextWatchToast(paused.state, watch());
		expect(started.show).toBe(true);
		expect(started.resume).toBe(false);
		expect(watchToastCopy(watch(), started.resume)).toEqual({
			lead: "Watching",
			title: "Stranger Things",
			detail: "S4 E1",
			icon: "eye",
		});
		const moviePause = nextWatchToast(
			emptyWatchToastState(),
			watch({
				title: "Dune",
				season: null,
				episode: null,
				paused: true,
				mode: "paused",
			}),
		);
		expect(moviePause.show).toBe(false);
		expect(moviePause.state).toEqual(emptyWatchToastState());
	});

	test("a pause on the next episode is ignored until it plays", () => {
		const started = nextWatchToast(emptyWatchToastState(), watch());
		const paused = nextWatchToast(
			started.state,
			watch({ paused: true, mode: "paused" }),
		);
		const early = nextWatchToast(
			paused.state,
			watch({ episode: 2, paused: true, mode: "paused" }),
		);
		expect(early.show).toBe(false);
		expect(early.state).toEqual(paused.state);
		const played = nextWatchToast(early.state, watch({ episode: 2 }));
		expect(played.show).toBe(true);
		expect(played.resume).toBe(false);
		expect(watchToastCopy(watch({ episode: 2 }), played.resume)).toEqual({
			lead: "Watching",
			title: "Stranger Things",
			detail: "S4 E2",
			icon: "eye",
		});
	});

	test("leaving the player starts the next play at Watching", () => {
		const started = nextWatchToast(emptyWatchToastState(), watch());
		const left = nextWatchToast(started.state, null);
		const returned = nextWatchToast(left.state, watch());
		expect(returned.show).toBe(true);
		expect(returned.resume).toBe(false);
		expect(watchToastCopy(watch(), returned.resume).lead).toBe("Watching");
		expect(watchToastCopy(watch(), returned.resume).icon).toBe("eye");
	});

	test("a paused episode without a number does not count", () => {
		const partial = nextWatchToast(
			emptyWatchToastState(),
			watch({ episode: null, paused: true, mode: "paused" }),
		);
		expect(partial.show).toBe(false);
		expect(partial.resume).toBe(false);
		expect(partial.state).toEqual(emptyWatchToastState());
	});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `apps/sense-companion`:

```bash
bun test src/presence/watch-toast.test.ts
```

Expected: FAIL. The resume copy still has lead `Watching`. A pause from an empty state still has `show: true`. A pause for episode 2 while episode 1 is paused still has `show: true`. A paused episode with no episode number still has `show: true`.

- [ ] **Step 3: Write the minimal implementation**

In `watchToastCopy`, the `playing` branch becomes:

```typescript
		case "playing":
			return {
				lead: resume ? "Resuming" : "Watching",
				title: watch.title,
				detail: mark,
				icon: resume ? "play" : "eye",
			};
```

Add these helpers above `nextWatchToast`:

```typescript
function sameTitle(state: WatchToastState, watch: PopupWatch): boolean {
	return (
		state.title === watch.title &&
		state.season === watch.season &&
		state.episode === watch.episode
	);
}

/** A stored play, or a pause that followed one, for this same title. */
function titleHasPlayed(state: WatchToastState, watch: PopupWatch): boolean {
	return (
		(state.mode === "playing" || state.mode === "paused") &&
		sameTitle(state, watch)
	);
}
```

Replace the body of `nextWatchToast` with:

```typescript
export function nextWatchToast(
	state: WatchToastState,
	watch: PopupWatch | null,
): { state: WatchToastState; show: boolean; resume: boolean } {
	if (!watch) return { state: emptyWatchToastState(), show: false, resume: false };
	// Season without an episode is not a play or a pause yet.
	if (watch.season != null && watch.episode == null) {
		return { state, show: false, resume: false };
	}
	// The player often reports paused before the first frame. Forget that.
	if (watch.mode === "paused" && !titleHasPlayed(state, watch)) {
		return { state, show: false, resume: false };
	}
	const key = watchToastKey(watch);
	if (key === state.key) return { state, show: false, resume: false };
	const resume =
		state.mode === "paused" &&
		watch.mode === "playing" &&
		state.title === watch.title &&
		state.season === watch.season &&
		state.episode === watch.episode;
	return { state: remember(watch, key), show: true, resume };
}
```

Replace the comment above `nextWatchToast` with:

```typescript
/**
 * True when the mode or the title changes. A pause before this title has
 * played is ignored and not stored. Pause, resume, exploring, and a title
 * page each get their own notice. A partial episode waits for both numbers.
 */
```

- [ ] **Step 4: Run the tests to verify they pass**

Run from `apps/sense-companion`:

```bash
bun test src/presence/watch-toast.test.ts
```

Expected: PASS, including the older tests for a single start notice, a real pause then resume, a different episode, leaving the player, and waiting for an episode number.

- [ ] **Step 5: Commit**

```bash
git add apps/sense-companion/src/presence/watch-toast.ts apps/sense-companion/src/presence/watch-toast.test.ts
git commit -m "feat: ignore a pause before the first play"
```

---

### Task 2: Notice paint

**Files:**
- Modify: `apps/sense-companion/src/presence/watch-toast-view.ts` (`.mark` rules around lines 78–89, `markSvg` around lines 116–119)

**Interfaces:**
- Consumes: `WatchToastIcon` (`eye`, `explore`, `info`, `pause`, `play`) and `showWatchToast(copy, ok)`. `ok === false` turns only the eye red.
- Produces: SVG classes `mark eye`, `mark eye error`, `mark explore`, `mark info`, `mark pause`, `mark play`, with the fills in Global Constraints. No new exports.

The spec does not unit-test the fills. This task only changes the class and the color rules.

- [ ] **Step 1: Paint each mark with its color**

Add these rules after `.mark.eye.error` in `TOAST_STYLE`:

```css
.mark.explore {
	color: #3dccc4;
}
.mark.info {
	color: #c49bff;
}
.mark.pause {
	color: #e8a854;
}
.mark.play {
	color: #5aa2ff;
}
```

Leave `.mark { color: #fff; }`, `.mark.eye { color: #3dcc7a; }`, and `.mark.eye.error { color: #f15b5b; }` as they are.

Replace the class assignment inside `markSvg` with a switch so a failed save never recolors play, pause, explore, or info:

```typescript
	let markClass: string;
	switch (icon) {
		case "eye":
			markClass = failed ? "mark eye error" : "mark eye";
			break;
		case "explore":
			markClass = "mark explore";
			break;
		case "info":
			markClass = "mark info";
			break;
		case "pause":
			markClass = "mark pause";
			break;
		case "play":
			markClass = "mark play";
			break;
		default: {
			const unreachable: never = icon;
			return unreachable;
		}
	}
	svg.setAttribute("class", markClass);
```

Delete the old `eyeFailed` / `markClass` lines that this switch replaces. Keep the rest of `markSvg` unchanged, including the path switch.

- [ ] **Step 2: Run the notice tests**

Run from `apps/sense-companion`:

```bash
bun test src/presence/watch-toast.test.ts
```

Expected: PASS. The view has no unit test. This confirms the decision module still passes after the paint edit.

- [ ] **Step 3: Commit**

```bash
git add apps/sense-companion/src/presence/watch-toast-view.ts
git commit -m "feat: color the companion toast marks"
```

---

## Manual check

Reload the unpacked extension from `apps/sense-companion/.output/chrome-mv3` after `bun run build` in `apps/sense-companion`. Open a title and confirm the first notice is Watching with the green eye. Pause and see amber Paused. Play again and see blue Resuming. Switch episode and see the green eye again. Catalogue stays the teal compass. A title page stays the violet info mark.
