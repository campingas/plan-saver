"use client";

import { useActionState, useId, useState } from "react";
import { deleteProject } from "@/lib/actions";

export function DeleteProjectForm({ projectId, slug }: { projectId: string; slug: string }) {
  const fieldId = useId();
  const [confirm, setConfirm] = useState("");
  const [state, action, pending] = useActionState(deleteProject.bind(null, projectId), {
    error: null,
  });

  return (
    <form action={action} className="space-y-3">
      <label htmlFor={fieldId} className="eyebrow block">
        Type <span className="font-mono text-ink">{slug}</span> to confirm
      </label>
      <input
        id={fieldId}
        name="confirm"
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        className="field font-mono text-xs"
      />
      <button
        disabled={confirm !== slug || pending}
        className="stamp cursor-pointer text-stamp hover:bg-stamp hover:text-paper transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-stamp"
      >
        {pending ? "Deleting…" : "Delete project"}
      </button>
      <div aria-live="polite" aria-atomic="true">
        {state.error && <p className="text-xs text-stamp">{state.error}</p>}
      </div>
    </form>
  );
}
