# Sense iOS Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `apps/ios` — a SwiftUI app where an existing Sense patron signs in three ways, lands on a five-tab shell, sees their own identity, and signs out — and delete the Expo app so the repo has one mobile client.

**Architecture:** An XcodeGen-defined iPhone app with three local Swift packages (`SenseNetworking`, `SenseAuth`, `SenseUI`). All traffic goes to the **web origin**, which proxies `/api/*` to Elysia where Better Auth is mounted. Because `ASWebAuthenticationSession` does not share cookies with `URLSession`, the app manages the Better Auth credential itself in the Keychain and sends it as a `Cookie` header; Better Auth's `expo()` server plugin stays registered because it is what hands a browser-issued session back to a native app through the `still://` deep link.

**Tech Stack:** Swift 5.9+/SwiftUI (iOS 17), XcodeGen, Swift Testing, `AuthenticationServices`, Keychain; server side Bun + Elysia + Better Auth 1.6.9 + `jose`.

**Specs:** `docs/superpowers/specs/2026-09-09-sense-ios-foundation-design.md` (slice 1), `docs/superpowers/specs/2026-09-09-sense-ios-near-web-roadmap-design.md` (program).

---

## Background for the implementer

Read this before Task 1. It is the context you cannot infer from the code.

### Where requests go

`BETTER_AUTH_URL` is the **web** origin (`http://localhost:3001` locally). `apps/web/src/proxy.ts` forwards `/api/*` to Elysia (`apiUpstreamOrigin()`, normally `:3000`), and Better Auth is mounted inside Elysia at `/api/auth/*` (`apps/server/src/server/app.ts`). Better Auth builds OAuth callback URLs from `BETTER_AUTH_URL`, so **the app must talk to the web origin, not `:3000`** — otherwise OAuth finishes on one host while the app holds credentials for another.

### Why the app manages cookies by hand

Discord sign-in runs in `ASWebAuthenticationSession`, i.e. the system browser. iOS deliberately does not share that cookie jar with your app's `URLSession`. The session cookie Better Auth sets at the end of the OAuth redirect would be invisible to the app.

Better Auth's `expo()` server plugin solves exactly this. Read `packages/auth/node_modules/@better-auth/expo/dist/index.js`: in an `after` hook on `/callback*`, when the redirect `location` is a non-http(s) **trusted** scheme, it appends the response's `set-cookie` header to that URL as a `cookie` query parameter:

```js
redirectURL.searchParams.set("cookie", cookie);
ctx.setHeader("location", redirectURL.toString());
```

So the app reads `?cookie=…` off the `still://` callback and stores it. Since one of the three sign-in paths must be manual, **all three are manual** — automatic cookie handling is disabled everywhere and `SessionCredentialStore` is the single source of truth. This mirrors the deleted Expo client (`apps/native/lib/api.ts` injected `Cookie` the same way).

### The OAuth state problem

`POST /sign-in/social` returns `{ redirect: true, url }` **and** sets the OAuth state cookie on that response — which lands in the app, not the browser. The browser needs it when Discord redirects back. That is what `/api/auth/expo-authorization-proxy` is for: you open **the proxy** in the browser, it sets the state cookie there, then redirects to the provider. Mirror the Expo client (`dist/client.js`, `fetchPlugins[0].hooks.onSuccess`):

```js
const params = new URLSearchParams({ authorizationURL: signInURL });
if (oauthStateValue) params.append("oauthState", oauthStateValue);
const proxyURL = `${context.request.baseURL}/expo-authorization-proxy?${params.toString()}`;
```

The state value is read from the stored cookie named `<prefix>.oauth_state` or `__Secure-<prefix>.oauth_state` (prefix `better-auth`). If it is absent the proxy falls back to deriving `state` from the authorization URL, so append the parameter only when found.

### Headers every request sends

From the Expo client's `init` hook: `credentials: "omit"` (→ disable cookie handling), the stored `Cookie`, `expo-origin: still://` (the plugin promotes this to `origin` for non-browser clients), and `x-skip-oauth-proxy: "true"`. Requests carrying `idToken` skip the cookie/origin headers and send only `x-skip-oauth-proxy`.

### Apple specifics

- The client secret is an **ES256 JWT** signed from a `.p8` key, valid at most six months — so the provider entry must be `async` and generate it (`jose`). See `https://www.better-auth.com/docs/authentication/apple`.
- `appBundleIdentifier` is **required** for native `idToken` sign-in, otherwise verification fails with `unexpected "aud" claim value` (native sends the bundle ID as audience, not the Services ID).
- `https://appleid.apple.com` must be in `trustedOrigins`.
- Apple's **web** flow rejects `localhost`/non-HTTPS return URLs. The native `idToken` flow performs no redirect, so local dev works.

### Conventions

- Package manager is **bun**; formatting/lint is **biome** (`bun run check`).
- Server tests: `cd apps/server && bun test <file>`. Package tests run from the package directory.
- Swift tests: `swift test` inside each package, or `cmd-U` in Xcode.
- Tasks 1 and 2 are doable on Windows. Tasks 3–11 require macOS with Xcode 15+ and `brew install xcodegen`.
- Commit after each task. Do not `git push` or use `--force` without asking.

---

## File structure

```
apps/native/                              # DELETE (entire directory)
package.json                              # MODIFY: drop dev:native
packages/env/package.json                 # MODIFY: drop ./native export
packages/env/src/native.ts                # DELETE
packages/env/src/server.ts                # MODIFY: APPLE_* vars
packages/auth/package.json                # MODIFY: add jose
packages/auth/src/index.ts                # MODIFY: apple provider, trustedOrigins
packages/auth/src/lib/apple-oauth-config.ts       # CREATE
packages/auth/src/lib/apple-oauth-config.test.ts  # CREATE
README.md                                 # MODIFY: Expo → iOS
.gitignore                                # MODIFY: ignore generated xcodeproj

apps/ios/
  project.yml                             # CREATE (XcodeGen)
  .gitignore                              # CREATE
  SMOKE.md                                # CREATE
  Sense/
    SenseApp.swift  RootView.swift
    Shell/   MainTabView.swift  PlaceholderTab.swift  YouTab.swift
    Auth/    SignInView.swift  SignUpView.swift  FinishSetupView.swift
    Resources/  Info.plist  Assets.xcassets
  Packages/
    SenseNetworking/Sources/… + Tests/…
    SenseAuth/Sources/… + Tests/…
    SenseUI/Sources/…
```

