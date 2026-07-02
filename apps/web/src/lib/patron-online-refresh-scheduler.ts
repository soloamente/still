/** Coalesce `/online` refetches — one in-flight request with an optional trailing run. */
export function createPatronOnlineRefreshScheduler(
	fetchSnapshot: () => Promise<void>,
) {
	let inFlight = false;
	let pending = false;

	const run = async () => {
		if (inFlight) {
			pending = true;
			return;
		}

		inFlight = true;
		try {
			await fetchSnapshot();
		} finally {
			inFlight = false;
			if (pending) {
				pending = false;
				void run();
			}
		}
	};

	return {
		refresh: () => {
			void run();
		},
	};
}
