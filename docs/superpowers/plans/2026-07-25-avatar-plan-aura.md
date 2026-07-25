# Avatar Plan Auras Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the always-animating diary-metal `BorderBeam` on patron portraits with plan-tier avatar auras — static gradient rim at rest, hover-only effects that scale from CSS sheen (Attuned) to a lazy WebGL shader (Devoted).

**Architecture:** Server batch-resolves each patron's effective plan tier (`resolveEffectiveTier` from `@still/plans`) and attaches `planTier` next to `diaryMetalTier` in every patron-shaped payload. Web renames `PatronPortraitWithMetalTier` → `PatronPortraitWithAura`, which delegates tier chrome to a new `avatar-aura` module: CSS rim + hover effects for Attuned/Immersed, a `next/dynamic` WebGL canvas for Devoted with CSS holo fallback.

**Tech Stack:** Bun (server tests), Drizzle, Elysia, Next.js App Router, Tailwind v4 (`packages/ui/src/styles/globals.css`), raw WebGL1 + inline GLSL (no new dependencies).

**Spec:** `docs/superpowers/specs/2026-07-25-avatar-plan-aura-design.md`

**Conventions that apply:**
- Windows PowerShell — chain commands with `;`, not `&&`.
- Commit after every task (lefthook runs biome on staged files).
- `parsePlanTierId` / `resolveEffectiveTier` / `PlanTierId` already exist in `packages/plans/src/index.ts` — do not re-implement.
- `diaryMetalTier` stays on all payloads — we only **add** `planTier`, we do not remove anything server-side.

---

### Task 1: Server batch plan-tier helper

**Files:**
- Create: `apps/server/src/lib/patron-plan-tier.ts`
- Test: `apps/server/src/lib/patron-plan-tier.test.ts`

**Step 1: Write the failing test**

Only test the pure map-reader (the DB fetcher follows the untested `fetchDiaryLogCountsForUserIds` precedent in `diary-metal-tier.ts` — same file, no DB test there either):

```ts
import { describe, expect, it } from "bun:test";
import { planTierForUserId } from "./patron-plan-tier";

describe("planTierForUserId", () => {
	it("returns the mapped tier", () => {
		const tiers = new Map([["u1", "devoted" as const]]);
		expect(planTierForUserId("u1", tiers)).toBe("devoted");
	});

	it("defaults missing users to still", () => {
		expect(planTierForUserId("ghost", new Map())).toBe("still");
	});
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/server; bun test src/lib/patron-plan-tier.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

```ts
import { db, profile } from "@still/db";
import {
	type PlanTierId,
	parsePlanTierId,
	resolveEffectiveTier,
} from "@still/plans";
import { inArray } from "drizzle-orm";

/**
 * Batch effective plan tiers for avatar aura hydration — one profile query per
 * page. No plan_feature_grant join: grants unlock features, never tier.
 */
export async function fetchPlanTiersForUserIds(
	userIds: readonly string[],
): Promise<Map<string, PlanTierId>> {
	const unique = [...new Set(userIds.filter(Boolean))];
	const map = new Map<string, PlanTierId>();
	if (unique.length === 0) return map;

	const rows = await db
		.select({
			userId: profile.userId,
			subscriptionTier: profile.subscriptionTier,
			planOverride: profile.planOverride,
		})
		.from(profile)
		.where(inArray(profile.userId, unique));

	for (const row of rows) {
		map.set(
			row.userId,
			resolveEffectiveTier({
				subscriptionTier: parsePlanTierId(row.subscriptionTier),
				planOverride:
					row.planOverride == null || row.planOverride === ""
						? null
						: parsePlanTierId(row.planOverride),
			}),
		);
	}
	return map;
}