---

## Task 1: Delete the Expo app

Runs on Windows. Removes the Expo **app** only — the `expo()` Better Auth server plugin and the `@better-auth/expo` dependency stay, because Task 8 depends on them.

**Files:**
- Delete: `apps/native/` (entire directory), `packages/env/src/native.ts`
- Modify: `package.json`, `packages/env/package.json`, `packages/auth/src/index.ts`, `README.md`

- [ ] **Step 1: Delete the app directory**

```bash
git rm -r apps/native
```

- [ ] **Step 2: Drop the dev script**

In `package.json`, remove this line from `scripts`:

```json
"dev:native": "turbo -F native dev",
```

Leave the `@better-auth/expo` catalog entry alone — `packages/auth` still depends on it.

- [ ] **Step 3: Drop the native env export**

```bash
git rm packages/env/src/native.ts
```

In `packages/env/package.json`, remove the `"./native": "./src/native.ts"` line from `exports` (and the trailing comma on the line above).

- [ ] **Step 4: Trim Expo dev origins**

In `packages/auth/src/index.ts`, the `trustedOrigins` development block lists Expo dev-client schemes. Remove the three `exp://` entries and keep the localhost ones (the iOS simulator uses them). Update the stale comment:

```ts
		trustedOrigins: [
			env.CORS_ORIGIN,
			"still://",
			...(env.NODE_ENV === "development"
				? [
						// Web may be opened via localhost or 127.0.0.1 even when
						// CORS_ORIGIN is a LAN IP (phone testing against a dev machine).
						"http://localhost:3001",
						"http://127.0.0.1:3001",
					]
				: []),
		],
```

`"still://"` stays — it is now the iOS app's scheme.

- [ ] **Step 5: Update the README**

Three edits in `README.md`:
- Features list: replace the `React Native` and `Expo` bullets with `- **SwiftUI** - Native iOS app (apps/ios)`.
- Getting Started: replace `Use the Expo Go app to run the mobile application.` with `The iOS app lives in apps/ios — see docs/superpowers/specs/2026-09-09-sense-ios-foundation-design.md.`
- Project structure and Available Scripts: change `│   ├── native/      # Mobile application (React Native, Expo)` to `│   ├── ios/         # Mobile application (SwiftUI)` and delete the `bun run dev:native` bullet.

- [ ] **Step 6: Reinstall and verify nothing references the app**

```bash
bun install
rg -n "apps/native|dev:native|@still/env/native|exp://" --glob '!docs/**' --glob '!bun.lock'
```

Expected: no matches. (Historical specs under `docs/` keep their references by design.)

Then confirm the auth package still resolves the plugin:

```bash
rg -n "@better-auth/expo" packages/auth
```

Expected: two matches — the import in `src/index.ts` and the dependency in `package.json`.

- [ ] **Step 7: Type-check and commit**

```bash
bun run check-types
bun run check
git add -A
git commit -m "chore: remove the Expo native app"
```

---

## Task 2: Apple provider on the server (TDD)

Runs on Windows. Registers Sign in with Apple the same opt-in way Discord is registered.

**Files:**
- Create: `packages/auth/src/lib/apple-oauth-config.ts`, `packages/auth/src/lib/apple-oauth-config.test.ts`
- Modify: `packages/env/src/server.ts`, `packages/auth/package.json`, `packages/auth/src/index.ts`

- [ ] **Step 1: Add the env vars**

In `packages/env/src/server.ts`, add to `serverEnv` next to the Discord block:

```ts
	/**
	 * Sign in with Apple — optional, mirrors the Discord block. Without these the
	 * provider is not registered and iOS falls back to email sign-in.
	 * `APPLE_CLIENT_ID` is the Services ID (web flow); `APPLE_APP_BUNDLE_IDENTIFIER`
	 * is the iOS bundle ID and is required for native idToken sign-in.
	 */
	APPLE_CLIENT_ID: optionalNonEmptyString(),
	APPLE_TEAM_ID: optionalNonEmptyString(),
	APPLE_KEY_ID: optionalNonEmptyString(),
	/** Contents of the .p8 private key, newlines may be escaped as \n. */
	APPLE_PRIVATE_KEY: optionalNonEmptyString(),
	APPLE_APP_BUNDLE_IDENTIFIER: optionalNonEmptyString(),
```

- [ ] **Step 2: Write the failing test**

Create `packages/auth/src/lib/apple-oauth-config.test.ts`:

```ts
import { describe, expect, it } from "bun:test";

import {
	appleClientSecretClaims,
	normalizeApplePrivateKey,
} from "./apple-oauth-config";

describe("normalizeApplePrivateKey", () => {
	it("restores newlines escaped by dotenv", () => {
		const raw =
			"-----BEGIN PRIVATE KEY-----\\nMIGTAgEA\\n-----END PRIVATE KEY-----";
		expect(normalizeApplePrivateKey(raw)).toBe(
			"-----BEGIN PRIVATE KEY-----\nMIGTAgEA\n-----END PRIVATE KEY-----",
		);
	});

	it("leaves real newlines untouched", () => {
		const raw = "-----BEGIN PRIVATE KEY-----\nMIGTAgEA\n-----END PRIVATE KEY-----";
		expect(normalizeApplePrivateKey(raw)).toBe(raw);
	});
});

describe("appleClientSecretClaims", () => {
	const now = 1_760_000_000;

	it("issues a JWT bound to the team and client", () => {
		const claims = appleClientSecretClaims(
			{ clientId: "fans.sense.si", teamId: "TEAM123" },
			now,
		);
		expect(claims.iss).toBe("TEAM123");
		expect(claims.sub).toBe("fans.sense.si");
		expect(claims.aud).toBe("https://appleid.apple.com");
		expect(claims.iat).toBe(now);
	});

	it("expires inside Apple's six-month ceiling", () => {
		const claims = appleClientSecretClaims(
			{ clientId: "fans.sense.si", teamId: "TEAM123" },
			now,
		);
		expect(claims.exp - claims.iat).toBeLessThanOrEqual(15_777_000);
		expect(claims.exp).toBeGreaterThan(claims.iat);
	});
});
```

