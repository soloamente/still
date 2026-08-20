/** Occupied Save/Cancel slot — `owner` is the registrant that last wrote. */
export type MeAccountBarActionsSlot<T> = {
	owner: symbol | null;
	actions: T | null;
};

export const EMPTY_ME_ACCOUNT_BAR_ACTIONS_SLOT: MeAccountBarActionsSlot<never> =
	{
		owner: null,
		actions: null,
	};

/**
 * Apply a register/clear from one `useRegisterMeAccountBarActions` instance.
 * Clearing is a no-op unless `owner` still holds the slot — so an exiting
 * route-slide duplicate cannot wipe the surviving Settings form.
 */
export function reduceMeAccountBarActionsSlot<T>(
	state: MeAccountBarActionsSlot<T>,
	next: T | null,
	owner: symbol,
): MeAccountBarActionsSlot<T> {
	if (next === null) {
		if (state.owner !== owner) return state;
		return EMPTY_ME_ACCOUNT_BAR_ACTIONS_SLOT;
	}
	return { owner, actions: next };
}
