const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export function formatDate(date: Date | null): string {
  return date ? fmt.format(date) : "—";
}
