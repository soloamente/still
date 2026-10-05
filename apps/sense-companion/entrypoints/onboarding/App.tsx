import { useEffect, useState } from "react";
import { browser } from "wxt/browser";

import { DiscordStatus } from "../../src/popup/discord-status";
import { PairingPanel } from "../../src/popup/pairing-panel";
import { PlaybackSettings } from "../../src/popup/playback-settings";
import { markOnboarded, readOnboarded } from "../../src/presence/site-settings";

const STEPS = ["welcome", "discord", "customize", "sense"] as const;
type StepId = (typeof STEPS)[number];

const STEP_LABEL: Record<StepId, string> = {
	welcome: "Welcome",
	discord: "Discord",
	customize: "Customize",
	sense: "Sense",
};

function stepFromLocation(): StepId {
	const raw = new URLSearchParams(location.search).get("step");
	if (raw === "discord" || raw === "customize" || raw === "sense") return raw;
	return "welcome";
}

function App() {
	const [ready, setReady] = useState(false);
	const [step, setStep] = useState<StepId>(stepFromLocation);
	const [finished, setFinished] = useState(false);
	const index = STEPS.indexOf(step);

	useEffect(() => {
		let cancelled = false;
		void readOnboarded().then((done) => {
			if (cancelled) return;
			// Setup already finished. This tab is the settings page from here on.
			if (done) {
				location.replace(browser.runtime.getURL("/settings.html"));
				return;
			}
			setReady(true);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	async function finish() {
		await markOnboarded();
		setFinished(true);
		window.close();
	}

	function goNext() {
		const next = STEPS[index + 1];
		if (!next) {
			void finish();
			return;
		}
		setStep(next);
	}

	if (!ready) return null;

	if (finished) {
		return (
			<main>
				<p className="eyebrow">Sense</p>
				<h1>You're set</h1>
				<p className="hint">
					You can close this tab. Play a title with Discord open.
				</p>
			</main>
		);
	}

	return (
		<main>
			<p className="eyebrow">Sense</p>
			<ol className="steps">
				{STEPS.map((id, stepIndex) => (
					<li key={id} aria-current={id === step ? "step" : undefined}>
						<span className="step-index">{stepIndex + 1}</span>
						{STEP_LABEL[id]}
					</li>
				))}
			</ol>
			{step === "welcome" ? <WelcomeStep /> : null}
			{step === "discord" ? <DiscordStep /> : null}
			{step === "customize" ? <CustomizeStep /> : null}
			{step === "sense" ? <SenseStep /> : null}
			<div className="actions">
				{index > 0 ? (
					<button
						type="button"
						className="secondary"
						onClick={() => {
							const previous = STEPS[index - 1];
							if (previous) setStep(previous);
						}}
					>
						Back
					</button>
				) : null}
				<button type="button" onClick={goNext}>
					{index === STEPS.length - 1 ? "Done" : "Next"}
				</button>
			</div>
		</main>
	);
}

function WelcomeStep() {
	return (
		<>
			<h1>Show what you're watching</h1>
			<p className="hint">
				Sense Companion puts the title on Discord. Pair this browser and it
				shows on your Sense profile too.
			</p>
		</>
	);
}

function DiscordStep() {
	return (
		<>
			<h1>Connect Discord</h1>
			<p className="hint">
				Install only this extension from the store, then open the Discord
				desktop app on this computer and leave it running while you watch.
			</p>
			<DiscordStatus />
		</>
	);
}

function CustomizeStep() {
	return (
		<>
			<h1>Customize</h1>
			<p className="hint">
				Pick a service. A change applies the next time that player updates. You
				can read what each option does later in Settings.
			</p>
			<PlaybackSettings />
		</>
	);
}

function SenseStep() {
	return (
		<>
			<h1>Sense profile</h1>
			<p className="hint">
				Pair this browser so the title shows on your profile. Discord already
				works without it.
			</p>
			<PairingPanel />
		</>
	);
}

export default App;