/** Missing profile rows read as the free tier. */
export function planTierForUserId(
	userId: string,
	tiers: Map<string, PlanTierId>,
): PlanTierId {
	return tiers.get(userId) ?? "still";
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/server; bun test src/lib/patron-plan-tier.test.ts`
Expected: PASS (2 tests).

**Step 5: Commit**

```
git add apps/server/src/lib/patron-plan-tier.ts apps/server/src/lib/patron-plan-tier.test.ts; git commit -m "feat(server): batch plan-tier resolver for avatar auras"
```

---

### Task 2: Attach `planTier` to the engagement payloads (representative builder, TDD)

**Files:**
- Modify: `apps/server/src/lib/listing-engagement-query.ts`
- Test: whichever existing test covers engagement payload shape — check `apps/server/src/lib/listing-engagement-query.test.ts` / `apps/server/src/routes/movies.test.ts` for the `diaryMetalTier` assertion pattern and mirror it for `planTier`. If the existing coverage is route-level with a live DB double, extend that same test.

**Step 1: Extend the existing shape test to expect `planTier`** (mirror how `diaryMetalTier` is asserted). Run it, expect FAIL.

**Step 2: Implement.** In `listing-engagement-query.ts`:

1. Import: `import { type PlanTierId } from "@still/plans";` and `import { fetchPlanTiersForUserIds, planTierForUserId } from "./patron-plan-tier";`
2. Add `planTier: PlanTierId;` to `ListingEngagementWatchItem` (line ~71, next to `diaryMetalTier`) and `ListingEngagementPatronItem` (line ~97).
3. In both hydrators (the functions calling `fetchDiaryLogCountsForUserIds` at lines ~243 and ~283), fetch tiers in parallel and map:

```ts
const [logCounts, planTiers] = await Promise.all([
	fetchDiaryLogCountsForUserIds(rows.map((row) => row.userId)),
	fetchPlanTiersForUserIds(rows.map((row) => row.userId)),
]);
```

and in each `rows.map(...)` add `planTier: planTierForUserId(row.userId, planTiers),` next to the `diaryMetalTier` line.

**Step 3: Run the extended test.** Expected: PASS.

**Step 4: Commit**

```
git add -A apps/server/src; git commit -m "feat(server): planTier on listing engagement payloads"
```

---

### Task 3: Attach `planTier` to the remaining patron-shaped payload builders

**Files (all Modify):** every server file that computes `diaryMetalTier` — same recipe as Task 2 (parallel `fetchPlanTiersForUserIds` next to the existing `fetchDiaryLogCountsForUserIds` call, `planTier` field next to `diaryMetalTier` in the item type and mapper):

- `apps/server/src/lib/leaderboard-query.ts`
- `apps/server/src/lib/members-leaderboard-query.ts`
- `apps/server/src/lib/members-leaderboard-items-query.ts`
- `apps/server/src/lib/profile-search.ts`
- `apps/server/src/lib/profile-media.ts`
- `apps/server/src/routes/profiles.ts`
- `apps/server/src/lib/movie-following-ratings.ts`
- `apps/server/src/lib/listing-presence.ts`
- `apps/server/src/lib/feed-rating-divergence.ts`
- `apps/server/src/lib/creator-recognition.ts`
- `apps/server/src/lib/month-recap-query.ts`
- `apps/server/src/routes/reviews.ts`
- `apps/server/src/routes/movies.ts`

Notes for the executor:
- Grep each file for `diaryMetalTier` first; some receive it pre-computed from a shared hydrator — in that case plumb `planTier` through the same path rather than adding a second DB call.
- Where a file already awaits `fetchDiaryLogCountsForUserIds`, convert to `Promise.all` as in Task 2 — do not add a sequential await.
- Do not touch `apps/server/src/lib/diary-metal-tier.ts` itself.

**Step 1:** Apply the recipe file by file.
**Step 2:** Run: `cd apps/server; bun test` (full suite — remember `00-realtime-publish.test.ts` ordering is handled by the default run order). Expected: PASS.
**Step 3:** Run: `cd apps/server; bun run check-types`. Expected: clean.
**Step 4: Commit**

```
git add -A apps/server/src; git commit -m "feat(server): planTier on all patron-shaped payloads"
```

---

### Task 4: Web aura tier config

**Files:**
- Create: `apps/web/src/components/profile/avatar-aura/avatar-aura-tier.ts`
- Test: `apps/web/src/components/profile/avatar-aura/avatar-aura-tier.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "bun:test";
import {
	avatarAuraRimStyle,
	hasAvatarAura,
	resolveAvatarAuraTier,
} from "./avatar-aura-tier";

describe("resolveAvatarAuraTier", () => {
	it("passes known tiers through", () => {
		expect(resolveAvatarAuraTier("devoted")).toBe("devoted");
	});
	it("coerces null/undefined/unknown to still", () => {
		expect(resolveAvatarAuraTier(null)).toBe("still");
		expect(resolveAvatarAuraTier(undefined)).toBe("still");
		expect(resolveAvatarAuraTier("chromatic")).toBe("still");
	});
});

describe("hasAvatarAura", () => {
	it("is false for still, true for paid tiers", () => {
		expect(hasAvatarAura("still")).toBe(false);
		expect(hasAvatarAura("attuned")).toBe(true);
		expect(hasAvatarAura("immersed")).toBe(true);
		expect(hasAvatarAura("devoted")).toBe(true);
	});
});

describe("avatarAuraRimStyle", () => {
	it("returns a conic gradient for every paid tier", () => {
		for (const tier of ["attuned", "immersed", "devoted"] as const) {
			expect(avatarAuraRimStyle(tier).background).toContain("conic-gradient");
		}
	});
});
```

Run: `cd apps/web; bun test src/components/profile/avatar-aura/avatar-aura-tier.test.ts` — expect FAIL.

**Step 2: Implement**

```ts
import { type PlanTierId, parsePlanTierId } from "@still/plans";
import type { CSSProperties } from "react";

/** Coerce unknown API values (missing field on stale payloads) to a tier. */
export function resolveAvatarAuraTier(value: unknown): PlanTierId {
	return parsePlanTierId(value);
}

/** Free tier renders the plain portrait — no rim, no hover effect. */
export function hasAvatarAura(tier: PlanTierId): boolean {
	return tier !== "still";
}

type PaidTier = Exclude<PlanTierId, "still">;

/**
 * Rest-state rim gradients — the static tier cue. Muted stops so the rim reads
 * as chrome, not a notification ring; hover effects carry the spectacle.
 */
const RIM_GRADIENTS: Record<PaidTier, string> = {
	attuned:
		"conic-gradient(from 210deg, oklch(0.62 0.07 75), oklch(0.48 0.05 60), oklch(0.7 0.09 85), oklch(0.62 0.07 75))",
	immersed:
		"conic-gradient(from 210deg, oklch(0.78 0.12 85), oklch(0.6 0.1 70), oklch(0.85 0.13 95), oklch(0.78 0.12 85))",
	devoted:
		"conic-gradient(from 210deg, oklch(0.75 0.1 320), oklch(0.78 0.11 200), oklch(0.8 0.12 90), oklch(0.74 0.1 260), oklch(0.75 0.1 320))",
};

export function avatarAuraRimStyle(tier: PaidTier): CSSProperties {
	return { background: RIM_GRADIENTS[tier] };
}
```

**Step 3:** Run the test — expect PASS.
**Step 4: Commit**

```
git add apps/web/src/components/profile/avatar-aura; git commit -m "feat(web): avatar aura tier config"
```

---

### Task 5: Aura CSS (rim geometry, sweep, glow, holo fallback)

**Files:**
- Modify: `packages/ui/src/styles/globals.css` — add an `avatar-aura` block in `@layer components`.

**Step 1: Add the styles** (all hover effects live behind `(hover: hover)` and `(prefers-reduced-motion: no-preference)` so touch and reduced-motion get rim-only for free):

```css
/* Avatar plan auras — rest rim is static; motion is hover-gated per tier. */
@layer components {
	.avatar-aura-rim {
		padding: 1.5px;
		border-radius: 9999px;
	}

	.avatar-aura-layer {
		position: absolute;
		inset: 0;
		border-radius: 9999px;
		overflow: hidden;
		pointer-events: none;
		opacity: 0;
	}

	@media (hover: hover) and (prefers-reduced-motion: no-preference) {
		/* Attuned — one diagonal projector sweep per hover-enter. */
		.avatar-aura-root:hover .avatar-aura-sweep::before {
			content: "";
			position: absolute;
			inset: -40%;
			background: linear-gradient(
				115deg,
				transparent 42%,
				oklch(0.98 0.02 90 / 0.55) 50%,
				transparent 58%
			);
			animation: avatar-aura-sweep 600ms ease-out forwards;
		}
		.avatar-aura-root:hover .avatar-aura-sweep {
			opacity: 1;
		}

		/* Immersed — breathing golden glow + drifting anamorphic flare. */
		.avatar-aura-root:hover .avatar-aura-glow {
			opacity: 1;
			background: radial-gradient(
				circle at 50% 42%,
				oklch(0.85 0.13 90 / 0.32),
				transparent 68%
			);
			animation: avatar-aura-breathe 2.4s ease-in-out infinite alternate;
		}
		.avatar-aura-root:hover .avatar-aura-flare::before {
			content: "";
			position: absolute;
			top: 46%;
			left: -60%;
			width: 120%;
			height: 8%;
			border-radius: 9999px;
			background: linear-gradient(
				90deg,
				transparent,
				oklch(0.92 0.1 95 / 0.5),
				transparent
			);
			filter: blur(1px);
			animation: avatar-aura-flare 3.2s ease-in-out infinite;
		}
		.avatar-aura-root:hover .avatar-aura-flare {
			opacity: 1;
		}

		/* Devoted CSS fallback — holo foil when WebGL is unavailable. */
		.avatar-aura-root:hover .avatar-aura-holo {
			opacity: 1;
			background: conic-gradient(
				from 0deg,
				oklch(0.8 0.12 320 / 0.28),
				oklch(0.82 0.12 200 / 0.28),
				oklch(0.85 0.13 90 / 0.28),
				oklch(0.8 0.11 260 / 0.28),
				oklch(0.8 0.12 320 / 0.28)
			);
			mix-blend-mode: screen;
			animation: avatar-aura-holo 4s linear infinite;
		}
	}

	@keyframes avatar-aura-sweep {
		from {
			transform: translateX(-55%);
		}
		to {
			transform: translateX(55%);
		}
	}
	@keyframes avatar-aura-breathe {
		from {
			opacity: 0.5;
		}
		to {
			opacity: 0.85;
		}
	}
	@keyframes avatar-aura-flare {
		0%,
		100% {
			transform: translateX(-12%);
			opacity: 0.4;
		}
		50% {
			transform: translateX(12%);
			opacity: 0.9;
		}
	}
	@keyframes avatar-aura-holo {
		to {
			filter: hue-rotate(360deg);
		}
	}
}
```

**Step 2:** Start web dev if not running and eyeball no global regressions (styles are inert until Task 6 adds the class names).
**Step 3: Commit**

```
git add packages/ui/src/styles/globals.css; git commit -m "feat(ui): avatar aura rim + hover effect styles"
```

---

### Task 6: `AvatarAura` wrapper (CSS tiers + Devoted mount state machine)

**Files:**
- Create: `apps/web/src/components/profile/avatar-aura/avatar-aura.tsx`

**Step 1: Implement**

```tsx
"use client";

import type { PlanTierId } from "@still/plans";
import { cn } from "@still/ui/lib/utils";
import dynamic from "next/dynamic";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
	avatarAuraRimStyle,
	hasAvatarAura,
} from "@/components/profile/avatar-aura/avatar-aura-tier";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { useSoftwareGpuRendering } from "@/lib/use-software-gpu-rendering";

