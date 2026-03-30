import { randomBytes } from "node:crypto";

export function randomId(): string {
  return randomBytes(12).toString("hex");
}

/** OpenAI-style system_fingerprint when no real backend fingerprint exists. */
export function randomSystemFingerprint(): string {
  return `fp_${randomBytes(5).toString("hex")}`;
}