- [ ] **Step 2b: Run it and watch it fail**

```bash
cd packages/auth && bun test src/lib/apple-oauth-config.test.ts
```

Expected: FAIL — `Cannot find module './apple-oauth-config'`.

- [ ] **Step 3: Add `jose` and write the implementation**

```bash
cd packages/auth && bun add jose
```

Create `packages/auth/src/lib/apple-oauth-config.ts`:

```ts
import { env } from "@still/env/server";
import { importPKCS8, SignJWT } from "jose";

/** Apple caps client-secret JWTs at six months; stay comfortably under it. */
const CLIENT_SECRET_TTL_SECONDS = 180 * 24 * 60 * 60;

/** Sign in with Apple credentials are configured. */
export function hasAppleOAuthCredentials(): boolean {
	return Boolean(
		env.APPLE_CLIENT_ID?.trim() &&
			env.APPLE_TEAM_ID?.trim() &&
			env.APPLE_KEY_ID?.trim() &&
			env.APPLE_PRIVATE_KEY?.trim(),
	);
}

/**
 * `.p8` contents pasted into an env file arrive with literal `\n` sequences;
 * `importPKCS8` needs real newlines.
 */
export function normalizeApplePrivateKey(raw: string): string {
	return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

export type AppleClientSecretClaims = {
	iss: string;
	sub: string;
	aud: string;
	iat: number;
	exp: number;
};

/** Pure claim builder — kept separate from signing so it is unit-testable. */
export function appleClientSecretClaims(
	input: { clientId: string; teamId: string },
	nowSeconds: number,
): AppleClientSecretClaims {
	return {
		iss: input.teamId,
		sub: input.clientId,
		aud: "https://appleid.apple.com",
		iat: nowSeconds,
		exp: nowSeconds + CLIENT_SECRET_TTL_SECONDS,
	};
}

/** ES256 JWT Apple accepts in place of a static client secret. */
export async function generateAppleClientSecret(): Promise<string> {
	const clientId = env.APPLE_CLIENT_ID as string;
	const teamId = env.APPLE_TEAM_ID as string;
	const keyId = env.APPLE_KEY_ID as string;
	const key = await importPKCS8(
		normalizeApplePrivateKey(env.APPLE_PRIVATE_KEY as string),
		"ES256",
	);
	const claims = appleClientSecretClaims(
		{ clientId, teamId },
		Math.floor(Date.now() / 1000),
	);
	return new SignJWT({})
		.setProtectedHeader({ alg: "ES256", kid: keyId })
		.setIssuer(claims.iss)
		.setSubject(claims.sub)
		.setAudience(claims.aud)
		.setIssuedAt(claims.iat)
		.setExpirationTime(claims.exp)
		.sign(key);
}
```

- [ ] **Step 4: Run the test again**

```bash
cd packages/auth && bun test src/lib/apple-oauth-config.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Register the provider**

In `packages/auth/src/index.ts`, import beside the Discord config import:

```ts
import {
	generateAppleClientSecret,
	hasAppleOAuthCredentials,
} from "./lib/apple-oauth-config";
```

Add a builder next to `buildDiscordSocialProviders`:

```ts
/** Sign in with Apple — async because the client secret is a short-lived JWT. */
function buildAppleSocialProviders(): BetterAuthOptions["socialProviders"] {
	if (!hasAppleOAuthCredentials()) return undefined;
	return {
		apple: async () => ({
			clientId: env.APPLE_CLIENT_ID as string,
			clientSecret: await generateAppleClientSecret(),
			// Native iOS sends the bundle ID as the token audience, not the
			// Services ID — without this, idToken sign-in fails aud validation.
			...(env.APPLE_APP_BUNDLE_IDENTIFIER
				? { appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER }
				: {}),
		}),
	};
}
```

In `createAuth()`, merge both provider maps instead of spreading Discord alone:

```ts
	const discordSocialProviders = buildDiscordSocialProviders();
	const appleSocialProviders = buildAppleSocialProviders();
	const socialProviders =
		discordSocialProviders || appleSocialProviders
			? { ...discordSocialProviders, ...appleSocialProviders }
			: undefined;
```

Replace the existing `...(discordSocialProviders ? { socialProviders: discordSocialProviders } : {})` with `...(socialProviders ? { socialProviders } : {})`. Leave `buildDiscordDatabaseHooks()` and the Discord `accountLinking` block untouched.

Finally add Apple's origin to `trustedOrigins`, after `"still://"`:

```ts
			// Required for Sign in with Apple.
			"https://appleid.apple.com",
```

- [ ] **Step 6: Verify the server still boots without Apple keys**

```bash
cd apps/server && bun test src/lib/discord-activity-config.test.ts
cd ../.. && bun run check-types
```

Expected: existing tests pass; no type errors. With no `APPLE_*` vars set, `buildAppleSocialProviders()` returns `undefined` and nothing changes.

- [ ] **Step 7: Document the env vars and commit**

Append to `docker/discord-setup.env.example` (or create `apps/server/.env.example` if you prefer a dedicated file) a commented Apple block listing `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_APP_BUNDLE_IDENTIFIER`, with a one-line pointer to the Apple Developer setup (App ID with Sign in with Apple → Services ID → Keys → download `.p8`).

```bash
git add -A
git commit -m "feat(auth): register Sign in with Apple provider"
```

---

## Task 3: XcodeGen project scaffold

**macOS required.** `brew install xcodegen` first.

**Files:**
- Create: `apps/ios/project.yml`, `apps/ios/.gitignore`, `apps/ios/Sense/SenseApp.swift`, `apps/ios/Sense/Resources/Info.plist`
- Modify: `.gitignore`

- [ ] **Step 1: Write `apps/ios/project.yml`**

```yaml
name: Sense
options:
  bundleIdPrefix: fans.sense
  deploymentTarget:
    iOS: "17.0"
  createIntermediateGroups: true

