import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { z } from "zod";
import { storage } from "./storage";
import { insertUserSchema, insertCredentialSchema, insertPaymentSchema } from "@shared/schema";
import { manualTriggers } from "./jobs/paymentCron";
import { sendEmail, emailTemplates } from "./utils/email";

// Extend session data
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    isAdmin?: boolean;
  }
}

// Middleware to check if user is authenticated
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  next();
};

// Middleware to check if user is admin
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId || !req.session.isAdmin) {
    return res.status(403).json({ error: "Acesso negado" });
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // SECURITY: Validate webhook secret at startup (fail fast)
  const webhookSecret = process.env.PUSHINPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn("⚠️  WARNING: PUSHINPAY_WEBHOOK_SECRET not configured - webhook authentication will be disabled!");
    console.warn("⚠️  This is a security risk in production. Set PUSHINPAY_WEBHOOK_SECRET environment variable.");
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
  
  // Client login
  app.post("/api/auth/login", async (req, res) => {
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

      req.session.userId = user.id;
      req.session.isAdmin = user.isAdmin === "true";

      // Don't send password to client
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Erro ao fazer login" });
    }
  });

  // Admin login
  app.post("/api/auth/admin/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user || user.isAdmin !== "true") {
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

  // Logout
  app.post("/api/auth/logout", (req, res) => {
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

      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Get me error:", error);
      res.status(500).json({ error: "Erro ao buscar usuário" });
    }
  });

  // Validate password reset token
  app.get("/api/auth/validate-token/:token", async (req, res) => {
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

  // Create password from token
  app.post("/api/auth/create-password", async (req, res) => {
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

  // User self-registration (public endpoint)
  app.post("/api/auth/register", async (req, res) => {
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
        isAdmin: "false",
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
  
  // Admin: Get users with filters
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const { status, search, sort } = req.query;
      
      const filters: any = {};
      if (status && (status === "ATIVO" || status === "INATIVO" || status === "BLOQUEADO")) {
        filters.status = status;
      }
      if (search && typeof search === "string") {
        filters.search = search;
      }
      if (sort && typeof sort === "string") {
        filters.sort = sort;
      }

      const users = await storage.getUsersWithFilters(filters);
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
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

      if (!status || !["ATIVO", "INATIVO", "BLOQUEADO"].includes(status)) {
        return res.status(400).json({ error: "Status inválido" });
      }

      const user = await storage.updateUser(id, { status });
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
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
      const payments = await storage.getPaymentsByUserId(id);
      res.json(payments);
    } catch (error) {
      console.error("Get user payments error:", error);
      res.status(500).json({ error: "Erro ao buscar pagamentos" });
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

  // ========== CREDENTIAL ROUTES ==========
  
  // Get user's credentials (only if payment is active)
  app.get("/api/credentials", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      // Return credentials only if user status is ATIVO
      if (user.status !== "ATIVO") {
        return res.json({ locked: true, credentials: [] });
      }

      // Get shared credentials (userId is null) - available to all active users
      const credentials = await storage.getSharedCredentials();

      res.json({ locked: false, credentials });
    } catch (error) {
      console.error("Get credentials error:", error);
      res.status(500).json({ error: "Erro ao buscar credenciais" });
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
      const credential = await storage.createCredential(validatedData);
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

      // Build Vectorizer SSO URL (pre-fills email only)
      const loginUrl = `https://cedarlakeventures.com/signon/v0/we54b154ba3adfa5e/single?lc=en-US&loginPath=%2Flogin_callback%3Fredir%3D%252F%253Fsignin%253D1&email=${encodeURIComponent(email)}`;

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

  // ========== PAYMENT ROUTES ==========
  
  // Get user's payments
  app.get("/api/payments", requireAuth, async (req, res) => {
    try {
      const payments = await storage.getPaymentsByUserId(req.session.userId!);
      res.json(payments);
    } catch (error) {
      console.error("Get payments error:", error);
      res.status(500).json({ error: "Erro ao buscar pagamentos" });
    }
  });

  // Check payment status by txid
  app.get("/api/payments/status/:txid", requireAuth, async (req, res) => {
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

  // Generate PIX payment
  app.post("/api/payments/pix", requireAuth, async (req, res) => {
    try {
      const { amount } = req.body;
      
      // CRITICAL: Accept both number and string (frontend may send either)
      if (amount == null || amount === '') {
        return res.status(400).json({ error: "Valor inválido" });
      }

      // Sanitize amount input (CRITICAL: convert string to number if needed)
      const sanitizedAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      
      if (isNaN(sanitizedAmount) || sanitizedAmount <= 0) {
        return res.status(400).json({ error: "Valor inválido" });
      }

      // PushinPay requires minimum value of 50 centavos (R$ 0.50)
      const amountInCents = Math.round(sanitizedAmount * 100);
      if (amountInCents < 50) {
        return res.status(400).json({ 
          error: "Valor mínimo permitido é R$ 0,50 (50 centavos)"
        });
      }

      // CRITICAL: Generate our own TXID (UUID) to send to PushinPay
      const ourTxid = crypto.randomUUID();

      // Check if demo mode is enabled (auto-enable on API failure)
      const useDemoMode = process.env.USE_PUSHINPAY_DEMO === "true";
      
      let pixData: any;
      let apiAttempted = false;
      
      if (useDemoMode) {
        // DEMO MODE: Generate fake PIX for testing
        console.log(`[DEMO MODE] Generating fake PIX for R$${sanitizedAmount} (txid: ${ourTxid})`);
        
        // Generate a simple demo QR code (base64 encoded 1x1 pixel)
        const demoQrCodeBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        
        pixData = {
          txid: ourTxid,
          id: ourTxid, // For compatibility
          qr_code: "00020101021126580014br.gov.bcb.pix0136demo-pix-code-for-testing-only5204000053039865802BR5925DEMO PUSHINPAY TESTING6009SAO PAULO62070503***6304ABCD",
          qr_code_base64: demoQrCodeBase64,
          status: "created",
          value: amountInCents
        };
        
        console.log(`[DEMO MODE] Created demo payment with our txid: ${ourTxid}`);
      } else {
        apiAttempted = true;
        // PRODUCTION MODE: Call real PushinPay API
        const pushinpayToken = process.env.PUSHINPAY_TOKEN;
        
        // CRITICAL: Ensure webhook URL is properly configured
        let webhookUrl: string | undefined = undefined;
        if (process.env.REPLIT_DEV_DOMAIN) {
          webhookUrl = `https://${process.env.REPLIT_DEV_DOMAIN}/api/webhook/pushinpay`;
        } else {
          console.warn("⚠️  REPLIT_DEV_DOMAIN not set - webhook notifications will not work!");
        }

        if (!pushinpayToken) {
          console.error("PUSHINPAY_TOKEN not configured");
          return res.status(500).json({ error: "Configuração de pagamento não encontrada" });
        }

        console.log(`Generating PIX for R$${sanitizedAmount} (${amountInCents} cents) with txid: ${ourTxid}`);

        // CRITICAL: Send our own TXID to PushinPay
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
            txid: ourTxid, // CRITICAL: Send our own TXID
          }),
        });

        if (!pushinpayResponse.ok) {
          const errorText = await pushinpayResponse.text();
          console.error("PushinPay API error:", pushinpayResponse.status, errorText);
          
          // Fallback to DEMO mode if API is unavailable
          console.log("[AUTO DEMO MODE] PushinPay API unavailable, using demo mode");
          
          const demoQrCodeBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
          
          pixData = {
            txid: ourTxid,
            id: ourTxid,
            qr_code: "00020101021126580014br.gov.bcb.pix0136demo-pix-code-for-testing-only5204000053039865802BR5925DEMO PUSHINPAY TESTING6009SAO PAULO62070503***6304ABCD",
            qr_code_base64: demoQrCodeBase64,
            status: "created",
            value: amountInCents
          };
          
          console.log(`[AUTO DEMO MODE] Created demo payment with our txid: ${ourTxid}`);
        } else {
          pixData = await pushinpayResponse.json();
          console.log("PushinPay response:", { pushinpayId: pixData.id, status: pixData.status });
          
          // CRITICAL: Overwrite ALL identifier fields with our TXID
          // This ensures consistency across client, database, and webhook
          pixData.txid = ourTxid;
          pixData.id = ourTxid;
        }
      }

      // Create payment record with OUR transaction ID (amount in cents as string)
      const payment = await storage.createPayment({
        userId: req.session.userId!,
        amount: amountInCents.toString(), // Store cents as string (decimal column)
        status: "pending",
        txid: ourTxid, // CRITICAL: Use our own TXID
      });

      console.log(`Payment record created: ${payment.id} with our txid: ${ourTxid}, amount: ${amountInCents} cents (R$${sanitizedAmount})`);

      // Ensure qr_code_base64 has proper data URI prefix
      let qrCodeBase64 = pixData.qr_code_base64;
      if (qrCodeBase64 && !qrCodeBase64.startsWith('data:image/')) {
        qrCodeBase64 = `data:image/png;base64,${qrCodeBase64}`;
      }

      // CRITICAL: Return OUR TXID to the client (not PushinPay's internal ID)
      // This ensures client polling uses the same TXID we stored in database
      // Return amount in reais (formatted) for UI display
      res.json({
        qrCodeBase64: qrCodeBase64,
        qrCode: pixData.qr_code,
        txid: ourTxid, // CRITICAL: Return our TXID, not pixData.id
        status: pixData.status,
        amount: sanitizedAmount, // Return original reais for UI
        amountCents: amountInCents, // Also provide cents for reference
      });
    } catch (error) {
      console.error("Generate PIX error:", error);
      res.status(500).json({ error: "Erro ao gerar PIX" });
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
      });

      const validatedData = createUserEmailSchema.parse(req.body);
      const { email, status } = validatedData;

      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email já cadastrado" });
      }

      // Create user without password
      const user = await storage.createUser({
        email,
        password: null, // Will be set by user via email link
        status: status || "PENDENTE",
        isAdmin: "false",
      });

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
        amount: amount.toString(),
        status: "paid",
        txid: `SIMULATED-${Date.now()}`,
      });

      // Calculate nextPaymentDate: day 5 of NEXT month
      const nextPaymentDate = new Date();
      nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1); // Next month
      nextPaymentDate.setDate(5); // Day 5
      nextPaymentDate.setHours(0, 0, 0, 0); // Midnight

      // Update user: set status to ATIVO, update ultimoPagamento and nextPaymentDate
      await storage.updateUser(userId, {
        status: "ATIVO",
        ultimoPagamento: new Date(),
        nextPaymentDate,
      });

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

  // Webhook from PushinPay
  app.post("/api/webhook/pushinpay", async (req, res) => {
    try {
      console.log("PushinPay webhook received:", JSON.stringify(req.body, null, 2));
      
      // SECURITY: Verify webhook authenticity using constant-time comparison
      // CRITICAL: PushinPay sends X-Token header (not x-webhook-secret!)
      const webhookSecret = process.env.PUSHINPAY_WEBHOOK_SECRET;
      
      if (!webhookSecret) {
        console.error("CRITICAL: PUSHINPAY_WEBHOOK_SECRET not configured");
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // CRITICAL: PushinPay uses X-Token header or Authorization Bearer
      const receivedToken = req.headers['x-token'] as string | undefined;
      const receivedAuth = req.headers['authorization'] as string | undefined;
      
      if (!receivedToken && !receivedAuth) {
        console.error("Webhook authentication failed - missing X-Token or Authorization header");
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Normalize received secret (trim whitespace)
      const normalizedReceived = (receivedToken || receivedAuth || '').trim();
      
      // Prepare expected values
      const expectedDirect = webhookSecret.trim();
      const expectedBearer = `Bearer ${webhookSecret.trim()}`;
      
      // Use constant-time comparison to prevent timing attacks
      let isValid = false;
      try {
        // Compare with direct secret (X-Token)
        if (normalizedReceived.length === expectedDirect.length) {
          const receivedBuf = Buffer.from(normalizedReceived, 'utf8');
          const expectedBuf = Buffer.from(expectedDirect, 'utf8');
          isValid = crypto.timingSafeEqual(receivedBuf, expectedBuf);
        }
        
        // Compare with Bearer format (Authorization)
        if (!isValid && normalizedReceived.length === expectedBearer.length) {
          const receivedBuf = Buffer.from(normalizedReceived, 'utf8');
          const expectedBuf = Buffer.from(expectedBearer, 'utf8');
          isValid = crypto.timingSafeEqual(receivedBuf, expectedBuf);
        }
      } catch (error) {
        // timingSafeEqual throws if buffer lengths don't match
        isValid = false;
      }
      
      if (!isValid) {
        console.error("Webhook authentication failed - invalid secret");
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // CRITICAL: PushinPay may send nested transaction object
      // SECURITY: Only trust txid from body root, ignore nested IDs to prevent forgery
      const { status, txid } = req.body;
      
      // CRITICAL: Extract TXID only from root level (not from nested transaction)
      const receivedTxid = txid;
      
      if (!receivedTxid) {
        console.error("Webhook missing transaction ID", req.body);
        return res.status(400).json({ error: "Missing transaction ID" });
      }
      
      // Normalize status to lowercase for comparison
      const normalizedStatus = status?.toLowerCase();
      
      // CRITICAL: PushinPay uses CONFIRMED status (not just "paid")
      // Possible statuses: "created" | "paid" | "pago" | "confirmed" | "CONFIRMED" | "canceled"
      if (normalizedStatus === "paid" || normalizedStatus === "pago" || 
          normalizedStatus === "confirmed") {
        const payment = await storage.getPaymentByTxid(receivedTxid);
        
        if (!payment) {
          console.error(`Payment not found for txid: ${receivedTxid}`);
          // Return 200 to prevent PushinPay retries for unknown transactions
          return res.json({ success: true, message: "Payment not found" });
        }

        // Check if payment is already processed (idempotency)
        if (payment.status === "paid") {
          console.log(`Payment ${payment.id} already processed (idempotent check)`);
          return res.json({ success: true, message: "Already processed" });
        }
        
        console.log(`Payment confirmed for txid: ${receivedTxid}, user: ${payment.userId}`);
        
        // Update payment status
        await storage.updatePayment(payment.id, { status: "paid" });
        
        // Calculate next payment date: Always day 5 of next month
        const nextPaymentDate = new Date();
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1); // Next month
        nextPaymentDate.setDate(5); // Day 5
        nextPaymentDate.setHours(0, 0, 0, 0); // Start of day
        
        // Update user status, payment date, and next payment date
        await storage.updateUser(payment.userId, {
          status: "ATIVO",
          ultimoPagamento: new Date(),
          nextPaymentDate: nextPaymentDate, // Set next vencimento (day 5 of next month)
        });
        
        console.log(`User ${payment.userId} activated successfully (next payment: ${nextPaymentDate.toISOString().split('T')[0]} - day 5 of next month)`);
        
        res.json({ success: true, message: "Payment processed" });
      } else if (normalizedStatus === "canceled" || normalizedStatus === "cancelled" || normalizedStatus === "failed") {
        // Handle both PushinPay's "canceled" (1 L) and potential "cancelled" (2 Ls) variants
        const payment = await storage.getPaymentByTxid(receivedTxid);
        
        if (payment && payment.status !== "failed") {
          console.log(`Payment ${payment.id} marked as failed/canceled`);
          await storage.updatePayment(payment.id, { status: "failed" });
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

  const httpServer = createServer(app);
  return httpServer;
}
