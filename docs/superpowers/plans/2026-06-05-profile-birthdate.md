# Profile Birth Date Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist patron date of birth on `profile.birth_date`, expose it in Settings → Profile with an optional public birthday toggle, and reuse it so adult content enables instantly when the patron is already ≥18.

**Architecture:** Nullable `date` column on `profile`; visibility flag in `preferences.showBirthDateOnProfile`. Shared `patronMeetsAdultAgeGate` validates on web + server PATCH. Public profile API returns preformatted `birthdayDisplay` (month + day only). Catalogue toggle skips `AdultContentEnableDialog` when saved DOB passes; dialog persists DOB + adult pref in one PATCH when DOB was missing.

**Tech Stack:** Drizzle ORM + Postgres (`packages/db`), Elysia (`apps/server`), Next.js App Router (`apps/web`), `bun:test`.

**Spec:** `docs/superpowers/specs/2026-06-05-profile-birthdate-design.md`

---

## Conventions

- Next migration: `0019_profile_birth_date.sql` + journal idx **19**
- Tests: `bun:test`, colocated `*.test.ts`
- Pref key: `showBirthDateOnProfile` — web constant `PROFILE_PREF_SHOW_BIRTH_DATE_ON_PROFILE`
- Reuse `BirthDatePicker` from `apps/web/src/components/profile/birth-date-picker.tsx`
- After code changes: `graphify update .`

---

## File structure

**Create:**
- `packages/db/src/migrations/0019_profile_birth_date.sql`
- `apps/server/src/lib/adult-content-age-gate.ts` (server mirror of web age helper)
- `apps/server/src/lib/adult-content-age-gate.test.ts`
- `apps/server/src/lib/profile-birth-date.ts` — parse/validate ISO date, public display formatter
- `apps/server/src/lib/profile-birth-date.test.ts`

**Modify:**
- `packages/db/src/schema/profile.ts` — `birthDate` column
- `packages/db/src/migrations/meta/_journal.json`
- `apps/server/src/routes/profiles.ts` — PATCH/GET me + public handle response
- `apps/web/src/lib/profile-preferences.ts` + `.test.ts` — pref reader
- `apps/web/src/lib/adult-content-age-gate.ts` — export shared types if needed
- `apps/web/src/components/profile/settings-form-context.tsx` — state, dirty, save, draft
- `apps/web/src/components/profile/settings-section-panels.tsx` — Profile + Catalogue sections
- `apps/web/src/components/profile/adult-content-enable-dialog.tsx` — persist DOB on confirm
- `apps/web/src/components/profile/profile-about-collapsible.tsx` — `birthdayDisplay` meta
- `apps/web/src/components/profile/profile-patron-header.tsx` — pass prop
- Profile page RSC fetch (where `ProfilePatronHeader` is fed)

---

## Task 1: DB migration + schema

**Files:**
- Create: `packages/db/src/migrations/0019_profile_birth_date.sql`
- Modify: `packages/db/src/schema/profile.ts`
- Modify: `packages/db/src/migrations/meta/_journal.json`

- [ ] **Step 1: Add migration**

```sql
ALTER TABLE "profile" ADD COLUMN "birth_date" date;
```

- [ ] **Step 2: Add to Drizzle schema**

In `packages/db/src/schema/profile.ts` inside `profile` table columns:

```ts
birthDate: date("birth_date"),
```

Import `date` from `drizzle-orm/pg-core`.

- [ ] **Step 3: Journal entry** idx 19, tag `0019_profile_birth_date`

- [ ] **Step 4: Run migration** (dev): project’s usual `db:migrate` command

---

## Task 2: Server birth-date helpers

**Files:**
- Create: `apps/server/src/lib/adult-content-age-gate.ts`
- Create: `apps/server/src/lib/adult-content-age-gate.test.ts`
- Create: `apps/server/src/lib/profile-birth-date.ts`
- Create: `apps/server/src/lib/profile-birth-date.test.ts`

- [ ] **Step 1: Write failing tests for age gate**