packages:
  SenseNetworking:
    path: Packages/SenseNetworking
  SenseAuth:
    path: Packages/SenseAuth
  SenseUI:
    path: Packages/SenseUI

targets:
  Sense:
    type: application
    platform: iOS
    sources:
      - path: Sense
    dependencies:
      - package: SenseNetworking
      - package: SenseAuth
      - package: SenseUI
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: fans.sense.app
        INFOPLIST_FILE: Sense/Resources/Info.plist
        SWIFT_VERSION: "5.9"
        TARGETED_DEVICE_FAMILY: "1"   # iPhone only
        ENABLE_USER_SCRIPT_SANDBOXING: YES
      configs:
        Debug:
          SENSE_BASE_URL: http:/$()/localhost:3001
        Release:
          SENSE_BASE_URL: https:/$()/sense.fans
    entitlements:
      path: Sense/Resources/Sense.entitlements
      properties:
        com.apple.developer.applesignin: [Default]
```

`$()` is XcodeGen's escape so `//` is not read as a build-setting comment; the value reaches `Info.plist` intact.

- [ ] **Step 2: Write `Info.plist`**

Create `apps/ios/Sense/Resources/Info.plist` with the URL scheme, the base-URL passthrough, and a Debug-only cleartext exception:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>Sense</string>
  <key>SenseBaseURL</key>
  <string>$(SENSE_BASE_URL)</string>
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLName</key>
      <string>fans.sense.app</string>
      <key>CFBundleURLSchemes</key>
      <array><string>still</string></array>
    </dict>
  </array>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsLocalNetworking</key>
    <true/>
  </dict>
  <key>UILaunchScreen</key>
  <dict/>
</dict>
</plist>
```

`NSAllowsLocalNetworking` permits `http://localhost:3001` without opening arbitrary cleartext. Production is HTTPS, so nothing more is needed.

- [ ] **Step 3: Minimal app entry point**

`apps/ios/Sense/SenseApp.swift`:

```swift
import SwiftUI

@main
struct SenseApp: App {
    var body: some Scene {
        WindowGroup {
            Text("Sense")
        }
    }
}
```

- [ ] **Step 4: Ignore the generated project**

`apps/ios/.gitignore`:

```
Sense.xcodeproj/
*.xcworkspace/
.build/
DerivedData/
```

- [ ] **Step 5: Generate and build**

```bash
cd apps/ios && xcodegen generate
xcodebuild -project Sense.xcodeproj -scheme Sense \
  -destination 'platform=iOS Simulator,name=iPhone 15' build
```

Expected: `BUILD SUCCEEDED`. If the simulator name is unavailable, list options with `xcrun simctl list devicetypes` and substitute.

- [ ] **Step 6: Commit**

```bash
git add apps/ios .gitignore
git commit -m "feat(ios): scaffold XcodeGen project"
```

---

## Task 4: SenseNetworking (TDD)

The credential store is the riskiest pure logic in the slice — test it first.

**Files:**
- Create: `apps/ios/Packages/SenseNetworking/Package.swift`, `Sources/SenseNetworking/{APIEnvironment,APIError,SessionCredentialStore,APIClient}.swift`, `Tests/SenseNetworkingTests/SessionCredentialStoreTests.swift`

- [ ] **Step 1: Package manifest**

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SenseNetworking",
    platforms: [.iOS(.v17)],
    products: [.library(name: "SenseNetworking", targets: ["SenseNetworking"])],
    targets: [
        .target(name: "SenseNetworking"),
        .testTarget(name: "SenseNetworkingTests", dependencies: ["SenseNetworking"]),
    ]
)
```

- [ ] **Step 2: Write the failing tests**

`Tests/SenseNetworkingTests/SessionCredentialStoreTests.swift`:

```swift
import Foundation
import Testing
@testable import SenseNetworking

@Suite("SessionCredential")
struct SessionCredentialTests {
    let origin = URL(string: "http://localhost:3001")!

    @Test("parses a Set-Cookie header into name/value pairs")
    func parsesSetCookie() {
        let credential = SessionCredential.parsing(
            setCookie: "better-auth.session_token=abc123; Path=/; HttpOnly; SameSite=Lax",
            origin: origin,
            now: Date(timeIntervalSince1970: 1_000)
        )
        #expect(credential?.header == "better-auth.session_token=abc123")
    }

    @Test("merges a new cookie over an existing one")
    func mergesCookies() {
        let first = SessionCredential.parsing(
            setCookie: "better-auth.session_token=old; Path=/",
            origin: origin,
            now: Date(timeIntervalSince1970: 1_000)
        )!
        let merged = first.merging(
            setCookie: "better-auth.session_token=new; Path=/",
            origin: origin,
            now: Date(timeIntervalSince1970: 1_000)
        )
        #expect(merged.header == "better-auth.session_token=new")
    }

    @Test("drops entries whose expiry has passed")
    func dropsExpired() {
        let credential = SessionCredential.parsing(
            setCookie: "better-auth.session_token=abc; Path=/; Max-Age=0",
            origin: origin,
            now: Date(timeIntervalSince1970: 1_000)
        )
        #expect(credential == nil)
    }

    @Test("finds the oauth state value under either cookie name")
    func findsOAuthState() {
        let plain = SessionCredential.parsing(
            setCookie: "better-auth.oauth_state=xyz; Path=/",
            origin: origin,
            now: Date(timeIntervalSince1970: 1_000)
        )
        #expect(plain?.oauthState == "xyz")

        let secure = SessionCredential.parsing(
            setCookie: "__Secure-better-auth.oauth_state=xyz; Path=/; Secure",
            origin: origin,
            now: Date(timeIntervalSince1970: 1_000)
        )
        #expect(secure?.oauthState == "xyz")
    }
}
```

- [ ] **Step 2b: Run and watch it fail**

```bash
cd apps/ios/Packages/SenseNetworking && swift test
```

Expected: compile failure — `cannot find 'SessionCredential' in scope`.

- [ ] **Step 3: Implement the credential**

`Sources/SenseNetworking/SessionCredentialStore.swift`:

```swift
import Foundation

