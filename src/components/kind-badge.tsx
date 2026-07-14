export function KindBadge({ kind }: { kind: "plan" | "report" }) {
  const styles =
    kind === "plan"
      ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide ${styles}`}>
      {kind}
    </span>
  );
}
