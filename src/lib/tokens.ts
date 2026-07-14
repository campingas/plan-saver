import { createHash, randomBytes } from "node:crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateApiToken(): { token: string; hash: string } {
  const token = `ps_live_${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashToken(token) };
}

export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}
