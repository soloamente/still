# Activity feed — manual smoke checklist (Phase 1)

Prereqs: server running (`bun dev:server`), DB seeded, Expo Go on device/simulator.
Run: `bun dev:native`.

## Signed-out
- [ ] Launch app → Home shows discover feed cards (reviews + lists), no crash.
- [ ] Pull-to-refresh re-fetches without error.
- [ ] No infinite-scroll spinner appears (discover is single-page).

## Signed-in
- [ ] Sign in → Home shows personalized feed.
- [ ] Scroll to bottom → footer spinner appears and the next page appends.
- [ ] Pull-to-refresh resets to the first page.
- [ ] Mixed kinds render correctly: log (poster + stars + liked/rewatch),
      review (quote + like/comment counts), list (cover strip + count),
      divergence (you vs them) — or divergence absent if none in feed.

## States
- [ ] With server stopped, first load shows "Tap to retry"; tapping after
      restarting the server loads the feed.
- [ ] A brand-new account with no follows shows the "Follow people" empty state.

## Navigation
- [ ] All 5 tabs switch; Search / Log / Inbox / You show "coming soon".
- [ ] The +Log tab icon is larger and accent-colored.