/// Better Auth cookies the app manages itself.
///
/// `ASWebAuthenticationSession` runs in the system browser, whose cookie jar iOS
/// does not share with `URLSession`, so a browser-issued session can only reach
/// us as a string. Rather than mixing storage mechanisms we own all of them:
/// automatic cookie handling is off and this type renders every `Cookie` header.
public struct SessionCredential: Equatable, Sendable {
    private var values: [String: String]

    private init(values: [String: String]) {
        self.values = values
    }

    /// Cookie header for an outgoing request, e.g. `a=1; b=2`.
    public var header: String {
        values
            .sorted { $0.key < $1.key }
            .map { "\($0.key)=\($0.value)" }
            .joined(separator: "; ")
    }

    /// OAuth state minted by `POST /sign-in/social`, passed to the browser proxy
    /// so the state cookie is set in the browser rather than in the app.
    public var oauthState: String? {
        values["better-auth.oauth_state"] ?? values["__Secure-better-auth.oauth_state"]
    }

    public static func parsing(
        setCookie: String,
        origin: URL,
        now: Date = Date()
    ) -> SessionCredential? {
        let parsed = Self.values(from: setCookie, origin: origin, now: now)
        return parsed.isEmpty ? nil : SessionCredential(values: parsed)
    }

    public func merging(
        setCookie: String,
        origin: URL,
        now: Date = Date()
    ) -> SessionCredential {
        var merged = values
        for (name, value) in Self.values(from: setCookie, origin: origin, now: now) {
            merged[name] = value
        }
        // An expired cookie is a deletion instruction, not an update.
        for name in Self.expiredNames(from: setCookie, origin: origin, now: now) {
            merged.removeValue(forKey: name)
        }
        return SessionCredential(values: merged)
    }

    private static func cookies(from setCookie: String, origin: URL) -> [HTTPCookie] {
        HTTPCookie.cookies(
            withResponseHeaderFields: ["Set-Cookie": setCookie],
            for: origin
        )
    }

    private static func values(
        from setCookie: String,
        origin: URL,
        now: Date
    ) -> [String: String] {
        var result: [String: String] = [:]
        for cookie in cookies(from: setCookie, origin: origin) {
            if let expires = cookie.expiresDate, expires <= now { continue }
            result[cookie.name] = cookie.value
        }
        return result
    }

    private static func expiredNames(
        from setCookie: String,
        origin: URL,
        now: Date
    ) -> [String] {
        cookies(from: setCookie, origin: origin)
            .filter { ($0.expiresDate.map { $0 <= now }) ?? false }
            .map(\.name)
    }
}
```

Note: `HTTPCookie` translates `Max-Age=0` into an already-passed `expiresDate`, which is why the expiry test passes without hand-parsing attributes.

- [ ] **Step 4: Run the tests**

```bash
cd apps/ios/Packages/SenseNetworking && swift test
```

Expected: 4 tests pass.

- [ ] **Step 5: Environment, errors, and the client**

`APIEnvironment.swift`:

```swift
import Foundation

/// Base URL for every request.
///
/// This is the **web** origin, not the Elysia port: `BETTER_AUTH_URL` is the web
/// host and Better Auth builds OAuth callbacks from it, so auth and data must
/// share one origin.
public struct APIEnvironment: Sendable {
    public let baseURL: URL

    public init(baseURL: URL) {
        self.baseURL = baseURL
    }

    /// Reads `SenseBaseURL`, injected per build configuration by XcodeGen.
    public static func fromBundle(_ bundle: Bundle = .main) -> APIEnvironment {
        guard
            let raw = bundle.object(forInfoDictionaryKey: "SenseBaseURL") as? String,
            let url = URL(string: raw.trimmingCharacters(in: .whitespaces))
        else {
            preconditionFailure("SenseBaseURL missing from Info.plist")
        }
        return APIEnvironment(baseURL: url)
    }
}
```

`APIError.swift`:

```swift
import Foundation

public enum APIError: Error, Equatable {
    /// 401 — the session is gone; the caller signs out.
    case unauthorized
    case http(status: Int)
    case decoding
    case transport
}
```

`APIClient.swift`:

```swift
import Foundation

/// Thin async wrapper over `URLSession` with Better Auth's native-client contract.
public actor APIClient {
    private let environment: APIEnvironment
    private let session: URLSession
    private let decoder: JSONDecoder
    private var credential: SessionCredential?

    public init(environment: APIEnvironment, credential: SessionCredential? = nil) {
        self.environment = environment
        self.credential = credential

        let configuration = URLSessionConfiguration.ephemeral
        // We manage cookies ourselves — see SessionCredential.
        configuration.httpShouldSetCookies = false
        configuration.httpCookieAcceptPolicy = .never
        configuration.httpCookieStorage = nil
        self.session = URLSession(configuration: configuration)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder
    }

    public func updateCredential(_ credential: SessionCredential?) {
        self.credential = credential
    }

    public func currentCredential() -> SessionCredential? { credential }

    /// Sends a request and returns the decoded body plus any `Set-Cookie` string.
    public func send<Response: Decodable>(
        _ request: APIRequest,
        as type: Response.Type
    ) async throws -> (value: Response, setCookie: String?) {
        var urlRequest = URLRequest(url: environment.baseURL.appending(path: request.path))
        urlRequest.httpMethod = request.method
        urlRequest.httpBody = request.body
        if request.body != nil {
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        // Better Auth's native bridge: promotes this to `origin` for non-browser
        // clients so the trusted-origin check passes.
        urlRequest.setValue("still://", forHTTPHeaderField: "expo-origin")
        urlRequest.setValue("true", forHTTPHeaderField: "x-skip-oauth-proxy")
        if let header = credential?.header, !header.isEmpty {
            urlRequest.setValue(header, forHTTPHeaderField: "Cookie")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: urlRequest)
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as URLError where error.code == .cancelled {
            // Cancellation is not a failure — never surface it as an error state.
            throw CancellationError()
        } catch {
            throw APIError.transport
        }

        guard let http = response as? HTTPURLResponse else { throw APIError.transport }
        if http.statusCode == 401 { throw APIError.unauthorized }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.http(status: http.statusCode)
        }

        let setCookie = http.value(forHTTPHeaderField: "Set-Cookie")
        if Response.self == EmptyResponse.self {
            return (EmptyResponse() as! Response, setCookie)
        }
        do {
            return (try decoder.decode(Response.self, from: data), setCookie)
        } catch {
            throw APIError.decoding
        }
    }
}

