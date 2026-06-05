# Profile birth date — settings, age gate, optional public display

**Status:** Approved (2026-06-05)  
**Date:** 2026-06-05  
**Topic:** Persist patron date of birth; reuse for adult-content age verification; optional public birthday on profile  
**Amends:** `docs/superpowers/specs/2026-06-05-adult-content-settings-design.md` (supersedes “birth date not persisted in v1”)  
**Related:** `packages/db/src/schema/profile.ts` · `apps/server/src/routes/profiles.ts` · `apps/web/src/components/profile/settings-section-panels.tsx` · `apps/web/src/components/profile/adult-content-enable-dialog.tsx` · `apps/web/src/lib/adult-content-age-gate.ts`

## Summary

Patrons can set **date of birth** under **Settings → Profile**. The value is stored on `profile.birth_date` and reused when enabling **Show adult content** (Catalogue). An optional **Show birthday on profile** preference controls whether visitors see **month + day only** (no year) in the profile about meta row.

When a valid saved DOB proves the patron is **≥18**, turning adult content **on** skips the enable dialog entirely.

## Problem

| Symptom | Root cause |
|---------|------------|
| DOB entered in adult enable dialog is lost on close | v1 spec intentionally did not persist DOB |
| No way to set DOB in Settings | Profile section has no birth-date field |
| Re-enabling adult content re-prompts for DOB | Gate only validates ephemeral dialog state |

## Locked decisions (brainstorm)

| Topic | Decision |
|-------|----------|
| Purpose | Saved DOB in Profile **and** satisfies adult-content age gate |
| Visibility | **Optional public** — field + “Show on profile” toggle (default off) |
| Public format | **Month + day only** — e.g. `March 15` (year never shown to visitors) |
| Enable flow (DOB ≥18 on file) | **Skip dialog** — toggle saves immediately |
| Enable flow (no DOB) | Keep `AdultContentEnableDialog` (DOB + checkbox); **persist DOB** on Enable |
| Disable flow | Unchanged — toggle off, no dialog |
| Storage | Dedicated nullable `profile.birth_date` column; visibility in `preferences.showBirthDateOnProfile` |
| Copy language | English |

## Data model

### Column

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `profile.birth_date` | `date` | `NULL` | Calendar date `YYYY-MM-DD`; no time zone |

Migration: `0019_profile_birth_date.sql`.

### Preference

| Key | Location | Default |
|-----|----------|---------|
| `showBirthDateOnProfile` | `profile.preferences` jsonb | `false` (absent = off) |

Web constant: `PROFILE_PREF_SHOW_BIRTH_DATE_ON_PROFILE = "showBirthDateOnProfile"`.

### Shared age helper

Reuse / extend `patronMeetsAdultAgeGate(birthDateIso: string)` in:

- `apps/web/src/lib/adult-content-age-gate.ts` (client validation)
- `apps/server/src/lib/adult-content-age-gate.ts` (new server mirror for PATCH validation)

Age rule unchanged: patron must be **≥18** as of **today in UTC** (same semantics as existing web helper).

## API

### `PATCH /api/profiles/me`

Accept optional fields:

- `birthDate: string | null` — ISO date `YYYY-MM-DD`, or `null` to clear
- `preferences.showBirthDateOnProfile: boolean`

Validation:

| Case | Response |
|------|----------|
| Invalid date string | `400` |
| Date in the future | `400` |
| Patron &lt;18 | `400` with message |
| Clear DOB while `showAdultContent` is true | `400` — must disable adult content first |
| Save DOB that implies &lt;18 while adult pref on | Force `showAdultContent: false` in merged preferences before write + return updated row |

### `GET /api/profiles/me`

Include `birthDate: string | null` (full ISO date for owner settings).

### `GET /api/profiles/:handle` (public)

When `showBirthDateOnProfile === true` and `birth_date` is set:

- Return `birthdayDisplay: string` — e.g. `"March 15"` via `Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" })`
- **Do not** return `birthDate`, year, or age to visitors

When toggle off or DOB null: omit `birthdayDisplay`.

## Settings UI

### Profile section (`SettingsProfileSection`)

Add below location / website block:

1. **Date of birth** — `BirthDatePicker` (reuse from adult dialog); hint: *Used for age verification. Year is never shown on your profile.*
2. **Show birthday on profile** — `MePreferenceToggle` (Off / On); disabled when DOB empty

Wire through `settings-form-context.tsx` with dirty tracking and save on **Save changes** (same PATCH as other profile fields).

### Catalogue section (`SettingsCatalogueSection`)

**Show adult content** toggle logic:

| Profile state | off → on |
|---------------|----------|
| `birthDate` set and ≥18 | Set `showAdultContent = true` immediately (no dialog) |
| No `birthDate` | Open `AdultContentEnableDialog` |
| `birthDate` set and &lt;18 | Disable toggle; hint links to Profile settings |

**AdultContentEnableDialog** on **Enable**:

1. Validate DOB + checkbox (unchanged)
2. Set local `birthDate` + `showAdultContent` in settings form
3. Persist on next settings save **or** immediate PATCH (dialog should trigger save — prefer including both fields in the same PATCH the dialog fires, or call existing settings save helper)

Recommended: dialog `onConfirm` sets form state for `birthDate` + `showAdultContent`, then invokes the same save routine as the settings footer so patron does not need a second Save click.

## Public profile UI

`ProfileAboutCollapsible` meta row (with pronouns · location · website):

- When API returns `birthdayDisplay`, append with middot separator
- Copy is display-only; no link

Pass prop from profile page fetch through `ProfilePatronHeader`.

## Edge cases

| Case | Behavior |
|------|----------|
| Enable dialog completes | Write DOB + `showAdultContent: true` in one PATCH |
| Adult on, edit DOB to &lt;18 in Profile | Server forces adult pref off on PATCH |
| Adult on, attempt to clear DOB | `400` — disable adult content first |
| Toggle show birthday with no DOB | Control disabled in UI; server ignores `true` if DOB null |
| Private profile | `birthdayDisplay` still only when toggle on; private profiles already gated by visibility |

## Testing

| Area | Tests |
|------|-------|
| `patronMeetsAdultAgeGate` | Existing web tests; add server copy if split |
| `formatBirthdayDisplayPublic` | New helper — month/day, no year |
| PATCH validation | Under-18 reject; clear DOB while adult on; auto-disable adult on under-18 DOB |
| Settings form | Dirty state for birthDate + toggle |
| Catalogue toggle | Skip dialog when DOB ≥18; open dialog when absent |

## Out of scope

- Showing age or birth year on public profile
- Onboarding birth-date step
- Storing DOB on Better Auth `user` table
- Re-prompting checkbox when DOB already on file (toggle is instant)

## Success criteria

1. Patron sets DOB in **Settings → Profile** and it persists across sessions.
2. With DOB ≥18 saved, **Show adult content** enables without dialog.
3. Without DOB, enable dialog saves DOB + pref in one action.
4. Optional public toggle shows **March 15** (no year) on profile about meta.
5. Under-18 or invalid DOB cannot enable adult content; server enforces on PATCH.
