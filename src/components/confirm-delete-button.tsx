"use client";

import { useEffect, useState, useTransition } from "react";

export function ConfirmDeleteButton({
  action,
  label,
  confirmLabel,
}: {
  action: () => Promise<void>;
  label: string;
  confirmLabel: string;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => (armed ? startTransition(() => action()) : setArmed(true))}
      className={`stamp cursor-pointer transition-colors ${
        armed ? "bg-stamp text-paper" : "text-stamp hover:bg-stamp hover:text-paper"
      }`}
    >
      {pending ? "Deleting…" : armed ? confirmLabel : label}
    </button>
  );
}