public struct APIRequest: Sendable {
    public let method: String
    public let path: String
    public let body: Data?

    public init(method: String, path: String, body: Data? = nil) {
        self.method = method
        self.path = path
        self.body = body
    }
}

public struct EmptyResponse: Decodable, Sendable {
    public init() {}
}
```

- [ ] **Step 6: Build, then commit**

```bash
cd apps/ios/Packages/SenseNetworking && swift build && swift test
git add apps/ios/Packages/SenseNetworking
git commit -m "feat(ios): SenseNetworking client and credential store"
```

---

## Task 5: SenseAuth model and onboarding gate (TDD)

Pure logic only — no UI, no network.

**Files:**
- Create: `apps/ios/Packages/SenseAuth/Package.swift`, `Sources/SenseAuth/{PatronSession,OnboardingGate}.swift`, `Tests/SenseAuthTests/OnboardingGateTests.swift`

- [ ] **Step 1: Package manifest**

Same shape as Task 4, named `SenseAuth`, with `.package(path: "../SenseNetworking")` in `dependencies` and `"SenseNetworking"` in the target's dependencies.

- [ ] **Step 2: Write the failing tests**

Port the web rules from `apps/web/src/lib/onboarding-gate.ts` case for case:

```swift
import Foundation
import Testing
@testable import SenseAuth

@Suite("patronNeedsOnboarding")
struct OnboardingGateTests {
    private func session(
        handle: String? = "anselmo",
        onboardedAt: Date? = nil,
        createdAt: Date? = nil
    ) -> PatronSession {
        PatronSession(
            userId: "u1",
            displayName: "Anselmo",
            handle: handle,
            portraitURL: nil,
            onboardedAt: onboardedAt,
            createdAt: createdAt
        )
    }

    @Test("an onboarded patron is done")
    func onboarded() {
        #expect(patronNeedsOnboarding(session(onboardedAt: Date())) == false)
    }

    @Test("a pre-v3 patron with a handle is legacy-complete")
    func legacyComplete() {
        let created = Date(timeIntervalSince1970: 1_700_000_000) // 2023
        #expect(patronNeedsOnboarding(session(createdAt: created)) == false)
    }

    @Test("a post-v3 patron with only a handle still needs onboarding")
    func postV3HandleOnly() {
        let created = Date(timeIntervalSince1970: 1_800_000_000) // 2027
        #expect(patronNeedsOnboarding(session(createdAt: created)) == true)
    }

    @Test("no handle always needs onboarding")
    func noHandle() {
        let created = Date(timeIntervalSince1970: 1_700_000_000)
        #expect(patronNeedsOnboarding(session(handle: nil, createdAt: created)) == true)
        #expect(patronNeedsOnboarding(session(handle: "  ", createdAt: created)) == true)
    }

    @Test("a missing session needs onboarding")
    func noSession() {
        #expect(patronNeedsOnboarding(nil) == true)
    }
}
```

- [ ] **Step 2b: Run and watch it fail**

```bash
cd apps/ios/Packages/SenseAuth && swift test
```

Expected: compile failure — `cannot find 'patronNeedsOnboarding' in scope`.

- [ ] **Step 3: Implement**

`Sources/SenseAuth/PatronSession.swift`:

```swift
import Foundation

/// Signed-in patron, decoded from `GET /api/profiles/me`.
///
/// That endpoint returns the whole profile row plus entitlement extras; we decode
/// only the handful of fields slice 1 needs, so added server fields cannot break us.
public struct PatronSession: Equatable, Sendable, Decodable {
    public let userId: String
    public let displayName: String
    public let handle: String?
    public let portraitURL: URL?
    public let onboardedAt: Date?
    public let createdAt: Date?

    public init(
        userId: String,
        displayName: String,
        handle: String?,
        portraitURL: URL?,
        onboardedAt: Date?,
        createdAt: Date?
    ) {
        self.userId = userId
        self.displayName = displayName
        self.handle = handle
        self.portraitURL = portraitURL
        self.onboardedAt = onboardedAt
        self.createdAt = createdAt
    }

    private enum CodingKeys: String, CodingKey {
        case userId, displayName, handle, image, onboardedAt, createdAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        userId = try container.decode(String.self, forKey: .userId)
        displayName =
            try container.decodeIfPresent(String.self, forKey: .displayName) ?? ""
        handle = try container.decodeIfPresent(String.self, forKey: .handle)
        portraitURL = try container
            .decodeIfPresent(String.self, forKey: .image)
            .flatMap(URL.init(string:))
        onboardedAt = try container.decodeIfPresent(Date.self, forKey: .onboardedAt)
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt)
    }
}
```

`Sources/SenseAuth/OnboardingGate.swift`:

```swift
import Foundation

/// Wizard v3 launch — profiles created before this with a handle are legacy-complete.
/// Mirrors `ONBOARDING_V3_LAUNCH_AT` in `apps/web/src/lib/onboarding-gate.ts`.
public let onboardingV3LaunchAt = Date(timeIntervalSince1970: 1_781_395_200) // 2026-06-14T00:00:00Z

/// Swift port of `patronNeedsOnboarding`. Keep in step with the web gate: a patron
/// blocked here on iOS but allowed on the web (or the reverse) is a bug.
public func patronNeedsOnboarding(_ session: PatronSession?) -> Bool {
    guard let session else { return true }
    if session.onboardedAt != nil { return false }
    return !isLegacyOnboardingComplete(session)
}

