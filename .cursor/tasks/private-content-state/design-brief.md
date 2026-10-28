# Private content state — oil-ui-pro 改流程

**Intent:** 改流程 (status expression). Visual language stays Sense empty trays.

**三问**
1. **品类** — Taste social identity (Sense): diary, profiles, lists.
2. **首屏** — Understand this object is private; leave via Home (or back).
3. **标杆** — Instagram / Letterboxd private profile honesty vs silent miss.

**User task:** “I opened someone’s profile or list and I want to know why I can’t see it — not that it vanished.”

**产出物:** Honest private screen (title + body + Home CTA). Same copy family for profile vs content.

**Locked approach:** 顺手 — 403 + `PROFILE_PRIVATE` / `CONTENT_PRIVATE` in place of private 404s; render `ContentPrivatePageShell` on profile + list routes. No new object/page type.

| | 点击 | 页面切换 | 决定 | 记忆负担 | 回头路 |
| --- | --- | --- | --- | --- | --- |
| 现状 | open URL → Next notFound | 1 | “gone?” | none | browser back |
| Ideal / 顺手 | open URL → private tray + Home | 1 | none | none | Home CTA |

**Motion (3):** enter fade/slide; lock mark spring; CTA tap scale (respects reduced motion).

**Out of scope:** Follow-request product; redesign of empty trays; changing true missing → 404.
