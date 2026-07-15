"use client";

import { useActionState, useId } from "react";
import { createApiToken } from "@/lib/actions";
import { HighlightedCode } from "@/components/highlighted-code";
import { machineSetupCommand } from "@/lib/machine-setup";

export function CreateTokenForm({ appUrl }: { appUrl: string }) {
  const fieldId = useId();
  const [state, action, pending] = useActionState(createApiToken, {
    token: null,
    error: null,
  });

  return (
    <div className="space-y-3">
      <form action={action} className="flex gap-2">
        <label htmlFor={fieldId} className="sr-only">
          Token name
        </label>
        <input
          id={fieldId}
          name="name"
          required
          placeholder="Token name, e.g. desktop"
          className="field flex-1"
        />
        <button type="submit" disabled={pending} className="btn btn-primary shrink-0">
          {pending ? "Creating…" : "Create token"}
        </button>
      </form>
      <div aria-live="polite" aria-atomic="true">
        {state.error && <p className="text-sm text-stamp">{state.error}</p>}
        {state.token && (
          <div className="space-y-1.5 border border-gold bg-panel-2 p-4">
            <p className="eyebrow !text-gold">Copy now — shown once</p>
            <code className="block break-all font-mono text-xs text-ink">{state.token}</code>
          </div>
        )}
      </div>
      <section className="space-y-2">
        <h2 className="eyebrow">Machine setup</h2>
        <p className="text-sm text-muted">Save the token where the skill reads it:</p>
        <HighlightedCode code={machineSetupCommand(appUrl, state.token ?? undefined)} language="bash" />
      </section>
    </div>
  );
}
