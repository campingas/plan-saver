import "server-only";

type LogEvent =
  | { event: "ingest"; outcome: string; status: number; durationMs: number }
  | { event: "auth_email"; outcome: string; durationMs: number }
  | { event: "viewer"; outcome: string; status: number; authMode: "owner" | "share"; durationMs: number };

export function logServerEvent(event: LogEvent): void {
  console.log(JSON.stringify({ level: event.outcome === "ok" ? "info" : "warn", ...event }));
}
