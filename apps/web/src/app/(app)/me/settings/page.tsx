import type { Metadata } from "next";

import { SettingsForm } from "@/components/profile/settings-form";
import { serverApi } from "@/lib/server-api";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

type Me = {
  handle: string;
  displayName: string;
  bio: string | null;
  pronouns: string | null;
  location: string | null;
  website: string | null;
  isPrivate: boolean;
  preferences?: Record<string, unknown> | null;
};

export default async function SettingsPage() {
  const api = await serverApi();
  const res = await api.api.profiles.me.get();
  const me = res.data as Me | null;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-3xl tracking-[-0.02em]">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your public identity on Still. Changes are visible immediately.
        </p>
      </header>
      <SettingsForm initial={me} />
    </div>
  );
}
