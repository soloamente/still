import { ScrollArea } from "@still/ui/components/scroll-area";

/** Stable list keys for static demo rows (Biome forbids array index as `key`). */
const SKI87_DEMO_ROW_KEYS = [
	"skiper87-row-0",
	"skiper87-row-1",
	"skiper87-row-2",
	"skiper87-row-3",
	"skiper87-row-4",
	"skiper87-row-5",
	"skiper87-row-6",
	"skiper87-row-7",
	"skiper87-row-8",
	"skiper87-row-9",
	"skiper87-row-10",
] as const;

const Skiper87 = () => {
	return (
		<div className="flex h-full w-full flex-col items-center justify-center gap-10 bg-muted">
			<div className="-mt-10 mb-20 grid content-start justify-items-center gap-6 text-center">
				<span className="relative max-w-[12ch] text-xs uppercase leading-tight opacity-40 after:absolute after:top-full after:left-1/2 after:h-16 after:w-px after:bg-gradient-to-b after:from-transparent after:to-foreground after:content-['']">
					see the fade while scroll
				</span>
			</div>
			<div className="rounded-xl border">
				<ScrollArea className="h-72 w-62 rounded-xl">
					<div className="space-y-1 p-1">
						{SKI87_DEMO_ROW_KEYS.map((rowKey, index) => (
							<div
								key={rowKey}
								className="flex h-10 w-full items-center gap-2 rounded-lg bg-foreground/5 px-4 text-foreground/30 hover:bg-foreground/10"
							>
								00{index} <div className="h-px flex-1 bg-foreground/10" />
							</div>
						))}
					</div>
				</ScrollArea>
			</div>
		</div>
	);
};

export { Skiper87 };
