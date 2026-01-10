import crypto from "crypto";
import { Buffer } from "buffer";

/**
 * AES-256-GCM Encryption Utility
 * Provides secure encryption/decryption for API keys
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Get encryption key from environment or generate one
 * IMPORTANT: Set ENCRYPTION_KEY in .env for production
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;

  if (!envKey) {
    console.warn(
      "⚠️  ENCRYPTION_KEY not set in environment. Using fallback key. " +
        "This is INSECURE for production!"
    );
    // Fallback key - ONLY for development
    return crypto.scryptSync("fallback-key-change-me", "salt", KEY_LENGTH);
  }

  // Derive key from environment variable
  return crypto.scryptSync(envKey, "salt", KEY_LENGTH);
}

/**
 * Encrypt data using AES-256-GCM
 * @param plaintext - Data to encrypt
 * @returns Object with encrypted data, IV, and auth tag
 */
export function encrypt(plaintext: string): {
  encrypted: string;
  iv: string;
  authTag: string;
} {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "base64");
    encrypted += cipher.final("base64");

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
    };
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt data using AES-256-GCM
 * @param encrypted - Encrypted data (base64)
 * @param iv - Initialization vector (base64)
 * @param authTag - Authentication tag (base64)
 * @returns Decrypted plaintext
 */
export function decrypt(
  encrypted: string,
  iv: string,
  authTag: string
): string {
  try {
    const key = getEncryptionKey();
    const ivBuffer = Buffer.from(iv, "base64");
    const authTagBuffer = Buffer.from(authTag, "base64");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
    decipher.setAuthTag(authTagBuffer);

    let decrypted = decipher.update(encrypted, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data - invalid key or corrupted data");
  }
}

/**
 * Encrypt API key for storage in database
 * @param apiKey - Plain API key
 * @returns Object with encrypted key and IV for database storage
 */
export function encryptApiKey(apiKey: string): {
  encryptedKey: string;
  iv: string;
} {
  const { encrypted, iv, authTag } = encrypt(apiKey);

  // Combine encrypted data and auth tag for storage
  const combined = `${encrypted}:${authTag}`;

  return {
    encryptedKey: combined,
    iv,
  };
}

/**
 * Decrypt API key from database
 * @param encryptedKey - Encrypted key from database (format: "encrypted:authTag")
 * @param iv - IV from database
 * @returns Decrypted API key
 */
export function decryptApiKey(encryptedKey: string, iv: string): string {
  try {
    // Split combined format
    const [encrypted, authTag] = encryptedKey.split(":");

    if (!encrypted || !authTag) {
      throw new Error("Invalid encrypted key format");
    }

    return decrypt(encrypted, iv, authTag);
  } catch (error) {
    console.error("API key decryption error:", error);
    throw new Error("Failed to decrypt API key");
  }
}

/**
 * Migrate old base64 "encrypted" key to AES-256-GCM
 * @param base64Key - Old base64 encoded key
 * @returns Object with new encrypted key and IV
 */
export function migrateFromBase64(base64Key: string): {
  encryptedKey: string;
  iv: string;
} {
  try {
    // Decode base64 to get original key
    const plainKey = Buffer.from(base64Key, "base64").toString("utf-8");

    // Encrypt with AES-256-GCM
    return encryptApiKey(plainKey);
  } catch (error) {
    console.error("Migration error:", error);
    throw new Error("Failed to migrate encryption");
  }
}

/**
 * Generate a secure encryption key for .env
 * Run this once and save to ENCRYPTION_KEY in .env
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("base64");
}

/**
 * Validate that encryption/decryption works correctly
 * @returns true if encryption is working
 */
export function testEncryption(): boolean {
  try {
    const testData = "test-api-key-12345";
    const { encryptedKey, iv } = encryptApiKey(testData);
    const decrypted = decryptApiKey(encryptedKey, iv);

    return decrypted === testData;
  } catch (error) {
    console.error("Encryption test failed:", error);
    return false;
  }
}
