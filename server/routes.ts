import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { insertUserSchema, insertCredentialSchema, insertPaymentSchema } from "@shared/schema";
import { manualTriggers } from "./jobs/paymentCron";
import { sendEmail, emailTemplates } from "./utils/email";
import { DEFAULT_SERVICE_ID } from "@shared/constants";
import removeBgRoutes from "./routes/removebg.routes";

// Rate limiters configuration - more lenient in development
const isProduction = process.env.NODE_ENV === 'production';

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 5 : 20, // Development: 20 attempts, Production: 5 attempts
  message: "Muitas tentativas de login. Por favor, tente novamente em 15 minutos.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipFailedRequests: true, // Don't count failed requests
});

const adminLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 3 : 10, // Development: 10 attempts, Production: 3 attempts
  message: "Muitas tentativas de login administrativo. Por favor, tente novamente em 15 minutos.",
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true, // Don't count failed requests
});

const paymentsRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per minute
  message: "Muitas requisições de pagamento. Por favor, aguarde um momento.",
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting in test/development environments
  skip: (req) => process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test',
});

const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  message: "Too many webhook requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Extend session data
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    isAdmin?: boolean;
  }
}

// Middleware to check if user is authenticated (allows ATIVO and INATIVO, blocks BLOQUEADO)
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  
  try {
    // Fetch user to check if exists
    const user = await storage.getUser(req.session.userId);
    
    if (!user) {
      // User doesn't exist, destroy session
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Sessão inválida" });
    }
    
    // CRITICAL: Block BLOQUEADO users immediately, destroy session
    if (user.status === "BLOQUEADO") {
      req.session.destroy(() => {});
      return res.status(403).json({ 
        error: "Conta bloqueada por falta de pagamento. Entre em contato com o suporte.",
        blocked: true,
        status: user.status 
      });
    }
    
    // Attach user to request for use in next middleware/route
    // Allow ATIVO and INATIVO to proceed (INATIVO needs to generate PIX)
    (req as any).user = user;
    next();
  } catch (error) {
    console.error("Error checking user authentication:", error);
    return res.status(500).json({ error: "Erro ao verificar autenticação" });
  }
};

// Middleware to check if user has ACTIVE status (must be used AFTER requireAuth)
const requireActiveUser = async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  
  if (!user) {
    return res.status(500).json({ error: "Usuário não carregado na sessão. Use requireAuth primeiro." });
  }
  
  // Admins can access even if not ATIVO
  if (user.isAdmin) {
    return next();
  }
  
  // Check if non-admin user status is ATIVO
  if (user.status !== "ATIVO") {
    if (user.status === "BLOQUEADO") {
      // Destroy session for blocked users
      req.session.destroy(() => {});
      return res.status(403).json({ 
        error: "Conta bloqueada por falta de pagamento. Entre em contato com o suporte.",
        blocked: true,
        status: user.status 
      });
    } else {
      // User is INATIVO or PENDENTE
      return res.status(403).json({ 
        error: "Conta inativa. Realize o pagamento para acessar este recurso.",
        inactive: true,
        status: user.status
      });
    }
  }
  
  // User is ATIVO, proceed
  next();
};

// Middleware to check if user is admin
const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  
  try {
    // Fetch user to verify admin status
    const user = await storage.getUser(req.session.userId);
    
    if (!user) {
      // User doesn't exist, destroy session
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Sessão inválida" });
    }
    
    // Check if user is actually an admin
    if (!user.isAdmin) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    
    // Even if admin, check if blocked (rare but possible)
    if (user.status === "BLOQUEADO") {
      req.session.destroy(() => {});
      return res.status(403).json({ 
        error: "Conta bloqueada. Entre em contato com o suporte.",
        blocked: true,
        status: user.status
      });
    }
    
    // Attach user to request
    (req as any).user = user;
    // Also maintain backward compatibility with session.isAdmin
    req.session.isAdmin = true;
    next();
  } catch (error) {
    console.error("Error checking admin authentication:", error);
    return res.status(500).json({ error: "Erro ao verificar autenticação de admin" });
  }
};

// checkUserStatus middleware removed - functionality consolidated into requireAuth and requireActiveUser

