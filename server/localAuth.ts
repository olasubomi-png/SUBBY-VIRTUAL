import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { ENV } from "./_core/env";

const SCRYPT_KEY_LENGTH = 64;

function deriveKey(password: string, salt: string, keyLength: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      keyLength,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELIZATION,
      },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey as Buffer);
      }
    );
  });
}
const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getBootstrapAdminEmail() {
  const email = normalizeEmail(ENV.bootstrapAdminEmail);
  return email || null;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await deriveKey(password, salt, SCRYPT_KEY_LENGTH);
  return [
    "scrypt",
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt,
    derivedKey.toString("hex"),
  ].join("$");
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, cost, blockSize, parallelization, salt, expectedHex] =
    encoded.split("$");
  if (
    algorithm !== "scrypt" ||
    !salt ||
    !expectedHex ||
    cost !== String(SCRYPT_COST) ||
    blockSize !== String(SCRYPT_BLOCK_SIZE) ||
    parallelization !== String(SCRYPT_PARALLELIZATION) ||
    !/^[0-9a-f]+$/i.test(expectedHex)
  ) {
    return false;
  }

  try {
    const expected = Buffer.from(expectedHex, "hex");
    const derived = await deriveKey(password, salt, expected.length);
    return (
      expected.length === derived.length && timingSafeEqual(expected, derived)
    );
  } catch {
    return false;
  }
}

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
