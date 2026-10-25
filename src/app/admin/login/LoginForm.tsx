"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/admin/actions";
import { Button } from "@/components/ui";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: null });
  return (
    <form action={action} className="mt-10 space-y-8">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label htmlFor="password" className="block text-[0.8125rem] font-bold uppercase tracking-[0.12em] text-ink-2">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          aria-invalid={!!state.error}
          aria-describedby={state.error ? "login-error" : undefined}
          className="mt-2 block h-11 w-full border-0 border-b border-rule bg-transparent px-0 text-[1.0625rem] text-ink outline-none transition-colors focus:border-clay"
        />
        {state.error && (
          <p id="login-error" role="alert" className="mt-3 text-[0.9375rem] text-danger">
            {state.error}
          </p>
        )}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