/** Loaded on first Devoted hover only — keeps GLSL out of the main bundle. */
const AvatarAuraDevotedCanvas = dynamic(
	() =>
		import("@/components/profile/avatar-aura/avatar-aura-devoted-canvas").then(
			(mod) => mod.AvatarAuraDevotedCanvas,
		),
	{ ssr: false },
);

const HOVER_INTENT_MS = 80;
const HOVER_EXIT_GRACE_MS = 300;

export function AvatarAura({
	tier,
	children,
	className,
}: {
	tier: PlanTierId;
	children: ReactNode;
	className?: string;
}) {
	const reducedMotion = usePrefersReducedMotion();
	const softwareGpu = useSoftwareGpuRendering();
	const [devotedActive, setDevotedActive] = useState(false);
	const [webglFailed, setWebglFailed] = useState(false);
	const intentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const wantsCanvas =
		tier === "devoted" && !reducedMotion && !softwareGpu && !webglFailed;

	const handleEnter = useCallback(() => {
		if (!wantsCanvas) return;
		if (exitTimer.current) clearTimeout(exitTimer.current);
		// Intent delay kills canvas churn while sweeping the cursor across a feed.
		intentTimer.current = setTimeout(
			() => setDevotedActive(true),
			HOVER_INTENT_MS,
		);
	}, [wantsCanvas]);

	const handleLeave = useCallback(() => {
		if (intentTimer.current) clearTimeout(intentTimer.current);
		// Exit grace lets a quick re-enter reuse the live context.
		exitTimer.current = setTimeout(
			() => setDevotedActive(false),
			HOVER_EXIT_GRACE_MS,
		);
	}, []);

	useEffect(
		() => () => {
			if (intentTimer.current) clearTimeout(intentTimer.current);
			if (exitTimer.current) clearTimeout(exitTimer.current);
		},
		[],
	);

	if (!hasAvatarAura(tier)) {
		return <>{children}</>;
	}

	return (
		<span
			className={cn(
				"avatar-aura-root avatar-aura-rim relative inline-flex size-full",
				className,
			)}
			style={avatarAuraRimStyle(tier)}
			onPointerEnter={handleEnter}
			onPointerLeave={handleLeave}
		>
			<span className="relative size-full overflow-hidden rounded-full">
				{children}
				{tier === "attuned" ? (
					<span aria-hidden className="avatar-aura-layer avatar-aura-sweep" />
				) : null}
				{tier === "immersed" ? (
					<>
						<span aria-hidden className="avatar-aura-layer avatar-aura-glow" />
						<span aria-hidden className="avatar-aura-layer avatar-aura-flare" />
					</>
				) : null}
				{tier === "devoted" && !wantsCanvas && !reducedMotion ? (
					<span aria-hidden className="avatar-aura-layer avatar-aura-holo" />
				) : null}
				{devotedActive ? (
					<AvatarAuraDevotedCanvas onWebglFailed={() => setWebglFailed(true)} />
				) : null}
			</span>
		</span>
	);
}
```

Notes:
- Attuned/Immersed motion is pure CSS on `:hover` — the JS state machine only exists for the Devoted canvas.
- When `handleEnter` fires on touch, pointer-enter still happens on tap; the canvas is decorative and clipped, so v1 accepts that (CSS effects are already `(hover: hover)`-gated). If QA dislikes it, gate `handleEnter` on `event.pointerType === "mouse"`.

**Step 2:** `cd apps/web; bunx tsc --noEmit` (or rely on IDE lints). Expected: clean except the not-yet-created canvas module — proceed to Task 7 before the final check if so.
**Step 3: Commit** (together with Task 7 if the import forces it)

---

### Task 7: Devoted WebGL canvas

**Files:**
- Create: `apps/web/src/components/profile/avatar-aura/avatar-aura-devoted-canvas.tsx`

**Step 1: Implement**

```tsx
"use client";

