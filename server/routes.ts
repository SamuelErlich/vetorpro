import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { insertUserSchema, insertCredentialSchema, insertPaymentSchema } from "@shared/schema";

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

  // ========== USER ROUTES (Admin only) ==========
  
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

      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
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

      res.json({ 
        status: payment.status,
        amount: payment.amount,
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
      
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: "Valor inválido" });
      }

      // Call PushinPay API to generate PIX first
      const pushinpayToken = process.env.PUSHINPAY_TOKEN;
      const webhookUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/webhook/pushinpay`
        : undefined;

      if (!pushinpayToken) {
        console.error("PUSHINPAY_TOKEN not configured");
        return res.status(500).json({ error: "Configuração de pagamento não encontrada" });
      }

      // Convert amount to cents (R$35.00 = 3500)
      const amountInCents = Math.round(amount * 100);

      console.log(`Generating PIX for R$${amount} (${amountInCents} cents)`);

      const pushinpayResponse = await fetch("https://api.pushinpay.com.br/api/pix/cashIn", {
        method: "POST",
        headers: {
          "Authorization": pushinpayToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          value: amountInCents,
          webhook_url: webhookUrl,
        }),
      });

      if (!pushinpayResponse.ok) {
        const errorText = await pushinpayResponse.text();
        console.error("PushinPay API error:", pushinpayResponse.status, errorText);
        return res.status(500).json({ error: "Erro ao gerar PIX. Tente novamente." });
      }

      const pixData = await pushinpayResponse.json();
      console.log("PushinPay response:", { id: pixData.id, status: pixData.status });

      // Create payment record with PushinPay transaction ID
      const payment = await storage.createPayment({
        userId: req.session.userId!,
        amount: amount.toString(),
        status: "pending",
        txid: pixData.id,
      });

      console.log(`Payment record created: ${payment.id} with txid: ${pixData.id}`);

      // Ensure qr_code_base64 has proper data URI prefix
      let qrCodeBase64 = pixData.qr_code_base64;
      if (qrCodeBase64 && !qrCodeBase64.startsWith('data:image/')) {
        qrCodeBase64 = `data:image/png;base64,${qrCodeBase64}`;
      }

      res.json({
        qrCodeBase64: qrCodeBase64,
        qrCode: pixData.qr_code,
        txid: pixData.id,
        status: pixData.status,
        amount: amount,
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

  // Webhook from PushinPay
  app.post("/api/webhook/pushinpay", async (req, res) => {
    try {
      console.log("PushinPay webhook received:", JSON.stringify(req.body, null, 2));
      
      const { status, id } = req.body;
      
      // PushinPay uses 'id' field for transaction ID
      const txid = id;
      
      if (!txid) {
        console.error("Webhook missing transaction ID");
        return res.status(400).json({ error: "Missing transaction ID" });
      }
      
      // Normalize status to lowercase for comparison
      const normalizedStatus = status?.toLowerCase();
      
      if (normalizedStatus === "paid" || normalizedStatus === "pago") {
        const payment = await storage.getPaymentByTxid(txid);
        
        if (!payment) {
          console.error(`Payment not found for txid: ${txid}`);
          // Return 200 to prevent PushinPay retries for unknown transactions
          return res.json({ success: true, message: "Payment not found" });
        }

        // Check if payment is already processed (idempotency)
        if (payment.status === "paid") {
          console.log(`Payment ${payment.id} already processed (idempotent check)`);
          return res.json({ success: true, message: "Already processed" });
        }
        
        console.log(`Payment confirmed for txid: ${txid}, user: ${payment.userId}`);
        
        // Update payment status
        await storage.updatePayment(payment.id, { status: "paid" });
        
        // Update user status and set payment date
        await storage.updateUser(payment.userId, {
          status: "ATIVO",
          ultimoPagamento: new Date(),
        });
        
        console.log(`User ${payment.userId} activated successfully`);
        
        res.json({ success: true, message: "Payment processed" });
      } else if (normalizedStatus === "failed" || normalizedStatus === "cancelled") {
        const payment = await storage.getPaymentByTxid(txid);
        
        if (payment && payment.status !== "failed") {
          console.log(`Payment ${payment.id} marked as failed`);
          await storage.updatePayment(payment.id, { status: "failed" });
        }
        
        res.json({ success: true, message: "Payment failed" });
      } else {
        console.log(`Unhandled payment status: ${status}`);
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
