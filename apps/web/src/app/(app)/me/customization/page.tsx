import type { Metadata } from "next";

import { CustomizationForm } from "@/components/profile/customization-form";
import { serverApi } from "@/lib/server-api";

export const metadata: Metadata = { title: "Customize" };
export const dynamic = "force-dynamic";

type Me = {
  bannerUrl: string | null;
  accentColor: string | null;
  sectionOrder: string[] | null;
  handle: string;
};

export default async function CustomizationPage() {
  const api = await serverApi();
  const res = await api.api.profiles.me.get();
  const me = res.data as Me | null;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-3xl tracking-[-0.02em]">Customize your profile</h1>
        <p className="text-sm text-muted-foreground">
          Make Still feel like home. Banner image, accent color, section order.
        </p>
      </header>
      <CustomizationForm initial={me} />
    </div>
  );
}