import { useEffect, useRef } from "react";

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
	vUv = aPos * 0.5 + 0.5;
	gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

/**
 * Chromatic reel — RGB split radiating from the cursor plus iridescent
 * value-noise grain screened over the portrait.
 */
const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uSampler;
uniform vec2 uMouse;
uniform float uTime;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
		mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
		f.y
	);
}

void main() {
	vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
	vec2 fromMouse = uv - uMouse;
	float dist = length(fromMouse);
	float pull = smoothstep(0.55, 0.0, dist) * 0.012;

	float r = texture2D(uSampler, uv + fromMouse * pull).r;
	float g = texture2D(uSampler, uv).g;
	float b = texture2D(uSampler, uv - fromMouse * pull).b;

	float grain = noise(uv * 90.0 + uTime * 0.8);
	vec3 iridescent = 0.5 + 0.5 * cos(6.2831 * (grain + uTime * 0.05) + vec3(0.0, 2.1, 4.2));
	vec3 color = vec3(r, g, b) + iridescent * grain * 0.10;

	gl_FragColor = vec4(color, 1.0);
}
`;

export function AvatarAuraDevotedCanvas({
	onWebglFailed,
}: {
	onWebglFailed: () => void;
}) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const failedRef = useRef(onWebglFailed);
	failedRef.current = onWebglFailed;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		// The portrait <img> is a sibling inside the same clipped circle.
		const image = canvas.parentElement?.querySelector("img");
		if (!(image instanceof HTMLImageElement) || !image.complete) {
			failedRef.current();
			return;
		}

		const gl = canvas.getContext("webgl", {
			alpha: true,
			antialias: false,
			preserveDrawingBuffer: false,
		});
		if (!gl) {
			failedRef.current();
			return;
		}

		let raf = 0;
		const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

		try {
			const compile = (type: number, src: string) => {
				const shader = gl.createShader(type);
				if (!shader) throw new Error("shader alloc failed");
				gl.shaderSource(shader, src);
				gl.compileShader(shader);
				if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
					throw new Error(gl.getShaderInfoLog(shader) ?? "compile failed");
				}
				return shader;
			};
			const program = gl.createProgram();
			if (!program) throw new Error("program alloc failed");
			gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
			gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
			gl.linkProgram(program);
			if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
				throw new Error(gl.getProgramInfoLog(program) ?? "link failed");
			}
			gl.useProgram(program);

			const quad = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, quad);
			gl.bufferData(
				gl.ARRAY_BUFFER,
				new Float32Array([-1, -1, 3, -1, -1, 3]),
				gl.STATIC_DRAW,
			);
			const aPos = gl.getAttribLocation(program, "aPos");
			gl.enableVertexAttribArray(aPos);
			gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

			const texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			// Throws on cross-origin-tainted images → CSS holo fallback.
			gl.texImage2D(
				gl.TEXTURE_2D,
				0,
				gl.RGBA,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				image,
			);

			const size = canvas.parentElement?.getBoundingClientRect();
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = Math.max(1, Math.round((size?.width ?? 72) * dpr));
			canvas.height = Math.max(1, Math.round((size?.height ?? 72) * dpr));
			gl.viewport(0, 0, canvas.width, canvas.height);

			const uMouse = gl.getUniformLocation(program, "uMouse");
			const uTime = gl.getUniformLocation(program, "uTime");
			const start = performance.now();

			const onPointerMove = (event: PointerEvent) => {
				const rect = canvas.getBoundingClientRect();
				mouse.tx = (event.clientX - rect.left) / rect.width;
				mouse.ty = (event.clientY - rect.top) / rect.height;
			};
			window.addEventListener("pointermove", onPointerMove, { passive: true });

			const onContextLost = (event: Event) => {
				event.preventDefault();
				failedRef.current();
			};
			canvas.addEventListener("webglcontextlost", onContextLost);

			const frame = () => {
				// Lerp toward the cursor for a trailing, filmic response.
				mouse.x += (mouse.tx - mouse.x) * 0.12;
				mouse.y += (mouse.ty - mouse.y) * 0.12;
				gl.uniform2f(uMouse, mouse.x, mouse.y);
				gl.uniform1f(uTime, (performance.now() - start) / 1000);
				gl.drawArrays(gl.TRIANGLES, 0, 3);
				raf = requestAnimationFrame(frame);
			};
			raf = requestAnimationFrame(frame);

			return () => {
				cancelAnimationFrame(raf);
				window.removeEventListener("pointermove", onPointerMove);
				canvas.removeEventListener("webglcontextlost", onContextLost);
				gl.getExtension("WEBGL_lose_context")?.loseContext();
			};
		} catch {
			failedRef.current();
			return () => cancelAnimationFrame(raf);
		}
	}, []);

	return (
		<canvas
			ref={canvasRef}
			aria-hidden
			className="pointer-events-none absolute inset-0 size-full rounded-full"
		/>
	);
}
```

