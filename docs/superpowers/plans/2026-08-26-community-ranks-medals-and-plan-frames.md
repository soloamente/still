# Community ranks medals + subscription plan frames Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace circular plan-tier portrait rims with escalating SVG scallop frames everywhere circular `PatronPortraitWithAura` already paints an aura, and restyle Community ranks top-3 podiums into 3D gold / silver / bronze medal pillars with numbered badges.

**Architecture:** Pure path helpers produce SVG silhouettes (Attuned 8 lobes, Immersed 16, Devoted 16+8 outer, staff square-cosine). `AvatarAura` paints those paths as a **CSS mask on the metal layer only**; the photo stays a circular well with a hairline. Community podium tokens in `community-ranks-podium.ts` switch inset washes to 3D medal faces plus a silver digit badge inside the existing ledger button. No API or payload changes.

**Tech Stack:** TypeScript, Bun tests (`bun:test`), React 19, Tailwind + `packages/ui/src/styles/globals.css` `@layer components`, `motion/react` (existing podium enter only).

**Spec:** [`docs/superpowers/specs/2026-08-26-community-ranks-medals-and-plan-frames-design.md`](../specs/2026-08-26-community-ranks-medals-and-plan-frames-design.md)

## File map

| File | Responsibility |
|------|----------------|
| `apps/web/src/components/profile/avatar-aura/avatar-aura-frame-path.ts` | Polar scallop paths, mask data-URI, well inset constant |
| `apps/web/src/components/profile/avatar-aura/avatar-aura-frame-path.test.ts` | Path / kind / mask tests |
| `apps/web/src/components/profile/avatar-aura/avatar-aura-tier.ts` | `avatarAuraFrameKind(visual)` |
| `apps/web/src/components/profile/avatar-aura/avatar-aura-tier.test.ts` | Frame-kind mapping tests |
| `apps/web/src/components/profile/avatar-aura/avatar-aura.tsx` | Metal layer + circular well + sheen |
| `apps/web/src/components/profile/patron-portrait-with-aura.tsx` | Inset online-dot when framed |
| `packages/ui/src/styles/globals.css` | Scallop metal + sheen; drop circular padding rim |
| `apps/web/src/components/profile/avatar-aura/avatar-aura-devoted-canvas.tsx` | Delete |
| `apps/web/src/lib/community-ranks-podium.ts` | Medal classes, badge digit, stage glow, filled-slot helper |
| `apps/web/src/lib/community-ranks-podium.test.ts` | Pedestal / badge / slot tests |
| `apps/web/src/components/home/community-ranks-podium-count.tsx` | Silver 1/2/3 badge inside pedestal button |
| `apps/web/src/components/home/home-leaderboard-podium.tsx` | Drop 1st text; stage glow; aria includes place |
| `apps/web/src/components/members/members-leaderboard-podium.tsx` | Same + no empty flex spacers |

## Global Constraints

- Windows PowerShell — chain with `;`, not `&&`.
- One task per Executor / subagent pass; human **go** between tasks.
- TDD for path helpers, frame kind, podium tokens. CSS/JSX tasks still run the matching unit tests after.
- Do **not** commit unless the human asks.
- After code changes in a session: `graphify update .` (AST-only).
- No new APIs, no month-recap podium, no scallops on rank rows #4+, no WebGL.
- Staff still wins over plan (`resolveAvatarAuraVisual` unchanged).
- Still / `kind: "none"` stays a plain circle.
- Imports at top of files. Exhaustive `switch` with `never` default.
- Frame is `aria-hidden`. Do not announce scallops.
- Rank list rows and month recap: do not touch.
- `motion/react` only (never `framer-motion`).

---

### Task 1: Frame paths + kind mapping (TDD)

**Files:**
- Create: `apps/web/src/components/profile/avatar-aura/avatar-aura-frame-path.ts`
- Create: `apps/web/src/components/profile/avatar-aura/avatar-aura-frame-path.test.ts`
- Modify: `apps/web/src/components/profile/avatar-aura/avatar-aura-tier.ts`
- Modify: `apps/web/src/components/profile/avatar-aura/avatar-aura-tier.test.ts`

