import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { removeBgService } from "../services/removebg.service";
import { storage } from "../storage";

const router = Router();
const REMOVEBG_SERVICE_ID = "removebg-001";

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

// Middleware to check if user has active RemoveBG service
const requireRemoveBgService = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  
  try {
    // Check if user is active
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "Usuário não encontrado" });
    }
    
    if (user.status !== "ATIVO") {
      return res.status(403).json({ 
        error: "Acesso negado. Sua conta está inativa. Por favor, regularize o pagamento para continuar.",
        inactive: true,
        status: user.status
      });
    }
    
    // Check if user has active RemoveBG service
    const userService = await storage.getUserService(req.session.userId, REMOVEBG_SERVICE_ID);
    if (!userService || userService.status !== "ATIVO") {
      return res.status(403).json({ 
        error: "Acesso negado. Você não tem uma assinatura ativa do RemoveBG.",
        serviceInactive: true
      });
    }
    
    next();
  } catch (error) {
    console.error("Error checking RemoveBG service status:", error);
    return res.status(500).json({ error: "Erro ao verificar status do serviço" });
  }
};

/**
 * POST /api/removebg/process
 * Upload and process image to remove background
 */
router.post("/process", requireRemoveBgService, upload.single("image"), async (req: Request, res: Response) => {
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
router.get("/usage", requireRemoveBgService, async (req: Request, res: Response) => {
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
router.get("/credits", requireRemoveBgService, async (req: Request, res: Response) => {
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

/**
 * DELETE /api/removebg/usage/:id
 * Delete a single RemoveBG usage record and its images
 */
router.delete("/usage/:id", requireRemoveBgService, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const usageId = req.params.id;
    
    // First verify the usage record belongs to this user
    const usage = await storage.getRemoveBgUsageByUserId(userId);
    const record = usage.find(u => u.id === usageId);
    
    if (!record) {
      return res.status(404).json({ error: "Usage record not found" });
    }
    
    // Delete the files if they exist
    if (record.originalImagePath || record.imagePath) {
      await removeBgService.deleteImages(record.originalImagePath, record.imagePath);
    }
    
    // Delete the database record
    const deleted = await storage.deleteRemoveBgUsage(usageId);
    
    if (!deleted) {
      return res.status(500).json({ error: "Failed to delete usage record" });
    }
    
    res.json({ success: true, message: "Usage record deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting RemoveBG usage:", error);
    res.status(500).json({ error: "Failed to delete usage record" });
  }
});

/**
 * DELETE /api/removebg/usage/batch
 * Delete multiple RemoveBG usage records and their images
 */
router.delete("/usage/batch", requireRemoveBgService, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Invalid or empty IDs array" });
    }
    
    // Verify all usage records belong to this user
    const userUsage = await storage.getRemoveBgUsageByUserId(userId);
    const userUsageIds = new Set(userUsage.map(u => u.id));
    
    const validIds = ids.filter(id => userUsageIds.has(id));
    
    if (validIds.length === 0) {
      return res.status(404).json({ error: "No valid usage records found" });
    }
    
    // Delete files for all valid records
    for (const id of validIds) {
      const record = userUsage.find(u => u.id === id);
      if (record && (record.originalImagePath || record.imagePath)) {
        await removeBgService.deleteImages(record.originalImagePath, record.imagePath);
      }
    }
    
    // Delete the database records
    const deletedCount = await storage.deleteRemoveBgUsageByIds(validIds);
    
    res.json({ 
      success: true, 
      message: `Deleted ${deletedCount} usage records`,
      deletedCount 
    });
  } catch (error: any) {
    console.error("Error deleting RemoveBG usage batch:", error);
    res.status(500).json({ error: "Failed to delete usage records" });
  }
});

export default router;