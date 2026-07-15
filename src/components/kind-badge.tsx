import type { DocumentKind } from "@/db/schema";

export function KindBadge({ kind }: { kind: DocumentKind }) {
  return <span className={`stamp ${kind === "plan" ? "text-accent" : "text-gold"}`}>{kind}</span>;
}