**Step 2:** `cd apps/web; bunx tsc --noEmit` — expect clean (Task 6 import now resolves). Fix any Biome lints via IDE diagnostics.
**Step 3: Commit** (Tasks 6+7 together)

```
git add apps/web/src/components/profile/avatar-aura; git commit -m "feat(web): AvatarAura wrapper + Devoted WebGL canvas"
```

---

### Task 8: `PatronPortraitWithAura` + rename sweep + web payload types

**Files:**
- Create: `apps/web/src/components/profile/patron-portrait-with-aura.tsx` (adapted from `patron-portrait-with-metal-tier.tsx`)
- Delete: `apps/web/src/components/profile/patron-portrait-with-metal-tier.tsx`
- Modify (call sites — every current importer of `PatronPortraitWithMetalTier`):
  - `apps/web/src/components/home/patron-members-ledger-panel.tsx`
  - `apps/web/src/components/members/members-leaderboard-podium.tsx`
  - `apps/web/src/components/members/members-leaderboard-row.tsx`
  - `apps/web/src/components/home/home-leaderboard-row.tsx`
  - `apps/web/src/components/home/home-leaderboard-podium.tsx`
  - `apps/web/src/components/home/patron-watch-ledger-panel.tsx`
  - `apps/web/src/components/home/home-curator-spotlights.tsx`
  - `apps/web/src/components/home/home-friend-activity-rail.tsx`
  - `apps/web/src/components/home/search-dialog-people-row.tsx`
  - `apps/web/src/components/profile/profile-patron-header.tsx`
  - `apps/web/src/components/profile/profile-follows-drawer.tsx`
  - `apps/web/src/components/movie/movie-detail-engagement-drawer-rows.tsx`
  - `apps/web/src/components/movie/movie-detail-following-ratings.tsx`
  - `apps/web/src/components/movie/movie-detail-reviews-carousel.tsx`
  - `apps/web/src/components/movie/listing-presence-drawer.tsx`
  - `apps/web/src/components/movie/listing-presence-row.tsx`
  - `apps/web/src/components/review/review-detail-sheet.tsx`
  - `apps/web/src/components/feed/feed-person-avatar.tsx`
  - `apps/web/src/components/app/app-user-account-menu.tsx`
  - `apps/web/src/components/app/nav-user-avatar.tsx`
  - `apps/web/src/components/app/month-recap-podium.tsx`
  - `apps/web/src/components/staff/staff-plans-topbar.tsx`
