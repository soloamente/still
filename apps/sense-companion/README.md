# Sense Companion

Browser extension that reports what you are watching on streaming sites to **Discord** (Rich Presence) and **Sense** (profile + optional auto-log).

Chrome Web Store / Edge Add-ons: patrons install **only the extension**. Discord desktop must be open on the same PC; no separate helper app.

## Build

From the repo root:

```bash
bun install
bun run --filter @still/sense-companion build
```

Output: `apps/sense-companion/.output/chrome-mv3`

## Chrome Web Store zip

The store rejects `manifest.key`. Use the **`zip`** script (not a hand-zipped folder from `build`):

```bash
bun run --filter @still/sense-companion zip
```

Upload the `.zip` from `apps/sense-companion/.output/`.

## Load unpacked (development)

1. Open `chrome://extensions` or `edge://extensions`.
2. Turn on Developer mode.
3. Choose **Load unpacked** and select `apps/sense-companion/.output/chrome-mv3`.
4. Open the toolbar icon on a page. It should say **Sense Companion**.

While developing, `bun run --filter @still/sense-companion dev` rebuilds into `.output/chrome-mv3-dev`. Load that folder instead, then reload the extension after changes.

## Discord

The extension connects to **Discord desktop** on `127.0.0.1` (IPC websocket). Keep the desktop app running while you watch.

Legacy `apps/sense-companion-host` (native messaging + named pipe) is **not** required for store builds.

## Sense pairing

Optional: Settings → Profile → Browser extension on Sense web → pairing code in the extension onboarding.
