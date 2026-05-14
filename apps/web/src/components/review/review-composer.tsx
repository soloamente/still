"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Label } from "@still/ui/components/label";
import { Textarea } from "@still/ui/components/textarea";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { create } from "zustand";

import { StarRating } from "@/components/rating/star-rating";
import { api } from "@/lib/api";

type ComposerArgs = { movieId: number; movieTitle: string; reviewId?: string };

type Store = {
  isOpen: boolean;
  args: ComposerArgs | null;
  open: (args: ComposerArgs) => void;
  close: () => void;
};

export const useReviewComposer = create<Store>((set) => ({
  isOpen: false,
  args: null,
  open: (args) => set({ isOpen: true, args }),
  close: () => set({ isOpen: false, args: null }),
}));

/**
 * Floating review composer. Mounted at the root of (app)/layout so any
 * button anywhere in the app can pop it open by calling useReviewComposer().open().
 */
export function ReviewComposerRoot() {
  const { isOpen, args, close } = useReviewComposer();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [contains, setContains] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setBody("");
      setRating(null);
      setContains(false);
    }
  }, [isOpen]);

  if (!args) return null;

  async function submit() {
    if (!body.trim()) {
      toast.error("Reviews need some content");
      return;
    }
    setSaving(true);
    try {
      await api.api.reviews.post({
        movieId: args!.movieId,
        title: title.trim() || undefined,
        body: body.trim(),
        rating: rating ?? undefined,
        containsSpoilers: contains,
      });
      toast.success("Review published");
      close();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't publish — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 grid place-items-end bg-absolute-black/82 backdrop-blur-sm md:place-items-center"
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-label={`Review ${args.movieTitle}`}
            initial={{ y: 32, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.165, 0.84, 0.44, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl md:rounded-2xl"
          >
            <header className="flex items-start justify-between border-b border-border p-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Now reviewing
                </p>
                <h2 className="font-serif text-xl">{args.movieTitle}</h2>
              </div>
              <Button variant="ghost" size="icon-pill" onClick={close} aria-label="Close">
                <X className="size-4" />
              </Button>
            </header>
            <div className="space-y-4 p-4">
              <div className="space-y-2">
                <Label>Rating</Label>
                <StarRating value={rating} onChange={setRating} size="lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-title">Title (optional)</Label>
                <Input
                  id="review-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={140}
                  placeholder="A headline for your take"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-body">Review</Label>
                <Textarea
                  id="review-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  placeholder="What did this film do for you?"
                  maxLength={8000}
                />
                <p className="text-xs text-muted-foreground">{body.length} / 8000</p>
              </div>
              <label className="flex select-none items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={contains}
                  onChange={(e) => setContains(e.target.checked)}
                  className="accent-desert-orange"
                />
                Late arrival (contains spoilers)
              </label>
            </div>
            <footer className="flex items-center justify-end gap-2 border-t border-border p-4">
              <Button variant="ghost-light" size="pill" onClick={close}>
                Cancel
              </Button>
              <Button variant="accent" size="pill" onClick={submit} disabled={saving}>
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Publish
              </Button>
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