- Modify (payload types — add `planTier?: PlanTierId | string | null` where `diaryMetalTier` exists; keep `diaryMetalTier` fields in place):
  - `apps/web/src/lib/fetch-listing-engagement.ts`
  - `apps/web/src/lib/home-leaderboard-types.ts`
  - `apps/web/src/lib/members-leaderboard-types.ts`
  - `apps/web/src/lib/members-leaderboard-item-types.ts`
  - `apps/web/src/lib/profile-search-query.ts`
  - `apps/web/src/lib/fetch-listing-presence.ts`
  - `apps/web/src/lib/month-recap-types.ts`
  - `apps/web/src/lib/patron-nav-user.ts`
  - `apps/web/src/lib/home-friend-rail.ts`
  - `apps/web/src/lib/fetch-me-profile.ts`
  - `apps/web/src/lib/creator-recognition.ts`
  - plus any prop-chain files surfaced by the typecheck.

**Step 1: Create the new component.** Copy `patron-portrait-with-metal-tier.tsx` and change:

1. Props: replace `diaryMetalTier?: DiaryMetalTier | null` with `planTier?: PlanTierId | string | null` (string-tolerant — Eden payloads arrive untyped; resolved through `resolveAvatarAuraTier`).
2. Remove imports: `BorderBeam`, `DIARY_METAL_BORDER_BEAM_STRENGTH`, `diaryMetalBorderBeamColorVariant`, `usePrefersReducedMotion` (only used for the beam). Keep `isCircularPatronPortraitClass` (still imported from `@/lib/diary-metal-tier`).
3. Portrait branch becomes:

