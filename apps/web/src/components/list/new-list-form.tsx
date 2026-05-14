"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Label } from "@still/ui/components/label";
import { Textarea } from "@still/ui/components/textarea";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";

/**
 * Create a new list — title, description, public/ranked toggles. Films
 * are added on the detail page after creation.
 */
export function NewListForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isRanked, setIsRanked] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Lists need a title");
      return;
    }
    setSaving(true);
    try {
      const res = await api.api.lists.post({
        title: title.trim(),
        description: description.trim() || undefined,
        isPublic,
        isRanked,
      });
      const data = res.data as { list?: { id: string } } | null;
      if (data?.list?.id) router.replace(`/lists/${data.list.id}`);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't create list");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <h1 className="font-display text-3xl tracking-[-0.02em]">New list</h1>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="My Letterboxd four"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={4}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this list about?"
        />
      </div>
      <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="accent-desert-orange"
          />
          Public
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={isRanked}
            onChange={(e) => setIsRanked(e.target.checked)}
            className="accent-desert-orange"
          />
          Ranked
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost-light" size="pill" onClick={() => history.back()}>
          Cancel
        </Button>
        <Button type="submit" variant="accent" size="pill" disabled={saving}>
          Create list
        </Button>
      </div>
    </form>
  );
}
