import {
	AnimatePresence,
	motion,
	useReducedMotion,
	type Variants,
} from "motion/react";
import {
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
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

/** Hold the done screen long enough for the success check to land. */
const FINISH_HOLD_MS = 1800;

/**
 * Same language as web auth convert-card slides (transitions.dev page-slide via
 * motion/react). CSS class choreography was too fast / flaky here — WAAPI +
 * absolute layer height locking clipped “Check again” and skipped the tween.
 */
const PAGE_EASE = [0.22, 1, 0.36, 1] as const;
const SLIDE_PX = 48;
const SLIDE_SEC = 0.42;
const STAGGER_SEC = 0.12;

const stepSlideVariants: Variants = {
	enter: (dir: "forward" | "back") => ({
		x: dir === "forward" ? SLIDE_PX : -SLIDE_PX,
		opacity: 0,
		filter: "blur(4px)",
	}),
	center: {
		x: 0,
		opacity: 1,
		filter: "blur(0px)",
		transition: {
			duration: SLIDE_SEC,
			ease: PAGE_EASE,
			delay: STAGGER_SEC,
		},
	},
	exit: (dir: "forward" | "back") => ({
		x: dir === "forward" ? -SLIDE_PX : SLIDE_PX,
		opacity: 0,
		filter: "blur(4px)",
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		transition: {
			duration: SLIDE_SEC * 0.7,
			ease: PAGE_EASE,
			delay: 0,
		},
	}),
};

function OnboardingStepSlide({
	stepKey,
	direction,
	children,
}: {
	stepKey: string;
	direction: number;
	children: ReactNode;
}) {
	const reduceMotion = useReducedMotion();
	const slideDir = direction < 0 ? "back" : "forward";

	if (reduceMotion) {
		return <div className="onboarding-step-body">{children}</div>;
	}

	return (
		<div
			className="onboarding-step-body t-page-slide"
			data-direction={slideDir}
		>
			<AnimatePresence custom={slideDir} initial={false} mode="sync">
				<motion.div
					key={stepKey}
					animate="center"
					className="t-page"
					custom={slideDir}
					exit="exit"
					initial="enter"
					variants={stepSlideVariants}
				>
					{children}
				</motion.div>
			</AnimatePresence>
		</div>
	);
}

function SuccessCheck() {
	const pathRef = useRef<SVGPathElement | null>(null);
	const [state, setState] = useState<"out" | "in">("out");

	useLayoutEffect(() => {
		const path = pathRef.current;
		if (path) {
			const len = Math.ceil(path.getTotalLength()) + 1;
			path.style.strokeDasharray = String(len);
			path.style.strokeDashoffset = String(len);
		}
		const frame = window.requestAnimationFrame(() => {
			setState("in");
		});
		return () => window.cancelAnimationFrame(frame);
	}, []);

	return (
		<span className="t-success-check" data-state={state} aria-hidden="true">
			<svg
				viewBox="0 0 48 48"
				width="56"
				height="56"
				fill="none"
				focusable="false"
			>
				<title>Done</title>
				<path
					ref={pathRef}
					d="M14 24.5 L21.5 32 L34 16"
					stroke="currentColor"
					strokeWidth="3.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</span>
	);
}

function App() {
	const [ready, setReady] = useState(false);
	const [step, setStep] = useState<StepId>(stepFromLocation);
	const [direction, setDirection] = useState(1);
	const [finished, setFinished] = useState(false);
	const index = STEPS.indexOf(step);

	useEffect(() => {
		let cancelled = false;
		void readOnboarded().then((done) => {
			if (cancelled) return;
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

	useEffect(() => {
		if (!finished) return;
		const id = window.setTimeout(() => {
			window.close();
		}, FINISH_HOLD_MS);
		return () => window.clearTimeout(id);
	}, [finished]);

	async function finish() {
		await markOnboarded();
		setFinished(true);
	}

	function goTo(next: StepId, dir: number) {
		setDirection(dir);
		setStep(next);
	}

	function goNext() {
		const next = STEPS[index + 1];
		if (!next) {
			void finish();
			return;
		}
		goTo(next, 1);
	}

	function goBack() {
		const previous = STEPS[index - 1];
		if (previous) goTo(previous, -1);
	}

	if (!ready) return null;

	if (finished) {
		return (
			<main className="onboarding onboarding--done">
				<div className="onboarding-done">
					<SuccessCheck />
					<p className="eyebrow">Sense</p>
					<h1>You're set</h1>
					<p className="hint">
						You can close this tab. Play a title with Discord open.
					</p>
				</div>
			</main>
		);
	}

	return (
		<main className="onboarding">
			<p className="eyebrow">Sense</p>
			<ol className="steps" aria-label="Setup steps">
				{STEPS.map((id, stepIndex) => (
					<li key={id} aria-current={id === step ? "step" : undefined}>
						<span className="step-index">{stepIndex + 1}</span>
						{STEP_LABEL[id]}
					</li>
				))}
			</ol>

			<OnboardingStepSlide stepKey={step} direction={direction}>
				{step === "welcome" ? <WelcomeStep /> : null}
				{step === "discord" ? <DiscordStep /> : null}
				{step === "customize" ? <CustomizeStep /> : null}
				{step === "sense" ? <SenseStep /> : null}
			</OnboardingStepSlide>

			<div className="actions">
				{index > 0 ? (
					<button type="button" className="secondary" onClick={goBack}>
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

function stepFromLocation(): StepId {
	const raw = new URLSearchParams(location.search).get("step");
	if (raw === "discord" || raw === "customize" || raw === "sense") return raw;
	return "welcome";
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
