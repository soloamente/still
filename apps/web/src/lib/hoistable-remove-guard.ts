/**
 * React 19 deletes hoisted `<link>`, `<meta>`, `<title>`, `<style>`, and
 * `<script>` nodes in `commitDeletionEffectsOnFiber` with
 * `node.parentNode.removeChild(node)`. The browser (and favicon updates) can
 * detach those nodes first, so `parentNode` is null and client navigations
 * throw `Cannot read properties of null (reading 'removeChild')`.
 *
 * When that parent is already gone, hand React a no-op parent so the commit
 * finishes. Every other node keeps the real `parentNode`.
 *
 * Called from `apps/web/src/app/layout.tsx` via `HOISTABLE_REMOVE_GUARD_SOURCE`
 * in a beforeInteractive script. No data files.
 */
type HoistableHost = {
	nodeType: number;
	nodeName: string;
};

type NodeConstructorLike = {
	prototype: object;
	[key: symbol]: true | undefined;
};

export function installHoistableRemoveGuard(
	nodeConstructor: NodeConstructorLike | undefined,
): void {
	// Kept inside the function so the beforeInteractive source is self-contained.
	const guardMark = Symbol.for("sense.hoistable-remove-guard");
	const hoistableNodeNames: Record<string, true> = {
		LINK: true,
		META: true,
		TITLE: true,
		STYLE: true,
		SCRIPT: true,
	};
	if (!nodeConstructor || nodeConstructor[guardMark]) return;

	const descriptor = Object.getOwnPropertyDescriptor(
		nodeConstructor.prototype,
		"parentNode",
	);
	const originalGet = descriptor?.get;
	if (!originalGet) return;

	const noopParent = {
		removeChild(child: unknown) {
			return child;
		},
		insertBefore(node: unknown) {
			return node;
		},
		appendChild(node: unknown) {
			return node;
		},
	};

	Object.defineProperty(nodeConstructor.prototype, "parentNode", {
		configurable: true,
		enumerable: descriptor.enumerable,
		get() {
			const parent = originalGet.call(this);
			const host = this as HoistableHost;
			if (
				parent == null &&
				host.nodeType === 1 &&
				hoistableNodeNames[host.nodeName] === true
			) {
				return noopParent;
			}
			return parent;
		},
	});

	nodeConstructor[guardMark] = true;
}

/** Inline source for the root layout, before React hydrates. */
export const HOISTABLE_REMOVE_GUARD_SOURCE = `(${installHoistableRemoveGuard.toString()})(typeof Node==="undefined"?undefined:Node);`;
