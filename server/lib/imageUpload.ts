/**
 * Shared image upload utilities for image-based services
 * 
 * Provides centralized multer configuration, validation, and error handling
 * for consistent image processing across all image-based services.
 */

import multer, { StorageEngine, FileFilterCallback } from "multer";
import { Request } from "express";

export interface ImageUploadOptions {
  maxFileSize?: number; // in bytes
  allowedMimeTypes?: string[];
}

const DEFAULT_OPTIONS: ImageUploadOptions = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/tiff",
  ],
};

/**
 * Create a configured multer instance for image uploads
 * Uses in-memory storage for compatibility with cloud deployments
 * 
 * @param options Upload configuration
 * @returns Configured multer instance
 * 
 * @example
 * const upload = createImageUpload({ maxFileSize: 5 * 1024 * 1024 });
 * router.post('/process', upload.single('image'), handler);
 */
export function createImageUpload(options: ImageUploadOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  const fileFilter = (
    req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) => {
    if (config.allowedMimeTypes!.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Only image files are allowed. Accepted types: ${config.allowedMimeTypes!.join(", ")}`
        )
      );
    }
  };

  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: config.maxFileSize,
    },
    fileFilter,
  });
}

/**
 * Validate image file
 * 
 * @param file Multer file object
 * @param maxSize Maximum file size in bytes
 * @returns Error message if invalid, null if valid
 */
export function validateImageFile(
  file: Express.Multer.File | undefined,
  maxSize: number = DEFAULT_OPTIONS.maxFileSize!
): string | null {
  if (!file) {
    return "No image file provided";
  }

  if (!file.mimetype.startsWith("image/")) {
    return `Invalid file type: ${file.mimetype}. Only image files are allowed.`;
  }

  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return `File too large: ${fileSizeMB}MB exceeds maximum ${maxSizeMB}MB`;
  }

  return null;
}

/**
 * Standard error handler for image upload errors
 * 
 * @param error Multer error
 * @returns User-friendly error message
 */
export function handleImageUploadError(error: any): string {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case "FILE_TOO_LARGE":
        return "File is too large. Maximum size is 10MB.";
      case "LIMIT_FILE_COUNT":
        return "Only one file is allowed.";
      case "LIMIT_FILE_SIZE":
        return "File exceeds size limit.";
      default:
        return `Upload error: ${error.message}`;
    }
  }

  if (error.message) {
    return error.message;
  }

  return "An error occurred during file upload";
}
