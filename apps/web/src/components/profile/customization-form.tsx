"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Label } from "@still/ui/components/label";
import { cn } from "@still/ui/lib/utils";
import { env } from "@still/env/web";
import { ArrowDown, ArrowUp, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { profileBannerImageUrl } from "@/lib/profile-banner";

type Me = {
  bannerUrl: string | null;
  accentColor: string | null;
  sectionOrder: string[] | null;
  handle: string;
} | null;

const DEFAULT_SECTIONS = ["favorites", "recent", "reviews", "lists", "stats"];

const PRESET_ACCENTS = [
  { name: "Desert", value: "#b75928" },
  { name: "Moss", value: "#193f32" },
  { name: "Crimson", value: "#df6a6b" },
  { name: "Ocean", value: "#044152" },
  { name: "Copper", value: "#776157" },
];

export function CustomizationForm({ initial }: { initial: Me }) {
  const [accent, setAccent] = useState(initial?.accentColor ?? "#b75928");
  const [bannerUrl, setBannerUrl] = useState(initial?.bannerUrl ?? "");
  const [sections, setSections] = useState<string[]>(
    initial?.sectionOrder?.length ? initial.sectionOrder : DEFAULT_SECTIONS,
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPickFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      // Upload hits the Elysia API so `BLOB_READ_WRITE_TOKEN` is read from
      // apps/server/.env (Next.js does not need the Blob token).
      const res = await fetch(new URL("/api/profiles/me/banner", env.NEXT_PUBLIC_SERVER_URL), {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        let msg = `Upload failed (${res.status})`;
        try {
          const body = (await res.json()) as { error?: string; code?: string; hint?: string };
          if (body.code === "BLOB_UNCONFIGURED") {
            msg =
              body.hint ??
              "Add BLOB_READ_WRITE_TOKEN to the API server .env (Vercel Blob token).";
          } else if (body.code === "BLOB_ACCESS_MISMATCH" && body.hint) {
            msg = body.hint;
          } else if (body.error) msg = body.error;
        } catch {
          /* use default */
        }
        throw new Error(msg);
      }
      const { url } = (await res.json()) as { url: string };
      setBannerUrl(url);
      toast.success("Banner uploaded");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Banner upload failed");
    } finally {
      setUploading(false);
    }
  }

  function move(idx: number, direction: -1 | 1) {
    setSections((current) => {
      const next = [...current];
      const target = idx + direction;
      if (target < 0 || target >= next.length) return next;
      [next[idx], next[target]] = [next[target]!, next[idx]!];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await api.api.profiles.me.patch({
        accentColor: accent,
        bannerUrl: bannerUrl || undefined,
        sectionOrder: sections,
      });
      toast.success("Profile updated");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <Label>Banner</Label>
        <div className="relative aspect-[3/1] overflow-hidden rounded-2xl border border-border bg-card">
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                initial?.handle
                  ? profileBannerImageUrl(initial.handle)
                  : bannerUrl
              }
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <div
              className="size-full"
              style={{
                background: `linear-gradient(120deg, ${accent}33, transparent 60%), var(--surface-card-base)`,
              }}
            />
          )}
          <Button
            variant="ghost-light"
            size="pill"
            type="button"
            className="absolute right-3 top-3"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="size-3.5" /> {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onPickFile(file);
          }}
        />
      </section>

      <section className="space-y-3">
        <Label>Accent color</Label>
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_ACCENTS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={cn(
                "h-9 w-12 rounded-full border-2 transition-transform",
                accent === preset.value ? "scale-110 border-foreground" : "border-transparent",
              )}
              style={{ backgroundColor: preset.value }}
              onClick={() => setAccent(preset.value)}
              aria-label={`Use ${preset.name} accent`}
            />
          ))}
          <Input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="h-9 w-16 p-1"
          />
        </div>
      </section>

      <section className="space-y-3">
        <Label>Section order</Label>
        <p className="text-xs text-muted-foreground">
          Choose what shows up first when someone visits @{initial?.handle}.
        </p>
        <ul className="space-y-2">
          {sections.map((section, idx) => (
            <li
              key={section}
              className="flex items-center justify-between rounded-md border border-border bg-card/60 px-3 py-2 text-sm"
            >
              <span className="capitalize">{section}</span>
              <span className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => move(idx, -1)}
                  aria-label="Move up"
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => move(idx, 1)}
                  aria-label="Move down"
                >
                  <ArrowDown className="size-3.5" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex justify-end">
        <Button variant="accent" size="pill" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
