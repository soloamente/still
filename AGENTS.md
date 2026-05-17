## Learned User Preferences

- Short replies **go** / **ok** are used to advance Executor work and to mark Planner or human verification on Track B milestones in the scratchpad.
- Product direction favors a **Letterboxd-class diary and social layer** with a **Mobbin-informed web design system** (usable controls on top of cinematic chrome), not replacing the theater identity wholesale.
- When researching UI patterns via Mobbin, prefer **`image_format: "jpg"`** for `search_screens` because WebP responses can fail to decode in some agent or tooling environments.

## Learned Workspace Facts

- The repo is a **monorepo**: main web app under **`apps/web`** (Next.js App Router), API under **`apps/server`**, shared UI and global styles under **`packages/ui`** (for example `packages/ui/src/styles/globals.css`).
- **Track B** (design system and screen IA) is the canonical plan for navigation, tokens, search and browse primitives, and core screens; it lives in **`.cursor/scratchpad.md`** as tasks **B.1–B.7** alongside Phase 8 polish items.
- **Elevation tokens** use an explicit ladder: **`surface-canvas`** → **`surface-raised`** → **`surface-overlay`**, mapped through shadcn-style **`--background`**, **`--card`**, and **`--popover`** for predictable depth on dark UI and **`.movie-themed`** pages.
- The authenticated app chrome is centralized in **`apps/web/src/components/app/app-shell.tsx`** (`AppShell`): **`main#main-content`**, shared horizontal gutters, and exports **`APP_SHELL_BOTTOM_RESERVE_CSS`** / **`appShellMainContentMinHeightStyle`** for pages that must match the nav inset (for example **`people/[id]`**). Bottom padding for `#main-content` is **`10px`** in **`packages/ui/src/styles/globals.css`** (same literal as **`APP_SHELL_BOTTOM_RESERVE_CSS`**).
- **Track B.4** introduced shared primitives such as **`SearchPillField`**, **`FilterChipRow`** / **`FilterChipLink`** / **`FilterChipButton`**, **`MovieCatalogSurfaceChips`**, and catalogue routes **`/movies/popular`**, **`/movies/upcoming`**, and **`/movies/discover`**; chip hrefs and discover fetches stay aligned via **`apps/web/src/lib/discover-catalog-url.ts`** (canonical sort + genre query building).
- **`/home`** (Track B.5.1): the following feed uses refactored **`ActivityItem`** rows with **`FeedPersonAvatar`**; a collapsible **friend-activity** rail (**`HomeFriendActivityRail`**, data from **`apps/web/src/lib/home-friend-rail.ts`**) shows from **`lg`** upward.
- If **`bun run build`** in **`apps/web`** fails TypeScript on **`Link`** **`href`** values or route types (**`RouteImpl`**) even though **`typedRoutes`** is false, delete **`apps/web/.next`** and rebuild; stale generated types can disagree with the current **`app/`** tree.
- Profile filmography timestamps may arrive as a **`Date`** or an **ISO string**; UI that formats years or dates should **normalize** unknown timestamp shapes instead of assuming **`.slice`** on a string.