Copy semantics from `apps/web/src/lib/adult-content-age-gate.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { patronMeetsAdultAgeGate } from "./adult-content-age-gate";

describe("patronMeetsAdultAgeGate", () => {
	it("rejects under 18", () => {
		const today = new Date();
		const y = today.getUTCFullYear() - 17;
		expect(patronMeetsAdultAgeGate(`${y}-01-01`)).toBe(false);
	});
	it("accepts exactly 18", () => {
		const today = new Date();
		const y = today.getUTCFullYear() - 18;
		expect(patronMeetsAdultAgeGate(`${y}-01-01`)).toBe(true);
	});
});
```

- [ ] **Step 2: Implement `adult-content-age-gate.ts`** (mirror web logic)

- [ ] **Step 3: Write failing tests for `profile-birth-date.ts`**

```ts
import { describe, expect, it } from "bun:test";
import {
	parseProfileBirthDate,
	formatBirthdayDisplayPublic,
} from "./profile-birth-date";

describe("parseProfileBirthDate", () => {
	it("accepts valid YYYY-MM-DD", () => {
		expect(parseProfileBirthDate("1990-06-05")).toBe("1990-06-05");
	});
	it("rejects future dates", () => {
		expect(parseProfileBirthDate("2099-01-01")).toBeNull();
	});
	it("rejects garbage", () => {
		expect(parseProfileBirthDate("not-a-date")).toBeNull();
	});
});

describe("formatBirthdayDisplayPublic", () => {
	it("returns month and day only", () => {
		expect(formatBirthdayDisplayPublic("1990-06-05")).toBe("June 5");
	});
});
```

- [ ] **Step 4: Implement helpers**

`parseProfileBirthDate(input: string | null | undefined): string | null`  
`formatBirthdayDisplayPublic(isoDate: string): string`

- [ ] **Step 5: Run tests**

```bash
bun test apps/server/src/lib/adult-content-age-gate.test.ts apps/server/src/lib/profile-birth-date.test.ts
```

Expected: PASS

---

## Task 3: PATCH / GET profiles API

**Files:**
- Modify: `apps/server/src/routes/profiles.ts`

- [ ] **Step 1: Extend `ProfileMePatchBody`**

```ts
birthDate?: string | null;
```

- [ ] **Step 2: Validate `birthDate` in PATCH handler**

Before `db.update`:

- If `body.birthDate === null`: if `readShowAdultContentPref(existing.preferences)` → `400` *Disable adult content before clearing date of birth*
- If string: `parseProfileBirthDate` → null ⇒ `400`; `!patronMeetsAdultAgeGate` ⇒ `400`
- If under-18 DOB saved while adult pref on: merge `preferences.showAdultContent = false`

- [ ] **Step 3: Include `birthDate` in `set` object**

Map to column `birthDate`; store `null` when clearing (only when adult off).

- [ ] **Step 4: Elysia body schema** add optional `birthDate: t.Union([t.String(), t.Null()])`

- [ ] **Step 5: GET `/me` response** include `birthDate: string | null`

- [ ] **Step 6: GET `/:handle` public response**

When `showBirthDateOnProfile` and `birthDate` set, add `birthdayDisplay: formatBirthdayDisplayPublic(...)`. Never expose raw `birthDate` to non-owner routes.

- [ ] **Step 7: Manual smoke**

PATCH with valid DOB → 200; PATCH clear while adult on → 400.

---

## Task 4: Web preference helpers

**Files:**
- Modify: `apps/web/src/lib/profile-preferences.ts`
- Modify: `apps/web/src/lib/profile-preferences.test.ts`

- [ ] **Step 1: Add constant + reader**

```ts
export const PROFILE_PREF_SHOW_BIRTH_DATE_ON_PROFILE =
	"showBirthDateOnProfile" as const;

export function readShowBirthDateOnProfilePref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	return preferences?.[PROFILE_PREF_SHOW_BIRTH_DATE_ON_PROFILE] === true;
}
```

- [ ] **Step 2: Add test cases** (default false, explicit true)

- [ ] **Step 3: Run** `bun test apps/web/src/lib/profile-preferences.test.ts`

---

## Task 5: Settings form state + save

**Files:**
- Modify: `apps/web/src/components/profile/settings-form-context.tsx`
- Modify: `apps/web/src/components/profile/me-account-session-context.tsx` (draft type if used)

- [ ] **Step 1: Extend `SettingsProfile` type** with `birthDate?: string | null`

- [ ] **Step 2: State** `birthDate`, `showBirthDateOnProfile` initialized from profile

- [ ] **Step 3: Dirty tracking** compare against initial profile + preferences

