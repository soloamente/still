import { fileURLToPath } from "node:url";

import { defineConfig } from "wxt";

// Chrome + Edge first. Firefox build stays off until we add it later.
// `webExt.disabled` keeps WXT from launching Chrome over CDP; load the
// unpacked build from chrome://extensions or edge://extensions.
export default defineConfig({
	modules: ["@wxt-dev/module-react"],
	manifest: {
		name: "Sense Companion",
		description: "Show what you are watching on Sense and Discord.",
		// Public key only. Pins the unpacked extension id. Do not rotate it.
		key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzNAG9jbJ+NxpMulg8rM6tHbufSm1T4STBf+3PZ0b2sXUluEspKNtADSxQLZL/p1m9tqcUlKi+WY8iWM4rCQTJMD9/Jfj+kvxDFiRcsBjz+rgyahHN+47DXDyo+vRRW288fu9UZQK70/ZlAJMGN3170unO5Ha6HAtb4LQKdg6FKCcIyiYG/d9sea+tZ37QkHUqh92Fe1y0hWOJStwKYAV38wmsuorFPPUNPug44uZgySqPQrqZhNu3GojiZmVo7vuBv1VGfq40bGHLxIeJzf1v9DUICywZwADIsZU0d9XV0PtGk1iyvZvPr12hT8tmoAyfhKyzY/CzvrWUDtMI7IW4wIDAQAB",
		permissions: ["storage", "scripting", "activeTab"],
		action: {
			default_title: "Sense Companion",
		},
		// The menu iframe is injected into the open tab. A stable URL is required
		// so the page can actually load the card.
		web_accessible_resources: [
			{
				resources: ["companion-menu.html"],
				matches: ["<all_urls>"],
			},
		],
		host_permissions: [
			"<all_urls>",
			"*://*.netflix.com/*",
			"*://netflix.com/*",
			"*://*.disneyplus.com/*",
			"*://*.hotstar.com/*",
			"*://*.primevideo.com/*",
			"*://primevideo.com/*",
			"*://*.amazon.com/*",
			"*://*.amazon.co.uk/*",
			"*://*.amazon.de/*",
			"*://*.amazon.co.jp/*",
			"*://*.amazon.ca/*",
			"*://*.amazon.com.au/*",
			"*://*.amazon.fr/*",
			"*://*.amazon.it/*",
			"*://*.amazon.es/*",
			"*://*.amazon.in/*",
			"*://*.amazon.com.br/*",
			"*://*.amazon.com.mx/*",
			"*://*.amazon.nl/*",
			"*://tv.apple.com/*",
			"*://play.hbomax.com/*",
			"*://play.max.com/*",
			"http://127.0.0.1:3001/*",
			"http://localhost:3001/*",
			"http://127.0.0.1:3000/*",
			"http://localhost:3000/*",
			// Discord desktop IPC (ports 6463–6472). Store builds use this, not native messaging.
			"http://127.0.0.1/*",
			"http://localhost/*",
		],
	},
	vite: () => ({
		resolve: {
			alias: {
				// Vendored site scripts import the PreMiD helper by this package name.
				premid: fileURLToPath(
					new URL(
						"./vendor/premid-activities/premid/src/index.ts",
						import.meta.url,
					),
				),
			},
		},
	}),
	webExt: {
		disabled: true,
	},
});
