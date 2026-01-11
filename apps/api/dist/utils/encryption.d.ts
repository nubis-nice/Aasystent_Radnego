/**
 * Encrypt data using AES-256-GCM
 * @param plaintext - Data to encrypt
 * @returns Object with encrypted data, IV, and auth tag
 */
export declare function encrypt(plaintext: string): {
    encrypted: string;
    iv: string;
    authTag: string;
};
/**
 * Decrypt data using AES-256-GCM
 * @param encrypted - Encrypted data (base64)
 * @param iv - Initialization vector (base64)
 * @param authTag - Authentication tag (base64)
 * @returns Decrypted plaintext
 */
export declare function decrypt(encrypted: string, iv: string, authTag: string): string;
/**
 * Encrypt API key for storage in database
 * @param apiKey - Plain API key
 * @returns Object with encrypted key and IV for database storage
 */
export declare function encryptApiKey(apiKey: string): {
    encryptedKey: string;
    iv: string;
};
/**
 * Decrypt API key from database
 * @param encryptedKey - Encrypted key from database (format: "encrypted:authTag")
 * @param iv - IV from database
 * @returns Decrypted API key
 */
export declare function decryptApiKey(encryptedKey: string, iv: string): string;
/**
 * Migrate old base64 "encrypted" key to AES-256-GCM
 * @param base64Key - Old base64 encoded key
 * @returns Object with new encrypted key and IV
 */
export declare function migrateFromBase64(base64Key: string): {
    encryptedKey: string;
    iv: string;
};
/**
 * Generate a secure encryption key for .env
 * Run this once and save to ENCRYPTION_KEY in .env
 */
export declare function generateEncryptionKey(): string;
/**
 * Validate that encryption/decryption works correctly
 * @returns true if encryption is working
 */
export declare function testEncryption(): boolean;
//# sourceMappingURL=encryption.d.ts.map