# Discord profile button and guest browsing

**Status:** Draft — pending user review
**Date:** 2026-09-30
**Scope:** Sense Companion Discord activity, and signed-out browsing of the Sense web app.

## Summary

Discord's Watching activity includes one button, **View profile**, on by default. It opens that patron's public Sense profile. Extension settings can hide the button.

Someone with no Sense account can browse home, movies, TV, lists, people, and public profiles in the normal app shell. Logging a title, or opening a personal page, shows a dialog with **Log in** and **Create account**. The personal page does not render. Closing the dialog leaves the guest on the page already on screen.

## Decisions

| Topic | Decision |
| --- | --- |
| Button label | **View profile** |
| Button URL | `https://{public web origin}/profile/{handle}` |
| Default | Button on |
| Hide | Extension settings, on the Discord activity preview |
| Missing pairing | No button. The rest of the activity still posts. |
| Private profile | No button. `profile.is_private` is the check. |
| Non-https origin | No button. Discord cannot open a localhost link for other people. |
| Lookup failure | Activity still posts, without the button. |
| Guest browse | `/home`, `/movies/…`, `/tv/…`, `/people/…`, `/profile/…` when public, `/lists`, public list pages, `/journal` |
| Guest personal pages | `/diary`, `/watchlist`, `/quotes`, `/me`, `/achievements`, `/notifications`, `/chat` do not render |
| Guest actions | Quick Log, watchlist, follow, save to a list, and review actions open the account dialog |
| Dialog actions | **Log in** → `/sign-in`. **Create account** → `/sign-up`. Both return to the page still on screen. |
| Close dialog | Escape, scrim, or close. The URL does not change. |
| Cold personal URL | The personal page does not render. The dialog opens over `/home`. Closing it leaves `/home`. |
| Private list | Still hidden from guests. |
| Own lists when signed out | `/lists` renders. The collection is empty. **New list** opens the account dialog. |

## Discord button

The activity payload gains one button when all of these are true:

- The extension setting is show.
- The device token resolves to a patron.
- That profile has a handle and `is_private` is false.
- The public web origin is `https`.

The button is `{ label: "View profile", url }`. Discord allows two buttons. This feature sends one. The label stays under 32 characters.

The public origin comes from the server's public web origin, the same origin patrons open in a browser. The extension does not invent the URL from `127.0.0.1`.

`GET /api/companion/session` keeps validating the device token. It also returns the button URL, or `null` when the button must be omitted. The extension attaches that URL to the activity only when the setting is show and the URL is non-null. The desktop helper copies it onto `SET_ACTIVITY` and drops any URL that is not `https`.

The setting lives on the existing Discord layout in extension storage (`senseCompanionDiscordLayout`). The field is `profileButton`: `"show"` or `"hide"`. A saved layout with no field reads as `"show"`. The settings preview draws the button on the sample activity when the field is show, and omits it when hide.

## Guest browsing

Signed-out visitors on a browse route get the same app shell as a patron: sticky chrome, catalogue, and list lobby. They do not get notifications, invite, or the account menu. That corner is a **Sign in** control which opens the account dialog.

On a narrow screen, Home and Search still navigate. Log, Inbox, and You open the account dialog and do not change the page.

Search still searches films, TV, and people. Searching the guest's own lists opens the account dialog.

Personal routes never render their page for a guest.

- In-app navigation to one of those routes is cancelled. The dialog opens. The current URL stays.
- A direct load of one of those routes redirects to `/home?account=1` before the personal page renders. The dialog opens because of that query. Closing the dialog removes the query and stays on `/home`.

**Log in** and **Create account** use `from` set to the path still on screen, including the movie, TV, list, or profile page when the guest tried to log from there. After a cold open of `/diary`, the path still on screen is `/home`, so `from` is `/home`.

The account dialog is one component. Poster actions that today toast "Sign in to use this action" open this dialog instead.

A public profile keeps working for guests. A private profile stays not-found. A public list at `/lists/{id}` renders for a guest the same way `/l/{id}` does. A private list stays hidden.

## Errors

- Companion session fails or times out: post the activity with no button.
- Profile is private, has no handle, or the public origin is not `https`: session returns a null button URL.
- Helper receives a non-https button URL: send the activity without buttons.
- Guest hits a personal route while navigation is in progress: do not paint that page, including its data requests.

## Non-goals

- A second Discord button
- Editing the button label
- Showing a private profile to guests
- A separate public copy of home or lists
- Changing signed-in patrons' Discord activity except for the new default button

## Test plan

- Default layout includes the profile button. Hide removes it from the preview and from the activity payload.
- A saved layout with no `profileButton` field still shows the button.
- Session returns an `https` profile URL for a public handle, and `null` when the profile is private, has no handle, or the origin is not `https`.
- The helper adds `View profile` only for an `https` URL, and still sets the activity when the URL is missing or not `https`.
- `/home` and `/lists` render with no session cookie.
- A direct `/diary` load ends on `/home?account=1` and does not render the diary.
- In-app navigation to `/watchlist` leaves the current URL in place and opens the dialog.
- **Log in** and **Create account** point at `/sign-in` and `/sign-up` with `from` set to the page on screen.
- Quick Log while signed out opens the dialog and does not post a log.