export async function registerRoutes(app: Express): Promise<Server> {
  // SECURITY: Validate webhook secret at startup (fail fast) - MANDATORY
  const webhookSecret = process.env.PUSHINPAY_WEBHOOK_SECRET;
  if (!webhookSecret || webhookSecret.trim() === '') {
    console.error("❌ CRITICAL SECURITY WARNING: PUSHINPAY_WEBHOOK_SECRET is not configured!");
    console.error("❌ This is a critical security requirement for production.");
    console.error("❌ Please set PUSHINPAY_WEBHOOK_SECRET environment variable with a secure random value.");
    console.error("❌ Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
    
    // In production, fail fast. In development, allow continuing with a warning
    if (process.env.NODE_ENV === 'production') {
      console.error("❌ FATAL: Cannot start production server without webhook authentication!");
      process.exit(1);
    } else {
      console.warn("⚠️  WARNING: Continuing in development mode without webhook authentication.");
      console.warn("⚠️  Webhook endpoint will return 403 Forbidden for all requests!");
    }
  }

  // Trust proxy for production (behind Replit's HTTPS proxy)
  if (process.env.NODE_ENV === "production") {
    app.set('trust proxy', 1);
  }

  // Session configuration
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "your-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
    })
  );

  // ========== AUTH ROUTES ==========
  
  // Client login (with rate limiting)
  app.post("/api/auth/login", authRateLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Credenciais inválidas" });
      }

      // Check if password has been set
      if (!user.password) {
        return res.status(401).json({ 
          error: "Senha não definida. Verifique seu email para criar sua senha.",
          passwordNotSet: true 
        });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Credenciais inválidas" });
      }

      // FIRST: Check if user is BLOQUEADO (blocked) - deny login completely
      if (user.status === "BLOQUEADO") {
        console.log(`🚫 [LOGIN] User ${email} is BLOQUEADO - denying access`);
        return res.status(403).json({ 
          error: "Conta bloqueada. Entre em contato com o suporte via WhatsApp.",
          blocked: true,
          status: user.status
        });
      }
      
      // For ATIVO or INATIVO users, allow login but control service access separately
      console.log(`✅ [LOGIN] User ${email} status: ${user.status} - allowing login`);
      
      // Check if user has any active service (for legacy sync purposes)
      const userServices = await storage.getUserServices(user.id);
      console.log(`🔍 [LOGIN] Checking services for ${email}:`, {
        userId: user.id,
        currentUserStatus: user.status,
        servicesFound: userServices?.length || 0,
        services: userServices?.map((us: any) => ({
          serviceId: us.serviceId,
          status: us.status,
          nextPaymentDate: us.proximoPagamento
        }))
      });
      
      const hasActiveService = userServices?.some((us: any) => us.status === "ATIVO") || false;
      console.log(`🔍 [LOGIN] Has active service: ${hasActiveService}`);
      
      // Legacy sync: If user has active services but Users.status is INATIVO, update to ATIVO
      if (hasActiveService && user.status === "INATIVO") {
        console.log(`✅ [LOGIN] Syncing user status for ${email} - has active services, updating from INATIVO to ATIVO`);
        await storage.updateUser(user.id, { status: "ATIVO" });
        console.log(`✅ [LOGIN] User status synced successfully for ${email}`);
      }

      req.session.userId = user.id;
      req.session.isAdmin = user.isAdmin;

      // Don't send password to client
      const { password: _, ...userWithoutPassword } = user;
      
      // Check if this is the user's first login (for modal display)
      // We send this flag so the client can store it in sessionStorage
      const isFirstLogin = true; // Always true for login, frontend manages localStorage
      
      res.json({ 
        user: userWithoutPassword, 
        isFirstLogin 
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Erro ao fazer login" });
    }
  });

  // Admin login (with stricter rate limiting)
  app.post("/api/auth/admin/login", adminLoginRateLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user || !user.isAdmin) {
        return res.status(401).json({ error: "Credenciais inválidas" });
      }

      // Check if password has been set
      if (!user.password) {
        return res.status(401).json({ 
          error: "Senha não definida. Verifique seu email para criar sua senha.",
          passwordNotSet: true 
        });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Credenciais inválidas" });
      }

      req.session.userId = user.id;
      req.session.isAdmin = true;

      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ error: "Erro ao fazer login" });
    }
  });

  // Logout (with rate limiting)
  app.post("/api/auth/logout", authRateLimiter, (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Erro ao fazer logout" });
      }
      res.json({ success: true });
    });
  });

  // Get current user  
  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      // Note: We allow both ATIVO and INATIVO users to get their info
      // but we include the status in the response so the frontend can handle appropriately
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Get me error:", error);
      res.status(500).json({ error: "Erro ao buscar usuário" });
    }
  });

  // Validate password reset token (with rate limiting)
  app.get("/api/auth/validate-token/:token", authRateLimiter, async (req, res) => {
    try {
      const { token } = req.params;
      
      const reset = await storage.getPasswordResetByToken(token);
      if (!reset) {
        return res.status(400).json({ valid: false, error: "Token inválido" });
      }

      // Check if token has expired
      if (new Date() > new Date(reset.expiresAt)) {
        return res.status(400).json({ valid: false, error: "Token expirado" });
      }

      res.json({ valid: true });
    } catch (error) {
      console.error("Validate token error:", error);
      res.status(500).json({ error: "Erro ao validar token" });
    }
  });

  // Create password from token (with rate limiting)
  app.post("/api/auth/create-password", authRateLimiter, async (req, res) => {
    try {
      // Validate request body with Zod
      const createPasswordSchema = z.object({
        token: z.string().min(1, "Token é obrigatório"),
        password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
      });

      const validatedData = createPasswordSchema.parse(req.body);
      const { token, password } = validatedData;

      // Validate token
      const reset = await storage.getPasswordResetByToken(token);
      if (!reset) {
        return res.status(400).json({ error: "Token inválido" });
      }

      // Check if token has expired
      if (new Date() > new Date(reset.expiresAt)) {
        return res.status(400).json({ error: "Token expirado. Solicite um novo link." });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Get user to check current status
      const user = await storage.getUser(reset.userId);
      
      // Update user password and status (PENDENTE → INATIVO when password is created, waiting for first payment)
      await storage.updateUser(reset.userId, {
        password: hashedPassword,
        status: user?.status === "PENDENTE" ? "INATIVO" : user?.status,
      });

      // Delete all password reset tokens for this user
      await storage.deletePasswordResetsByUserId(reset.userId);

      console.log(`✅ [CREATE-PASSWORD] Password created for user ${reset.userId}${user?.status === "PENDENTE" ? " (status: PENDENTE → INATIVO - aguardando primeiro pagamento)" : ""}`);

      res.json({ success: true, message: "Senha criada com sucesso! Você já pode fazer login." });
    } catch (error: any) {
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        const firstError = error.errors[0];
        return res.status(400).json({ error: firstError.message });
      }
      console.error("Create password error:", error);
      res.status(500).json({ error: "Erro ao criar senha" });
    }
  });

  // User self-registration (public endpoint with rate limiting)
  app.post("/api/auth/register", authRateLimiter, async (req, res) => {
    try {
      // Validate request body with Zod
      const registerSchema = z.object({
        email: z.string().email("Email inválido"),
      });

      const validatedData = registerSchema.parse(req.body);
      const { email } = validatedData;

      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      
      if (existingUser) {
        // If user exists and is ATIVO → error
        if (existingUser.status === "ATIVO") {
          return res.status(400).json({ 
            error: "Este email já está cadastrado e ativo. Faça login para acessar sua conta." 
          });
        }
        
        // If user exists but not ATIVO → resend password creation email
        console.log(`📧 [REGISTER] Resending password creation email`);
        
        // Generate new token
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        // Delete old tokens and create new one
        await storage.deletePasswordResetsByUserId(existingUser.id);
        await storage.createPasswordReset({
          userId: existingUser.id,
          token,
          expiresAt,
        });

        // Send email
        const template = emailTemplates.createPassword(email, token);
        await sendEmail({
          to: email,
          subject: template.subject,
          html: template.html,
        });

        return res.json({ 
          success: true, 
          message: "Email de criação de senha reenviado com sucesso!" 
        });
      }

      // User doesn't exist → create new user with status INATIVO
      const user = await storage.createUser({
        email,
        password: null, // Will be set by user via email link
        status: "INATIVO", // Not active until password is created
        isAdmin: false,
        discount: 0, // Default discount
      });

      // Generate secure token for password creation
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Valid for 24 hours

      await storage.createPasswordReset({
        userId: user.id,
        token,
        expiresAt,
      });

      // Send password creation email
      const template = emailTemplates.createPassword(email, token);
      const emailSent = await sendEmail({
        to: email,
        subject: template.subject,
        html: template.html,
      });

      if (!emailSent) {
        console.warn(`⚠️  [REGISTER] User created but email failed to send`);
        return res.json({
          success: true,
          warning: "Conta criada, mas o email não pôde ser enviado. Configure RESEND_API_KEY.",
        });
      }

      console.log(`✅ [REGISTER] New user registered (status: INATIVO)`);

      res.json({ 
        success: true, 
        message: "Conta criada com sucesso! Verifique seu email para criar sua senha." 
      });
    } catch (error: any) {
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        const firstError = error.errors[0];
        return res.status(400).json({ error: firstError.message });
      }
      console.error("Register error:", error);
      res.status(500).json({ error: "Erro ao criar conta" });
    }
  });

  // ========== USER ROUTES (Admin only) ==========
  
  // Admin: Get users with filters (updated to include services)
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const { status, search, sort } = req.query;
      
      // Get users with their services
      const usersWithServices = await storage.getUsersWithServices();
      
      // Process each user to add computed fields and remove password
      const processedUsers = usersWithServices.map(({ password, ...user }) => {
        // Compute aggregated status from services for backward compatibility
        let computedStatus = user.status || "INATIVO";
        if (user.services && user.services.length > 0) {
          const hasAtivo = user.services.some(s => s.status === "ATIVO");
          const hasBloqueado = user.services.some(s => s.status === "BLOQUEADO");
          const allInativo = user.services.every(s => s.status === "INATIVO");
          
          if (hasBloqueado) {
            computedStatus = "BLOQUEADO";
          } else if (hasAtivo) {
            computedStatus = "ATIVO";
          } else if (allInativo) {
            computedStatus = "INATIVO";
          }
        }
        
        // Calculate total services and active services
        const totalServices = user.services?.length || 0;
        const activeServices = user.services?.filter(s => s.status === "ATIVO").length || 0;
        
        // Find the most recent payment across all services
        let lastPaymentDate = user.ultimoPagamento;
        if (user.services && user.services.length > 0) {
          const servicePayments = user.services
            .filter(s => s.ultimoPagamento)
            .map(s => new Date(s.ultimoPagamento!));
          
          if (servicePayments.length > 0) {
            const mostRecent = servicePayments.reduce((latest, current) => 
              current > latest ? current : latest
            );
            lastPaymentDate = mostRecent;
          }
        }
        
        return {
          ...user,
          status: computedStatus, // Computed status for backward compatibility
          computedStatus, // Also include as explicit field
          totalServices,
          activeServices,
          lastPayment: lastPaymentDate ? lastPaymentDate.toISOString().split('T')[0] : user.ultimoPagamento ? new Date(user.ultimoPagamento).toISOString().split('T')[0] : null
        };
      });
      
      // Apply filters
      let filteredUsers = processedUsers;
      
      if (status && (status === "ATIVO" || status === "INATIVO" || status === "BLOQUEADO")) {
        filteredUsers = filteredUsers.filter(user => user.computedStatus === status);
      }
      
      if (search && typeof search === "string") {
        const searchLower = search.toLowerCase();
        filteredUsers = filteredUsers.filter(user => 
          user.email.toLowerCase().includes(searchLower)
        );
      }
      
      // Apply sorting
      if (sort && typeof sort === "string") {
        switch (sort) {
          case "ultimoPagamento_desc":
            filteredUsers.sort((a, b) => {
              const dateA = a.lastPayment ? new Date(a.lastPayment).getTime() : 0;
              const dateB = b.lastPayment ? new Date(b.lastPayment).getTime() : 0;
              return dateB - dateA;
            });
            break;
          case "ultimoPagamento_asc":
            filteredUsers.sort((a, b) => {
              const dateA = a.lastPayment ? new Date(a.lastPayment).getTime() : 0;
              const dateB = b.lastPayment ? new Date(b.lastPayment).getTime() : 0;
              return dateA - dateB;
            });
            break;
          case "cadastro_desc":
            filteredUsers.sort((a, b) => b.id.localeCompare(a.id));
            break;
          case "cadastro_asc":
            filteredUsers.sort((a, b) => a.id.localeCompare(b.id));
            break;
        }
      }
      
      res.json(filteredUsers);
    } catch (error) {
      console.error("Get users with filters error:", error);
      res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  });
  
  // Legacy route for backwards compatibility
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ error: "Email já cadastrado" });
      }

      // Hash password if provided (password can be null for users created via email invitation)
      const hashedPassword = validatedData.password 
        ? await bcrypt.hash(validatedData.password, 10)
        : null;
      
      const user = await storage.createUser({
        ...validatedData,
        password: hashedPassword,
      });

      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ error: "Erro ao criar usuário" });
    }
  });

  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates: any = { ...req.body };

      // Hash password if provided
      if (updates.password) {
        updates.password = await bcrypt.hash(updates.password, 10);
      }

      const user = await storage.updateUser(id, updates);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ error: "Erro ao atualizar usuário" });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteUser(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ error: "Erro ao deletar usuário" });
    }
  });

  // Admin: Update user status manually
  app.patch("/api/admin/users/:id/status", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      console.log(`📝 Updating user ${id} status to: ${status}`);

      if (!status || !["ATIVO", "INATIVO", "BLOQUEADO"].includes(status)) {
        return res.status(400).json({ error: "Status inválido" });
      }

      // Get user before update for debugging
      const userBefore = await storage.getUser(id);
      console.log(`   Before update - Status: ${userBefore?.status}`);

      const user = await storage.updateUser(id, { status });
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      console.log(`   After update - Status: ${user.status}`);

      // Also update all user services to match the user status
      const userServices = await storage.getUserServices(id);
      for (const userService of userServices) {
        await storage.updateUserService(userService.id, { status });
        console.log(`   Updated service ${userService.serviceId} to status: ${status}`);
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Update user status error:", error);
      res.status(500).json({ error: "Erro ao atualizar status" });
    }
  });

  // Admin: Get user payment history
  app.get("/api/admin/payments/user/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      // Use filtered payments (paid + latest pending only)
      const payments = await storage.getFilteredPaymentsForUser(id);
      res.json(payments);
    } catch (error) {
      console.error("Get user payments error:", error);
      res.status(500).json({ error: "Erro ao buscar pagamentos" });
    }
  });

  // ========== USER SERVICES ROUTES (New for multi-service) ==========

  // Admin: Get services for specific user
  app.get("/api/admin/users/:userId/services", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      
      const user = await storage.getUserWithServices(userId);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Get user services error:", error);
      res.status(500).json({ error: "Erro ao buscar serviços do usuário" });
    }
  });

  // Admin: Update specific user-service relationship
  app.patch("/api/admin/users/:userId/services/:serviceId", requireAdmin, async (req, res) => {
    try {
      const { userId, serviceId } = req.params;
      const updates = req.body;
      
      // Find the user service record
      const userService = await storage.getUserService(userId, serviceId);
      if (!userService) {
        return res.status(404).json({ error: "Assinatura não encontrada" });
      }
      
      // Update the user service
      const updatedUserService = await storage.updateUserService(userService.id, updates);
      if (!updatedUserService) {
        return res.status(500).json({ error: "Erro ao atualizar assinatura" });
      }
      
      // Update the legacy users.status field for backward compatibility
      // Compute aggregated status from all user services
      const allUserServices = await storage.getUserServices(userId);
      let computedStatus = "INATIVO";
      
      if (allUserServices.length > 0) {
        const hasAtivo = allUserServices.some(s => s.status === "ATIVO");
        const hasBloqueado = allUserServices.some(s => s.status === "BLOQUEADO");
        const allInativo = allUserServices.every(s => s.status === "INATIVO");
        
        if (hasBloqueado) {
          computedStatus = "BLOQUEADO";
        } else if (hasAtivo) {
          computedStatus = "ATIVO";
        } else if (allInativo) {
          computedStatus = "INATIVO";
        }
      }
      
      // Update the user's legacy status field
      await storage.updateUser(userId, { status: computedStatus });
      
      res.json(updatedUserService);
    } catch (error) {
      console.error("Update user service error:", error);
      res.status(500).json({ error: "Erro ao atualizar serviço do usuário" });
    }
  });

  // Admin: Add new service to user (create subscription)
  app.post("/api/admin/users/:userId/services", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { serviceId, status = "INATIVO", creditsAvailable = 0 } = req.body;
      
      if (!serviceId) {
        return res.status(400).json({ error: "serviceId é obrigatório" });
      }
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      // Check if service exists
      const service = await storage.getService(serviceId);
      if (!service) {
        return res.status(404).json({ error: "Serviço não encontrado" });
      }
      
      // Check if subscription already exists
      const existingSubscription = await storage.getUserService(userId, serviceId);
      if (existingSubscription) {
        return res.status(400).json({ error: "Usuário já possui assinatura para este serviço" });
      }
      
      // Create the subscription
      const userService = await storage.createUserService({
        userId,
        serviceId,
        status,
        creditsAvailable,
      });
      
      // Update the legacy users.status field for backward compatibility
      const allUserServices = await storage.getUserServices(userId);
      let computedStatus = "INATIVO";
      
      if (allUserServices.length > 0) {
        const hasAtivo = allUserServices.some(s => s.status === "ATIVO");
        const hasBloqueado = allUserServices.some(s => s.status === "BLOQUEADO");
        
        if (hasBloqueado) {
          computedStatus = "BLOQUEADO";
        } else if (hasAtivo) {
          computedStatus = "ATIVO";
        }
      }
      
      await storage.updateUser(userId, { status: computedStatus });
      
      res.status(201).json(userService);
    } catch (error) {
      console.error("Add user service error:", error);
      res.status(500).json({ error: "Erro ao adicionar serviço ao usuário" });
    }
  });

  // Admin: Export users to CSV
  app.get("/api/admin/users/export", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const allPayments = await storage.getAllPayments();

      const csvRows = [];
      csvRows.push("email,status,ultimoPagamento,totalPago,dataCadastro");

      for (const user of users) {
        const userPayments = allPayments.filter((p) => p.userId === user.id && p.status === "paid");
        const totalPago = userPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        const totalPagoReais = (totalPago / 100).toFixed(2);

        const row = [
          user.email,
          user.status,
          user.ultimoPagamento ? new Date(user.ultimoPagamento).toLocaleDateString("pt-BR") : "",
          totalPagoReais,
          user.id,
        ];

        csvRows.push(row.join(","));
      }

      const csv = csvRows.join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=usuarios.csv");
      res.send(csv);
    } catch (error) {
      console.error("Export users error:", error);
      res.status(500).json({ error: "Erro ao exportar usuários" });
    }
  });

  // ========== USER SERVICES ROUTES ==========

  // Get user's services/subscriptions
  app.get("/api/user-services", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const userServices = await storage.getUserServicesWithDetails(userId);
      
      // Enrich services with plan and service information
      const enrichedServices = await Promise.all(
        userServices.map(async (us) => {
          const service = await storage.getService(us.serviceId);
          const plan = us.planId ? await storage.getServicePlan(us.planId) : null;
          
          // Calculate remaining credits for services with credit system
          const remainingCredits = us.credits ? 
            (us.credits - (us.creditsUsed || 0)) : 
            (us.creditsAvailable || 0);
          
          return {
            ...us,
            serviceName: service?.nome,
            serviceDescription: service?.descricao,
            planId: us.planId,
            planName: plan?.name,
            planFeatures: plan?.features,
            remainingCredits: remainingCredits,
            totalCredits: us.credits || us.creditsAvailable || 0,
            creditsUsed: us.creditsUsed || 0
          };
        })
      );
      
      res.json(enrichedServices);
    } catch (error) {
      console.error("Get user services error:", error);
      res.status(500).json({ error: "Erro ao buscar serviços" });
    }
  });

  // ========== CREDENTIAL ROUTES ==========
  
  // Get user's credentials (controlled by UserServices.status, not user.status)
  app.get("/api/credentials", requireAuth, requireActiveUser, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      // Get user's active subscriptions to services
      const userServices = await storage.getUserServices(userId);
      const activeServices = userServices.filter(us => us.status === "ATIVO");
      
      // If no active services, return locked
      if (activeServices.length === 0) {
        return res.json({ locked: true, credentials: [] });
      }

      // Get the service IDs that the user has active subscriptions for
      const activeServiceIds = activeServices.map(us => us.serviceId);
      
      // Get credentials for this user that belong to their active services
      const userCredentials = await storage.getCredentialsByUserAndServices(userId, activeServiceIds);

      res.json({ locked: false, credentials: userCredentials });
    } catch (error) {
      console.error("Get credentials error:", error);
      res.status(500).json({ error: "Erro ao buscar credenciais" });
    }
  });

  // Get credentials for a specific service - checks if user has active access
  app.get("/api/credentials/:serviceId", requireAuth, requireActiveUser, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { serviceId } = req.params;
      
      // Verify if the user has access to this specific service
      const userService = await storage.getUserService(userId, serviceId);
      
      if (!userService || userService.status !== "ATIVO") {
        return res.status(403).json({ 
          error: "Você não tem acesso ativo a este serviço. Faça uma assinatura.",
          needsSubscription: true
        });
      }
      
      // Get credentials for this user and service
      const credentials = await storage.getCredentialsByUserAndServices(userId, [serviceId]);
      
      res.json({ credentials });
    } catch (error) {
      console.error("Get service credentials error:", error);
      res.status(500).json({ error: "Erro ao buscar credenciais do serviço" });
    }
  });

  // Admin: Get all credentials
  app.get("/api/admin/credentials", requireAdmin, async (req, res) => {
    try {
      const credentials = await storage.getAllCredentials();
      res.json(credentials);
    } catch (error) {
      console.error("Get all credentials error:", error);
      res.status(500).json({ error: "Erro ao buscar credenciais" });
    }
  });

  // Admin: Get credentials by user
  app.get("/api/admin/credentials/user/:userId", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const credentials = await storage.getCredentialsByUserId(userId);
      res.json(credentials);
    } catch (error) {
      console.error("Get user credentials error:", error);
      res.status(500).json({ error: "Erro ao buscar credenciais" });
    }
  });

  // Admin: Create credential
  app.post("/api/admin/credentials", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertCredentialSchema.parse(req.body);
      // Set default serviceId if not provided
      const credentialData = {
        ...validatedData,
        serviceId: validatedData.serviceId || DEFAULT_SERVICE_ID
      };
      
      // If creating credential for a specific user, verify they have the service
      if (credentialData.userId) {
        const userService = await storage.getUserService(credentialData.userId, credentialData.serviceId);
        if (!userService) {
          return res.status(400).json({ 
            error: `Usuário não possui o serviço ${credentialData.serviceId}. Não é possível criar credencial.` 
          });
        }
        if (userService.status !== "ATIVO") {
          return res.status(400).json({ 
            error: `Serviço ${credentialData.serviceId} do usuário não está ativo. Não é possível criar credencial.` 
          });
        }
      }
      
      const credential = await storage.createCredential(credentialData);
      res.status(201).json(credential);
    } catch (error) {
      console.error("Create credential error:", error);
      res.status(500).json({ error: "Erro ao criar credencial" });
    }
  });

  // Admin: Update credential
  app.patch("/api/admin/credentials/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const credential = await storage.updateCredential(id, req.body);
      
      if (!credential) {
        return res.status(404).json({ error: "Credencial não encontrada" });
      }

      res.json(credential);
    } catch (error) {
      console.error("Update credential error:", error);
      res.status(500).json({ error: "Erro ao atualizar credencial" });
    }
  });

  // Admin: Delete credential
  app.delete("/api/admin/credentials/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteCredential(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Credencial não encontrada" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Delete credential error:", error);
      res.status(500).json({ error: "Erro ao deletar credencial" });
    }
  });

  // ========== VECTORIZER AUTO-LOGIN ROUTES ==========
  
  // Auto-login to Vectorizer via SSO
  app.get("/api/vectorizer/autologin", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      // Check if user is ATIVO
      if (user.status !== "ATIVO") {
        return res.status(403).json({ 
          success: false, 
          error: "Acesso bloqueado. Pagamento pendente." 
        });
      }

      // Get shared credentials (most recent)
      const credentials = await storage.getSharedCredentials();
      
      if (credentials.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: "Nenhuma credencial disponível" 
        });
      }

      // Get the most recent credential (last in array)
      const latestCredential = credentials[credentials.length - 1];

      // Parse credential data
      let email: string;
      let senha: string;
      try {
        const data = JSON.parse(latestCredential.data);
        email = data.usuario || data.email;
        senha = data.senha || data.password;
        
        if (!email) {
          return res.status(400).json({ 
            success: false, 
            error: "Email não encontrado nas credenciais" 
          });
        }
        
        if (!senha) {
          return res.status(400).json({ 
            success: false, 
            error: "Senha não encontrada nas credenciais" 
          });
        }
      } catch (error) {
        return res.status(400).json({ 
          success: false, 
          error: "Erro ao processar credenciais" 
        });
      }

      // Build Vectorizer SSO URL (pre-fills email only) - Updated to correct login URL
      const loginUrl = `https://pt.cedarlakeventures.com/signon/v0/we54b154ba3adfa5e/single?lc=pt-BR&loginPath=%2Flogin_callback%3Fredir%3D%252F&email=${encodeURIComponent(email)}`;

      res.json({ 
        success: true, 
        url: loginUrl,
        email,
        senha
      });
    } catch (error) {
      console.error("Vectorizer auto-login error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Erro ao gerar link de acesso" 
      });
    }
  });

  // ========== DEBUG ROUTES (Admin only) ==========
  
  // Admin: Check server's actual outbound IP address
  app.get("/api/debug/ip", requireAdmin, async (req, res) => {
    try {
      console.log("🔍 [DEBUG] Admin checking server IP address");
      
      // Get server's public IP by making a request to an IP checking service
      const ipCheckServices = [
        'https://api.ipify.org?format=json',
        'https://api.my-ip.io/ip.json',
        'https://ipapi.co/json/',
      ];
      
      let serverIp = null;
      let serviceUsed = null;
      
      // Try multiple services in case one is down
      for (const service of ipCheckServices) {
        try {
          const response = await fetch(service);
          if (response.ok) {
            const data = await response.json();
            serverIp = data.ip || data;
            serviceUsed = service;
            break;
          }
        } catch (err) {
          console.warn(`Failed to get IP from ${service}:`, err);
          continue;
        }
      }
      
      // Also get local request info
      const requestIp = req.ip || req.connection.remoteAddress || 'unknown';
      const forwardedFor = req.headers['x-forwarded-for'] || 'not set';
      const realIp = req.headers['x-real-ip'] || 'not set';
      
      console.log(`✅ [DEBUG] Server IP check completed:
        - Public IP: ${serverIp}
        - Request IP: ${requestIp}
        - X-Forwarded-For: ${forwardedFor}
        - X-Real-IP: ${realIp}
        - Service Used: ${serviceUsed}
        - Environment: ${process.env.NODE_ENV}
        - Admin User: ${req.session.userId}`);
      
      res.json({
        serverPublicIp: serverIp,
        requestIp: requestIp,
        headers: {
          xForwardedFor: forwardedFor,
          xRealIp: realIp
        },
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        message: serverIp 
          ? "Use este IP para autorizar no painel da PushinPay" 
          : "Não foi possível determinar o IP público do servidor"
      });
    } catch (error) {
      console.error("Debug IP error:", error);
      res.status(500).json({ error: "Erro ao verificar IP do servidor" });
    }
  });

  // ========== PAYMENT ROUTES ==========
  
  // Get user's payments (with rate limiting)
  app.get("/api/payments", requireAuth, paymentsRateLimiter, async (req, res) => {
    try {
      // Use filtered payments (paid + latest pending only)
      const payments = await storage.getFilteredPaymentsForUser(req.session.userId!);
      res.json(payments);
    } catch (error) {
      console.error("Get payments error:", error);
      res.status(500).json({ error: "Erro ao buscar pagamentos" });
    }
  });

  // Check payment status by txid (with rate limiting)
  app.get("/api/payments/status/:txid", requireAuth, paymentsRateLimiter, async (req, res) => {
    try {
      const { txid } = req.params;
      const payment = await storage.getPaymentByTxid(txid);
      
      if (!payment) {
        return res.status(404).json({ error: "Pagamento não encontrado" });
      }

      // Verify the payment belongs to the current user
      if (payment.userId !== req.session.userId) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      // Format cents to reais for UI display
      // payment.amount is stored as cents in string format (e.g., "1750")
      const amountCents = parseInt(payment.amount as string, 10);
      const amountInReais = (amountCents / 100).toFixed(2);

      res.json({ 
        status: payment.status,
        amount: amountInReais, // Return formatted reais for UI (e.g., "17.50")
        amountCents: amountCents, // Return raw cents (e.g., 1750)
        createdAt: payment.createdAt,
      });
    } catch (error) {
      console.error("Get payment status error:", error);
      res.status(500).json({ error: "Erro ao verificar status do pagamento" });
    }
  });

  // Generate PIX payment (with rate limiting)
  app.post("/api/payments/pix", requireAuth, paymentsRateLimiter, async (req, res) => {
    try {
      // === VALIDATION CHECKS START ===
      console.log(`📝 [PIX Payment] Starting payment generation for user: ${req.session?.userId}`);
      
      // Check session validity
      if (!req.session) {
        console.error("❌ [PIX Payment] No session object available");
        return res.status(401).json({ error: "Sessão inválida. Por favor, faça login novamente." });
      }
      
      if (!req.session.userId) {
        console.error("❌ [PIX Payment] No userId in session");
        return res.status(401).json({ error: "Usuário não autenticado. Por favor, faça login novamente." });
      }
      
      // Log critical environment variables status
      console.log(`🔧 [PIX Payment] Environment check:
        - NODE_ENV: ${process.env.NODE_ENV || 'not set'}
        - PUSHINPAY_TOKEN: ${process.env.PUSHINPAY_TOKEN ? 'configured' : 'NOT CONFIGURED'}
        - USE_PUSHINPAY_DEMO: ${process.env.USE_PUSHINPAY_DEMO || 'not set'}
        - DATABASE_URL: ${process.env.DATABASE_URL ? 'configured' : 'NOT CONFIGURED'}`);
      
      // Check if database is accessible (simple validation)
      if (!storage) {
        console.error("❌ [PIX Payment] Storage object is not initialized");
        return res.status(500).json({ error: "Sistema indisponível. Por favor, tente novamente." });
      }
      // === VALIDATION CHECKS END ===
      
      const { amount, serviceId: requestServiceId, planId } = req.body;
      
      // CRITICAL: Accept both number and string (frontend may send either)
      if (amount == null || amount === '') {
        console.error("❌ [PIX Payment] Amount is null or empty:", amount);
        return res.status(400).json({ error: "Valor inválido" });
      }

      // Sanitize amount input (CRITICAL: convert string to number if needed)
      const originalAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      
      if (isNaN(originalAmount) || originalAmount <= 0) {
        return res.status(400).json({ error: "Valor inválido" });
      }

      // Get user's discount
      console.log(`📊 [PIX Payment] Fetching user data for userId: ${req.session.userId}`);
      let user;
      try {
        user = await storage.getUser(req.session.userId!);
      } catch (userFetchError: any) {
        console.error("❌ [PIX Payment] Failed to fetch user from storage:", userFetchError);
        console.error("Error details:", {
          message: userFetchError?.message,
          code: userFetchError?.code,
          stack: userFetchError?.stack
        });
        return res.status(500).json({ error: "Erro ao buscar dados do usuário" });
      }
      
      if (!user) {
        console.error(`❌ [PIX Payment] User not found for userId: ${req.session.userId}`);
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      console.log(`✅ [PIX Payment] User found - Email: ${user.email}, Status: ${user.status}, Discount: ${user.discount || 0}%`);

      // Apply discount if user has one
      const discount = user.discount || 0;
      const discountMultiplier = 1 - (discount / 100);
      const sanitizedAmount = originalAmount * discountMultiplier;

      // PushinPay requires minimum value of 50 centavos (R$ 0.50)
      const amountInCents = Math.round(sanitizedAmount * 100);
      if (amountInCents < 50) {
        return res.status(400).json({ 
          error: "Valor mínimo permitido é R$ 0,50 (50 centavos)"
        });
      }

      // Check if demo mode is explicitly enabled
      const forceDemo = process.env.USE_PUSHINPAY_DEMO === "true";
      
      let pixData: any;
      let isUsingDemoMode = false;
      let demoReason = "";
      
      if (forceDemo) {
        // DEMO MODE FORCED: Use fake PIX for testing/maintenance
        isUsingDemoMode = true;
        demoReason = "maintenance";
        console.log("⚠️  [PIX] Demo mode is enabled via USE_PUSHINPAY_DEMO environment variable");
      } else {
        // Try PRODUCTION MODE first
        const pushinpayToken = process.env.PUSHINPAY_TOKEN;
        
        if (!pushinpayToken) {
          // No token configured - fall back to demo mode
          isUsingDemoMode = true;
          demoReason = "no_token";
          console.error("❌ [PIX] PUSHINPAY_TOKEN not configured - falling back to demo mode");
        } else {
          // Try to call real PushinPay API
          try {
            // Get server IP for logging
            let serverIp = "unknown";
            try {
              const ipResponse = await fetch('https://api.ipify.org?format=json');
              if (ipResponse.ok) {
                const ipData = await ipResponse.json();
                serverIp = ipData.ip;
              }
            } catch (ipErr) {
              console.warn("Could not determine server IP:", ipErr);
            }
            
            // CRITICAL: Ensure webhook URL is properly configured
            let webhookUrl: string | undefined = undefined;
            if (process.env.REPLIT_DEV_DOMAIN) {
              webhookUrl = `https://${process.env.REPLIT_DEV_DOMAIN}/api/webhook/pushinpay`;
            }

            // IMPORTANT: Do NOT send our own txid - let PushinPay generate their own
            const pushinpayResponse = await fetch("https://api.pushinpay.com.br/api/pix/cashIn", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${pushinpayToken}`,
                "Accept": "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                value: amountInCents,
                webhook_url: webhookUrl,
                // NO txid sent - PushinPay will generate their own
              }),
            });

            if (!pushinpayResponse.ok) {
              const errorText = await pushinpayResponse.text();
              console.error(`❌ [PIX] PushinPay API error (status ${pushinpayResponse.status}):`, errorText);
              console.error(`❌ [PIX] Server IP that was rejected: ${serverIp}`);
              
              // Check for IP authorization error
              let isIpError = false;
              let errorMessage = "";
              
              try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error && (
                  errorJson.error.includes("IP não") ||
                  errorJson.error.includes("IP not") ||
                  errorJson.error.includes("IP nao") ||
                  errorJson.error.includes("não autorizado") ||
                  errorJson.error.includes("not authorized")
                )) {
                  isIpError = true;
                  errorMessage = errorJson.error;
                }
              } catch (e) {
                // Check status codes that typically indicate authorization issues
                if (pushinpayResponse.status === 401 || pushinpayResponse.status === 403) {
                  isIpError = true;
                  errorMessage = `Authorization error (${pushinpayResponse.status})`;
                }
              }
              
              if (isIpError) {
                // IP authorization error - automatically fall back to demo mode
                console.warn(`⚠️  [PIX] IP authorization failed - Server IP ${serverIp} is not whitelisted`);
                console.warn(`⚠️  [PIX] Falling back to demo mode for user experience`);
                isUsingDemoMode = true;
                demoReason = "ip_error";
              } else {
                // Other error - don't fall back, return the error
                let userErrorMessage = "Sistema de pagamento temporariamente indisponível. Tente novamente.";
                
                try {
                  const errorJson = JSON.parse(errorText);
                  if (errorJson.error) {
                    console.error(`❌ [PIX] PushinPay error detail: ${errorJson.error}`);
                  }
                } catch (e) {
                  // Keep default error message
                }
                
                return res.status(503).json({ 
                  error: userErrorMessage,
                  temporary: true 
                });
              }
            } else {
              // Success - parse the response
              pixData = await pushinpayResponse.json();
              isUsingDemoMode = false;
              
              // Log the FULL PushinPay response for debugging
              console.log("📝 PushinPay API Response (Full):", JSON.stringify(pixData, null, 2));
              console.log("📝 PushinPay API Response (Key Fields):", {
                id: pixData.id,
                txid: pixData.txid,
                endToEndId: pixData.endToEndId,
                end_to_end_id: pixData.end_to_end_id,
                EndToEndId: pixData.EndToEndId,
                e2e_id: pixData.e2e_id,
                end2end_id: pixData.end2end_id,
                transaction_id: pixData.transaction_id,
                transactionId: pixData.transactionId,
              });
            }
          } catch (apiError) {
            // Network error or other unexpected error - fall back to demo mode
            console.error("❌ [PIX] Unexpected error calling PushinPay:", apiError);
            isUsingDemoMode = true;
            demoReason = "api_error";
          }
        }
      }
      
      // If using demo mode, generate demo PIX data
      if (isUsingDemoMode) {
        console.log(`⚠️  [PIX] Using demo mode (reason: ${demoReason})`);
        
        // Generate a simple demo QR code (base64 encoded 1x1 pixel)
        const demoQrCodeBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        
        // In demo mode, generate a UUID for testing
        const demoTxid = crypto.randomUUID();
        pixData = {
          txid: demoTxid,
          id: demoTxid, // For compatibility
          qr_code: "00020101021126580014br.gov.bcb.pix0136demo-pix-code-for-testing-only5204000053039865802BR5925DEMO PUSHINPAY TESTING6009SAO PAULO62070503***6304ABCD",
          qr_code_base64: demoQrCodeBase64,
          status: "created",
          value: amountInCents,
          isDemoMode: true,
          demoReason: demoReason
        };
      }

      // CRITICAL: Extract the REAL PIX ID from PushinPay response
      // Check all possible field names where PushinPay might return the ID
      const pixTxid = pixData.id || 
                     pixData.txid ||
                     pixData.endToEndId || 
                     pixData.end_to_end_id ||
                     pixData.EndToEndId ||
                     pixData.e2e_id || 
                     pixData.end2end_id ||
                     pixData.transaction_id ||
                     pixData.transactionId ||
                     crypto.randomUUID(); // Fallback only if PushinPay doesn't return any ID
      
      // Log the extracted PIX ID for debugging
      console.log(`🔑 [PIX Payment] Creating payment with PIX ID: ${pixTxid}`);
      console.log(`📊 [PIX Payment] Source field for ID: ${
        pixData.id ? 'id' :
        pixData.txid ? 'txid' :
        pixData.endToEndId ? 'endToEndId' :
        pixData.end_to_end_id ? 'end_to_end_id' :
        pixData.EndToEndId ? 'EndToEndId' :
        pixData.e2e_id ? 'e2e_id' :
        pixData.end2end_id ? 'end2end_id' :
        pixData.transaction_id ? 'transaction_id' :
        pixData.transactionId ? 'transactionId' :
        'FALLBACK (UUID generated)'
      }`);

      // Create payment record with the REAL PIX ID as primary txid
      console.log(`💾 [PIX Payment] Creating payment record in database...`);
      
      let payment;
      try {
        // Use serviceId from request or fallback to default
        const serviceId = requestServiceId || DEFAULT_SERVICE_ID;
        
        // Check if there's already a recent pending payment for this user and service (within 1 hour)
        const recentPendingPayment = await storage.getRecentPendingPayment(
          req.session.userId!,
          serviceId,
          60 * 60 * 1000 // 1 hour window
        );
        
        if (recentPendingPayment) {
          // Reuse the existing pending payment - just update with new PIX data
          console.log(`🔁 [PIX Payment] Reusing existing pending payment:
            - Payment ID: ${recentPendingPayment.id}
            - Previous TXID: ${recentPendingPayment.txid}
            - Created at: ${recentPendingPayment.createdAt}`);
          
          // Update the existing payment with new PIX data (new QR code)
          payment = await storage.updatePayment(recentPendingPayment.id, {
            txid: pixTxid,
            pushinpayId: pixTxid,
            amount: amountInCents.toString(),
            planId: planId || recentPendingPayment.planId, // Keep planId if updating
          });
          
          console.log(`✅ [PIX Payment] Updated existing pending payment with new PIX data`);
        } else {
          // Before creating new payment, expire old pending payments (older than 1 hour)
          await storage.expireOldPendingPayments(req.session.userId!, serviceId);
          console.log(`🧹 [PIX Payment] Expired old pending payments for user ${req.session.userId} and service ${serviceId}`);
          
          // Create new payment only if no recent pending payment exists
          const paymentData = {
            userId: req.session.userId!,
            serviceId, // Use the service from request or default
            planId: planId || null, // Include planId from request
            amount: amountInCents.toString(), // Store cents as string (decimal column)
            status: "pending" as const,
            txid: pixTxid, // Use REAL PIX ID as primary txid
            pushinpayId: pixTxid, // Store same ID in both fields for compatibility
          };
          
          console.log(`📝 [PIX Payment] Creating new payment:`, JSON.stringify(paymentData, null, 2));
          
          payment = await storage.createPayment(paymentData);
        }
        
        if (!payment) {
          console.error("❌ [PIX Payment] storage.createPayment/updatePayment returned null/undefined");
          throw new Error("Failed to create/update payment record - storage returned null");
        }
      } catch (paymentError: any) {
        console.error("❌ [PIX Payment] Failed to create payment in storage:", paymentError);
        console.error("Payment creation error details:", {
          message: paymentError?.message,
          code: paymentError?.code,
          stack: paymentError?.stack,
          sqlMessage: paymentError?.sqlMessage,
          sql: paymentError?.sql
        });
        
        // Return specific error based on the database error
        if (paymentError?.code === 'ER_DUP_ENTRY' || paymentError?.message?.includes('duplicate')) {
          return res.status(409).json({ error: "Pagamento duplicado. Por favor, aguarde ou tente novamente." });
        }
        
        return res.status(500).json({ error: "Erro ao registrar pagamento no sistema" });
      }

      console.log(`✅ [PIX Payment] Payment created in database:
        - Payment ID: ${payment.id}
        - TXID (Primary): ${payment.txid}
        - PushinPay ID: ${payment.pushinpayId}
        - Amount: R$ ${sanitizedAmount} (${amountInCents} cents)
        - User ID: ${req.session.userId}`);

      // Ensure qr_code_base64 has proper data URI prefix
      let qrCodeBase64 = pixData.qr_code_base64;
      if (qrCodeBase64 && !qrCodeBase64.startsWith('data:image/')) {
        qrCodeBase64 = `data:image/png;base64,${qrCodeBase64}`;
      }

      // Prepare user-friendly message based on demo mode reason
      let userMessage = null;
      if (isUsingDemoMode) {
        switch (demoReason) {
          case "maintenance":
            userMessage = "⚠️ Sistema PIX em manutenção. Os pagamentos estão temporariamente desabilitados.";
            break;
          case "ip_error":
            userMessage = "⚠️ PIX temporariamente indisponível devido a manutenção. Nosso time está trabalhando para resolver.";
            break;
          case "no_token":
            userMessage = "⚠️ Sistema de pagamento não configurado. Entre em contato com o suporte.";
            break;
          case "api_error":
            userMessage = "⚠️ Sistema PIX temporariamente indisponível. Tente novamente em alguns minutos.";
            break;
          default:
            userMessage = "⚠️ Sistema PIX em modo de demonstração.";
        }
        console.log(`⚠️  [PIX] Demo mode message for user: ${userMessage}`);
      }

      // Return the PIX data to the client
      res.json({
        qrCodeBase64: qrCodeBase64,
        qrCode: pixData.qr_code,
        txid: pixTxid, // Return REAL PIX ID for frontend polling
        status: pixData.status,
        amount: sanitizedAmount, // Return discounted amount for UI
        amountCents: amountInCents, // Also provide cents for reference
        originalAmount: originalAmount, // Original price before discount
        discount: discount, // Discount percentage
        discountAmount: originalAmount - sanitizedAmount, // Amount saved
        isDemoMode: isUsingDemoMode, // Inform frontend if in demo mode
        maintenanceMessage: userMessage, // User-friendly message
      });

      console.log(`✅ [PIX Payment] PIX generated ${isUsingDemoMode ? '(DEMO MODE)' : 'successfully'} - Client will poll with TXID: ${pixTxid}`);
    } catch (error: any) {
      // Comprehensive error logging for debugging
      console.error("========================================");
      console.error("❌ [PIX ERROR] Generate PIX failed!");
      console.error("========================================");
      
      // Log error details
      console.error("Error Type:", error?.constructor?.name || "Unknown");
      console.error("Error Message:", error?.message || "No message");
      console.error("Error Code:", error?.code || "No code");
      
      // Log full error object
      console.error("Full Error Object:", JSON.stringify(error, null, 2));
      
      // Log stack trace if available
      if (error?.stack) {
        console.error("Stack Trace:");
        console.error(error.stack);
      }
      
      // Log session information (safely)
      console.error("\n--- Session Debug Info ---");
      console.error("Session ID Exists:", !!req.session);
      console.error("User ID:", req.session?.userId || "NO USER ID");
      console.error("Is Admin:", req.session?.isAdmin || false);
      
      // Log environment variables status (without exposing sensitive values)
      console.error("\n--- Environment Check ---");
      console.error("NODE_ENV:", process.env.NODE_ENV || "not set");
      console.error("PUSHINPAY_TOKEN configured:", !!process.env.PUSHINPAY_TOKEN);
      console.error("PUSHINPAY_WEBHOOK_SECRET configured:", !!process.env.PUSHINPAY_WEBHOOK_SECRET);
      console.error("USE_PUSHINPAY_DEMO:", process.env.USE_PUSHINPAY_DEMO || "not set");
      console.error("REPLIT_DEV_DOMAIN:", process.env.REPLIT_DEV_DOMAIN || "not set");
      console.error("SESSION_SECRET configured:", !!process.env.SESSION_SECRET);
      console.error("DATABASE_URL configured:", !!process.env.DATABASE_URL);
      
      // Log request details
      console.error("\n--- Request Debug Info ---");
      console.error("Request Method:", req.method);
      console.error("Request Path:", req.path);
      console.error("Request Body:", JSON.stringify(req.body, null, 2));
      console.error("Request Headers (relevant):", {
        "content-type": req.headers["content-type"],
        "user-agent": req.headers["user-agent"],
        "x-forwarded-for": req.headers["x-forwarded-for"],
        "x-real-ip": req.headers["x-real-ip"]
      });
      
      // Check specific error scenarios
      let errorResponse = { error: "Erro ao gerar PIX", details: null as any };
      
      // Check if it's a session/auth issue
      if (!req.session?.userId) {
        console.error("🚨 ERROR CAUSE: No user ID in session - Authentication issue!");
        errorResponse.details = "Session authentication problem";
      }
      
      // Check if it's a database/storage error
      else if (error?.message?.toLowerCase().includes("storage") || 
               error?.message?.toLowerCase().includes("database") ||
               error?.code === "ECONNREFUSED") {
        console.error("🚨 ERROR CAUSE: Database/Storage operation failed!");
        errorResponse.details = "Database connection or operation issue";
      }
      
      // Check if it's an environment variable issue
      else if (error?.message?.toLowerCase().includes("env") ||
               error?.message?.toLowerCase().includes("undefined")) {
        console.error("🚨 ERROR CAUSE: Possible missing environment variable!");
        errorResponse.details = "Configuration issue";
      }
      
      // Check if it's a network/API error
      else if (error?.message?.toLowerCase().includes("fetch") ||
               error?.message?.toLowerCase().includes("network") ||
               error?.message?.toLowerCase().includes("timeout")) {
        console.error("🚨 ERROR CAUSE: Network/API communication error!");
        errorResponse.details = "External API communication issue";
      }
      
      // Check if it's a validation error
      else if (error?.message?.toLowerCase().includes("invalid") ||
               error?.message?.toLowerCase().includes("validation")) {
        console.error("🚨 ERROR CAUSE: Data validation error!");
        errorResponse.details = "Invalid data or parameters";
      }
      
      // Unknown error
      else {
        console.error("🚨 ERROR CAUSE: Unknown - check full error details above");
        errorResponse.details = "Unknown error - check server logs";
      }
      
      console.error("\n========================================");
      console.error("Timestamp:", new Date().toISOString());
      console.error("========================================\n");
      
      // Return error with more context (but don't expose sensitive info)
      res.status(500).json(errorResponse);
    }
  });

  // Admin: Get all payments
  app.get("/api/admin/payments", requireAdmin, async (req, res) => {
    try {
      const payments = await storage.getAllPayments();
      
      // Enrich with user emails
      const paymentsWithUsers = await Promise.all(
        payments.map(async (payment) => {
          const user = await storage.getUser(payment.userId);
          return {
            ...payment,
            userEmail: user?.email || "Unknown",
          };
        })
      );

      res.json(paymentsWithUsers);
    } catch (error) {
      console.error("Get all payments error:", error);
      res.status(500).json({ error: "Erro ao buscar pagamentos" });
    }
  });

  // Admin: Export payments to CSV
  app.get("/api/admin/payments/export", requireAdmin, async (req, res) => {
    try {
      const payments = await storage.getAllPayments();
      
      // Enrich with user emails and service names
      const paymentsWithDetails = await Promise.all(
        payments.map(async (payment) => {
          const user = await storage.getUser(payment.userId);
          const service = payment.serviceId ? await storage.getService(payment.serviceId) : null;
          return {
            ...payment,
            userEmail: user?.email || "Unknown",
            serviceName: service?.nome || "N/A",
          };
        })
      );

      // Sort by date descending
      paymentsWithDetails.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Create CSV header
      const csvHeader = [
        "ID Transação",
        "Data",
        "Hora",
        "Email Usuário",
        "Serviço",
        "Valor (R$)",
        "Status",
        "Método",
        "ID Pagamento"
      ].join(",");

      // Create CSV rows
      const csvRows = paymentsWithDetails.map(payment => {
        const date = new Date(payment.createdAt);
        const formattedDate = date.toLocaleDateString("pt-BR");
        const formattedTime = date.toLocaleTimeString("pt-BR");
        const amount = (parseFloat(payment.amount) / 100).toFixed(2).replace(".", ",");
        
        // Map status to Portuguese
        const statusMap: { [key: string]: string } = {
          "pending": "Pendente",
          "completed": "Concluído",
          "paid": "Pago",
          "failed": "Falhou",
          "cancelled": "Cancelado"
        };
        const status = statusMap[payment.status] || payment.status;
        
        return [
          payment.txid || payment.id,
          formattedDate,
          formattedTime,
          payment.userEmail,
          payment.serviceName,
          amount,
          status,
          "PIX",
          payment.id
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(",");
      });

      // Combine header and rows
      const csv = [csvHeader, ...csvRows].join("\n");

      // Set response headers for file download
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="pagamentos-${new Date().toISOString().split("T")[0]}.csv"`
      );
      
      // Add BOM for Excel UTF-8 compatibility
      const bom = "\uFEFF";
      res.send(bom + csv);
      
      console.log(`✅ [ADMIN] Payments exported by admin ${req.session.userId}`);
    } catch (error) {
      console.error("Export payments error:", error);
      res.status(500).json({ error: "Erro ao exportar pagamentos" });
    }
  });

  // Admin: Delete payment (only pending or failed payments)
  app.delete("/api/admin/payments/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get payment to check status
      const payment = await storage.getPayment(id);
      if (!payment) {
        return res.status(404).json({ error: "Pagamento não encontrado" });
      }

      // Only allow deletion of pending or failed payments
      if (payment.status !== "pending" && payment.status !== "failed") {
        return res.status(400).json({ 
          error: "Apenas pagamentos pendentes ou falhados podem ser excluídos" 
        });
      }

      // Delete the payment
      const deleted = await storage.deletePayment(id);
      if (!deleted) {
        return res.status(500).json({ error: "Erro ao excluir pagamento" });
      }

      console.log(`✅ [ADMIN] Payment ${id} deleted by admin ${req.session.userId}`);
      res.json({ success: true, message: "Pagamento excluído com sucesso" });
    } catch (error) {
      console.error("Delete payment error:", error);
      res.status(500).json({ error: "Erro ao excluir pagamento" });
    }
  });

  // Admin: Test email system (manual trigger)
  app.post("/api/admin/test-email", requireAdmin, async (req, res) => {
    try {
      const { type, email } = req.body;
      
      if (!type || !email) {
        return res.status(400).json({ 
          error: "Missing required fields: type (tomorrow|today|blocked) and email" 
        });
      }

      let template;
      let success = false;

      switch (type) {
        case "tomorrow":
          template = emailTemplates.paymentDueTomorrow(email.split('@')[0]);
          success = await sendEmail({
            to: email,
            subject: template.subject,
            html: template.html,
          });
          break;

        case "today":
          template = emailTemplates.paymentDueInTwoDays(email.split('@')[0]);
          success = await sendEmail({
            to: email,
            subject: template.subject,
            html: template.html,
          });
          break;

        case "blocked":
          template = emailTemplates.accessBlocked(email.split('@')[0]);
          success = await sendEmail({
            to: email,
            subject: template.subject,
            html: template.html,
          });
          break;

        default:
          return res.status(400).json({ 
            error: "Invalid type. Must be: tomorrow, today, or blocked" 
          });
      }

      if (success) {
        res.json({ 
          success: true, 
          message: `Test email sent successfully to ${email}`,
          type 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: "Failed to send email. Check server logs and RESEND_API_KEY configuration." 
        });
      }
    } catch (error) {
      console.error("Test email error:", error);
      res.status(500).json({ error: "Erro ao enviar email de teste" });
    }
  });

  // Admin: Create user and send password creation email
  app.post("/api/admin/users/create-and-send-email", requireAdmin, async (req, res) => {
    try {
      // Validate request body with Zod
      const createUserEmailSchema = z.object({
        email: z.string().email("Email inválido"),
        status: z.enum(["ATIVO", "PENDENTE", "INATIVO", "BLOQUEADO"]).optional(),
        sendEmail: z.boolean().optional().default(true),
        password: z.string().optional(),
      }).refine((data) => {
        // If not sending email, password is required and must be at least 6 characters
        if (data.sendEmail === false && (!data.password || data.password.length < 6)) {
          return false;
        }
        return true;
      }, {
        message: "Senha é obrigatória (mínimo 6 caracteres) quando o envio de email está desativado",
        path: ["password"],
      });

      const validatedData = createUserEmailSchema.parse(req.body);
      const { email, status, sendEmail: shouldSendEmail, password } = validatedData;

      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email já cadastrado" });
      }

      // Hash password if provided
      let hashedPassword = null;
      if (password && !shouldSendEmail) {
        hashedPassword = await bcrypt.hash(password, 10);
      }

      // Create user with or without password
      const user = await storage.createUser({
        email,
        password: hashedPassword, // Will be null if sending email, or hashed password if manual
        status: status || (shouldSendEmail ? "PENDENTE" : "ATIVO"), // Default to ATIVO if password is set manually
        isAdmin: false,
        discount: 0, // Default discount
      });

      // Only create password reset token and send email if shouldSendEmail is true
      if (shouldSendEmail) {
        // Generate secure token
        const token = crypto.randomBytes(32).toString("hex");

        // Create password reset token (valid for 24 hours)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        await storage.createPasswordReset({
          userId: user.id,
          token,
          expiresAt,
        });

        // Send email with password creation link
        const template = emailTemplates.createPassword(email, token);
        const emailSent = await sendEmail({
          to: email,
          subject: template.subject,
          html: template.html,
        });

        if (!emailSent) {
          // User was created but email failed - still return success but warn
          console.warn(`⚠️  User created but email failed to send to ${email}`);
          return res.json({
            success: true,
            user: { id: user.id, email: user.email, status: user.status },
            emailSent: false,
            warning: "Usuário criado mas o email não pôde ser enviado. Configure RESEND_API_KEY.",
          });
        }

        console.log(`✅ [CREATE-USER] User created and email sent to ${email}`);

        res.json({
          success: true,
          user: { id: user.id, email: user.email, status: user.status },
          emailSent: true,
          message: `Usuário criado! Um email foi enviado para ${email} com instruções para criar a senha.`,
        });
      } else {
        // User created with manual password, no email sent
        console.log(`✅ [CREATE-USER] User created with manual password for ${email}`);

        res.json({
          success: true,
          user: { id: user.id, email: user.email, status: user.status },
          emailSent: false,
          message: `Usuário criado com senha definida manualmente.`,
        });
      }
    } catch (error: any) {
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        const firstError = error.errors[0];
        return res.status(400).json({ error: firstError.message });
      }
      console.error("Create user and send email error:", error);
      res.status(500).json({ error: "Erro ao criar usuário e enviar email" });
    }
  });

  // Admin: Simulate payment (for testing)
  app.post("/api/admin/simulate-payment", requireAdmin, async (req, res) => {
    try {
      const { userId, amount } = req.body;

      if (!userId || !amount) {
        return res.status(400).json({ 
          error: "Missing required fields: userId and amount (in cents)" 
        });
      }

      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Create payment record with PAID status
      const payment = await storage.createPayment({
        userId,
        serviceId: DEFAULT_SERVICE_ID, // Default service for all payments
        amount: amount.toString(),
        status: "paid",
        txid: `SIMULATED-${Date.now()}`,
      });

      // Calculate nextPaymentDate: day 5 of NEXT month
      const nextPaymentDate = new Date();
      nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1); // Next month
      nextPaymentDate.setDate(5); // Day 5
      nextPaymentDate.setHours(0, 0, 0, 0); // Midnight

      // Update user: set status to ATIVO, update ultimoPagamento and nextPaymentDate (for compatibility)
      await storage.updateUser(userId, {
        status: "ATIVO",
        ultimoPagamento: new Date(),
        nextPaymentDate,
      });

      // Also update or create UserService for vectorizer-001
      const serviceId = payment.serviceId || DEFAULT_SERVICE_ID;
      const existingUserService = await storage.getUserService(userId, serviceId);
      
      if (existingUserService) {
        // Update existing UserService
        await storage.updateUserService(existingUserService.id, {
          status: "ATIVO",
          ultimoPagamento: new Date(),
          proximoPagamento: nextPaymentDate,
        });
      } else {
        // Create new UserService
        await storage.createUserService({
          userId,
          serviceId: serviceId,
          status: "ATIVO",
          ultimoPagamento: new Date(),
          proximoPagamento: nextPaymentDate,
        });
      }

      console.log(`✅ [SIMULATE-PAYMENT] User ${user.email} payment simulated. Next payment: ${nextPaymentDate.toISOString().split('T')[0]}`);

      res.json({ 
        success: true, 
        message: `Payment simulated for user ${user.email}`,
        payment,
        nextPaymentDate: nextPaymentDate.toISOString(),
      });
    } catch (error) {
      console.error("Simulate payment error:", error);
      res.status(500).json({ error: "Erro ao simular pagamento" });
    }
  });

  // Admin: Manual trigger for cron jobs (testing)
  // All payments are due on DAY 5 of each month
  app.post("/api/admin/trigger-cron", requireAdmin, async (req, res) => {
    try {
      const { action } = req.body;

      if (!action) {
        return res.status(400).json({ 
          error: "Missing required field: action (day3|day4|day6)" 
        });
      }

      let result;
      
      switch (action) {
        case "day3":
        case "pre-reminder":
          await manualTriggers.sendPaymentPreReminderEmails();
          result = "Day 3: Pre-reminder emails triggered (payment due in 2 days)";
          break;

        case "day4":
        case "final-warning":
          await manualTriggers.sendPaymentFinalWarningEmails();
          result = "Day 4: Final warning emails triggered (payment due tomorrow - day 5)";
          break;

        case "day6":
        case "block":
          await manualTriggers.blockOverdueUsers();
          result = "Day 6: Block overdue users triggered";
          break;

        default:
          return res.status(400).json({ 
            error: "Invalid action. Must be: day3, day4, or day6 (or: pre-reminder, final-warning, block)" 
          });
      }

      res.json({ 
        success: true, 
        message: result,
        note: "Check server logs for detailed execution results. All payments are due on DAY 5 of each month."
      });
    } catch (error) {
      console.error("Manual cron trigger error:", error);
      res.status(500).json({ error: "Erro ao executar cron manualmente" });
    }
  });

  // Webhook from PushinPay (with rate limiting and strict authentication)
  app.post("/api/webhook/pushinpay", webhookRateLimiter, async (req, res) => {
    try {
      // Log webhook receipt for debugging
      console.log("📨 Webhook received from PushinPay");
      
      // SECURITY: Strict authentication required - X-Token header is MANDATORY
      const secret = process.env.PUSHINPAY_WEBHOOK_SECRET?.trim();
      
      // If no secret is configured, reject all webhook requests (fail safe)
      if (!secret) {
        console.error("❌ WEBHOOK REJECTED: PUSHINPAY_WEBHOOK_SECRET not configured");
        return res.status(403).json({ error: "Forbidden: Webhook authentication not configured" });
      }
      
      // SECURITY: Check for authentication header - REQUIRED
      const xTokenLower = req.headers['x-token'] as string | undefined;
      const xTokenUpper = req.headers['X-Token'] as string | undefined;
      const authLower = req.headers['authorization'] as string | undefined;
      const authUpper = req.headers['Authorization'] as string | undefined;
      const receivedToken = xTokenLower || xTokenUpper || authLower || authUpper;
      
      // STRICT AUTHENTICATION: X-Token header is MANDATORY
      if (!receivedToken) {
        console.error("❌ WEBHOOK REJECTED: Missing X-Token header");
        return res.status(403).json({ error: "Forbidden: Missing authentication header" });
      }
      
      // Validate the provided token
      const normalizedReceived = receivedToken.replace(/[\s\n\r\t]+/g, ' ').trim();
      const expectedDirect = secret;
      const expectedBearer = `Bearer ${secret}`;
      
      // Helper function for constant-time comparison
      const isTokenValid = (received: string, expected: string): boolean => {
        if (received.length !== expected.length) return false;
        try {
          const receivedBuf = Buffer.from(received, 'utf8');
          const expectedBuf = Buffer.from(expected, 'utf8');
          return crypto.timingSafeEqual(receivedBuf, expectedBuf);
        } catch {
          return false;
        }
      };
      
      // Try all valid authentication formats
      let isValid = false;
      let authMethod = "";
      
      if (isTokenValid(normalizedReceived, expectedDirect)) {
        isValid = true;
        authMethod = "x-token";
      } else if (isTokenValid(normalizedReceived, expectedBearer)) {
        isValid = true;
        authMethod = "authorization-bearer";
      } else if (normalizedReceived.startsWith("Bearer ")) {
        const tokenWithoutBearer = normalizedReceived.substring(7).trim();
        if (isTokenValid(tokenWithoutBearer, expectedDirect)) {
          isValid = true;
          authMethod = "authorization-stripped";
        }
      }
      
      // STRICT: If authentication fails, reject the request immediately
      if (!isValid) {
        console.error("❌ WEBHOOK REJECTED: Invalid X-Token header");
        console.error("⚠️  Header was sent but doesn't match PUSHINPAY_WEBHOOK_SECRET");
        return res.status(403).json({ error: "Forbidden: Invalid authentication token" });
      }
      
      console.log(`✅ Webhook authenticated successfully via ${authMethod}`);
      
      // Log webhook body for debugging
      console.log("📦 Webhook received body:", JSON.stringify(req.body));
      
      // CRITICAL: PushinPay may send TXID in various field names
      // Function to normalize and find TXID from multiple possible field names
      const findTxidFromBody = (body: any): string | null => {
        // First, prioritize finding our TXID or PushinPay's transaction_id
        const primaryFields = [
          'txid',
          'transaction_id',
          'transactionId',
          'id', // PushinPay often sends their ID here
        ];
        
        for (const field of primaryFields) {
          if (body[field]) {
            console.log(`✅ Found TXID in primary field '${field}': ${body[field]}`);
            return body[field];
          }
        }
        
        // Then check EndToEndId variations (less common)
        const endToEndFields = [
          'EndToEndId',
          'endToEndId',
          'end_to_end_id',
          'endToEndID',
          'endTo_endID',
          'endTo_end_id',
          'e2eid',
          'E2EID',
          'EndToEndID',
          'endtoendid',
          'ENDTOENDID',
          'end2endId',
          'end2end_id',
          'e2e_id',
          'transaction_code',
          'transactionCode',
          'tx_id',
          'txId',
          'TXID',
        ];
        
        // Check each EndToEnd field name
        for (const field of endToEndFields) {
          if (body[field]) {
            console.log(`✅ Found TXID in EndToEnd field '${field}': ${body[field]}`);
            return body[field];
          }
        }
        
        // If not found in direct fields, try nested objects
        if (body.transaction?.id) {
          console.log(`✅ Found TXID in nested 'transaction.id': ${body.transaction.id}`);
          return body.transaction.id;
        }
        if (body.payment?.txid) {
          console.log(`✅ Found TXID in nested 'payment.txid': ${body.payment.txid}`);
          return body.payment.txid;
        }
        if (body.data?.endToEndId) {
          console.log(`✅ Found TXID in nested 'data.endToEndId': ${body.data.endToEndId}`);
          return body.data.endToEndId;
        }
        
        return null;
      };
      
      // Extract status and TXID using normalizer function
      const { status } = req.body;
      const receivedTxid = findTxidFromBody(req.body);
      
      if (!receivedTxid) {
        console.error("❌ Webhook missing TXID. Searched all possible fields.");
        console.error("📋 Available fields in body:", Object.keys(req.body));
        return res.status(400).json({ error: "Missing TXID" });
      }
      
      console.log(`🔍 [WEBHOOK] Normalized TXID: ${receivedTxid}`);
      console.log(`📊 [WEBHOOK] Processing webhook - TXID: ${receivedTxid}, Status: ${status}`);
      
      // Normalize status to lowercase for comparison
      const normalizedStatus = status?.toLowerCase();
      
      // CRITICAL: PushinPay uses CONFIRMED status (not just "paid")
      // Possible statuses: "created" | "paid" | "pago" | "confirmed" | "CONFIRMED" | "canceled"
      if (normalizedStatus === "paid" || normalizedStatus === "pago" || 
          normalizedStatus === "confirmed") {
        console.log(`💰 [WEBHOOK] Payment confirmation received for ID: ${receivedTxid}`);
        
        // DUAL ID STRATEGY: Try to find payment by txid first, then by pushinpayId
        let payment = await storage.getPaymentByTxid(receivedTxid);
        let searchMethod = "txid";
        
        if (!payment) {
          // Try to find by PushinPay ID as fallback
          console.log(`🔍 [WEBHOOK] Payment not found by txid, trying pushinpayId: ${receivedTxid}`);
          payment = await storage.getPaymentByPushinpayId(receivedTxid);
          searchMethod = "pushinpayId";
        }
        
        if (!payment) {
          // Log all payments for debugging
          const allPayments = await storage.getAllPayments();
          console.log(`🔎 [WEBHOOK] Current payments in database:`);
          allPayments.slice(-5).forEach(p => {
            console.log(`  - Payment ${p.id}: txid=${p.txid}, pushinpayId=${p.pushinpayId}, status=${p.status}`);
          });
          
          console.error(`❌ [WEBHOOK] Payment not found for ID: ${receivedTxid} (tried both txid and pushinpayId)`);
          // Return 200 to prevent PushinPay retries for unknown transactions
          return res.json({ success: true, message: "Payment not found" });
        }
        
        console.log(`✅ [WEBHOOK] Payment found via ${searchMethod}! 
          - Payment ID: ${payment.id}
          - TXID: ${payment.txid}
          - PushinPay ID: ${payment.pushinpayId}
          - Current Status: ${payment.status}`)

        // Check if payment is already processed (idempotency)
        if (payment.status === "paid") {
          console.log(`Payment ${payment.id} already processed (idempotent check)`);
          return res.json({ success: true, message: "Already processed" });
        }
        
        console.log(`Payment confirmed for txid: ${receivedTxid}, user: ${payment.userId}`);
        
        // Update payment status
        await storage.updatePayment(payment.id, { status: "paid" });
        
        // Mark all other pending payments for the same user and service as expired/canceled
        const serviceId = payment.serviceId || DEFAULT_SERVICE_ID;
        await storage.markOldPendingPaymentsAsExpired(payment.userId, serviceId, payment.id);
        console.log(`🚫 [WEBHOOK] Marked all other pending payments as expired for user ${payment.userId} and service ${serviceId}`);
        
        // Calculate next payment date: Always day 5 of next month
        const nextPaymentDate = new Date();
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1); // Next month
        nextPaymentDate.setDate(5); // Day 5
        nextPaymentDate.setHours(0, 0, 0, 0); // Start of day
        
        // Update user status, payment date, and next payment date (for compatibility)
        await storage.updateUser(payment.userId, {
          status: "ATIVO",
          ultimoPagamento: new Date(),
          nextPaymentDate: nextPaymentDate, // Set next vencimento (day 5 of next month)
        });
        
        // Get existing user_service to update it
        const existingUserService = await storage.getUserService(payment.userId, serviceId);
        
        // Get credits from plan if planId is provided
        let creditsToAdd = 0;
        if (payment.planId) {
          const plan = await storage.getServicePlan(payment.planId);
          // Extract credits from features if available (for RemoveBG plans)
          if (plan && plan.features) {
            try {
              const features = typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features;
              // Look for credits in features array
              const creditFeature = features.find((f: string) => f.includes('créditos') || f.includes('credits'));
              if (creditFeature) {
                const match = creditFeature.match(/\d+/);
                if (match) {
                  creditsToAdd = parseInt(match[0], 10);
                }
              }
            } catch (e) {
              console.error("Error parsing plan features:", e);
            }
          }
        }
        
        if (existingUserService) {
          // Update existing UserService with planId and activate it
          await storage.updateUserService(existingUserService.id, {
            status: "ATIVO",
            ultimoPagamento: new Date(),
            proximoPagamento: nextPaymentDate,
            planId: payment.planId || existingUserService.planId,
            lastPaymentDate: new Date(),
            credits: creditsToAdd > 0 ? creditsToAdd : existingUserService.credits,
            creditsAvailable: creditsToAdd > 0 ? creditsToAdd : existingUserService.creditsAvailable
          });
          console.log(`UserService ${existingUserService.id} updated for user ${payment.userId} and service ${serviceId} with planId: ${payment.planId}`);
        } else {
          // Create new UserService if it doesn't exist (backward compatibility)
          const userService = await storage.createUserService({
            userId: payment.userId,
            serviceId: serviceId,
            status: "ATIVO",
            ultimoPagamento: new Date(),
            proximoPagamento: nextPaymentDate,
            planId: payment.planId || null,
            lastPaymentDate: new Date(),
            credits: creditsToAdd,
            creditsAvailable: creditsToAdd
          });
          console.log(`UserService ${userService.id} created for user ${payment.userId} and service ${serviceId} with planId: ${payment.planId}`);
        }
        
        // Mark old pending payments as expired (except this one)
        await storage.markOldPendingPaymentsAsExpired(
          payment.userId,
          serviceId,
          payment.id
        );
        
        console.log(`User ${payment.userId} activated successfully (next payment: ${nextPaymentDate.toISOString().split('T')[0]} - day 5 of next month)`);
        
        res.json({ success: true, message: "Payment processed" });
      } else if (normalizedStatus === "canceled" || normalizedStatus === "cancelled" || normalizedStatus === "failed" || normalizedStatus === "expired") {
        // Handle canceled, cancelled, failed, and expired statuses
        console.log(`❌ [WEBHOOK] Payment cancellation/failure/expiration received for ID: ${receivedTxid}`);
        
        // DUAL ID STRATEGY: Try to find payment by txid first, then by pushinpayId
        let payment = await storage.getPaymentByTxid(receivedTxid);
        let searchMethod = "txid";
        
        if (!payment) {
          // Try to find by PushinPay ID as fallback
          console.log(`🔍 [WEBHOOK] Payment not found by txid, trying pushinpayId: ${receivedTxid}`);
          payment = await storage.getPaymentByPushinpayId(receivedTxid);
          searchMethod = "pushinpayId";
        }
        
        if (payment && payment.status !== "failed") {
          console.log(`⚠️ [WEBHOOK] Payment ${payment.id} marked as failed/canceled (found via ${searchMethod})`);
          await storage.updatePayment(payment.id, { status: "failed" });
        } else if (!payment) {
          console.log(`⚠️ [WEBHOOK] Payment not found for canceled/failed transaction: ${receivedTxid}`);
        }
        
        res.json({ success: true, message: "Payment failed/canceled" });
      } else if (normalizedStatus === "created") {
        // Payment created, waiting for payment - no action needed
        console.log(`Payment created (pending): ${receivedTxid}`);
        res.json({ success: true, message: "Payment created" });
      } else {
        console.log(`Unhandled payment status: ${status} for txid: ${receivedTxid}`);
        res.json({ success: true, message: "Status noted" });
      }
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: "Erro ao processar webhook" });
    }
  });

  // ========== ADMIN REMOVEBG ROUTES ==========
  
  // GET /api/admin/removebg/usage - Get all users' RemoveBG usage
  app.get("/api/admin/removebg/usage", requireAdmin, async (req, res) => {
    try {
      // Get query parameters for filtering
      const { userId, limit = 100, offset = 0 } = req.query;
      
      let allUsage = await storage.getAllRemoveBgUsage();
      
      // Filter by user if specified
      if (userId && typeof userId === 'string') {
        allUsage = allUsage.filter(u => u.userId === userId);
      }
      
      // Sort by creation date (newest first)
      allUsage.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Apply pagination
      const limitNum = parseInt(limit as string);
      const offsetNum = parseInt(offset as string);
      const paginatedUsage = allUsage.slice(offsetNum, offsetNum + limitNum);
      
      // Add user emails to the response
      const usageWithUsers = await Promise.all(
        paginatedUsage.map(async (usage) => {
          const user = await storage.getUser(usage.userId);
          return {
            ...usage,
            userEmail: user?.email || 'Unknown'
          };
        })
      );
      
      res.json({
        data: usageWithUsers,
        total: allUsage.length,
        limit: limitNum,
        offset: offsetNum
      });
    } catch (error) {
      console.error("Error fetching RemoveBG usage:", error);
      res.status(500).json({ error: "Failed to fetch RemoveBG usage" });
    }
  });

  // GET /api/admin/removebg/subscriptions - Get all RemoveBG subscriptions
  app.get("/api/admin/removebg/subscriptions", requireAdmin, async (req, res) => {
    try {
      const REMOVEBG_SERVICE_ID = "removebg-001";
      
      // Get all user services for RemoveBG
      const userServices = await storage.getUserServicesByServiceId(REMOVEBG_SERVICE_ID);
      
      // Enrich with user data and usage statistics
      const subscriptionsData = await Promise.all(
        userServices.map(async (userService) => {
          const user = await storage.getUser(userService.userId);
          const usage = await storage.getRemoveBgUsageByUserId(userService.userId);
          
          // Calculate credits used this month
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthlyUsage = usage.filter(u => 
            new Date(u.createdAt) >= startOfMonth
          );
          const creditsUsedThisMonth = monthlyUsage.reduce((sum, u) => sum + u.creditsUsed, 0);
          
          return {
            id: userService.id,
            userId: userService.userId,
            userEmail: user?.email || 'Unknown',
            status: userService.status,
            creditsAvailable: userService.creditsAvailable || 0,
            creditsUsedThisMonth,
            totalCreditsUsed: usage.reduce((sum, u) => sum + u.creditsUsed, 0),
            lastPayment: userService.ultimoPagamento,
            nextPayment: userService.proximoPagamento,
            createdAt: userService.createdAt,
          };
        })
      );
      
      res.json({ data: subscriptionsData });
    } catch (error) {
      console.error("Error fetching RemoveBG subscriptions:", error);
      res.status(500).json({ error: "Failed to fetch RemoveBG subscriptions" });
    }
  });

  // PATCH /api/admin/removebg/credits/:userId - Adjust user credits manually
  app.patch("/api/admin/removebg/credits/:userId", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { credits, reason } = req.body;
      
      if (typeof credits !== 'number' || credits < 0) {
        return res.status(400).json({ error: "Invalid credits value" });
      }
      
      const REMOVEBG_SERVICE_ID = "removebg-001";
      
      // Update the user's credits
      const updated = await storage.updateUserCredits(userId, REMOVEBG_SERVICE_ID, credits);
      
      if (!updated) {
        return res.status(404).json({ error: "User service not found" });
      }
      
      // Log the adjustment (could be stored in a separate audit table in the future)
      console.log(`Admin adjusted credits for user ${userId}: ${credits} credits. Reason: ${reason || 'No reason provided'}`);
      
      res.json({ 
        success: true, 
        userId, 
        newCredits: credits,
        reason 
      });
    } catch (error) {
      console.error("Error adjusting user credits:", error);
      res.status(500).json({ error: "Failed to adjust credits" });
    }
  });

  // GET /api/admin/removebg/stats - Get usage statistics
  app.get("/api/admin/removebg/stats", requireAdmin, async (req, res) => {
    try {
      const allUsage = await storage.getAllRemoveBgUsage();
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Filter usage for this month
      const monthlyUsage = allUsage.filter(u => 
        new Date(u.createdAt) >= startOfMonth
      );
      
      // Calculate statistics
      const totalCreditsConsumed = monthlyUsage.reduce((sum, u) => sum + u.creditsUsed, 0);
      const totalImagesProcessed = monthlyUsage.length;
      
      // Get user statistics
      const userStats = new Map<string, number>();
      monthlyUsage.forEach(u => {
        userStats.set(u.userId, (userStats.get(u.userId) || 0) + u.creditsUsed);
      });
      
      // Get top users
      const topUsersArray = Array.from(userStats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      // Fetch user emails for top users
      const topUsers = await Promise.all(
        topUsersArray.map(async ([userId, credits]) => {
          const user = await storage.getUser(userId);
          return {
            userId,
            email: user?.email || 'Unknown',
            creditsUsed: credits
          };
        })
      );
      
      const averageCreditsPerUser = userStats.size > 0 
        ? Math.round(totalCreditsConsumed / userStats.size)
        : 0;
      
      // Get daily usage for chart
      const dailyUsage = new Map<string, number>();
      monthlyUsage.forEach(u => {
        const date = new Date(u.createdAt).toISOString().split('T')[0];
        dailyUsage.set(date, (dailyUsage.get(date) || 0) + u.creditsUsed);
      });
      
      const dailyUsageArray = Array.from(dailyUsage.entries())
        .map(([date, credits]) => ({ date, credits }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      res.json({
        totalCreditsConsumed,
        totalImagesProcessed,
        averageCreditsPerUser,
        uniqueUsers: userStats.size,
        topUsers,
        dailyUsage: dailyUsageArray
      });
    } catch (error) {
      console.error("Error fetching RemoveBG stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // ========== SERVICE MANAGEMENT ROUTES ==========

  // Get service details with subscribers
  app.get("/api/admin/services/:serviceId", requireAdmin, async (req, res) => {
    try {
      const { serviceId } = req.params;
      const service = await storage.getService(serviceId);
      
      if (!service) {
        return res.status(404).json({ error: "Serviço não encontrado" });
      }

      // Get subscribers for this service
      const userServices = await storage.getUserServicesByServiceId(serviceId);
      
      // Enrich with user data
      const subscribers = await Promise.all(
        userServices.map(async (us) => {
          const user = await storage.getUser(us.userId);
          return {
            ...us,
            user: user ? {
              id: user.id,
              email: user.email,
              status: user.status,
            } : undefined,
          };
        })
      );

      res.json({
        ...service,
        subscribers,
      });
    } catch (error) {
      console.error("Error fetching service details:", error);
      res.status(500).json({ error: "Erro ao buscar detalhes do serviço" });
    }
  });

  // Get credentials for a specific service
  app.get("/api/admin/services/:serviceId/credentials", requireAdmin, async (req, res) => {
    try {
      const { serviceId } = req.params;
      const credentials = await storage.getCredentialsByServiceId(serviceId);
      res.json(credentials);
    } catch (error) {
      console.error("Error fetching service credentials:", error);
      res.status(500).json({ error: "Erro ao buscar credenciais do serviço" });
    }
  });

  // Get usage data for a service (currently only for RemoveBG)
  app.get("/api/admin/services/:serviceId/usage", requireAdmin, async (req, res) => {
    try {
      const { serviceId } = req.params;
      
      if (serviceId === "removebg-001") {
        const allUsage = await storage.getAllRemoveBgUsage();
        
        // Add user data
        const usageWithUsers = await Promise.all(
          allUsage.map(async (usage) => {
            const user = await storage.getUser(usage.userId);
            return {
              ...usage,
              user: user ? {
                id: user.id,
                email: user.email,
              } : undefined,
            };
          })
        );
        
        // Sort by date desc
        usageWithUsers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        res.json(usageWithUsers.slice(0, 100)); // Return last 100 entries
      } else {
        res.json([]);
      }
    } catch (error) {
      console.error("Error fetching service usage:", error);
      res.status(500).json({ error: "Erro ao buscar uso do serviço" });
    }
  });

  // Update service details
  app.patch("/api/admin/services/:serviceId", requireAdmin, async (req, res) => {
    try {
      const { serviceId } = req.params;
      const updates = req.body;
      
      // DEBUG: Log para ver o que está sendo recebido
      console.log("🔍 [UPDATE SERVICE] Received updates:", {
        serviceId,
        updates,
        updateKeys: Object.keys(updates),
        types: Object.entries(updates).map(([k, v]) => `${k}: ${typeof v}`)
      });
      
      // Filter out timestamp and id fields that shouldn't be updated
      const processedUpdates = { ...updates };
      delete processedUpdates.id;
      delete processedUpdates.createdAt;
      delete processedUpdates.created_at;
      
      // Garantir que preco seja string se for número
      if (processedUpdates.preco !== undefined && typeof processedUpdates.preco === 'number') {
        processedUpdates.preco = processedUpdates.preco.toString();
      }
      
      console.log("🔄 [UPDATE SERVICE] Processed updates (filtered):", processedUpdates);
      
      const service = await storage.updateService(serviceId, processedUpdates);
      
      if (!service) {
        console.error("❌ [UPDATE SERVICE] Service not found:", serviceId);
        return res.status(404).json({ error: "Serviço não encontrado" });
      }
      
      console.log("✅ [UPDATE SERVICE] Service updated successfully:", service);
      res.json(service);
    } catch (error) {
      console.error("❌ [UPDATE SERVICE] Error updating service:", error);
      console.error("Stack trace:", error.stack);
      res.status(500).json({ error: "Erro ao atualizar serviço", details: error.message });
    }
  });

  // Toggle user service status (activate/deactivate)
  app.patch("/api/admin/services/:serviceId/users/:userId/status", requireAdmin, async (req, res) => {
    try {
      const { serviceId, userId } = req.params;
      const { status } = req.body;
      
      if (!["ATIVO", "INATIVO", "BLOQUEADO"].includes(status)) {
        return res.status(400).json({ error: "Status inválido" });
      }
      
      const userService = await storage.getUserService(userId, serviceId);
      
      if (!userService) {
        return res.status(404).json({ error: "Assinatura não encontrada" });
      }
      
      const updated = await storage.updateUserService(userService.id, { status });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating user service status:", error);
      res.status(500).json({ error: "Erro ao atualizar status" });
    }
  });

  // Update user's RemoveBG plan and credits
  app.put("/api/admin/services/:serviceId/users/:userId/plan", requireAdmin, async (req, res) => {
    try {
      const { serviceId, userId } = req.params;
      const { planId, credits } = req.body;
      
      // Validate inputs
      if (credits !== undefined && (typeof credits !== 'number' || credits < 0)) {
        return res.status(400).json({ error: "Créditos inválidos" });
      }
      
      // Check if user service exists
      const userService = await storage.getUserService(userId, serviceId);
      if (!userService) {
        return res.status(404).json({ error: "Assinatura não encontrada" });
      }
      
      // Update plan and credits
      const updated = await storage.updateUserServicePlan(userId, serviceId, planId, credits);
      
      if (!updated) {
        return res.status(500).json({ error: "Erro ao atualizar plano" });
      }
      
      // Get the updated service with plan details
      const updatedWithPlan = await storage.getUserServiceWithPlan(userId, serviceId);
      
      res.json(updatedWithPlan);
    } catch (error) {
      console.error("Error updating user plan:", error);
      res.status(500).json({ error: "Erro ao atualizar plano do usuário" });
    }
  });

  // Add user subscription manually
  app.post("/api/admin/services/:serviceId/subscribe", requireAdmin, async (req, res) => {
    try {
      const { serviceId } = req.params;
      const { email, status = "ATIVO" } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email é obrigatório" });
      }
      
      // Check if service exists
      const service = await storage.getService(serviceId);
      if (!service) {
        return res.status(404).json({ error: "Serviço não encontrado" });
      }
      
      // Get user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      // Check if user is already subscribed
      const existingSubscription = await storage.getUserService(user.id, serviceId);
      if (existingSubscription) {
        return res.status(400).json({ error: "Usuário já está assinado neste serviço" });
      }
      
      // Calculate next payment date (day 5 of next month)
      const today = new Date();
      const nextPaymentDate = new Date(today.getFullYear(), today.getMonth() + 1, 5);
      
      // Create subscription
      const userService = await storage.createUserService({
        userId: user.id,
        serviceId,
        status,
        ultimoPagamento: status === "ATIVO" ? new Date() : null,
        proximoPagamento: nextPaymentDate,
      });
      
      // If service is ATIVO, also update user's legacy status for backward compatibility
      if (serviceId === "vectorizer-001" && status === "ATIVO") {
        await storage.updateUser(user.id, { 
          status: "ATIVO",
          ultimoPagamento: new Date()
        });
      }
      
      res.json({
        userService,
        user: {
          id: user.id,
          email: user.email,
          status: user.status
        }
      });
    } catch (error) {
      console.error("Error adding subscription:", error);
      res.status(500).json({ error: "Erro ao adicionar assinatura" });
    }
  });

  // Get all services (for admin listing)
  app.get("/api/admin/services", requireAdmin, async (req, res) => {
    try {
      const services = await storage.getAllServices();
      
      // Add subscriber counts
      const servicesWithCounts = await Promise.all(
        services.map(async (service) => {
          const userServices = await storage.getUserServicesByServiceId(service.id);
          const activeCount = userServices.filter(us => us.status === "ATIVO").length;
          const totalCount = userServices.length;
          
          return {
            ...service,
            activeSubscribers: activeCount,
            totalSubscribers: totalCount,
          };
        })
      );
      
      res.json(servicesWithCounts);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ error: "Erro ao buscar serviços" });
    }
  });

  // ========== REMOVEBG ROUTES ==========
  app.use("/api/removebg", removeBgRoutes);

  // ========== ADMIN SERVICE MANAGEMENT ROUTES ==========
  // Get all services (admin)
  app.get("/api/admin/services", requireAdmin, async (req, res) => {
    try {
      const services = await storage.getAllServices();
      res.json(services);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ error: "Erro ao buscar serviços" });
    }
  });

  // Create new service (admin)
  app.post("/api/admin/services", requireAdmin, async (req, res) => {
    try {
      const { nome, descricao, preco, ativo } = req.body;
      
      if (!nome || !preco) {
        return res.status(400).json({ error: "Nome e preço são obrigatórios" });
      }
      
      const service = await storage.createService({
        nome,
        descricao: descricao || null,
        preco,
        ativo: ativo !== undefined ? ativo : true
      });
      
      res.status(201).json(service);
    } catch (error) {
      console.error("Error creating service:", error);
      res.status(500).json({ error: "Erro ao criar serviço" });
    }
  });

  // Update service (admin)
  app.put("/api/admin/services/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // DEBUG: Log para ver o que está sendo recebido
      console.log("🔍 [UPDATE SERVICE PUT] Received updates:", {
        serviceId: id,
        updates,
        updateKeys: Object.keys(updates),
        types: Object.entries(updates).map(([k, v]) => `${k}: ${typeof v}`)
      });
      
      // Filter out timestamp and id fields that shouldn't be updated
      const processedUpdates = { ...updates };
      delete processedUpdates.id;
      delete processedUpdates.createdAt;
      delete processedUpdates.created_at;
      
      // Garantir que preco seja string se for número
      if (processedUpdates.preco !== undefined && typeof processedUpdates.preco === 'number') {
        processedUpdates.preco = processedUpdates.preco.toString();
      }
      
      console.log("🔄 [UPDATE SERVICE PUT] Processed updates (filtered):", processedUpdates);
      
      const service = await storage.updateService(id, processedUpdates);
      
      if (!service) {
        console.error("❌ [UPDATE SERVICE PUT] Service not found:", id);
        return res.status(404).json({ error: "Serviço não encontrado" });
      }
      
      console.log("✅ [UPDATE SERVICE PUT] Service updated successfully:", service);
      res.json(service);
    } catch (error) {
      console.error("❌ [UPDATE SERVICE PUT] Error updating service:", error);
      console.error("Stack trace:", error.stack);
      res.status(500).json({ error: "Erro ao atualizar serviço", details: error.message });
    }
  });

  // Delete service (admin)
  app.delete("/api/admin/services/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if service has active subscriptions
      const subscriptions = await storage.getUserServicesByServiceId(id);
      const activeSubscriptions = subscriptions.filter(s => s.status === "ATIVO");
      
      if (activeSubscriptions.length > 0) {
        return res.status(400).json({ 
          error: `Não é possível excluir: ${activeSubscriptions.length} assinaturas ativas` 
        });
      }
      
      // First, deactivate the service
      await storage.updateService(id, { ativo: false });
      
      res.json({ success: true, message: "Serviço desativado com sucesso" });
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ error: "Erro ao excluir serviço" });
    }
  });

  // ========== SERVICE PLANS ENDPOINTS ==========
  app.get("/api/admin/service-plans", requireAdmin, async (req, res) => {
    try {
      const { serviceId } = req.query;
      
      let plans;
      if (serviceId && typeof serviceId === 'string') {
        plans = await storage.getServicePlansByServiceId(serviceId);
      } else {
        plans = await storage.getAllServicePlans();
      }
      
      res.json(plans);
    } catch (error) {
      console.error("Error fetching service plans:", error);
      res.status(500).json({ error: "Erro ao buscar planos de serviço" });
    }
  });

  app.post("/api/admin/service-plans", requireAdmin, async (req, res) => {
    try {
      const { insertServicePlanSchema } = await import("@shared/schema");
      
      // Validate request body
      const validation = insertServicePlanSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Dados inválidos", 
          details: validation.error.errors 
        });
      }
      
      // Create the service plan
      const plan = await storage.createServicePlan(validation.data);
      res.status(201).json(plan);
    } catch (error: any) {
      console.error("Error creating service plan:", error);
      if (error.message?.includes("does not exist")) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Erro ao criar plano de serviço" });
      }
    }
  });

  app.put("/api/admin/service-plans/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { updateServicePlanSchema } = await import("@shared/schema");
      
      // Validate request body
      const validation = updateServicePlanSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Dados inválidos", 
          details: validation.error.errors 
        });
      }
      
      // Update the service plan
      const plan = await storage.updateServicePlan(id, validation.data);
      if (!plan) {
        return res.status(404).json({ error: "Plano não encontrado" });
      }
      
      res.json(plan);
    } catch (error) {
      console.error("Error updating service plan:", error);
      res.status(500).json({ error: "Erro ao atualizar plano de serviço" });
    }
  });

  app.delete("/api/admin/service-plans/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if plan exists
      const plan = await storage.getServicePlan(id);
      if (!plan) {
        return res.status(404).json({ error: "Plano não encontrado" });
      }
      
      // TODO: Check if there are active subscriptions using this plan
      // For now, we'll just soft delete it
      const deleted = await storage.deleteServicePlan(id);
      if (!deleted) {
        return res.status(400).json({ error: "Não foi possível deletar o plano" });
      }
      
      res.json({ success: true, message: "Plano desativado com sucesso" });
    } catch (error) {
      console.error("Error deleting service plan:", error);
      res.status(500).json({ error: "Erro ao deletar plano de serviço" });
    }
  });

  // ========== CATEGORIES ENDPOINTS ==========
  app.get("/api/admin/categories", requireAdmin, async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Erro ao buscar categorias" });
    }
  });

  app.post("/api/admin/categories", requireAdmin, async (req, res) => {
    try {
      const { insertCategorySchema } = await import("@shared/schema");
      
      // Validate request body
      const validation = insertCategorySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Dados inválidos", 
          details: validation.error.errors 
        });
      }
      
      // Create the category
      const category = await storage.createCategory(validation.data);
      res.status(201).json(category);
    } catch (error: any) {
      console.error("Error creating category:", error);
      if (error.message?.includes("already exists")) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Erro ao criar categoria" });
      }
    }
  });

  app.put("/api/admin/categories/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { updateCategorySchema } = await import("@shared/schema");
      
      // Validate request body
      const validation = updateCategorySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Dados inválidos", 
          details: validation.error.errors 
        });
      }
      
      // Update the category
      const category = await storage.updateCategory(id, validation.data);
      if (!category) {
        return res.status(404).json({ error: "Categoria não encontrada" });
      }
      
      res.json(category);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ error: "Erro ao atualizar categoria" });
    }
  });

  app.delete("/api/admin/categories/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if category exists
      const category = await storage.getCategory(id);
      if (!category) {
        return res.status(404).json({ error: "Categoria não encontrada" });
      }
      
      // Try to delete (will fail if services are using this category)
      const deleted = await storage.deleteCategory(id);
      if (!deleted) {
        return res.status(400).json({ 
          error: "Não foi possível deletar a categoria. Verifique se existem serviços usando esta categoria." 
        });
      }
      
      res.json({ success: true, message: "Categoria deletada com sucesso" });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: "Erro ao deletar categoria" });
    }
  });

  // ========== SERVICES ROUTES (NEW) ==========
  // Get all active services
  app.get("/api/services", async (req, res) => {
    try {
      const services = await storage.getActiveServices();
      
      // Transform service data for marketplace display
      const marketplaceServices = services.map(service => {
        // Define categories based on service ID
        let category = "Geral";
        let features: string[] = [];
        let isPopular = false;
        let isHighlight = false;
        
        if (service.id === "vectorizer-001") {
          category = "Produtividade";
          features = [
            "Vetorização ilimitada",
            "Alta qualidade",
            "Suporte API",
            "Processamento em lote"
          ];
          isPopular = true;
        } else if (service.id === "removebg-001") {
          category = "Imagens";
          features = [
            "Precisão com IA",
            "HD e 4K",
            "PNG transparente",
            "Processamento rápido"
          ];
          isHighlight = true;
        }
        
        return {
          id: service.id,
          nome: service.nome,
          descricao: service.descricao,
          preco: service.preco,
          ativo: service.ativo,
          category,
          features,
          isPopular,
          isHighlight
        };
      });
      
      res.json(marketplaceServices);
    } catch (error) {
      console.error("Error fetching marketplace services:", error);
      res.status(500).json({ error: "Erro ao buscar serviços" });
    }
  });

  // Get service categories
  app.get("/api/services/categories", async (req, res) => {
    try {
      const services = await storage.getActiveServices();
      
      // Define categories with service mapping
      const categoryMap = new Map();
      services.forEach(service => {
        let category = "Geral";
        if (service.id === "vectorizer-001") {
          category = "Produtividade";
        } else if (service.id === "removebg-001") {
          category = "Imagens";
        }
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
      });
      
      const categories = [
        { name: "Todos", count: services.length },
        ...Array.from(categoryMap.entries()).map(([name, count]) => ({
          name,
          count
        }))
      ];
      
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Erro ao buscar categorias" });
    }
  });

  // Get service details by ID
  app.get("/api/services/:id", async (req, res) => {
    try {
      const service = await storage.getService(req.params.id);
      
      if (!service) {
        return res.status(404).json({ error: "Serviço não encontrado" });
      }
      
      res.json(service);
    } catch (error) {
      console.error("Error fetching service details:", error);
      res.status(500).json({ error: "Erro ao buscar detalhes do serviço" });
    }
  });

  // Subscribe to a service (requires auth)
  app.post("/api/services/subscribe", requireAuth, async (req, res) => {
    try {
      const { serviceId, planId } = req.body;
      const userId = req.session.userId;
      
      if (!serviceId) {
        return res.status(400).json({ error: "ID do serviço é obrigatório" });
      }
      
      // Validate service exists and is active
      const service = await storage.getService(serviceId);
      if (!service || !service.ativo) {
        return res.status(404).json({ error: "Serviço não encontrado ou inativo" });
      }
      
      // Validate plan if provided
      let plan = null;
      if (planId) {
        plan = await storage.getServicePlan(planId);
        if (!plan || plan.serviceId !== serviceId || !plan.isActive) {
          return res.status(400).json({ error: "Plano inválido para este serviço" });
        }
      }
      
      // Check if user already has this service
      const existingUserService = await storage.getUserService(userId!, serviceId);
      
      if (existingUserService) {
        if (existingUserService.status === "ATIVO") {
          return res.status(400).json({ 
            error: "Você já possui uma assinatura ativa deste serviço",
            redirect: "/payment" 
          });
        }
        // Update existing user_service with new planId
        await storage.updateUserService(existingUserService.id, {
          planId: planId || null,
          status: "PENDENTE"
        });
      } else {
        // Create new user_service
        await storage.createUserService({
          userId: userId!,
          serviceId,
          planId: planId || null,
          status: "PENDENTE",
          proximoPagamento: null
        });
      }
      
      // Calculate payment amount (use plan price if available, otherwise service price)
      const amountInReais = plan ? parseFloat(plan.price) : parseFloat(service.preco);
      const amountInCents = Math.round(amountInReais * 100);
      
      // Create pending payment
      const payment = await storage.createPayment({
        userId: userId!,
        serviceId,
        planId: planId || null,
        amount: amountInCents.toString(),
        status: "pending",
        txid: null,
        pushinpayId: null
      });
      
      res.json({ 
        success: true, 
        message: "Serviço adicionado! Efetue o pagamento para ativar.",
        paymentId: payment.id,
        redirect: "/payment"
      });
    } catch (error) {
      console.error("Error subscribing to service:", error);
      res.status(500).json({ error: "Erro ao adicionar serviço" });
    }
  });
  
  // ========== MARKETPLACE ROUTES (LEGACY ALIASES) ==========
  // These endpoints are maintained for backward compatibility
  // They delegate to the same logic as the new /api/services endpoints
  
  // Legacy: Get all active services for marketplace
  app.get("/api/marketplace/services", async (req, res) => {
    try {
      const services = await storage.getActiveServices();
      
      // Transform service data for marketplace display
      const marketplaceServices = services.map(service => {
        // Define categories based on service ID
        let category = "Geral";
        let features: string[] = [];
        let isPopular = false;
        let isHighlight = false;
        
        if (service.id === "vectorizer-001") {
          category = "Produtividade";
          features = [
            "Vetorização ilimitada",
            "Alta qualidade",
            "Suporte API",
            "Processamento em lote"
          ];
          isPopular = true;
        } else if (service.id === "removebg-001") {
          category = "Imagens";
          features = [
            "Precisão com IA",
            "HD e 4K",
            "PNG transparente",
            "Processamento rápido"
          ];
          isHighlight = true;
        }
        
        return {
          id: service.id,
          nome: service.nome,
          descricao: service.descricao,
          preco: service.preco,
          ativo: service.ativo,
          category,
          features,
          isPopular,
          isHighlight
        };
      });
      
      res.json(marketplaceServices);
    } catch (error) {
      console.error("Error fetching marketplace services:", error);
      res.status(500).json({ error: "Erro ao buscar serviços" });
    }
  });
  
  // Legacy: Get service categories
  app.get("/api/marketplace/categories", async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Erro ao buscar categorias" });
    }
  });
  
  // Legacy: Get service details by ID
  app.get("/api/marketplace/services/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const service = await storage.getService(id);
      
      if (!service || !service.ativo) {
        return res.status(404).json({ error: "Serviço não encontrado ou inativo" });
      }
      
      res.json(service);
    } catch (error) {
      console.error("Error fetching service:", error);
      res.status(500).json({ error: "Erro ao buscar serviço" });
    }
  });
  
  // Legacy: Subscribe to a service
  app.post("/api/marketplace/subscribe", requireAuth, async (req, res) => {
    try {
      const { serviceId } = req.body;
      const userId = req.session.userId;
      
      if (!serviceId) {
        return res.status(400).json({ error: "Service ID is required" });
      }
      
      // Verify service exists and is active
      const service = await storage.getService(serviceId);
      if (!service || !service.ativo) {
        return res.status(404).json({ error: "Serviço não encontrado ou inativo" });
      }
      
      // Create inactive subscription (will be activated after payment)
      await storage.createUserService({
        userId: userId!,
        serviceId,
        status: "INATIVO",
        proximoPagamento: null
      });
      
      res.json({ 
        success: true, 
        message: "Serviço adicionado! Efetue o pagamento para ativar.",
        redirect: "/payment"
      });
    } catch (error) {
      console.error("Error subscribing to service:", error);
      res.status(500).json({ error: "Erro ao adicionar serviço" });
    }
  });
  
  // RemoveBG API Token Management Routes (Admin only)
  app.get("/api/admin/removebg-tokens", requireAdmin, async (req, res) => {
    try {
      const tokens = await storage.listRemoveBgApiKeys();
      // Mask API keys for security - only show last 4 characters
      const maskedTokens = tokens.map(token => ({
        ...token,
        maskedApiKey: token.apiKeyEncrypted ? `****${token.apiKeyEncrypted.slice(-4)}` : '****',
        apiKeyEncrypted: undefined, // Don't send encrypted key to frontend
      }));
      res.json(maskedTokens);
    } catch (error) {
      console.error("Error fetching RemoveBG tokens:", error);
      res.status(500).json({ error: "Erro ao buscar tokens" });
    }
  });

  app.post("/api/admin/removebg-tokens", requireAdmin, async (req, res) => {
    try {
      const { label, apiKey } = req.body;

      if (!label || !apiKey) {
        return res.status(400).json({ error: "Label e API Key são obrigatórios" });
      }

      // Encrypt the API key before storing
      const { encrypt } = await import("./utils/crypto");
      const encryptedKey = encrypt(apiKey);

      const newToken = await storage.createRemoveBgApiKey({
        label,
        apiKeyEncrypted: encryptedKey,
        isActive: false,
        createdBy: req.session.userId!,
      });

      // Return token without the encrypted key
      const maskedToken = {
        ...newToken,
        maskedApiKey: `****${apiKey.slice(-4)}`,
        apiKeyEncrypted: undefined,
      };

      res.json(maskedToken);
    } catch (error) {
      console.error("Error creating RemoveBG token:", error);
      res.status(500).json({ error: "Erro ao criar token" });
    }
  });

  app.put("/api/admin/removebg-tokens/:id/activate", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const activatedToken = await storage.activateRemoveBgApiKey(id);
      if (!activatedToken) {
        return res.status(404).json({ error: "Token não encontrado" });
      }

      // Return token without the encrypted key
      const maskedToken = {
        ...activatedToken,
        maskedApiKey: activatedToken.apiKeyEncrypted ? `****${activatedToken.apiKeyEncrypted.slice(-4)}` : '****',
        apiKeyEncrypted: undefined,
      };

      res.json(maskedToken);
    } catch (error) {
      console.error("Error activating RemoveBG token:", error);
      res.status(500).json({ error: "Erro ao ativar token" });
    }
  });

  app.delete("/api/admin/removebg-tokens/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const success = await storage.deleteRemoveBgApiKey(id);
      if (!success) {
        return res.status(404).json({ error: "Token não encontrado" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting RemoveBG token:", error);
      res.status(500).json({ error: "Erro ao remover token" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
