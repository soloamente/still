"use client";

import { Input } from "@still/ui/components/input";
import { Label } from "@still/ui/components/label";
import { cn } from "@still/ui/lib/utils";
import type { AnyFieldApi } from "@tanstack/react-form";
import * as React from "react";

/**
 * Small wrapper around a TanStack Form field + Aker-styled <Input>.
 * Renders the label, the field, validation message, and an optional
 * helper (used for handle availability hints, password meters, etc.).
 */
export function Field({
  field,
  label,
  helper,
  hint,
  className,
  inputClassName,
  ...input
}: {
  field: AnyFieldApi;
  label: string;
  helper?: React.ReactNode;
  hint?: string;
  className?: string;
  inputClassName?: string;
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "onBlur" | "name">) {
  const errorMessage = field.state.meta.errors.find(Boolean) as { message?: string } | undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between">
        <Label htmlFor={field.name}>{label}</Label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <Input
        id={field.name}
        name={field.name}
        value={field.state.value as string}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={errorMessage ? true : undefined}
        className={inputClassName}
        {...input}
      />
      <div className="min-h-4 text-xs">
        {errorMessage ? (
          <span className="text-destructive">{errorMessage.message}</span>
        ) : (
          <span className="text-muted-foreground">{helper}</span>
        )}
      </div>
    </div>
  );
}
