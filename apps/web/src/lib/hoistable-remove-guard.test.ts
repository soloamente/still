import { describe, expect, test } from "bun:test";

import { installHoistableRemoveGuard } from "./hoistable-remove-guard";

class FakeNode {
	nodeType = 1;
	nodeName: string;
	parent: FakeNode | null;

	constructor(nodeName: string, parent: FakeNode | null) {
		this.nodeName = nodeName;
		this.parent = parent;
	}

	get parentNode(): FakeNode | null {
		return this.parent;
	}

	removeChild(child: unknown): unknown {
		return child;
	}
}

describe("installHoistableRemoveGuard", () => {
	test("a detached link can be removed without a parent", () => {
		installHoistableRemoveGuard(FakeNode);
		const link = new FakeNode("LINK", null);

		expect(link.parentNode.removeChild(link)).toBe(link);
	});

	test("a detached div still has no parent", () => {
		installHoistableRemoveGuard(FakeNode);
		const div = new FakeNode("DIV", null);

		expect(div.parentNode).toBeNull();
	});

	test("a connected link keeps its real parent", () => {
		installHoistableRemoveGuard(FakeNode);
		const head = new FakeNode("HEAD", null);
		const link = new FakeNode("LINK", head);

		expect(link.parentNode).toBe(head);
	});
});