/// Pre-v3 patrons often have a handle but never received `onboarded_at`.
public func isLegacyOnboardingComplete(_ session: PatronSession) -> Bool {
    guard let handle = session.handle?.trimmingCharacters(in: .whitespaces),
          !handle.isEmpty
    else { return false }
    guard let createdAt = session.createdAt else { return false }
    return createdAt < onboardingV3LaunchAt
}
```

The epoch literal was verified as `2026-06-14T00:00:00Z` (the neighbouring value
`1_781_308_800` is 2026-06-13 — an easy off-by-one). Re-check if you touch it:

```bash
python3 -c "import datetime;print(datetime.datetime.fromtimestamp(1781395200, datetime.UTC))"
```

Expected: `2026-06-14 00:00:00+00:00`.

- [ ] **Step 4: Run the tests**

```bash
cd apps/ios/Packages/SenseAuth && swift test
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/ios/Packages/SenseAuth
git commit -m "feat(ios): patron session model and onboarding gate"
```

---

## Task 6: SessionStore and email auth

**Files:**
- Create: `Sources/SenseAuth/{KeychainCredentialStorage,AuthAPI,SessionStore}.swift`

- [ ] **Step 1: Keychain storage**

`KeychainCredentialStorage.swift` — a small wrapper over `SecItemAdd`/`SecItemCopyMatching`/`SecItemDelete` for a single generic-password item (service `fans.sense.app`, account `session-credential`) holding the rendered cookie header. Expose `load() -> String?`, `save(_ header: String)`, `clear()`. Use `kSecAttrAccessibleAfterFirstUnlock` so a relaunch before unlock still restores the session.

- [ ] **Step 2: Auth calls**

`AuthAPI.swift` wraps `APIClient` with the endpoints, each storing the returned `Set-Cookie`:

```swift
public struct AuthAPI: Sendable {
    private let client: APIClient
    private let origin: URL

    public func signInWithEmail(email: String, password: String) async throws -> String?
    public func signUpWithEmail(name: String, email: String, password: String) async throws -> String?
    public func signInWithApple(idToken: String, nonce: String?) async throws -> String?
    public func socialAuthorizationURL(provider: String, callbackURL: String) async throws -> SocialRedirect
    public func signOut() async throws
    public func loadSession() async throws -> PatronSession?
}
```

Paths: `/api/auth/sign-in/email`, `/api/auth/sign-up/email`, `/api/auth/sign-in/social`, `/api/auth/sign-out`, `/api/profiles/me`. `SocialRedirect` decodes `{ redirect: Bool, url: String }`. Apple passes `{"provider":"apple","idToken":{"token":…,"nonce":…}}` and, per the Expo client, must **not** send the cookie/origin headers — add an `APIRequest` flag for that.

`loadSession()` returns `nil` on `APIError.unauthorized` (signed out) and rethrows everything else, so a flaky network is not mistaken for a sign-out.

- [ ] **Step 3: SessionStore**

```swift
@MainActor @Observable
public final class SessionStore {
    public enum State: Equatable {
        case launching
        case signedOut
        case needsOnboarding(PatronSession)
        case signedIn(PatronSession)
        case unavailable          // transport failure at launch; offer retry
    }
    public private(set) var state: State = .launching
    public func restore() async
    public func signInWithEmail(email: String, password: String) async throws
    public func signUpWithEmail(name: String, email: String, password: String) async throws
    public func completeAppleSignIn(idToken: String, nonce: String?) async throws
    public func signOut() async
    public func refreshOnboardingState() async
}
```

`restore()` loads the Keychain credential, calls `loadSession()`, and routes through `patronNeedsOnboarding` to pick `signedIn` vs `needsOnboarding`. Every successful auth call persists the new credential before re-reading the session. `signOut()` clears the Keychain first so a failed network call cannot strand a signed-in UI.

- [ ] **Step 4: Build and commit**

```bash
cd apps/ios/Packages/SenseAuth && swift build && swift test
git add apps/ios/Packages/SenseAuth
git commit -m "feat(ios): session store with email authentication"
```

---

## Task 7: Sign in with Apple

**Files:**
- Create: `Sources/SenseAuth/AppleSignInCoordinator.swift`
- Modify: `apps/ios/Sense/Auth/SignInView.swift` (created in Task 10; if that file does not exist yet, add the button there and revisit)

- [ ] **Step 1: Nonce handling**

Generate a random nonce, send its SHA-256 to Apple via `ASAuthorizationAppleIDRequest.nonce`, and pass the **raw** nonce to Better Auth. Sending the hashed value to the server is the classic failure here.

- [ ] **Step 2: Coordinator**

Use `SignInWithAppleButton` (`AuthenticationServices`) with `.email` and `.fullName` scopes. On success pull `credential.identityToken`, decode as UTF-8, and call `SessionStore.completeAppleSignIn`. Treat `ASAuthorizationError.canceled` as a silent no-op.

- [ ] **Step 3: Verify**

Requires the App ID, Services ID, and `.p8` key from Task 2 Step 7, plus `APPLE_*` set in `apps/server/.env`. Sign in on the simulator with a sandbox Apple ID.
Expected: the app reaches the tab shell; `select id, email from "user" order by "createdAt" desc limit 1;` shows the Apple account.

Apple only sends `email` on the **first** authorization. To retest as a new user, revoke the app under Settings → Apple ID → Sign in with Apple.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(ios): sign in with Apple"
```

---

## Task 8: Discord sign-in through the native bridge

The three-hop flow from the background section. Build it exactly in that order.

**Files:**
- Create: `Sources/SenseAuth/DiscordSignInCoordinator.swift`

- [ ] **Step 1: Request the authorization URL**

`POST /api/auth/sign-in/social` with `{"provider":"discord","callbackURL":"still://auth-callback"}`. Store the response `Set-Cookie` (it carries the OAuth state) and keep `url` from the body.

- [ ] **Step 2: Open the proxy, not the provider URL**

