import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export const SESSION_COOKIE_NAME = "sbai_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateLoginCode(): string {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(":");
  if (!salt || !keyHex) {
    return false;
  }

  const derivedKey = scryptSync(password, salt, 64);
  const expectedKey = Buffer.from(keyHex, "hex");

  if (derivedKey.length !== expectedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expectedKey);
}
