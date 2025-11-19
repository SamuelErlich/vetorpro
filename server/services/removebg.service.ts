import { storage } from "../storage";
import FormData from "form-data";
import sharp from "sharp";
import axios from "axios";
import fs from "fs";
import path from "path";
import { decrypt } from "../utils/crypto";

const REMOVEBG_SERVICE_ID = "removebg-001";

// Token cache with TTL
interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class RemoveBgService {
  /**
   * Get the active RemoveBG API token
   * Uses cache to avoid frequent database calls
   * Falls back to environment variable if no database token exists
   * @returns API key or throws error if none available
   */
  private async getApiKey(): Promise<string> {
    // Check if we have a valid cached token
    if (tokenCache && tokenCache.expiresAt > Date.now()) {
      return tokenCache.token;
    }

    try {
      // Get active API key from database
      const activeKey = await storage.getActiveRemoveBgApiKey();
      
      if (activeKey) {
        // Decrypt the API key
        const decryptedKey = decrypt(activeKey.apiKeyEncrypted);
        
        // Update cache
        tokenCache = {
          token: decryptedKey,
          expiresAt: Date.now() + TOKEN_CACHE_TTL
        };
        
        // Update last used timestamp (fire and forget)
        storage.activateRemoveBgApiKey(activeKey.id).catch(err => 
          console.error("Failed to update lastUsedAt:", err)
        );
        
        return decryptedKey;
      }
    } catch (error) {
      console.error("Error fetching API key from database:", error);
    }
    
    // Fallback to environment variable (for migration period)
    const envKey = process.env.REMOVE_BG_API_KEY;
    if (envKey) {
      // Cache the env key too
      tokenCache = {
        token: envKey,
        expiresAt: Date.now() + TOKEN_CACHE_TTL
      };
      return envKey;
    }
    
    throw new Error("No RemoveBG API key configured. Please add an API key in the admin panel.");
  }

  /**
   * Invalidate the cached token (call when admin changes active token)
   */
  public static invalidateCache(): void {
    tokenCache = null;
  }
  /**
   * Calculate credits needed based on image resolution in megapixels
   * @param resolutionMp Megapixels of the image
   * @returns Credits needed (1, 2, or 3)
   */
  calculateCreditsNeeded(resolutionMp: number): number {
    if (resolutionMp <= 2) return 1; // Up to 2MP = 1 credit
    if (resolutionMp <= 5) return 2; // 2-5MP = 2 credits
    return 3; // Above 5MP = 3 credits
  }

  /**
   * Get image resolution in megapixels from buffer
   * @param buffer Image buffer
   * @returns Megapixels (resolution)
   */
  async getImageResolution(buffer: Buffer): Promise<number> {
    try {
      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error("Unable to determine image dimensions");
      }
      
      // Calculate megapixels (width * height / 1,000,000)
      const megapixels = (metadata.width * metadata.height) / 1000000;
      return Number(megapixels.toFixed(2));
    } catch (error) {
      console.error("Error getting image resolution:", error);
      throw new Error("Failed to analyze image");
    }
  }

  /**
   * Process image with RemoveBG API
   * @param buffer Image buffer
   * @param apiKey RemoveBG API key
   * @returns Processed image buffer
   */
  async processImage(buffer: Buffer, apiKey: string): Promise<Buffer> {
    try {
      const formData = new FormData();
      formData.append("image_file", buffer, {
        filename: "image.jpg",
        contentType: "image/jpeg",
      });
      formData.append("size", "auto");

      const response = await axios.post(
        "https://api.remove.bg/v1.0/removebg",
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            "X-Api-Key": apiKey,
          },
          responseType: "arraybuffer",
        }
      );

      return Buffer.from(response.data);
    } catch (error: any) {
      if (error.response) {
        const errorMessage = error.response.data?.errors?.[0]?.title || 
                           error.response.statusText || 
                           "RemoveBG API error";
        throw new Error(`RemoveBG API error: ${errorMessage}`);
      }
      throw new Error("Failed to process image with RemoveBG");
    }
  }

  /**
   * Validate if user has enough credits
   * @param userId User ID
   * @param creditsNeeded Credits required
   * @returns True if user has enough credits
   */
  async validateUserCredits(userId: string, creditsNeeded: number): Promise<boolean> {
    const currentCredits = await storage.getUserCredits(userId, REMOVEBG_SERVICE_ID);
    return currentCredits >= creditsNeeded;
  }

  /**
   * Save image to file system
   * @param buffer Image buffer
   * @param filename Filename to save as
   * @param directory Directory to save in
   * @returns Path to saved file
   */
  async saveImage(buffer: Buffer, filename: string, directory: string): Promise<string> {
    try {
      const uploadDir = path.join(process.cwd(), "uploads", directory);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filepath = path.join(uploadDir, filename);
      fs.writeFileSync(filepath, buffer);
      
      console.log(`✅ Saved image: ${filepath}`);
      
      // Return web-accessible path
      return `/uploads/${directory}/${filename}`;
    } catch (error) {
      console.error("Error saving image:", error);
      throw new Error("Failed to save image");
    }
  }

  /**
   * Process a complete RemoveBG request
   * @param userId User ID
   * @param imageBuffer Original image buffer
   * @returns Object with processed image path and usage details
   */
  async processRemoveBgRequest(
    userId: string, 
    imageBuffer: Buffer
  ): Promise<{ 
    processedImagePath: string; 
    originalImagePath: string;
    creditsUsed: number; 
    resolutionMp: number;
  }> {
    // Get the API key from database/cache
    const apiKey = await this.getApiKey();
    
    // Get image resolution
    const resolutionMp = await this.getImageResolution(imageBuffer);
    
    // Calculate credits needed
    const creditsNeeded = this.calculateCreditsNeeded(resolutionMp);
    
    // Validate user has enough credits
    const hasCredits = await this.validateUserCredits(userId, creditsNeeded);
    if (!hasCredits) {
      const currentCredits = await storage.getUserCredits(userId, REMOVEBG_SERVICE_ID);
      throw new Error(`Insufficient credits. You have ${currentCredits} credits but need ${creditsNeeded}.`);
    }

    // Process image with RemoveBG API
    const processedBuffer = await this.processImage(imageBuffer, apiKey);
    
    // Save original and processed images
    const timestamp = Date.now();
    const originalFilename = `original_${userId}_${timestamp}.jpg`;
    const processedFilename = `processed_${userId}_${timestamp}.png`;
    
    const originalPath = await this.saveImage(imageBuffer, originalFilename, "removebg/original");
    const processedPath = await this.saveImage(processedBuffer, processedFilename, "removebg/processed");
    
    // Debit credits
    const debited = await storage.debitUserCredits(userId, REMOVEBG_SERVICE_ID, creditsNeeded);
    if (!debited) {
      throw new Error("Failed to debit credits");
    }
    
    // Record usage
    await storage.createRemoveBgUsage({
      userId,
      serviceId: REMOVEBG_SERVICE_ID,
      creditsUsed: creditsNeeded,
      resolutionMp: resolutionMp.toString(),
      imagePath: processedPath,
      originalImagePath: originalPath,
    });
    
    return {
      processedImagePath: processedPath,
      originalImagePath: originalPath,
      creditsUsed: creditsNeeded,
      resolutionMp,
    };
  }

  /**
   * Get user's RemoveBG usage history
   * @param userId User ID
   * @returns Array of usage records
   */
  async getUserUsageHistory(userId: string) {
    return await storage.getRemoveBgUsageByUserId(userId);
  }

  /**
   * Get user's available credits
   * @param userId User ID
   * @returns Number of available credits
   */
  async getUserCredits(userId: string): Promise<number> {
    return await storage.getUserCredits(userId, REMOVEBG_SERVICE_ID);
  }

  /**
   * Get all RemoveBG plans
   * @returns Array of plans
   */
  async getPlans() {
    return await storage.getRemoveBgPlans();
  }

  /**
   * Delete images from filesystem
   * @param originalPath Original image path
   * @param processedPath Processed image path
   */
  async deleteImages(originalPath: string | null, processedPath: string | null) {
    const promises: Promise<void>[] = [];
    
    if (originalPath) {
      promises.push(
        fs.promises.unlink(path.join(process.cwd(), originalPath)).catch((err: any) => {
          console.error(`Failed to delete original image ${originalPath}:`, err);
        })
      );
    }
    
    if (processedPath) {
      promises.push(
        fs.promises.unlink(path.join(process.cwd(), processedPath)).catch((err: any) => {
          console.error(`Failed to delete processed image ${processedPath}:`, err);
        })
      );
    }
    
    await Promise.all(promises);
  }

  /**
   * Clean up old images (older than specified days)
   * @param days Number of days to keep images
   * @returns Number of deleted records
   */
  async cleanupOldImages(days: number = 7): Promise<number> {
    const oldUsage = await storage.getRemoveBgUsageOlderThan(days);
    
    // Delete files
    for (const record of oldUsage) {
      if (record.originalImagePath || record.imagePath) {
        await this.deleteImages(record.originalImagePath, record.imagePath);
      }
    }
    
    // Delete database records
    const ids = oldUsage.map(u => u.id);
    if (ids.length > 0) {
      return await storage.deleteRemoveBgUsageByIds(ids);
    }
    
    return 0;
  }

  /**
   * Enforce user image limit
   * @param userId User ID
   * @param maxImages Maximum number of images to keep
   * @returns Number of deleted records
   */
  async enforceUserImageLimit(userId: string, maxImages: number = 30): Promise<number> {
    const count = await storage.countUserRemoveBgUsage(userId);
    
    if (count <= maxImages) {
      return 0;
    }
    
    // Get records to delete (keeping only the newest maxImages)
    const allUsage = await storage.getRemoveBgUsageByUserId(userId);
    const sortedUsage = allUsage.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    const toDelete = sortedUsage.slice(maxImages);
    
    // Delete files
    for (const record of toDelete) {
      if (record.originalImagePath || record.imagePath) {
        await this.deleteImages(record.originalImagePath, record.imagePath);
      }
    }
    
    // Delete database records
    return await storage.deleteOldestUserRemoveBgUsage(userId, maxImages);
  }
}

export const removeBgService = new RemoveBgService();