```swift
var components = URLComponents(
    url: environment.baseURL.appending(path: "/api/auth/expo-authorization-proxy"),
    resolvingAgainstBaseURL: false
)!
var query = [URLQueryItem(name: "authorizationURL", value: authorizationURL)]
if let state = credential?.oauthState {
    query.append(URLQueryItem(name: "oauthState", value: state))
}
components.queryItems = query
```

Present with `ASWebAuthenticationSession(url:callbackURLScheme:"still")`, `prefersEphemeralWebBrowserSession = false`, and a presentation-context provider. Opening the provider URL directly instead of the proxy is the mistake that makes the callback fail with an invalid-state error — the browser would never receive the state cookie.

- [ ] **Step 3: Read the credential off the callback**

```swift
guard let callbackURL,
      let cookie = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?
          .queryItems?.first(where: { $0.name == "cookie" })?.value
else { return }   // user cancelled, or the plugin is not registered
```

Merge it into the credential, persist to the Keychain, then `restore()`.

Treat `ASWebAuthenticationSessionError.canceledLogin` as a silent no-op.

- [ ] **Step 4: Verify**

Run the web app and server (`bun dev`), then Discord sign-in on the simulator.
Expected: browser sheet → Discord consent → returns to the app signed in. If it returns without a session, log the callback URL: a missing `cookie` parameter means the `expo()` plugin is not registered (Task 1 must not have removed it), and an error parameter usually means `still://` fell out of `trustedOrigins`.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(ios): discord sign-in via native bridge"
```

---

## Task 9: SenseUI tokens

**Files:**
- Create: `apps/ios/Packages/SenseUI/Package.swift`, `Sources/SenseUI/{SenseColor,SenseFont,PatronPortrait,SenseButtonStyle}.swift`, colour sets in `Sense/Resources/Assets.xcassets`

- [ ] **Step 1: Colour sets**

Add `SenseBackground`, `SenseCard`, `SenseForeground`, `SenseMutedForeground`, `SenseAccent` with light and dark variants, sampled from `packages/ui/src/styles/globals.css`. Expose them as `Color` statics; the package needs `resources` or the asset catalog must live in the app target and be referenced by name.

- [ ] **Step 2: Type scale and controls**

`SenseFont` wraps `.font(.system(...))` with Dynamic Type. `PatronPortrait` is an `AsyncImage` circle with an initials fallback (no plan-tier aura in this slice). `SenseButtonStyle` provides primary and secondary fills used by the auth screens.

- [ ] **Step 3: Build and commit**

```bash
cd apps/ios/Packages/SenseUI && swift build
git add apps/ios/Packages/SenseUI apps/ios/Sense/Resources
git commit -m "feat(ios): SenseUI token layer"
```

---

## Task 10: App shell and screens

**Files:**
- Create: `Sense/RootView.swift`, `Sense/Shell/{MainTabView,PlaceholderTab,YouTab}.swift`, `Sense/Auth/{SignInView,SignUpView,FinishSetupView}.swift`
- Modify: `Sense/SenseApp.swift`

- [ ] **Step 1: Root routing**

`SenseApp` builds `APIEnvironment.fromBundle()`, constructs `SessionStore`, injects it via `@Environment`, and calls `restore()` in `.task`. `RootView` switches on state: `launching` → progress; `unavailable` → retry; `signedOut` → `SignInView`; `needsOnboarding` → `FinishSetupView`; `signedIn` → `MainTabView`.

- [ ] **Step 2: Auth screens**

`SignInView`: email and password fields inside a `Form`, `.textContentType(.emailAddress)`, `.keyboardType(.emailAddress)`, `.textInputAutocapitalization(.never)`, `.disableAutocorrection(true)`; submit disabled while in flight; inline error text; Sign in with Apple and Continue with Discord buttons; a link to `SignUpView`. Fields must be at least 16pt so iOS does not zoom.

- [ ] **Step 3: Tab shell**

Five `NavigationStack` tabs per the spec table. Home, Search, Log, Inbox use `PlaceholderTab`; You shows `PatronPortrait`, display name, `@handle`, and Sign out.

- [ ] **Step 4: Finish-setup gate**

Explanation, a button opening `<baseURL>/onboarding` in `SFSafariViewController`, and an "I've finished" button calling `refreshOnboardingState()`. No path to the tabs while un-onboarded.

- [ ] **Step 5: Build and commit**

```bash
cd apps/ios && xcodegen generate && xcodebuild -project Sense.xcodeproj -scheme Sense \
  -destination 'platform=iOS Simulator,name=iPhone 15' build
git add apps/ios/Sense
git commit -m "feat(ios): tab shell and auth screens"
```

---

## Task 11: Smoke pass

**Files:**
- Create: `apps/ios/SMOKE.md`

- [ ] **Step 1: Write the checklist**

Copy the Testing section of the foundation spec into `apps/ios/SMOKE.md` as checkboxes, with a prerequisites line: `bun dev` running, `APPLE_*` and `DISCORD_*` set in `apps/server/.env`, simulator on iOS 17.

- [ ] **Step 2: Run every item**

Sign in with email, Apple, and Discord; relaunch persistence; sign out; the un-onboarded gate; server-stopped retry; light and dark; Dynamic Type XXL.

For the un-onboarded case, clear the flag for a test account:

```sql
update profile set onboarded_at = null where handle = '<test-handle>';
```

Restore it afterwards.

- [ ] **Step 3: Full test sweep and commit**

```bash
cd apps/ios/Packages/SenseNetworking && swift test
cd ../SenseAuth && swift test
cd ../../../.. && bun run check-types && bun run check
git add apps/ios/SMOKE.md
git commit -m "docs(ios): foundation smoke checklist"
```

---

## Done when

1. `xcodegen generate && xcodebuild … build` succeeds from a clean checkout.
2. All three sign-in methods produce a session that survives a force-quit.
3. The You tab shows the real patron; Sign out clears the credential.
4. Un-onboarded accounts cannot reach the tab shell.
5. `apps/native` is gone; `rg "apps/native|dev:native"` outside `docs/` is empty; the `expo()` server plugin is still registered.
6. Swift and bun test suites pass; `SMOKE.md` has been run once.
