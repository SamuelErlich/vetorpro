import { storage } from "../storage";
import { encrypt } from "../utils/crypto";

/**
 * Migrate RemoveBG API key from environment variable to database
 * This runs once on server startup to ensure backward compatibility
 */
export async function migrateRemoveBgApiKey(): Promise<void> {
  try {
    const envApiKey = process.env.REMOVE_BG_API_KEY;
    
    if (!envApiKey) {
      // No env key to migrate
      return;
    }
    
    // Check if there are any API keys in the database already
    const existingKeys = await storage.listRemoveBgApiKeys();
    
    if (existingKeys.length > 0) {
      // Keys already exist in database, no migration needed
      console.log("✅ RemoveBG API keys already exist in database, skipping migration");
      return;
    }
    
    // Encrypt the API key before storing
    const encryptedKey = encrypt(envApiKey);
    
    // Create the initial API key from environment variable
    const result = await storage.createRemoveBgApiKey({
      label: "Chave Migrada (Original)",
      apiKeyEncrypted: encryptedKey,
      isActive: true,
      createdBy: "system-migration",
    });
    
    if (result) {
      console.log("✅ Successfully migrated RemoveBG API key from environment to database");
      console.log("⚠️  You can now remove REMOVE_BG_API_KEY from your environment variables");
    }
  } catch (error) {
    console.error("❌ Failed to migrate RemoveBG API key:", error);
    // Don't throw - allow server to continue starting even if migration fails
  }
}