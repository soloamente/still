import React from "react";
import ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";

import App from "./App.tsx";

import "./style.css";

// Toolbar fallback only. The page card is an iframe and must keep the icon on the card path.
if (window.parent === window) {
	void browser.action.setPopup({ popup: "" });
}

const root = document.getElementById("root");
if (!root) {
	throw new Error("Sense Companion popup root is missing");
}

ReactDOM.createRoot(root).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);

// The menu is an iframe on the page. Tell that frame how tall the card is.
if (window.parent !== window) {
	const reportHeight = () => {
		const height = Math.ceil(document.body.getBoundingClientRect().height);
		window.parent.postMessage(
			{ source: "sense-companion", type: "popup-size", height },
			"*",
		);
	};
	reportHeight();
	const observer = new ResizeObserver(reportHeight);
	observer.observe(document.body);
}
