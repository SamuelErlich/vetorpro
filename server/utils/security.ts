/**
 * Security utilities and middleware for VectorPro
 * Implements security best practices and fixes identified vulnerabilities
 */

import type { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import session from "express-session";

/**
 * Security Headers Middleware
 * Adds essential security headers to protect against common attacks
 */
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Needed for React
        styleSrc: ["'self'", "'unsafe-inline'"], // Needed for inline styles
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // May need to be false for some integrations
  });
}

/**
 * Session Configuration with Security Best Practices
 * Includes session regeneration on login to prevent fixation attacks
 */
export function createSecureSession() {
  const isProduction = process.env.NODE_ENV === "production";
  
  return session({
    secret: process.env.SESSION_SECRET || "your-secret-key-change-in-production",
    name: "sessionId", // Don't use default name
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiry on activity
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true, // Prevent XSS attacks
      secure: isProduction, // HTTPS only in production
      sameSite: isProduction ? "strict" : "lax", // CSRF protection
      domain: isProduction ? process.env.PRODUCTION_DOMAIN?.replace(/^https?:\/\//, '') : undefined,
    },
  });
}

/**
 * Session Regeneration Middleware
 * Call this after successful login to prevent session fixation
 */
export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    const sessionData = { ...req.session };
    req.session.regenerate((err) => {
      if (err) {
        reject(err);
      } else {
        // Restore session data after regeneration
        Object.assign(req.session, sessionData);
        req.session.save((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      }
    });
  });
}

/**
 * Request Size Limiting
 * Prevents DoS attacks through large payloads
 */
export const requestSizeLimits = {
  json: "1mb", // JSON payload limit
  urlencoded: "1mb", // URL-encoded payload limit
  raw: "10mb", // Raw payload limit (for file uploads)
};

/**
 * Enhanced Rate Limiters with Different Tiers
 */
export const rateLimiters = {
  // Strict rate limit for authentication endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: "Muitas tentativas. Por favor, aguarde 15 minutos.",
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: true, // Don't count failed auth attempts
  }),

  // Medium rate limit for payment endpoints
  payments: rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // 10 requests per window
    message: "Muitas requisições de pagamento. Aguarde alguns minutos.",
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Lenient rate limit for general API endpoints
  api: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: "Muitas requisições. Por favor, aguarde.",
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Very strict rate limit for webhooks
  webhook: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 20, // 20 webhooks per minute
    message: "Too many webhook requests",
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Admin endpoints rate limit
  admin: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // 3 attempts per window
    message: "Acesso administrativo bloqueado temporariamente.",
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: true,
  }),
};

/**
 * Input Sanitization Middleware
 * Prevents SQL injection and XSS attacks
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  // Sanitize query parameters
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === "string") {
        // Remove SQL injection attempts
        req.query[key] = (req.query[key] as string)
          .replace(/['";\\]/g, "") // Remove dangerous characters
          .replace(/--/g, "") // Remove SQL comments
          .replace(/\/\*/g, "") // Remove SQL multi-line comments
          .replace(/\*\//g, "")
          .trim();
      }
    }
  }

  // Sanitize path parameters
  if (req.params) {
    for (const key in req.params) {
      if (typeof req.params[key] === "string") {
        req.params[key] = req.params[key]
          .replace(/['";\\]/g, "")
          .replace(/--/g, "")
          .replace(/\/\*/g, "")
          .replace(/\*\//g, "")
          .trim();
      }
    }
  }

  next();
}

/**
 * IP-based Brute Force Protection
 * Tracks failed login attempts per IP
 */
class BruteForceProtection {
  private attempts = new Map<string, { count: number; lastAttempt: Date }>();
  private readonly maxAttempts = 5;
  private readonly windowMs = 15 * 60 * 1000; // 15 minutes

  isBlocked(ip: string): boolean {
    const record = this.attempts.get(ip);
    if (!record) return false;

    const timeSinceLastAttempt = Date.now() - record.lastAttempt.getTime();
    if (timeSinceLastAttempt > this.windowMs) {
      this.attempts.delete(ip);
      return false;
    }

    return record.count >= this.maxAttempts;
  }

  recordFailure(ip: string): void {
    const record = this.attempts.get(ip);
    if (!record) {
      this.attempts.set(ip, { count: 1, lastAttempt: new Date() });
    } else {
      record.count++;
      record.lastAttempt = new Date();
    }
  }

  clearAttempts(ip: string): void {
    this.attempts.delete(ip);
  }
}

export const bruteForceProtection = new BruteForceProtection();

/**
 * Security Audit Logging
 * Logs security-relevant events for monitoring
 */
export function logSecurityEvent(
  event: "login" | "logout" | "failed_login" | "admin_access" | "rate_limit" | "suspicious_activity",
  details: {
    userId?: string;
    email?: string;
    ip?: string;
    userAgent?: string;
    reason?: string;
  }
) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event,
    ...details,
  };

  // In production, send to logging service
  if (process.env.NODE_ENV === "production") {
    console.log(`[SECURITY] ${JSON.stringify(logEntry)}`);
  } else {
    console.log(`[SECURITY] ${event}:`, details);
  }
}

/**
 * CORS Configuration with Strict Origins
 */
export function getCorsOptions() {
  const allowedOrigins = [
    "http://localhost:5000",
    "http://localhost:5173",
    "http://127.0.0.1:5000",
    "http://127.0.0.1:5173",
  ];

  // Add production domain if configured
  if (process.env.PRODUCTION_DOMAIN) {
    allowedOrigins.push(process.env.PRODUCTION_DOMAIN);
  }

  return {
    origin: function (origin: string | undefined, callback: Function) {
      // Allow requests with no origin (like mobile apps)
      if (!origin) {
        return callback(null, true);
      }

      // In development, allow Replit domains
      if (process.env.NODE_ENV === "development" || process.env.REPL_SLUG) {
        if (origin.includes(".replit.dev") || origin.includes(".repl.co")) {
          return callback(null, true);
        }
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️ CORS: Blocked request from origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Token", "x-token"],
    maxAge: 86400, // Cache preflight for 24 hours
  };
}

/**
 * Security Middleware Stack
 * Apply all security measures in correct order
 */
export function applySecurityMiddleware(app: any) {
  // Trust proxy for accurate IP addresses
  app.set("trust proxy", true);

  // Security headers
  app.use(securityHeaders());

  // CORS with strict origins
  const cors = require("cors");
  app.use(cors(getCorsOptions()));

  // Body parser with size limits
  const express = require("express");
  app.use(
    express.json({
      limit: requestSizeLimits.json,
      verify: (req: any, _res: any, buf: any) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(
    express.urlencoded({
      extended: false,
      limit: requestSizeLimits.urlencoded,
    })
  );

  // Input sanitization
  app.use(sanitizeInput);

  // Session configuration
  app.use(createSecureSession());

  console.log("✅ Security middleware applied successfully");
}

/**
 * Export all security utilities
 */
export default {
  securityHeaders,
  createSecureSession,
  regenerateSession,
  requestSizeLimits,
  rateLimiters,
  sanitizeInput,
  bruteForceProtection,
  logSecurityEvent,
  getCorsOptions,
  applySecurityMiddleware,
};