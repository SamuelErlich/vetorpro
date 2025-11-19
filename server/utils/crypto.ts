import crypto from "crypto";

const algorithm = "aes-256-gcm";
const ivLength = 16; // AES GCM IV is 16 bytes
const tagLength = 16; // AES GCM tag is 16 bytes
const saltLength = 64; // Salt for key derivation

/**
 * Get or generate encryption key from environment variable
 * @returns Encryption key as Buffer
 */
function getEncryptionKey(): Buffer {
  let encryptionKey = process.env.ENCRYPTION_KEY;
  
  if (!encryptionKey) {
    // Generate a new key if not exists
    encryptionKey = crypto.randomBytes(32).toString("hex");
    console.warn("ENCRYPTION_KEY not found. Generated new key. Please set ENCRYPTION_KEY environment variable!");
    process.env.ENCRYPTION_KEY = encryptionKey;
  }
  
  // Ensure the key is exactly 32 bytes for AES-256
  const hash = crypto.createHash("sha256");
  hash.update(encryptionKey);
  return hash.digest();
}

/**
 * Encrypt a string using AES-256-GCM
 * @param text Plain text to encrypt
 * @returns Encrypted text with format: salt:iv:tag:encrypted
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey();
  
  // Generate random salt and IV
  const salt = crypto.randomBytes(saltLength);
  const iv = crypto.randomBytes(ivLength);
  
  // Derive key from main key and salt
  const derivedKey = crypto.pbkdf2Sync(key, salt, 10000, 32, "sha256");
  
  // Create cipher
  const cipher = crypto.createCipheriv(algorithm, derivedKey, iv);
  
  // Encrypt the text
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final()
  ]);
  
  // Get the authentication tag
  const tag = cipher.getAuthTag();
  
  // Combine salt, iv, tag, and encrypted data
  const combined = Buffer.concat([salt, iv, tag, encrypted]);
  
  // Return as base64 string
  return combined.toString("base64");
}

/**
 * Decrypt a string encrypted with AES-256-GCM
 * @param encryptedText Encrypted text with format: salt:iv:tag:encrypted (base64)
 * @returns Decrypted plain text
 */
export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  
  // Decode from base64
  const combined = Buffer.from(encryptedText, "base64");
  
  // Extract components
  const salt = combined.slice(0, saltLength);
  const iv = combined.slice(saltLength, saltLength + ivLength);
  const tag = combined.slice(saltLength + ivLength, saltLength + ivLength + tagLength);
  const encrypted = combined.slice(saltLength + ivLength + tagLength);
  
  // Derive key from main key and salt
  const derivedKey = crypto.pbkdf2Sync(key, salt, 10000, 32, "sha256");
  
  // Create decipher
  const decipher = crypto.createDecipheriv(algorithm, derivedKey, iv);
  decipher.setAuthTag(tag);
  
  // Decrypt
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  
  return decrypted.toString("utf8");
}

/**
 * Mask an API key for display (show only last 4 characters)
 * @param apiKey The API key to mask
 * @returns Masked API key
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length <= 8) {
    return "****";
  }
  
  const lastFour = apiKey.slice(-4);
  const maskedLength = apiKey.length - 4;
  const masked = "*".repeat(Math.min(maskedLength, 20));
  
  return `${masked}${lastFour}`;
}

/**
 * Validate that an encrypted value can be decrypted
 * @param encryptedText Encrypted text to validate
 * @returns True if valid, false otherwise
 */
export function validateEncrypted(encryptedText: string): boolean {
  try {
    decrypt(encryptedText);
    return true;
  } catch {
    return false;
  }
}