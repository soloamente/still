# Subscription Holo membership card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Human `go` between tasks** (repo preference).

**Goal:** Replace Settings → Subscription membership-card Motion tilt / tier chrome with the Holo foil engine (lagged laminate, duotone portrait polarity) on both identity and billing faces — per [`2026-08-15-subscription-holo-card-design.md`](../specs/2026-08-15-subscription-holo-card-design.md).

**Architecture:** Port Holo maths into `apps/web/src/lib/holo/`; reconstruct `.holo-*` CSS in `packages/ui` globals; one pointer rAF loop writes CSS variables onto both face hosts; keep existing flip / billing / companion rail behavior. No Polar or schema changes.

**Tech Stack:** Next.js App Router, React client components, Bun test, CSS custom properties, existing `usePrefersReducedMotion` / `useSoftwareGpuRendering`.

## Global Constraints

- Patron-facing product name **Sense**; no Kamila / girlfriend / Vault playground UI.
- Foil map: Still `brushed` · Attuned `holo` · Immersed `velvet` · Devoted `cosmos`.
- Pale low-chroma **tier-tinted** print under foil (not dark `bg-card` as the print).
- Portrait: Holo duotone tile + polarity; **no** `PatronPortraitWithAura` on this card.
- Foil on **both** flip faces; type/actions above foil.
- Soft GPU / `prefers-reduced-motion`: no idle drift, no continuous rAF when settled.
- Imports at top of files; `motion/react` only if flip still needs it (not for foil).
- Do **not** commit unless the human explicitly asks.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/web/src/lib/holo/engine.ts` | FOILS, Follow, Kick, Orientation, applyFrame, applyFoil (Sense-adapted) |
| Create | `apps/web/src/lib/holo/tier-print.ts` | Tier → foil key + body gradient + tile duo colors |
| Create | `apps/web/src/lib/holo/engine.test.ts` | Follow settle, applyFoil blanking, tier map |
| Create | `apps/web/src/lib/holo/tier-print.test.ts` | Tier → foil keys |
| Create | `apps/web/src/components/profile/holo-membership-face.tsx` | Shared face shell (body + foil slots + content slot + tile) |
| Create | `apps/web/src/hooks/use-holo-card-loop.ts` | Intersection / visibility / reduced-motion gated rAF |
| Modify | `packages/ui/src/styles/globals.css` | Add `.holo-*` component block; leave old `.subscription-card-fx` until Task 4 removes usage |
| Modify | `apps/web/src/components/profile/me-subscription-identity-card.tsx` | Wire Holo faces + loop; drop aura / Motion tilt / old glow chrome |
| Modify | `apps/web/src/lib/subscription-identity-card.ts` | Re-export or thin wrappers if tier helpers move; keep billing copy helpers |

---

### Task 1: Holo engine + tier print map (TDD)

**Files:**
- Create: `apps/web/src/lib/holo/engine.ts`
- Create: `apps/web/src/lib/holo/tier-print.ts`
- Create: `apps/web/src/lib/holo/engine.test.ts`
- Create: `apps/web/src/lib/holo/tier-print.test.ts`

**Interfaces:**
- Produces: `FOILS`, `foilByKey(key)`, `Follow`, `Kick`, `fromPointer`, `applyFrame`, `applyFoil(card, foil, opts)`, `LAYER_SLOTS`, `subscriptionHoloAppearance(tier)` → `{ foil, bodyGrad, tileDark, tileLight }`
- Consumes: `PlanTierId` from `@still/plans`

- [ ] **Step 1: Write failing tests**

```ts
// apps/web/src/lib/holo/tier-print.test.ts
import { describe, expect, test } from "bun:test";
import { subscriptionHoloAppearance } from "./tier-print";

describe("subscriptionHoloAppearance", () => {
	test("maps tiers to locked foil keys", () => {
		expect(subscriptionHoloAppearance("still").foil.key).toBe("brushed");
		expect(subscriptionHoloAppearance("attuned").foil.key).toBe("holo");
		expect(subscriptionHoloAppearance("immersed").foil.key).toBe("velvet");
		expect(subscriptionHoloAppearance("devoted").foil.key).toBe("cosmos");
	});

	test("prints are pale (high lightness) and distinct per tier", () => {
		const still = subscriptionHoloAppearance("still").bodyGrad;
		const devoted = subscriptionHoloAppearance("devoted").bodyGrad;
		expect(still).not.toBe(devoted);
		expect(still.toLowerCase()).toContain("linear-gradient");
	});
});
```

```ts
// apps/web/src/lib/holo/engine.test.ts
import { describe, expect, test } from "bun:test";
import { Follow, FOILS, applyFoil, foilByKey } from "./engine";

