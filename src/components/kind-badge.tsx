export function KindBadge({ kind }: { kind: "plan" | "report" }) {
  return <span className={`stamp ${kind === "plan" ? "text-accent" : "text-gold"}`}>{kind}</span>;
}
