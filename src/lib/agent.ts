export const MAX_AGENT_NAME_LENGTH = 50;
export const UNKNOWN_AGENT = "Unknown";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export function normalizeAgentName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (
    name.length === 0 ||
    name.length > MAX_AGENT_NAME_LENGTH ||
    CONTROL_CHARACTERS.test(name)
  ) {
    return null;
  }
  return name;
}

export function displayAgentName(value: unknown): string {
  return normalizeAgentName(value) ?? UNKNOWN_AGENT;
}
