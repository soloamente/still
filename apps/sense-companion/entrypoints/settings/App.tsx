import { DiscordActivityEditor } from "../../src/popup/discord-activity-editor";
import { DiscordStatus } from "../../src/popup/discord-status";
import { PairingPanel } from "../../src/popup/pairing-panel";
import { PlaybackSettings } from "../../src/popup/playback-settings";

/**
 * Settings is a document, not the setup wizard. Connection status is the
 * first thing on the page. The Discord card is the thing you edit.
 */
function App() {
	return (
		<main className="settings-page">
			<header className="settings-header">
				<p className="eyebrow">Sense</p>
				<h1>Settings</h1>
				<p className="lede">
					Discord on this computer, your profile, and what each player reports.
				</p>
			</header>

			<section className="settings-section">
				<h2>Connections</h2>
				<div className="connections">
					<div className="connection">
						<h3>Discord</h3>
						<p className="hint">
							The desktop app on this computer has to stay open.
						</p>
						<DiscordStatus />
					</div>
					<div className="connection">
						<h3>Sense</h3>
						<p className="hint">
							Pair this browser so the title shows on your profile.
						</p>
						<PairingPanel />
					</div>
				</div>
			</section>

			<section className="settings-section">
				<h2>Discord activity</h2>
				<DiscordActivityEditor />
			</section>

			<section className="settings-section">
				<h2>Playback</h2>
				<p className="hint">Each option is for that service only.</p>
				<PlaybackSettings detailed />
			</section>
		</main>
	);
}

export default App;
