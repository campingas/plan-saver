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
          placeholder="Token name, e.g. desktop"
          className="field flex-1"
        />
        <button type="submit" disabled={pending} className="btn btn-primary shrink-0">
          {pending ? "Creating…" : "Create token"}
        </button>
      </form>
      {state.error && <p className="text-sm text-stamp">{state.error}</p>}
      {state.token && (
        <div className="space-y-1.5 border border-gold bg-panel-2 p-4">
          <p className="eyebrow !text-gold">Copy now — shown once</p>
          <code className="block break-all font-mono text-xs text-ink">{state.token}</code>
        </div>
      )}
    </div>
  );
}