- [ ] **Step 4: PATCH body** include `birthDate` and `preferences.showBirthDateOnProfile`

- [ ] **Step 5: Client validation before save**

If `birthDate` non-empty and `!patronMeetsAdultAgeGate(birthDate)` → block save, inline error

- [ ] **Step 6: Export setters** for dialog to set `birthDate` + `showAdultContent`

- [ ] **Step 7: Optional `saveSettingsNow()`** helper for dialog one-shot save (extract from existing save handler if needed)

---

## Task 6: Settings → Profile UI

**Files:**
- Modify: `apps/web/src/components/profile/settings-section-panels.tsx`

- [ ] **Step 1: Add fields to `SettingsProfileSection`**

After website field:

```tsx
<MeFormField
	id="birthDate"
	label="Date of birth"
	hint="Used for age verification. Year is never shown on your profile."
>
	<BirthDatePicker id="birthDate" value={birthDate} onChange={setBirthDate} />
</MeFormField>
<MePreferenceToggle
	id="show-birthday-on-profile"
	checked={showBirthDateOnProfile}
	onChange={setShowBirthDateOnProfile}
	disabled={!birthDate}
	title="Show birthday on profile"
	description="Visitors see month and day only — never your birth year."
/>
```

- [ ] **Step 2: Wire hooks from `useSettingsForm()`**

---

## Task 7: Catalogue toggle + enable dialog

**Files:**
- Modify: `apps/web/src/components/profile/settings-section-panels.tsx`
- Modify: `apps/web/src/components/profile/adult-content-enable-dialog.tsx`

- [ ] **Step 1: Catalogue toggle handler**

```tsx
onChange={(next) => {
	if (!next) {
		setShowAdultContent(false);
		return;
	}
	if (birthDate && patronMeetsAdultAgeGate(birthDate)) {
		setShowAdultContent(true);
		return;
	}
	setAdultEnableOpen(true);
}}
```

- [ ] **Step 2: Under-18 hint** when DOB set but fails gate — disable toggle or show hint under row

- [ ] **Step 3: Dialog `onConfirm`**

Set `birthDate` from dialog state, `showAdultContent: true`, call immediate save (PATCH) — not only local state

- [ ] **Step 4: Update dialog copy** — remove “not saved” line; say DOB saves to Profile

- [ ] **Step 5: Manual QA**

No DOB → dialog → enables + DOB in Profile. With DOB ≥18 → instant toggle.

---

## Task 8: Public profile display

**Files:**
- Modify: `apps/web/src/components/profile/profile-about-collapsible.tsx`
- Modify: `apps/web/src/components/profile/profile-patron-header.tsx`
- Modify: profile page server fetch (grep `ProfilePatronHeader` usage)

- [ ] **Step 1: Add optional `birthdayDisplay?: string | null` prop**

- [ ] **Step 2: Render in meta row** with middot separators (same pattern as location)

- [ ] **Step 3: Pass from RSC** only when API returns field

---

## Task 9: Verification

- [ ] **Step 1: Run unit tests**

```bash
bun test apps/server/src/lib/adult-content-age-gate.test.ts apps/server/src/lib/profile-birth-date.test.ts apps/web/src/lib/profile-preferences.test.ts apps/web/src/lib/adult-content-age-gate.test.ts
```

- [ ] **Step 2: Web build**

```bash
cd apps/web && bun run build
```

- [ ] **Step 3: `graphify update .`**

- [ ] **Step 4: Manual checklist**

1. Settings → Profile: set DOB, save, reload — persists  
2. Toggle “Show birthday on profile” — public profile shows `June 5` style  
3. Catalogue: adult on with saved DOB ≥18 — no dialog  
4. Clear DOB attempt while adult on — blocked  
5. Enable via dialog without prior DOB — saves both  

---

## Spec self-review (plan author)

| Spec requirement | Task |
|------------------|------|
| `profile.birth_date` column | Task 1 |
| `showBirthDateOnProfile` pref | Tasks 3–4 |
| Profile Settings UI | Tasks 5–6 |
| Skip dialog when DOB ≥18 | Task 7 |
| Dialog persists DOB | Task 7 |
| Public month/day display | Tasks 3, 8 |
| PATCH edge cases | Task 3 |
| Tests | Tasks 2, 4, 9 |

No placeholders remain in task steps above.
