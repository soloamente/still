import fs from "fs";

const data = JSON.parse(
	fs.readFileSync(
		"C:/Users/adgv/Documents/Projects/still/.cursor/hooks/state/_mine-out.json",
		"utf8",
	),
);

const keywords =
	/\b(always|never|don't|do not|prefer|must|should|instead|not |use |avoid|keep|stop|fix|wrong|correct|planner|executor|go\b|ok\b|scratchpad|AGENTS|design|onboarding|hero|home|profile|community|metal-fx|originkit|spiral|polar|subscription|theme|motion|animation)\b/i;

for (const t of data) {
	console.log(`\n######## ${t.id} (${t.count}) ########`);
	for (let i = 0; i < t.users.length; i++) {
		const u = t.users[i];
		// skip huge skill dumps
		if (u.includes("manually_attached_skills") && u.length > 1500) {
			console.log(`--- ${i + 1} [skill attach, truncated] ---`);
			const q = u.match(/<user_query>[\s\S]*$/);
			console.log((q ? q[0] : u).slice(0, 600));
			continue;
		}
		if (u.length > 400 && !keywords.test(u.slice(0, 800))) {
			// still show short head
			console.log(`--- ${i + 1} ---`);
			console.log(u.slice(0, 500));
			continue;
		}
		console.log(`--- ${i + 1} ---`);
		console.log(u.slice(0, 1400));
	}
}