**Interfaces:**
- Consumes: `AvatarAuraVisual` from `avatar-aura-tier.ts`
- Produces:
  - `AVATAR_AURA_FRAME_VIEWBOX = 100`
  - `AVATAR_AURA_WELL_INSET_PERCENT = 14`
  - `AvatarAuraFrameKind = "attuned" | "immersed" | "devoted" | "staff"`
  - `avatarAuraFrameKind(visual: AvatarAuraVisual): AvatarAuraFrameKind | null`
  - `avatarAuraFramePaths(kind: AvatarAuraFrameKind): { inner: string; outer: string | null }`
  - `avatarAuraFrameMaskSvg(kind: AvatarAuraFrameKind): string`
  - `avatarAuraFrameMaskStyle(kind: AvatarAuraFrameKind): { "--avatar-aura-frame-mask": string }`

- [ ] **Step 1: Write the failing tests**

Create `avatar-aura-frame-path.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import {
	AVATAR_AURA_FRAME_VIEWBOX,
	AVATAR_AURA_WELL_INSET_PERCENT,
	avatarAuraFrameMaskStyle,
	avatarAuraFrameMaskSvg,
	avatarAuraFramePaths,
} from "./avatar-aura-frame-path";

function commandCount(path: string, command: "M" | "L"): number {
	return path.split(" ").filter((token) => token === command).length;
}

describe("avatarAuraFramePaths", () => {
	test("every kind closes a path that starts with M", () => {
		for (const kind of ["attuned", "immersed", "devoted", "staff"] as const) {
			const { inner, outer } = avatarAuraFramePaths(kind);
			expect(inner.startsWith("M ")).toBe(true);
			expect(inner.endsWith(" Z")).toBe(true);
			expect(commandCount(inner, "L")).toBeGreaterThan(16);
			if (kind === "devoted") {
				expect(outer).toBeTruthy();
				expect(outer?.startsWith("M ")).toBe(true);
			} else {
				expect(outer).toBeNull();
			}
		}
	});

	test("immersed samples denser than attuned", () => {
		const attuned = avatarAuraFramePaths("attuned").inner;
		const immersed = avatarAuraFramePaths("immersed").inner;
		expect(commandCount(immersed, "L")).toBeGreaterThan(
			commandCount(attuned, "L"),
		);
	});
});

describe("avatarAuraFrameMaskSvg", () => {
	test("embeds viewBox and a white filled path", () => {
		const svg = avatarAuraFrameMaskSvg("attuned");
		expect(svg).toContain(`viewBox="0 0 ${AVATAR_AURA_FRAME_VIEWBOX} ${AVATAR_AURA_FRAME_VIEWBOX}"`);
		expect(svg).toContain('fill="white"');
		expect(svg).toContain("<path");
	});

	test("devoted includes two paths", () => {
		const svg = avatarAuraFrameMaskSvg("devoted");
		expect(svg.split("<path").length - 1).toBe(2);
	});
});

describe("avatarAuraFrameMaskStyle", () => {
	test("exposes a data-URI mask custom property", () => {
		const style = avatarAuraFrameMaskStyle("staff");
		expect(style["--avatar-aura-frame-mask"].startsWith("url(")).toBe(true);
		expect(style["--avatar-aura-frame-mask"]).toContain("data:image/svg+xml");
	});
});

describe("AVATAR_AURA_WELL_INSET_PERCENT", () => {
	test("is 14 so the photo sits inside scallops", () => {
		expect(AVATAR_AURA_WELL_INSET_PERCENT).toBe(14);
	});
});
```

Append to `avatar-aura-tier.test.ts`: add `avatarAuraFrameKind` to the existing import from `./avatar-aura-tier`, then add this describe block (keep every existing case):

```ts
describe("avatarAuraFrameKind", () => {
	test("maps none to null", () => {
		expect(avatarAuraFrameKind({ kind: "none" })).toBeNull();
	});

	test("maps each paid plan to its own kind", () => {
		expect(avatarAuraFrameKind({ kind: "plan", tier: "attuned" })).toBe(
			"attuned",
		);
		expect(avatarAuraFrameKind({ kind: "plan", tier: "immersed" })).toBe(
			"immersed",
		);
		expect(avatarAuraFrameKind({ kind: "plan", tier: "devoted" })).toBe(
			"devoted",
		);
	});

	test("staff wins even when a plan is present", () => {
		expect(avatarAuraFrameKind({ kind: "staff" })).toBe("staff");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
bun test apps/web/src/components/profile/avatar-aura/avatar-aura-frame-path.test.ts apps/web/src/components/profile/avatar-aura/avatar-aura-tier.test.ts
```

