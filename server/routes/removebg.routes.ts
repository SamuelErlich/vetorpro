import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { removeBgService } from "../services/removebg.service";

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Middleware to check if user is authenticated
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
};

/**
 * POST /api/removebg/process
 * Upload and process image to remove background
 */
router.post("/process", requireAuth, upload.single("image"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const userId = req.session.userId!;
    const imageBuffer = req.file.buffer;

    // Process the image (API key is now fetched internally)
    const result = await removeBgService.processRemoveBgRequest(
      userId,
      imageBuffer
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("RemoveBG processing error:", error);
    
    // Check for specific error types
    if (error.message.includes("Insufficient credits")) {
      return res.status(402).json({ error: error.message });
    }
    
    if (error.message.includes("No RemoveBG API key configured")) {
      return res.status(503).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: error.message || "Failed to process image" 
    });
  }
});

/**
 * GET /api/removebg/usage
 * Get user's RemoveBG usage history
 */
router.get("/usage", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const usage = await removeBgService.getUserUsageHistory(userId);

    res.json({
      success: true,
      data: usage,
    });
  } catch (error: any) {
    console.error("Error fetching RemoveBG usage:", error);
    res.status(500).json({ 
      error: "Failed to fetch usage history" 
    });
  }
});

/**
 * GET /api/removebg/credits
 * Get user's available RemoveBG credits
 */
router.get("/credits", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const credits = await removeBgService.getUserCredits(userId);

    res.json({
      success: true,
      credits,
    });
  } catch (error: any) {
    console.error("Error fetching RemoveBG credits:", error);
    res.status(500).json({ 
      error: "Failed to fetch credits" 
    });
  }
});

/**
 * GET /api/removebg/plans
 * Get available RemoveBG plans
 */
router.get("/plans", async (req: Request, res: Response) => {
  try {
    const plans = await removeBgService.getPlans();

    res.json({
      success: true,
      data: plans,
    });
  } catch (error: any) {
    console.error("Error fetching RemoveBG plans:", error);
    res.status(500).json({ 
      error: "Failed to fetch plans" 
    });
  }
});

/**
 * GET /api/removebg/estimate
 * Estimate credits needed for an image
 */
router.post("/estimate", requireAuth, upload.single("image"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const imageBuffer = req.file.buffer;
    const resolutionMp = await removeBgService.getImageResolution(imageBuffer);
    const creditsNeeded = removeBgService.calculateCreditsNeeded(resolutionMp);

    res.json({
      success: true,
      data: {
        resolutionMp,
        creditsNeeded,
      },
    });
  } catch (error: any) {
    console.error("Error estimating credits:", error);
    res.status(500).json({ 
      error: "Failed to estimate credits" 
    });
  }
});

export default router;