"use client";

import { Button } from "@still/ui/components/button";
import { useForm } from "@tanstack/react-form";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import { Field } from "./field";

const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("from") ?? "/home";

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(value, {
        onSuccess: () => {
          toast.success("Welcome back");
          // Use refresh so the edge proxy re-evaluates the session cookie.
          router.replace(redirectTo);
          router.refresh();
        },
        onError: (err) => {
          toast.error(err.error.message || "Could not sign you in");
        },
      });
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
            autoComplete="current-password"
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
            disabled={!canSubmit || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? "Signing you in…" : "Sign in"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