```tsx
const tier = resolveAvatarAuraTier(planTier);
const portrait =
	!hasAvatarAura(tier) || !circularPortrait ? (
		<PatronPortraitAvatar
			handle={handle}
			className={innerPortraitClassName}
			width={width}
			height={height}
			{...avatarProps}
		/>
	) : (
		<AvatarAura tier={tier}>
			<PatronPortraitAvatar
				handle={handle}
				{...avatarProps}
				width={width}
				height={height}
				className={cn(innerPortraitClassName, "rounded-full")}
			/>
		</AvatarAura>
	);
```

4. Export names: `PatronPortraitWithAura`, `PatronPortraitWithAuraProps`. Keep the presence-dot logic byte-identical.

**Step 2: Rename sweep.** In every call-site file: update the import path/name, component JSX name, and swap `diaryMetalTier={...}` prop to `planTier={...planTier}` reading the new payload field. Where the payload type doesn't have `planTier` yet, add it in the matching lib file (see list above). `feed-person-avatar.tsx` re-exports a wrapper used across feed surfaces — update its prop name too and let the typecheck surface downstream call sites.

**Step 3: Delete** `patron-portrait-with-metal-tier.tsx`. Run `rg "PatronPortraitWithMetalTier|patron-portrait-with-metal-tier" apps/web` — expect zero hits.

