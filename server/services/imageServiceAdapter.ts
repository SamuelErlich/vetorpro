/**
 * Image Service Adapter - Abstract base class for image-based services
 * 
 * This adapter provides a standard interface for services that process images.
 * New image-based services (OCR, image enhancement, etc.) can extend this class
 * to inherit common functionality and patterns.
 * 
 * @example
 * class OCRService extends ImageServiceAdapter {
 *   async processImage(buffer: Buffer, apiKey: string): Promise<{ text: string }> {
 *     // Custom OCR processing logic
 *   }
 * }
 */

import { Request, Response, NextFunction } from "express";

export interface ImageServiceConfig {
  serviceId: string;
  serviceName: string;
  maxFileSize?: number; // in bytes, default 10MB
  allowedMimeTypes?: string[]; // default: all image/*
}

export interface ProcessImageResult {
  [key: string]: any; // Service-specific results
}

export interface ImageUsageRecord {
  id: string;
  userId: string;
  creditsUsed: number;
  originalImagePath?: string;
  processedImagePath?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

/**
 * Abstract base class for image-based services
 */
export abstract class ImageServiceAdapter {
  protected config: ImageServiceConfig;

  constructor(config: ImageServiceConfig) {
    this.config = {
      maxFileSize: 10 * 1024 * 1024, // 10MB default
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      ...config,
    };
  }

  /**
   * Get the service configuration
   */
  getConfig(): ImageServiceConfig {
    return this.config;
  }

  /**
   * Validate and process the uploaded image
   * Override this method with service-specific logic
   * 
   * @param buffer Image buffer
   * @param apiKey API key for the external service
   * @returns Processed image or service-specific result
   */
  abstract processImage(buffer: Buffer, apiKey: string): Promise<ProcessImageResult>;

  /**
   * Get image metadata from buffer
   * Useful for credit calculation, resolution, etc.
   * 
   * @param buffer Image buffer
   * @returns Image metadata
   */
  abstract getImageMetadata(buffer: Buffer): Promise<Record<string, any>>;

  /**
   * Calculate credits needed based on image metadata
   * Override this for service-specific credit logic
   * 
   * @param metadata Image metadata
   * @returns Number of credits needed
   */
  abstract calculateCreditsNeeded(metadata: Record<string, any>): number;

  /**
   * Get user's available credits for this service
   * This should be implemented in the concrete service class
   * 
   * @param userId User ID
   * @returns Available credits
   */
  abstract getUserCredits(userId: string): Promise<number>;

  /**
   * Get user's usage history for this service
   * 
   * @param userId User ID
   * @returns Array of usage records
   */
  abstract getUserUsageHistory(userId: string): Promise<ImageUsageRecord[]>;

  /**
   * Validate that user has enough credits
   * 
   * @param userId User ID
   * @param creditsNeeded Credits required
   * @returns True if user has enough credits
   */
  abstract validateUserCredits(
    userId: string,
    creditsNeeded: number
  ): Promise<boolean>;

  /**
   * Deduct credits from user's account
   * 
   * @param userId User ID
   * @param credits Credits to deduct
   */
  abstract deductCredits(userId: string, credits: number): Promise<void>;

  /**
   * Save processed result (images, data, etc.)
   * 
   * @param userId User ID
   * @param result Processed result from processImage()
   * @param metadata Additional metadata
   * @returns Saved result with paths/references
   */
  abstract saveResult(
    userId: string,
    result: ProcessImageResult,
    metadata: Record<string, any>
  ): Promise<ImageUsageRecord>;

  /**
   * Delete files associated with a usage record
   * 
   * @param paths File paths to delete
   */
  abstract deleteFiles(...paths: string[]): Promise<void>;
}

/**
 * Factory function to create service-specific middleware
 */
export function createServiceAuthMiddleware(
  serviceId: string,
  storage: any
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "Usuário não encontrado" });
      }

      if (user.status !== "ATIVO") {
        return res.status(403).json({
          error:
            "Acesso negado. Sua conta está inativa. Por favor, regularize o pagamento para continuar.",
          inactive: true,
          status: user.status,
        });
      }

      const userService = await storage.getUserService(req.session.userId, serviceId);
      if (!userService || userService.status !== "ATIVO") {
        return res.status(403).json({
          error: `Acesso negado. Você não tem uma assinatura ativa deste serviço.`,
          serviceInactive: true,
        });
      }

      next();
    } catch (error) {
      console.error(
        `Error checking ${serviceId} service status:`,
        error
      );
      return res.status(500).json({ error: "Erro ao verificar status do serviço" });
    }
  };
}
