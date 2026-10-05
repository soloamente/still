// Opens the Sense Companion card on the current page.
// This file is injected as-is. It must not open a browser window.
(() => {
	const hostId = "sense-companion-panel";
	const existing = document.getElementById(hostId);
	if (existing) {
		existing.dispatchEvent(new CustomEvent("sense-companion-close"));
		return;
	}

	const host = document.createElement("div");
	host.id = hostId;
	// Inline !important so a site stylesheet cannot hide or reposition the card.
	const hostStyle = {
		position: "fixed",
		top: "12px",
		right: "12px",
		"z-index": "2147483647",
		width: "320px",
		margin: "0",
		padding: "0",
		border: "0",
		background: "transparent",
		"box-shadow": "none",
		display: "block",
	};
	for (const [name, value] of Object.entries(hostStyle)) {
		host.style.setProperty(name, value, "important");
	}

	const shadow = host.attachShadow({ mode: "closed" });
	const frame = document.createElement("iframe");
	frame.title = "Sense Companion";
	frame.src = chrome.runtime.getURL("/companion-menu.html");
	frame.style.cssText = [
		"display:block",
		"width:320px",
		"height:280px",
		"border:0",
		"margin:0",
		"padding:0",
		"border-radius:16px",
		"overflow:hidden",
		"background:#141414",
		"box-shadow:none",
		"color-scheme:dark",
	].join(";");
	shadow.append(frame);

	const close = () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("pointerdown", onPointerDown, true);
		window.removeEventListener("keydown", onKey, true);
		host.remove();
	};

	const onMessage = (event) => {
		if (event.source !== frame.contentWindow) return;
		const data = event.data;
		if (
			!data ||
			data.source !== "sense-companion" ||
			data.type !== "popup-size"
		)
			return;
		const height = Number(data.height);
		if (!Number.isFinite(height) || height < 80 || height > 600) return;
		frame.style.height = `${Math.ceil(height)}px`;
	};

	const onPointerDown = (event) => {
		if (event.composedPath().includes(host)) return;
		close();
	};

	const onKey = (event) => {
		if (event.key === "Escape") close();
	};

	host.addEventListener("sense-companion-close", close);
	window.addEventListener("message", onMessage);
	window.addEventListener("keydown", onKey, true);
	(document.documentElement ?? document.body).append(host);
	// The click that opened the menu can land on the page a moment later.
	window.setTimeout(() => {
		if (!host.isConnected) return;
		window.addEventListener("pointerdown", onPointerDown, true);
	}, 400);
})();