describe("Follow", () => {
	test("settles toward target", () => {
		const f = new Follow(1);
		f.target = { x: 0.5, y: -0.25 };
		f.step();
		expect(f.value.x).toBeCloseTo(0.5, 5);
		expect(f.value.y).toBeCloseTo(-0.25, 5);
		expect(f.settled).toBe(true);
	});
});

describe("applyFoil", () => {
	test("blanks unused layer slots", () => {
		const el = document.createElement("div");
		const foil = foilByKey("brushed"); // 2 layers
		applyFoil(el, foil, {
			tileSrc: "https://example.com/p.jpg",
			bodyGrad: "linear-gradient(115deg, #eee, #ddd)",
			tileDark: "#333",
			tileLight: "#eee",
		});
		expect(el.style.getPropertyValue("--l3-img")).toBe("none");
		expect(el.style.getPropertyValue("--l3-o")).toBe("0");
		expect(el.style.getPropertyValue("--tile-src")).toContain("example.com");
	});
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/web && bun test src/lib/holo/tier-print.test.ts src/lib/holo/engine.test.ts
```

Expected: modules missing / exports missing.

- [ ] **Step 3: Implement `engine.ts`**

Port the provided Holo `engine.ts` with these Sense changes only:

1. Remove `import { mediaUrl } from "..."` and `TILE_PHOTO` / fixed `BODY` / fixed `TILE` from `applyFoil`.
2. Add:

```ts
export function foilByKey(key: string): Foil {
	const found = FOILS.find((f) => f.key === key);
	if (!found) throw new Error(`Unknown foil: ${key}`);
	return found;
}

export interface ApplyFoilOpts {
	tileSrc: string;
	bodyGrad: string;
	tileDark: string;
	tileLight: string;
}

export function applyFoil(card: HTMLElement, foil: Foil, opts: ApplyFoilOpts): void {
	const s = card.style;
	s.setProperty("--tile-src", `url("${opts.tileSrc}")`);
	s.setProperty("--body-grad", opts.bodyGrad);
	s.setProperty("--tile-dark", opts.tileDark);
	s.setProperty("--tile-light", opts.tileLight);
	s.setProperty("--glare-o", `${foil.glare}`);
	// …same LAYER_SLOTS blanking loop as original…
}
```

3. Keep `FOILS`, `Follow`, `Kick`, `Orientation`, `applyFrame`, `adjust`, `clamp`, `fromPointer`, `MAX_TILT`, `LAYER_SLOTS`, `SUNPILLARS` intact (including `--reveal` vars even if CSS omits hearts — harmless).

- [ ] **Step 4: Implement `tier-print.ts`**

```ts
import type { PlanTierId } from "@still/plans";
import { foilByKey, type Foil } from "./engine";

export interface SubscriptionHoloAppearance {
	foil: Foil;
	bodyGrad: string;
	tileDark: string;
	tileLight: string;
}

/** Pale prints — high value, low chroma so color-dodge foil stays readable. */
const PRINT: Record<
	PlanTierId,
	{ body: string[]; tile: [string, string] }
> = {
	still: {
		body: ["#e8eef4", "#dfe6ee", "#d5dde8", "#e2e8f0"],
		tile: ["#3d4a5c", "#e2e8f0"],
	},
	attuned: {
		body: ["#f3ebe0", "#eadcc8", "#e0d0b8", "#efe4d4"],
		tile: ["#6b4e32", "#efe4d4"],
	},
	immersed: {
		body: ["#f2ecd8", "#e8dfc4", "#ddd2b0", "#efe8d4"],
		tile: ["#5c4a28", "#efe8d4"],
	},
	devoted: {
		body: ["#f4e4ee", "#ebd4e4", "#e0c4d8", "#f0dceb"],
		tile: ["#6b3a58", "#f0dceb"],
	},
};

const FOIL_KEY: Record<PlanTierId, string> = {
	still: "brushed",
	attuned: "holo",
	immersed: "velvet",
	devoted: "cosmos",
};

export function subscriptionHoloAppearance(
	tier: PlanTierId,
): SubscriptionHoloAppearance {
	const print = PRINT[tier];
	return {
		foil: foilByKey(FOIL_KEY[tier]),
		bodyGrad: `linear-gradient(115deg, ${print.body.join(", ")})`,
		tileDark: print.tile[0],
		tileLight: print.tile[1],
	};
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd apps/web && bun test src/lib/holo/tier-print.test.ts src/lib/holo/engine.test.ts
```

Note: `applyFoil` DOM test needs `document` — if Bun lacks it, use `happy-dom` already in repo or assert only `foilByKey` + Follow in engine tests and move `applyFoil` to a small node-safe pure helper that returns a `Record<string,string>` of props (preferred if DOM unavailable). Prefer: keep `applyFoil` writing to `HTMLElement` and skip DOM test under `typeof document === "undefined"` OR use Bun's happy-dom if the package already has it.

**Stop for human QA:** tests green. Reply **`go`** for Task 2.

---

### Task 2: Reconstruct `.holo-*` CSS

**Files:**
- Modify: `packages/ui/src/styles/globals.css` (new `@layer components` block after subscription-card-fx or nearby)

**Interfaces:**
- Consumes: CSS vars from `applyFrame` / `applyFoil`
- Produces: Visual foil stack usable by Task 3 DOM

- [ ] **Step 1: Add component CSS** (reconstructed — not Vault-identical)

Add a block that implements at least:

```css
@layer components {
	.holo-card {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		border-radius: 1.25rem;
		transform-style: preserve-3d;
		transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
		will-change: transform;
	}
	.holo-body {
		position: absolute;
		inset: 0;
		background: var(--body-grad);
	}
	/* Three foil slots — background from --lN-img / size / position / blend / filter / opacity */
	.holo-foil,
	.holo-foil--b,
	.holo-foil--c {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background-image: var(--l1-img, none);
		background-size: var(--l1-size, auto);
		background-position: var(--l1-x, 50%) var(--l1-y, 50%);
		background-blend-mode: var(--l1-bgblend, normal);
		mix-blend-mode: var(--l1-blend, overlay);
		filter: var(--l1-filter, none);
		opacity: var(--l1-o, 0);
	}
	.holo-foil--b {
		background-image: var(--l2-img, none);
		background-size: var(--l2-size, auto);
		background-position: var(--l2-x, 50%) var(--l2-y, 50%);
		background-blend-mode: var(--l2-bgblend, normal);
		mix-blend-mode: var(--l2-blend, overlay);
		filter: var(--l2-filter, none);
		opacity: var(--l2-o, 0);
	}
	.holo-foil--c {
		background-image: var(--l3-img, none);
		background-size: var(--l3-size, auto);
		background-position: var(--l3-x, 50%) var(--l3-y, 50%);
		background-blend-mode: var(--l3-bgblend, normal);
		mix-blend-mode: var(--l3-blend, overlay);
		filter: var(--l3-filter, none);
		opacity: var(--l3-o, 0);
	}
	.holo-glare {
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: calc(var(--glare-o, 0.5) * (0.35 + var(--off, 0) * 0.65));
		background: radial-gradient(
			circle at var(--gx, 50%) var(--gy, 50%),
			rgba(255, 255, 255, 0.55),
			transparent 42%
		);
		mix-blend-mode: soft-light;
	}
	.holo-smear {
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: var(--smear, 0);
		background: linear-gradient(
			var(--smear-angle, 0deg),
			transparent,
			rgba(255, 255, 255, 0.35),
			transparent
		);
		mix-blend-mode: soft-light;
	}
	.holo-spot {
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: calc(var(--spot, 0) * 0.55);
		background: radial-gradient(
			circle at var(--gx, 50%) var(--gy, 50%),
			rgba(255, 255, 255, 0.45),
			transparent 50%
		);
		mix-blend-mode: color-dodge;
	}
	.holo-noise,
	.holo-sheen,
	.holo-pattern,
	.holo-pattern--lit {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	/* Quiet grain only — no heart artwork */
	.holo-noise {
		opacity: 0.12;
		background-image: /* same GRAIN data-uri as engine or a short feTurbulence svg */;
		mix-blend-mode: overlay;
	}
	.holo-content {
		position: relative;
		z-index: 2;
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 1.25rem 1.35rem;
		color: oklch(0.22 0.02 280);
		text-shadow: calc(var(--emboss-x, 0px) * -1) calc(var(--emboss-y, 0px) * -1)
			0 rgba(255, 255, 255, 0.35);
	}
	.holo-tile {
		position: relative;
		width: 5.5rem;
		aspect-ratio: 1;
		border-radius: 0.85rem;
		overflow: hidden;
		isolation: isolate;
		align-self: flex-end;
	}
	.holo-tile__photo,
	.holo-tile__photo--neg {
		position: absolute;
		inset: 0;
		background-image: var(--tile-src);
		background-size: cover;
		background-position: var(--tile-x, 50%) center;
	}
	.holo-tile__photo--neg {
		filter: invert(1) hue-rotate(var(--tile-hue, 150deg));
		-webkit-mask-image: linear-gradient(
			var(--tile-sweep-angle, 90deg),
			#000 0%,
			#000 calc(var(--tile-invert, 0) * 100%),
			transparent calc(var(--tile-invert, 0) * 100% + 1%)
		);
		mask-image: linear-gradient(
			var(--tile-sweep-angle, 90deg),
			#000 0%,
			#000 calc(var(--tile-invert, 0) * 100%),
			transparent calc(var(--tile-invert, 0) * 100% + 1%)
		);
	}
	.holo-tile__duo {
		position: absolute;
		inset: 0;
		background: linear-gradient(135deg, var(--tile-dark), var(--tile-light));
		mix-blend-mode: color;
		opacity: 0.85;
		pointer-events: none;
	}
	.holo-tile__gloss {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: radial-gradient(
			circle at var(--gx, 40%) var(--gy, 30%),
			rgba(255, 255, 255, 0.35),
			transparent 55%
		);
		mix-blend-mode: soft-light;
	}
	@media (prefers-reduced-motion: reduce) {
		.holo-card {
			transform: none;
		}
	}
}
```

Implementer must flesh edge catches (`--edge-*`) as thin inset box-shadows if time; omit hearts. Do not style `.holo-pattern` with heart SVGs.

- [ ] **Step 2: Smoke-check** — open Story/temp page optional; otherwise Task 3 mounts it. No automated CSS test required.

**Stop for human:** CSS landed. Reply **`go`** for Task 3.

---

### Task 3: Face shell + rAF loop hook

**Files:**
- Create: `apps/web/src/components/profile/holo-membership-face.tsx`
- Create: `apps/web/src/hooks/use-holo-card-loop.ts`

**Interfaces:**
- Consumes: `applyFoil`, `applyFrame`, `Follow`, `Kick`, `fromPointer`, `subscriptionHoloAppearance`, foil live fields
- Produces: `<HoloMembershipFace ref content tileSrc … />`, `useHoloCardLoop({ hostRef, faceRefs, foil, live, enabled })`

- [ ] **Step 1: `holo-membership-face.tsx`**

```tsx
"use client";

import type { ReactNode, Ref } from "react";

/** Shared print + foil DOM for identity and billing faces. */
export function HoloMembershipFace({
	ref,
	className,
	children,
}: {
	ref?: Ref<HTMLDivElement>;
	className?: string;
	children: ReactNode;
}) {
	return (
		<div ref={ref} className={`holo-card ${className ?? ""}`.trim()} style={{ aspectRatio: "1.586" }}>
			<div className="holo-body" />
			<div className="holo-pattern" aria-hidden />
			<div className="holo-pattern--lit" aria-hidden />
			<div className="holo-foil" aria-hidden />
			<div className="holo-foil--b" aria-hidden />
			<div className="holo-foil--c" aria-hidden />
			<div className="holo-smear" aria-hidden />
			<div className="holo-spot" aria-hidden />
			<div className="holo-noise" aria-hidden />
			<div className="holo-glare" aria-hidden />
			<div className="holo-sheen" aria-hidden />
			<div className="holo-content">{children}</div>
		</div>
	);
}

export function HoloMembershipTile() {
	return (
		<div className="holo-tile" aria-hidden>
			<div className="holo-tile__photo" />
			<div className="holo-tile__photo--neg" />
			<div className="holo-tile__duo" />
			<div className="holo-tile__gloss" />
		</div>
	);
}
```

(Use the repo’s React 19 `ref` prop pattern already used in `HoloBody` paste / existing components.)

- [ ] **Step 2: `use-holo-card-loop.ts`**

Port the rAF / Follow / Kick / idle / grab / release logic from the pasted `HoloCard` `useEffect`, with:

- `enabled = !reduceMotion && !softwareGpu && onScreen && !document.hidden`
- On each frame: `applyFrame` to **every** face ref in `faceRefs` (front + back) with the same tilt/sheet/foil/live/motion
- On mount / foil change: `applyFoil` each face with `ApplyFoilOpts`
- Skip `onTransitionChange` / Vault `view-transition` unless that helper already exists under `apps/web` — if missing, omit
- Skip device orientation in v1
- When `!enabled`, call `applyFrame` once at `{x:0,y:0}` and cancel rAF

- [ ] **Step 3: Manual sanity** — temporary mount optional; prefer Task 4 integration.

**Stop for human.** Reply **`go`** for Task 4.

---

### Task 4: Wire `MeSubscriptionIdentityCard`

**Files:**
- Modify: `apps/web/src/components/profile/me-subscription-identity-card.tsx`
- Modify: `apps/web/src/lib/subscription-identity-card.ts` only if needed for exports
- Optionally leave unused `.subscription-card-fx` CSS for a later cleanup (YAGNI: do not delete large CSS in this task unless unused and greppable)

**Interfaces:**
- Consumes: Task 1–3 APIs, `profilePatronAvatarImageUrl(handle)` (or existing portrait URL helper used elsewhere — prefer proxy URL, never raw `user.image` in Next Image; for CSS `background-image` use the same proxy absolute/path URL)

- [ ] **Step 1: Replace Motion tilt host**

1. Remove `useMotionValue` / spring tilt pointer handlers used for `--rx`/`--ry` (keep Motion **only** for flip `rotateY` if still used).
2. Wrap stage in `hostRef`; mount two `HoloMembershipFace` refs (front + back) inside the existing flip shell.
3. Front children: name, handle, tier, `HoloMembershipTile` (no `PatronPortraitWithAura`).
4. Back children: existing billing UI (status, manage button) — still inside `holo-content`.
5. `const appearance = subscriptionHoloAppearance(effectiveTier)`.
6. `useHoloCardLoop({ hostRef, faceRefs: [front, back], foil: appearance.foil, opts: { tileSrc: portraitUrl, bodyGrad: appearance.bodyGrad, tileDark, tileLight }, enabled: tiltEnabled })` where `tiltEnabled` matches hover-capable + !reduceMotion + !softwareGpu.
7. Remove old glow `filter: drop-shadow`, `subscription-card-fx--*` wrappers from the card faces.
8. Preserve: flip control, Escape, aria-live, companion rail, Manage portal, upgrade links.

- [ ] **Step 2: Portrait URL**

```ts
import { profilePatronAvatarImageUrl } from "@/lib/…"; // existing helper — grep and use the real path
const tileSrc = profilePatronAvatarImageUrl(handle);
```

- [ ] **Step 3: Manual QA checklist** (human)

1. `/me/settings/subscription` — foil moves with lag on pointer.  
2. Flip to billing — foil still responds.  
3. Staff/planOverride Still / Attuned / Immersed / Devoted — different foil + print.  
4. Portrait polarity sweeps at steep tilt.  
5. Reduced motion / soft GPU — settled, no busy rAF.  
6. Manage subscription still works.

**Stop for human QA.** Reply **`ok`** when signed off (or list bugs).

---

### Task 5 (optional polish): Edge catch + dead CSS

Only if Task 4 QA passes and human says **`go`**:

- Wire `--edge-*` as inset highlights on `.holo-card`
- Remove unused `.subscription-card-fx*` rules if nothing else imports them (`rg subscription-card-fx`)
- Tune Immersed/Devoted opacities if foil reads muddy on pale prints

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| Port engine, drop Kamila/mediaUrl | 1 |
| Tier foil map + pale prints | 1 |
| Reconstruct CSS | 2 |
| Both faces foil + shared loop | 3–4 |
| Duotone tile, no aura | 4 |
| Keep flip / billing / rail | 4 |
| Soft GPU / reduced motion | 3–4 |
| No playground / no API | N/A (non-goal) |

## Placeholder scan

No TBD steps; commit steps omitted (human must ask to commit).