**Step 4:** `cd apps/web; bunx tsc --noEmit` — expect clean. Fix stragglers.

**Step 5: Commit**

```
git add -A apps/web/src; git commit -m "feat(web): PatronPortraitWithAura replaces diary-metal BorderBeam portraits"
```

---

### Task 9: Retire beam exports from the web diary-metal lib

**Files:**
- Modify: `apps/web/src/lib/diary-metal-tier.ts`

**Step 1:** Remove `diaryMetalBorderBeamColorVariant`, `DIARY_METAL_BORDER_BEAM_STRENGTH`, and the `border-beam` type import. Keep `DiaryMetalTier` and `isCircularPatronPortraitClass` (payload types still reference the tier type; the portrait still uses the circular check). Update the `isCircularPatronPortraitClass` doc comment (it no longer gates BorderBeam — it gates auras).

**Step 2:** `rg "diaryMetalBorderBeamColorVariant|DIARY_METAL_BORDER_BEAM_STRENGTH" apps/web` — expect zero hits. Confirm `border-beam` is still imported by the search pill (`rg "border-beam" apps/web/src --files-with-matches` → search chrome files only).

**Step 3:** `cd apps/web; bunx tsc --noEmit` — clean.

**Step 4: Commit**

```
git add apps/web/src/lib/diary-metal-tier.ts; git commit -m "chore(web): drop BorderBeam exports from diary-metal-tier"
```

---

### Task 10: Full verification + manual QA

**Step 1: Automated**

- `cd apps/server; bun test` — all green.
- `cd apps/server; bun run check-types` — clean.
- `cd apps/web; bunx tsc --noEmit` — clean.
- `bunx biome check apps/web/src/components/profile/avatar-aura apps/web/src/components/profile/patron-portrait-with-aura.tsx apps/server/src/lib/patron-plan-tier.ts` — clean.

**Step 2: Manual QA (dev servers: web `:3001`, API `:3000`)**

Use the staff panel Pro/plan override (`staff-user-edit-form.tsx` sets `planOverride`) to move a test patron through the tiers, then check:

- [ ] Still patron — portrait pixel-identical to plain `PatronPortraitAvatar`, no rim.
- [ ] Attuned — brass rim at rest; single diagonal sweep on hover-enter; re-hover replays.
- [ ] Immersed — gold rim; breathing glow + drifting flare while hovered; fades on leave.
- [ ] Devoted — iridescent rim; hover mounts the shader (~80ms delay); RGB split follows the cursor; leaving unmounts after ~300ms.
- [ ] Sizes: feed byline (~24–32px), engagement drawer tile (~64–80px), profile hero (176px).
- [ ] Rapid cursor sweep across a Community leaderboard — no canvas churn, no jank.
- [ ] DevTools → rendering → emulate `prefers-reduced-motion` — rim only, zero motion.
- [ ] Launch Chrome with `--disable-gpu` (or force `useSoftwareGpuRendering`) — Devoted hover shows the CSS holo foil.
- [ ] Touch emulation — rim renders, no hover effects fire.
- [ ] Presence dot still renders on the rim edge at all tiers.

**Step 3: Commit any QA fixes, then report done.**
