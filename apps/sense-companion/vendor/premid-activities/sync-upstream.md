# Re-sync from PreMiD Activities

Upstream: https://github.com/PreMiD/Activities
Pinned commit: `e4c0de9c04a3d310877343bdc05b04bdd7b42603` (2026-09-29)

Copied paths:

- `premid/` helper (`getTimestamps`, `getTimestampsFromMedia`, `supports`, `timestampFromFormat`, activity enums)
- `@types/premid/index.d.ts` → `types/premid/index.d.ts`
- `websites/general.json` (string keys used by those types)
- `websites/N/Netflix/`
- `websites/D/Disney+/`
- `websites/P/Prime Video/`
- `websites/A/Apple TV+/`
- `websites/H/HBO Max/`

Each `.ts` file has an MPL header naming that commit. Do not reformat these files; a later sync should replace them from upstream and re-apply only Sense-specific edits.

Not copied: the closed-source PreMiD extension, other sites, images, or `cdn.rcd.gg` assets.