Expected: FAIL — `avatarAuraFrameKind` / `avatarAuraFramePaths` not exported.

- [ ] **Step 3: Implement paths + kind mapping**

Add to `avatar-aura-tier.ts` (after `hasAvatarAuraVisual`):

```ts
export type AvatarAuraFrameKind = "attuned" | "immersed" | "devoted" | "staff";

/** Silhouette id for SVG frames — null means plain circle (Still). */
export function avatarAuraFrameKind(
	visual: AvatarAuraVisual,
): AvatarAuraFrameKind | null {
	if (visual.kind === "staff") return "staff";
	if (visual.kind === "plan") return visual.tier;
	return null;
}
```

Create `avatar-aura-frame-path.ts`:

```ts
import type { AvatarAuraFrameKind } from "./avatar-aura-tier";

export const AVATAR_AURA_FRAME_VIEWBOX = 100;
export const AVATAR_AURA_WELL_INSET_PERCENT = 14;

const CX = 50;
const CY = 50;

type PolarLobe = {
	frequency: number;
	baseRadius: number;
	amplitude: number;
	/** 1 = round cosine lobes; higher = squarer staff petals. */
	sharpness?: number;
};

function polarLobePath(lobe: PolarLobe): string {
	const samples = lobe.frequency * 12;
	const sharpness = lobe.sharpness ?? 1;
	const parts: string[] = [];
	for (let i = 0; i <= samples; i++) {
		const t = (i / samples) * Math.PI * 2;
		const wave = Math.cos(lobe.frequency * t);
		const shaped =
			sharpness === 1
				? wave
				: Math.sign(wave) * Math.pow(Math.abs(wave), 1 / sharpness);
		const r = lobe.baseRadius + lobe.amplitude * shaped;
		const x = CX + r * Math.cos(t - Math.PI / 2);
		const y = CY + r * Math.sin(t - Math.PI / 2);
		parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(3)} ${y.toFixed(3)}`);
	}
	return `${parts.join(" ")} Z`;
}

