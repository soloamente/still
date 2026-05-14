"use client";

import { Button } from "@still/ui/components/button";
import { Input } from "@still/ui/components/input";
import { Label } from "@still/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { fetchProfileHandleAvailable } from "@/lib/still-api-fetch";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

import { Field } from "./field";

const HANDLE_RE = /^[a-z0-9._-]{2,24}$/;

const schema = z.object({
  name: z.string().min(2, "At least 2 characters").max(60),
  handle: z
    .string()
    .min(2, "At least 2 characters")
    .max(24, "Max 24 characters")
    .regex(HANDLE_RE, "Use lowercase letters, numbers, . _ -"),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});

type HandleStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "taken" }
  | { state: "invalid" };

export function SignUpForm() {
  const router = useRouter();
  const [handleStatus, setHandleStatus] = useState<HandleStatus>({ state: "idle" });
  const [handleValue, setHandleValue] = useState("");

  // Debounced availability check; cancels in-flight requests on key changes.
  useEffect(() => {
    const trimmed = handleValue.trim().toLowerCase();
    if (!trimmed) {
      setHandleStatus({ state: "idle" });
      return;
    }
    if (!HANDLE_RE.test(trimmed)) {
      setHandleStatus({ state: "invalid" });
      return;
    }
    setHandleStatus({ state: "checking" });
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetchProfileHandleAvailable(trimmed, { signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        const data = res.data as { available: boolean; reason: string } | null;
        if (!data) return setHandleStatus({ state: "idle" });
        setHandleStatus({ state: data.available ? "available" : "taken" });
      } catch {
        if (!ctrl.signal.aborted) setHandleStatus({ state: "idle" });
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [handleValue]);

  const form = useForm({
    defaultValues: { name: "", handle: "", email: "", password: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      const handle = value.handle.toLowerCase();
      await authClient.signUp.email(
        { email: value.email, password: value.password, name: value.name },
        {
          onSuccess: async () => {
            try {
              // Bootstrap a profile row right after signup so the user lands
              // on a complete /home with their handle ready to share.
              await api.api.profiles.me.patch({
                handle,
                displayName: value.name,
              });
            } catch (err) {
              console.error("[sign-up] profile bootstrap failed", err);
            }
            toast.success("Welcome to Still");
            router.replace("/onboarding");
            router.refresh();
          },
          onError: (err) => {
            toast.error(err.error.message || "Could not create your account");
          },
        },
      );
    },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.Field name="name">
        {(field) => (
          <Field
            field={field}
            label="Display name"
            autoComplete="name"
            placeholder="Akira Kurosawa"
            required
          />
        )}
      </form.Field>
      <form.Field name="handle">
        {(field) => {
          const errorMessage = field.state.meta.errors.find(Boolean) as
            | { message?: string }
            | undefined;
          const helper =
            handleStatus.state === "checking" ? (
              <span className="text-muted-foreground">Checking availability…</span>
            ) : handleStatus.state === "available" ? (
              <span className="text-accent">still.app/@{handleValue} is yours</span>
            ) : handleStatus.state === "taken" ? (
              <span className="text-destructive">Handle is taken</span>
            ) : handleStatus.state === "invalid" ? (
              <span className="text-destructive">Use a–z, 0–9, . _ -</span>
            ) : (
              <span className="text-muted-foreground">
                Lowercase, 2–24 characters. This is your public URL.
              </span>
            );
          return (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>Handle</Label>
              <div className="relative">
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
                >
                  @
                </span>
                <Input
                  id={field.name}
                  name={field.name}
                  spellCheck={false}
                  autoCapitalize="none"
                  placeholder="akira"
                  className="pl-8"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    const next = e.target.value.toLowerCase().replace(/\s+/g, "");
                    field.handleChange(next);
                    setHandleValue(next);
                  }}
                  aria-invalid={errorMessage ? true : undefined}
                  required
                />
              </div>
              <div className="min-h-4 text-xs">
                {errorMessage ? (
                  <span className="text-destructive">{errorMessage.message}</span>
                ) : (
                  helper
                )}
              </div>
            </div>
          );
        }}
      </form.Field>
      <form.Field name="email">
        {(field) => (
          <Field
            field={field}
            label="Email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            placeholder="you@cinema.zone"
            required
          />
        )}
      </form.Field>
      <form.Field name="password">
        {(field) => (
          <Field
            field={field}
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            required
          />
        )}
      </form.Field>
      <form.Subscribe
        selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
      >
        {({ canSubmit, isSubmitting }) => (
          <Button
            type="submit"
            variant="accent"
            size="lg"
            disabled={!canSubmit || isSubmitting || handleStatus.state === "taken"}
            className="w-full"
          >
            {isSubmitting ? "Creating your account…" : "Create account"}
          </Button>
        )}
      </form.Subscribe>
      <p className="text-center text-xs text-muted-foreground">
        By signing up you agree to our community guidelines. We don&apos;t spoil films you
        haven&apos;t logged.
      </p>
    </form>
  );
}
