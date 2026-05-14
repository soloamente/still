"use client";

import { useEffect, useState } from "react";

const STORAGE_PREFIX = "still:endcredits:";

type Checks = {
  stayed: boolean;
  stinger: boolean;
};

function loadChecks(movieId: number): Checks {
  if (typeof window === "undefined") return { stayed: false, stinger: false };
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${movieId}`);
    if (!raw) return { stayed: false, stinger: false };
    const parsed = JSON.parse(raw) as Partial<Checks>;
    return {
      stayed: Boolean(parsed.stayed),
      stinger: Boolean(parsed.stinger),
    };
  } catch {
    return { stayed: false, stinger: false };
  }
}

function saveChecks(movieId: number, next: Checks) {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${movieId}`, JSON.stringify(next));
  } catch {
    // Storage can be unavailable in private modes — ignore quietly.
  }
}

/**
 * Purely local “projectionist checklist” so members can remember how they watched.
 * Not synced server-side (by design — avoids schema churn for a playful detail).
 */
export function EndCreditsChecklist({ movieId }: { movieId: number }) {
  const [checks, setChecks] = useState<Checks>({ stayed: false, stinger: false });

  useEffect(() => {
    setChecks(loadChecks(movieId));
  }, [movieId]);

  function update(patch: Partial<Checks>) {
    setChecks((prev) => {
      const next = { ...prev, ...patch };
      saveChecks(movieId, next);
      return next;
    });
  }

  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
        After the screening
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Quick notes for your future self — saved only on this device.
      </p>
      <div className="mt-4 space-y-3">
        <label className="flex select-none items-start gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={checks.stayed}
            onChange={(e) => update({ stayed: e.target.checked })}
            className="accent-desert-orange mt-1"
          />
          <span>
            <span className="text-sm font-medium text-foreground">Stayed through the credits</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Whether you listened to the house music or actually read the names.
            </span>
          </span>
        </label>
        <label className="flex select-none items-start gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={checks.stinger}
            onChange={(e) => update({ stinger: e.target.checked })}
            className="accent-desert-orange mt-1"
          />
          <span>
            <span className="text-sm font-medium text-foreground">Post-credits scene</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Toggle if there was a stinger — no spoilers saved, just your memory.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
