import { describe, expect, test } from "bun:test";

import {
	EMPTY_ME_ACCOUNT_BAR_ACTIONS_SLOT,
	reduceMeAccountBarActionsSlot,
} from "@/components/profile/me-account-bar-actions-slot";

type StubActions = {
	onSave: () => void;
	onCancel: () => void;
	canSave: boolean;
};

function stubActions(label: string): StubActions {
	return {
		onSave: () => {
			void label;
		},
		onCancel: () => {
			void label;
		},
		canSave: true,
	};
}

describe("reduceMeAccountBarActionsSlot", () => {
	test("exit-layer unmount does not clear a later registrant", () => {
		const exit = Symbol("exit");
		const enter = Symbol("enter");
		const exitActions = stubActions("exit");
		const enterActions = stubActions("enter");

		let slot = EMPTY_ME_ACCOUNT_BAR_ACTIONS_SLOT;
		slot = reduceMeAccountBarActionsSlot(slot, exitActions, exit);
		slot = reduceMeAccountBarActionsSlot(slot, enterActions, enter);
		// Route-slide timeout unmounts the outgoing SettingsFormProvider.
		slot = reduceMeAccountBarActionsSlot(slot, null, exit);

		expect(slot.actions).toBe(enterActions);
		expect(slot.owner).toBe(enter);
	});

	test("owner unmount clears the slot so other /me routes do not inherit handlers", () => {
		const owner = Symbol("live");
		const actions = stubActions("live");

		let slot = reduceMeAccountBarActionsSlot(
			EMPTY_ME_ACCOUNT_BAR_ACTIONS_SLOT,
			actions,
			owner,
		);
		slot = reduceMeAccountBarActionsSlot(slot, null, owner);

		expect(slot.actions).toBeNull();
		expect(slot.owner).toBeNull();
	});

	test("same owner can replace actions when dirty/saving changes", () => {
		const owner = Symbol("live");
		const idle = { ...stubActions("idle"), canSave: false };
		const dirty = { ...stubActions("dirty"), canSave: true };

		let slot = reduceMeAccountBarActionsSlot(
			EMPTY_ME_ACCOUNT_BAR_ACTIONS_SLOT,
			idle,
			owner,
		);
		slot = reduceMeAccountBarActionsSlot(slot, dirty, owner);

		expect(slot.actions).toBe(dirty);
		expect(slot.owner).toBe(owner);
	});
});