export function avatarAuraFramePaths(kind: AvatarAuraFrameKind): {
	inner: string;
	outer: string | null;
} {
	switch (kind) {
		case "attuned":
			return {
				inner: polarLobePath({ frequency: 8, baseRadius: 38, amplitude: 8 }),
				outer: null,
			};
		case "immersed":
			return {
				inner: polarLobePath({ frequency: 16, baseRadius: 39, amplitude: 5 }),
				outer: null,
			};
		case "devoted":
			return {
				inner: polarLobePath({ frequency: 16, baseRadius: 36, amplitude: 5 }),
				outer: polarLobePath({ frequency: 8, baseRadius: 42, amplitude: 4 }),
			};
		case "staff":
			return {
				inner: polarLobePath({
					frequency: 8,
					baseRadius: 38,
					amplitude: 7,
					sharpness: 2.4,
				}),
				outer: null,
			};
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

export function avatarAuraFrameMaskSvg(kind: AvatarAuraFrameKind): string {
	const { inner, outer } = avatarAuraFramePaths(kind);
	const outerEl = outer ? `<path d="${outer}" fill="white"/>` : "";
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${AVATAR_AURA_FRAME_VIEWBOX} ${AVATAR_AURA_FRAME_VIEWBOX}">${outerEl}<path d="${inner}" fill="white"/></svg>`;
}

export function avatarAuraFrameMaskStyle(kind: AvatarAuraFrameKind): {
	"--avatar-aura-frame-mask": string;
} {
	const uri = `url("data:image/svg+xml,${encodeURIComponent(avatarAuraFrameMaskSvg(kind))}")`;
	return { "--avatar-aura-frame-mask": uri };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run the same `bun test` command as Step 2.

Expected: PASS (existing aura-tier cases still pass).

- [ ] **Step 5: Commit** — skip unless the human asks.

---

### Task 2: Paint frames in `AvatarAura` + CSS sheen; delete WebGL canvas

**Files:**
- Modify: `apps/web/src/components/profile/avatar-aura/avatar-aura.tsx`
- Modify: `apps/web/src/components/profile/patron-portrait-with-aura.tsx`
- Modify: `packages/ui/src/styles/globals.css` (`.avatar-aura-rim` block ~2027–2075)
- Delete: `apps/web/src/components/profile/avatar-aura/avatar-aura-devoted-canvas.tsx`

**Interfaces:**
- Consumes: `avatarAuraFrameKind`, `avatarAuraVisualClassName`, `avatarAuraFrameMaskStyle`, `AVATAR_AURA_WELL_INSET_PERCENT`
- Produces: Framed circular portraits; online dot inset to the well when a frame is present

- [ ] **Step 1: Replace `AvatarAura` markup**

`avatar-aura.tsx` full file:

```tsx
import { cn } from "@still/ui/lib/utils";
import type { CSSProperties, ReactNode } from "react";

import {
	AVATAR_AURA_WELL_INSET_PERCENT,
	avatarAuraFrameMaskStyle,
} from "@/components/profile/avatar-aura/avatar-aura-frame-path";
import {
	avatarAuraFrameKind,
	avatarAuraVisualClassName,
	hasAvatarAuraVisual,
	resolveAvatarAuraVisual,
} from "@/components/profile/avatar-aura/avatar-aura-tier";

/**
 * Plan / staff scallop frame — metal layer masked to an SVG silhouette.
 * Photo stays a circle. Decorative; no hover WebGL.
 */
export function AvatarAura({
	planTier,
	staffRole,
	children,
	className,
}: {
	planTier?: unknown;
	staffRole?: unknown;
	children: ReactNode;
	className?: string;
}) {
	const visual = resolveAvatarAuraVisual({ planTier, staffRole });
	if (!hasAvatarAuraVisual(visual)) {
		return <>{children}</>;
	}

	const frameKind = avatarAuraFrameKind(visual);
	if (!frameKind) {
		return <>{children}</>;
	}

	const rimClass = avatarAuraVisualClassName(visual);
	const maskStyle = avatarAuraFrameMaskStyle(frameKind);

	return (
		<span
			className={cn(
				"avatar-aura-root avatar-aura-rim relative inline-flex min-w-0 overflow-visible",
				rimClass,
				className,
			)}
			style={maskStyle as CSSProperties}
		>
			<span className="avatar-aura-metal" aria-hidden />
			<span
				className="avatar-aura-well relative z-10 overflow-hidden rounded-full"
				style={{ margin: `${AVATAR_AURA_WELL_INSET_PERCENT}%` }}
			>
				{children}
			</span>
			<span className="avatar-aura-sheen" aria-hidden />
		</span>
	);
}
```

- [ ] **Step 2: Replace the circular-rim CSS**

In `packages/ui/src/styles/globals.css`, replace the `/* Avatar plan auras */` `@layer components` block with:

```css
/* Avatar plan frames — SVG-masked metal; circular photo well; hover sheen only. */
@layer components {
	.avatar-aura-rim {
		position: relative;
		box-sizing: border-box;
		/* Scallops live in the metal mask — do not clip with border-radius. */
		border-radius: 0;
		padding: 0;
		background: none;
		box-shadow: none;
	}

	.avatar-aura-metal,
	.avatar-aura-sheen {
		position: absolute;
		inset: 0;
		pointer-events: none;
		-webkit-mask-image: var(--avatar-aura-frame-mask);
		mask-image: var(--avatar-aura-frame-mask);
		-webkit-mask-size: 100% 100%;
		mask-size: 100% 100%;
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
	}

	.avatar-aura-metal {
		background: conic-gradient(
			from 210deg,
			var(--avatar-aura-rim-a, oklch(0.62 0.06 70)),
			var(--avatar-aura-rim-b, oklch(0.72 0.08 82)),
			var(--avatar-aura-rim-c, oklch(0.58 0.05 55)),
			var(--avatar-aura-rim-a, oklch(0.62 0.06 70))
		);
	}

	.avatar-aura-well {
		box-shadow: inset 0 0 0 1.5px var(--background);
	}

	.avatar-aura-sheen {
		z-index: 2;
		opacity: 0;
		background: linear-gradient(
			105deg,
			transparent 42%,
			oklch(1 0 0 / 0.32) 50%,
			transparent 58%
		);
		background-size: 220% 100%;
		background-position: 100% 0;
		transition: opacity 0.2s ease-out;
	}

	@media (hover: hover) {
		.avatar-aura-root:hover .avatar-aura-sheen {
			opacity: 1;
			background-position: 0 0;
			transition:
				opacity 0.2s ease-out,
				background-position 0.2s linear;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.avatar-aura-sheen {
			display: none;
		}
	}

	.avatar-aura-rim--attuned {
		--avatar-aura-rim-a: oklch(0.6 0.06 58);
		--avatar-aura-rim-b: oklch(0.7 0.08 72);
		--avatar-aura-rim-c: oklch(0.56 0.05 48);
	}

	.avatar-aura-rim--immersed {
		--avatar-aura-rim-a: oklch(0.66 0.1 68);
		--avatar-aura-rim-b: oklch(0.76 0.12 82);
		--avatar-aura-rim-c: oklch(0.62 0.08 58);
	}

	.avatar-aura-rim--devoted {
		--avatar-aura-rim-a: oklch(0.66 0.11 320);
		--avatar-aura-rim-b: oklch(0.7 0.1 200);
		--avatar-aura-rim-c: oklch(0.68 0.09 130);
	}

	.avatar-aura-rim--staff .avatar-aura-metal {
		background: repeating-conic-gradient(
			from -22.5deg,
			oklch(0.74 0.03 255) 0deg 45deg,
			oklch(0.5 0.045 268) 45deg 90deg
		);
	}
}
```

Keep the existing hue tokens. Do not leave the old `padding: 1.5px; border-radius: 9999px` rim — it would clip scallops.

- [ ] **Step 3: Sit the online dot on the inner photo**

In `patron-portrait-with-aura.tsx`, import `AVATAR_AURA_WELL_INSET_PERCENT` and pass an inset class when `showAura` is true:

```tsx
<PatronOnlineDot
	presenceState={resolvedPresenceState}
	label={dotLabel}
	size={resolvePatronOnlineDotSize(width)}
	className={
		showAura
			? `right-[${AVATAR_AURA_WELL_INSET_PERCENT}%] bottom-[${AVATAR_AURA_WELL_INSET_PERCENT}%]`
			: undefined
	}
/>
```

**Do not use dynamic Tailwind class interpolation** — JIT will drop it. Use a static class instead. Add to `globals.css`:

```css
.avatar-aura-root + .patron-online-dot--framed,
.patron-online-dot--framed {
	right: 14%;
	bottom: 14%;
}
```

Simpler and reliable: in `patron-portrait-with-aura.tsx` use the existing `style` only on the outer span. Give `PatronOnlineDot` a new optional className from a **static** string:

```tsx
className={showAura ? "right-[14%] bottom-[14%]" : undefined}
```

`14%` is a complete literal so Tailwind keeps it. Comment that it must match `AVATAR_AURA_WELL_INSET_PERCENT`. Add a one-line test in `avatar-aura-frame-path.test.ts` is already `14`. If someone changes the constant, they must change this class in the same pass.

- [ ] **Step 4: Delete unused WebGL canvas**

Delete `apps/web/src/components/profile/avatar-aura/avatar-aura-devoted-canvas.tsx`. Grep the repo for `AvatarAuraDevotedCanvas` / `avatar-aura-devoted-canvas` — only docs/plans should remain. Do not delete those docs.

- [ ] **Step 5: Re-run frame unit tests**

```powershell
bun test apps/web/src/components/profile/avatar-aura/avatar-aura-frame-path.test.ts apps/web/src/components/profile/avatar-aura/avatar-aura-tier.test.ts
```

Expected: PASS.

- [ ] **Step 6: Browser check (this task’s QA)**

Signed-in: profile hero (paid + Still + staff if available), account menu, Community feed avatar, search People row. Confirm scallops, no circular rim, sheen on hover desktop only, no sheen with reduced motion, green/orange dot on the **photo** not a lobe. Touch: no sheen.

- [ ] **Step 7: Commit** — skip unless the human asks.

---

### Task 3: Medal podium tokens (TDD)

**Files:**
- Modify: `apps/web/src/lib/community-ranks-podium.ts`
- Create: `apps/web/src/lib/community-ranks-podium.test.ts`

**Interfaces:**
- Consumes: existing `CommunityRanksPodiumSlot`
- Produces:
  - `communityRanksPodiumBadgeDigit(slot): "1" | "2" | "3"`
  - `communityRanksPodiumBadgeClassName` (constant string)
  - `COMMUNITY_RANKS_PODIUM_STAGE_CLASSNAME`
  - `COMMUNITY_RANKS_PODIUM_FLOOR_GLOW_CLASSNAME`
  - `communityRanksPodiumFilled(entries: T[]): { first: T; second: T | undefined; third: T | undefined } | null`
  - `communityRanksPodiumPedestalClass` — 3D medal gradients (replace inset washes)
  - `communityRanksPodiumPedestalButtonClass` — `relative` so the badge can sit on the face; `text-foreground` on 3D faces may need `text-zinc-900` on light metal — use `text-zinc-950` for count on medals so it reads on gold/silver/bronze

- [ ] **Step 1: Write the failing test**

Create `community-ranks-podium.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

import {
	communityRanksPodiumBadgeDigit,
	communityRanksPodiumFilled,
	communityRanksPodiumPedestalClass,
	communityRanksPodiumPedestalHeightClass,
	communityRanksPodiumSlotLabel,
} from "./community-ranks-podium";

describe("communityRanksPodiumBadgeDigit", () => {
	test("maps slots to 1 2 3", () => {
		expect(communityRanksPodiumBadgeDigit("first")).toBe("1");
		expect(communityRanksPodiumBadgeDigit("second")).toBe("2");
		expect(communityRanksPodiumBadgeDigit("third")).toBe("3");
	});
});

describe("communityRanksPodiumSlotLabel", () => {
	test("stays 1st 2nd 3rd for SR", () => {
		expect(communityRanksPodiumSlotLabel("first")).toBe("1st");
		expect(communityRanksPodiumSlotLabel("second")).toBe("2nd");
		expect(communityRanksPodiumSlotLabel("third")).toBe("3rd");
	});
});

describe("communityRanksPodiumPedestalHeightClass", () => {
	test("1st is taller than 2nd and 3rd", () => {
		expect(communityRanksPodiumPedestalHeightClass("first")).toContain("h-22");
		expect(communityRanksPodiumPedestalHeightClass("second")).toContain("h-18");
		expect(communityRanksPodiumPedestalHeightClass("third")).toContain("h-16");
	});
});

describe("communityRanksPodiumPedestalClass", () => {
	test("three medal materials are distinct", () => {
		const first = communityRanksPodiumPedestalClass("first");
		const second = communityRanksPodiumPedestalClass("second");
		const third = communityRanksPodiumPedestalClass("third");
		expect(first).not.toBe(second);
		expect(second).not.toBe(third);
		expect(first).toContain("linear-gradient");
		expect(third).toContain("desert-orange");
	});
});

describe("communityRanksPodiumFilled", () => {
	test("returns null without a first entry", () => {
		expect(communityRanksPodiumFilled([])).toBeNull();
	});

	test("does not invent second or third", () => {
		const filled = communityRanksPodiumFilled([{ id: "a" }]);
		expect(filled?.first).toEqual({ id: "a" });
		expect(filled?.second).toBeUndefined();
		expect(filled?.third).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```powershell
bun test apps/web/src/lib/community-ranks-podium.test.ts
```

Expected: FAIL — `communityRanksPodiumBadgeDigit` / `communityRanksPodiumFilled` not defined; pedestal class has no `linear-gradient`.

- [ ] **Step 3: Implement tokens**

Replace `communityRanksPodiumPedestalClass` and add new exports in `community-ranks-podium.ts`. Keep height + slot label + count text + column classname. Change the button class to include `relative` and medal-friendly type color.

```ts
/** 3D medal face — gold 1st, silver 2nd, desert-orange bronze 3rd. */
export function communityRanksPodiumPedestalClass(
	slot: CommunityRanksPodiumSlot,
): string {
	switch (slot) {
		case "first":
			return "bg-[linear-gradient(180deg,oklch(0.22_0.03_78)_0_10px,oklch(0.82_0.12_82)_12px,oklch(0.62_0.14_72)_100%)] text-zinc-950";
		case "second":
			return "bg-[linear-gradient(180deg,oklch(0.2_0.02_260)_0_10px,oklch(0.86_0.02_250)_12px,oklch(0.62_0.03_250)_100%)] text-zinc-950";
		case "third":
			return "bg-[linear-gradient(180deg,oklch(0.24_0.04_55)_0_10px,color-mix(in_oklab,var(--color-desert-orange)_72%,white)_12px,var(--color-desert-orange)_100%)] text-zinc-950";
		default: {
			const _exhaustive: never = slot;
			return _exhaustive;
		}
	}
}

export function communityRanksPodiumBadgeDigit(
	slot: CommunityRanksPodiumSlot,
): "1" | "2" | "3" {
	switch (slot) {
		case "first":
			return "1";
		case "second":
			return "2";
		case "third":
			return "3";
		default: {
			const _exhaustive: never = slot;
			return _exhaustive;
		}
	}
}

export const COMMUNITY_RANKS_PODIUM_BADGE_CLASSNAME =
	"absolute top-2 left-1/2 z-10 flex size-6 -translate-x-1/2 items-center justify-center rounded-full bg-[radial-gradient(circle_at_32%_28%,white,#b8bcc4_62%)] font-bold text-[11px] text-zinc-900 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.5)]";

export const COMMUNITY_RANKS_PODIUM_STAGE_CLASSNAME =
	"relative flex items-end justify-center gap-2 sm:gap-3";

/** Soft floor light — radial only, no backdrop-blur. */
export const COMMUNITY_RANKS_PODIUM_FLOOR_GLOW_CLASSNAME =
	"pointer-events-none absolute inset-x-[8%] bottom-0 h-8 bg-[radial-gradient(ellipse_at_center,oklch(0.85_0.08_82_/_0.22),transparent_70%)]";

export function communityRanksPodiumFilled<T>(
	entries: readonly T[],
): { first: T; second: T | undefined; third: T | undefined } | null {
	const first = entries[0];
	if (!first) return null;
	return { first, second: entries[1], third: entries[2] };
}
```

Update `communityRanksPodiumPedestalButtonClass` to add `"relative"` in the `cn()` list (keep height, hover brightness, focus ring, `rounded-t-2xl`). Change CTA classname color if the parent is now `text-zinc-950`: use `text-zinc-950/70` on `COMMUNITY_RANKS_PODIUM_CTA_CLASSNAME` **only for podium pedestals**, not rank rows.

Rank rows use `COMMUNITY_RANKS_PODIUM_CTA_CLASSNAME` too (`CommunityRanksRowCount`). Do **not** globally switch that constant to zinc-950 — rows sit on `bg-background` with `text-foreground`.

Keep `COMMUNITY_RANKS_PODIUM_CTA_CLASSNAME` as today. On the pedestal button, medal `text-zinc-950` inherits into the CTA; that is intended on the 3D block. Rows are unchanged.

- [ ] **Step 4: Run tests to verify they pass**

```powershell
bun test apps/web/src/lib/community-ranks-podium.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit** — skip unless the human asks.

---

### Task 4: Podium UI — badge, drop place text, glow, members spacers

**Files:**
- Modify: `apps/web/src/components/home/community-ranks-podium-count.tsx`
- Modify: `apps/web/src/components/home/home-leaderboard-podium.tsx`
- Modify: `apps/web/src/components/members/members-leaderboard-podium.tsx`

**Interfaces:**
- Consumes: `communityRanksPodiumBadgeDigit`, `COMMUNITY_RANKS_PODIUM_BADGE_CLASSNAME`, `COMMUNITY_RANKS_PODIUM_STAGE_CLASSNAME`, `COMMUNITY_RANKS_PODIUM_FLOOR_GLOW_CLASSNAME`, `communityRanksPodiumFilled`, `communityRanksPodiumSlotLabel`
- Produces: Both Community podiums show medals with badges; no 1st/2nd/3rd captions; members has no empty `flex-1` spacers

- [ ] **Step 1: Add the badge inside `CommunityRanksPodiumCount`**

Imports: add `COMMUNITY_RANKS_PODIUM_BADGE_CLASSNAME`, `communityRanksPodiumBadgeDigit`, `communityRanksPodiumSlotLabel`.

Inside `DetailMotionButton`, as the first child:

```tsx
<span className={COMMUNITY_RANKS_PODIUM_BADGE_CLASSNAME} aria-hidden>
	{communityRanksPodiumBadgeDigit(slot)}
</span>
```

Do **not** add the badge to `CommunityRanksRowCount`.

- [ ] **Step 2: Home podium — drop caption, wrap stage, prefix aria with place**

Remove the `<p className="font-medium text-muted-foreground...">{rankLabel}</p>` from `PodiumTile`.

Keep `const rankLabel = communityRanksPodiumSlotLabel(slot)` and prefix the count `ariaLabel`:

```tsx
ariaLabel={`${rankLabel}. ${entry.count} ${leaderboardKindCountLabel(kind, entry.count)} — view watch list`}
```

In `HomeLeaderboardPodium`, replace the entries unpack + inner flex with:

```tsx
const filled = communityRanksPodiumFilled(entries);
if (!filled) return null;
const { first, second, third } = filled;

return (
	<div className={HOME_COMMUNITY_RANKS_PODIUM_TRAY_CLASSNAME}>
		<div className={COMMUNITY_RANKS_PODIUM_STAGE_CLASSNAME}>
			<div className={COMMUNITY_RANKS_PODIUM_FLOOR_GLOW_CLASSNAME} aria-hidden />
			{second ? (
				<PodiumTile
					entry={second}
					slot="second"
					kind={kind}
					period={period}
					reduceMotion={Boolean(reduceMotion)}
				/>
			) : null}
			<PodiumTile
				entry={first}
				slot="first"
				kind={kind}
				period={period}
				reduceMotion={Boolean(reduceMotion)}
			/>
			{third ? (
				<PodiumTile
					entry={third}
					slot="third"
					kind={kind}
					period={period}
					reduceMotion={Boolean(reduceMotion)}
				/>
			) : null}
		</div>
	</div>
);
```

Portrait `Link` must stay `overflow-visible` so scallops are not clipped.

- [ ] **Step 3: Members podium — same chrome, delete spacers**

Remove the `<p>…{rankLabel}</p>` from `MembersPodiumTile`. Prefix members `ariaLabel` with `rankLabel` the same way.

Replace the inner flex (including the `else { <div className="min-w-0 flex-1" aria-hidden /> }` branches) with `communityRanksPodiumFilled(items)` + the same stage + glow pattern as home. Missing second/third render `null`, never a flex spacer.

- [ ] **Step 4: Re-run podium token tests**

```powershell
bun test apps/web/src/lib/community-ranks-podium.test.ts apps/web/src/components/profile/avatar-aura/avatar-aura-frame-path.test.ts apps/web/src/components/profile/avatar-aura/avatar-aura-tier.test.ts
```

Expected: PASS.

- [ ] **Step 5: Browser check**

`/home?browse=community` — Film ranks, Shows, Episodes, Reviews. Confirm: 2nd · 1st · 3rd, gold/silver/bronze 3D, silver badges, no “1st” caption, count still opens ledger, name/@ still open profile, plan frames on faces independent of place, 1-patron board stays centered, #4+ rows unchanged, month recap dialog podium unchanged.

- [ ] **Step 6: `graphify update .`** then **Commit** — skip commit unless the human asks.

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| SVG scallops Attuned 8 / Immersed 16 / Devoted 16+8 / staff square | 1 |
| Replace circular rim everywhere `PatronPortraitWithAura` | 2 |
| Still = none | 1 (`avatarAuraFrameKind` null) |
| Staff wins | 1 (resolver unchanged + staff kind) |
| CSS sheen, no WebGL, reduced-motion off | 2 |
| Delete devoted canvas | 2 |
| Photo circle + hairline | 2 (`.avatar-aura-well`) |
| Online dot on inner photo | 2 (`right-[14%]`) |
| Medal pillars gold/silver/bronze + numbered badge | 3–4 |
| Count in pillar → ledger | 4 (same button) |
| Drop 1st text; SR still 1st | 4 |
| Center 1–2 patrons; members spacers gone | 3 helper + 4 |
| Floor glow, no backdrop-blur | 3–4 |
| No API | all |
| Month recap / rows #4+ untouched | 4 files list |
