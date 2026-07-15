"use client";

import { useActionState, useId } from "react";
import { createShareLink } from "@/lib/actions";

export function CreateShareLinkForm({ versionId }: { versionId: string }) {
  const fieldId = useId();
  const [state, action, pending] = useActionState(createShareLink.bind(null, versionId), {
    url: null,
    error: null,
  });

  return (
    <div className="space-y-3">
      <form action={action}>
        <button disabled={pending} className="btn btn-ghost w-full">
          {pending ? "Issuing…" : "Issue share link"}
        </button>
      </form>
      <div aria-live="polite" aria-atomic="true">
        {state.error && <p className="text-xs text-stamp">{state.error}</p>}
        {state.url && (
          <div className="space-y-1.5 border border-gold bg-panel-2 p-2.5">
            <label htmlFor={fieldId} className="eyebrow !text-gold">
              Copy now — shown once
            </label>
            <input id={fieldId} readOnly value={state.url} className="field font-mono text-xs" />
          </div>
        )}
      </div>
    </div>
  );
}
