"use client";

import { useActionState } from "react";
import { createApiToken } from "@/lib/actions";

export function CreateTokenForm() {
  const [state, action, pending] = useActionState(createApiToken, {
    token: null,
    error: null,
  });

  return (
    <div className="space-y-3">
      <form action={action} className="flex gap-2">
        <input
          name="name"
          required
          placeholder="Token name (e.g. laptop)"
          className="flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Creating…" : "Create token"}
        </button>
      </form>
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state.token && (
        <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Copy this token now — it will not be shown again.
          </p>
          <code className="block break-all text-xs text-amber-900 dark:text-amber-200">
            {state.token}
          </code>
        </div>
      )}
    </div>
  );
}
