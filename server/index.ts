import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeData } from "./init-data";
import { initializePaymentCron } from "./jobs/paymentCron";
import { migrateRemoveBgApiKey } from "./migrations/removebg-api-key";

const app = express();

// Trust proxy for rate limiting to work properly in Replit
app.set('trust proxy', true);

// CORS Configuration
const corsOptions: cors.CorsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) {
      return callback(null, true);
    }

    // Production domain from environment variable
    const allowedOrigins = [
      'http://localhost:5000',
      'http://localhost:5173', // Vite dev server port
      'http://127.0.0.1:5000', // localhost alias
      'http://127.0.0.1:5173', // Vite dev server alias
    ];

    // Add production domain if configured
    if (process.env.PRODUCTION_DOMAIN) {
      allowedOrigins.push(process.env.PRODUCTION_DOMAIN);
    }

    // In development, allow Replit domains
    if (process.env.NODE_ENV === 'development' || process.env.REPL_SLUG) {
      // Allow all Replit subdomains
      if (origin.includes('.replit.dev') || origin.includes('.repl.co')) {
        return callback(null, true);
      }
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS: Blocked request from origin: ${origin}`);
      callback(null, false); // Properly reject the request
    }
  },
  credentials: true, // Allow cookies for session management
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Token', 'x-token'],
};

app.use(cors(corsOptions));

// Create uploads directory structure if it doesn't exist
const uploadsPath = path.join(import.meta.dirname, '../uploads');
const removeBgOriginalPath = path.join(uploadsPath, 'removebg', 'original');
const removeBgProcessedPath = path.join(uploadsPath, 'removebg', 'processed');

// Create directories if they don't exist
[removeBgOriginalPath, removeBgProcessedPath].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsPath));
console.log(`📁 Serving uploads from: ${uploadsPath}`);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize sample data
  await initializeData();
  
  // Migrate RemoveBG API key from environment to database
  // Temporarily disabled to avoid migration conflicts during deployment
  // await migrateRemoveBgApiKey();
  
  const server = await registerRoutes(app);

  // Initialize payment monitoring cron jobs (safe - won't crash server if fails)
  try {
    initializePaymentCron();
  } catch (error) {
    console.error("Failed to initialize payment cron jobs:", error);
    console.error("Server will continue running without automated emails.");
  }

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    console.error("Global error handler:", {
      path: req.path,
      method: req.method,
      message: err?.message,
      stack: err?.stack,
    });

    // Se outra coisa já respondeu, só loga e sai
    if (res.headersSent) {
      return;
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ 
      success: false,
      error: status === 500 ? "Internal server error" : message 
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
