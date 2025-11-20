# 📚 Código Completo VectorPro - Revisão Técnica Detalhada

## 🏗️ Arquitetura Geral
- **Frontend**: React + TypeScript + Vite + TanStack Query + Shadcn/ui
- **Backend**: Express + TypeScript + PostgreSQL (Neon) + Drizzle ORM
- **Autenticação**: Session-based com express-session
- **Pagamentos**: PushinPay API (PIX)
- **Email**: Resend API
- **Cron Jobs**: node-cron para cobrança automática

---

# 1️⃣ BANCO DE DADOS (Schema)

## 📄 shared/schema.ts
```typescript
import { pgTable, text, integer, date, timestamp, boolean, varchar, serial } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ========== USERS TABLE ==========
export const users = pgTable("Users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password"),
  status: text("status", { 
    enum: ["ATIVO", "INATIVO", "BLOQUEADO", "PENDENTE"] 
  }).notNull().default("INATIVO"),
  ultimoPagamento: timestamp("ultimoPagamento"),
  nextPaymentDate: timestamp("nextPaymentDate"),
  isAdmin: boolean("isAdmin").notNull().default(false), // CORRIGIDO: era text, agora boolean
  discount: integer("discount").default(0),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ========== SERVICES TABLE ==========
export const services = pgTable("Services", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("isActive").notNull().default(true),
  monthlyPrice: integer("monthlyPrice"), // em centavos
  requiresApiKey: boolean("requiresApiKey").default(false),
  maxCreditsPerMonth: integer("maxCreditsPerMonth"),
  category: text("category"),
  features: text("features").array(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type Service = typeof services.$inferSelect;

// ========== USER SERVICES TABLE (Multi-service support) ==========
export const userServices = pgTable("UserServices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id),
  serviceId: varchar("serviceId").notNull().references(() => services.id),
  status: text("status", { 
    enum: ["ATIVO", "INATIVO", "BLOQUEADO", "PENDENTE"] 
  }).notNull().default("INATIVO"),
  ultimoPagamento: timestamp("ultimoPagamento"),
  proximoPagamento: timestamp("proximoPagamento"),
  creditsAvailable: integer("creditsAvailable").default(0),
  planId: varchar("planId"),
  credits: integer("credits").default(0),
  creditsUsed: integer("creditsUsed").default(0),
  lastPaymentDate: timestamp("lastPaymentDate"),
  trialEndsAt: timestamp("trialEndsAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type UserService = typeof userServices.$inferSelect;

// ========== CREDENTIALS TABLE ==========
export const credentials = pgTable("Credentials", {
  id: serial("id").primaryKey(),
  userId: varchar("userId").notNull().references(() => users.id),
  serviceId: varchar("serviceId").notNull().references(() => services.id),
  month: date("month").notNull(),
  data: text("data").notNull(), // JSON string
});

export type Credential = typeof credentials.$inferSelect;

// ========== PAYMENTS TABLE ==========
export const payments = pgTable("Payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id),
  serviceId: varchar("serviceId").notNull().references(() => services.id),
  amount: integer("amount").notNull(), // em centavos
  status: text("status", {
    enum: ["pending", "paid", "failed", "expired", "refunded", "canceled_by_system"]
  }).notNull().default("pending"),
  txid: text("txid").notNull().unique(),
  qrCode: text("qrCode"),
  qrCodeUrl: text("qrCodeUrl"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  paidAt: timestamp("paidAt"),
  metadata: text("metadata"), // JSON string
});

export type Payment = typeof payments.$inferSelect;

// ========== PLANS TABLE (RemoveBG) ==========
export const plans = pgTable("Plans", {
  id: varchar("id").primaryKey(),
  serviceId: varchar("serviceId").notNull().references(() => services.id),
  name: text("name").notNull(),
  price: integer("price").notNull(), // em centavos
  credits: integer("credits").notNull(),
  description: text("description"),
  isActive: boolean("isActive").notNull().default(true),
  features: text("features").array(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type Plan = typeof plans.$inferSelect;

// ========== REMOVEBG REQUESTS TABLE ==========
export const removeBgRequests = pgTable("RemoveBgRequests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id),
  originalImagePath: text("originalImagePath").notNull(),
  processedImagePath: text("processedImagePath"),
  status: text("status", {
    enum: ["processing", "completed", "failed"]
  }).notNull().default("processing"),
  error: text("error"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type RemoveBgRequest = typeof removeBgRequests.$inferSelect;

// ========== INVITATION TOKENS TABLE ==========
export const invitationTokens = pgTable("InvitationTokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type InvitationToken = typeof invitationTokens.$inferSelect;
```

---

# 2️⃣ BACKEND

## 📄 server/routes.ts (Principais Rotas e Middleware)
```typescript
import express from "express";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import { requireAuth, requireAdmin } from "./middleware";

// ========== MIDDLEWARE DE AUTENTICAÇÃO ==========
export const requireAuth: express.RequestHandler = async (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  
  try {
    // VALIDAÇÃO EM TEMPO REAL DO STATUS DO USUÁRIO
    const user = await storage.getUser(req.session.userId);
    
    if (!user) {
      req.session.destroy((err) => {
        if (err) console.error('Erro ao destruir sessão:', err);
      });
      return res.status(401).json({ error: "Usuário não encontrado" });
    }
    
    // Se não for admin E status não for ATIVO, bloqueia acesso
    if (!user.isAdmin && user.status !== 'ATIVO') {
      req.session.destroy((err) => {
        if (err) console.error('Erro ao destruir sessão:', err);
      });
      
      const message = user.status === 'BLOQUEADO' 
        ? "Conta bloqueada por falta de pagamento"
        : "Conta inativa - realize o pagamento para ativar";
      
      return res.status(403).json({ error: message });
    }
    
    (req as any).user = user;
    next();
  } catch (error) {
    console.error('Erro ao validar autenticação:', error);
    return res.status(500).json({ error: "Erro ao validar sessão" });
  }
};

export const requireAdmin: express.RequestHandler = async (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const user = await storage.getUser(req.session.userId);
  if (!user || user.isAdmin !== true) { // CORRIGIDO: comparação boolean
    return res.status(403).json({ error: "Acesso negado. Apenas administradores." });
  }

  (req as any).user = user;
  next();
};

// ========== AUTH ROUTES ==========
app.post("/api/auth/register", async (req, res) => {
  const { email } = req.body;

  try {
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      if (existingUser.status === "ATIVO") {
        return res.status(400).json({ 
          error: "Este email já está registrado. Faça login para acessar sua conta." 
        });
      }
      // If INATIVO, resend token
      const token = crypto.randomBytes(32).toString('hex');
      await storage.createInvitationToken(email, token, 24);
      await sendPasswordCreationEmail(email, token);
      return res.json({ success: true });
    }

    // Create new user INATIVO
    const newUser = await storage.createUser({
      email,
      status: "INATIVO",
      isAdmin: false,
    });

    // Generate password creation token
    const token = crypto.randomBytes(32).toString('hex');
    await storage.createInvitationToken(email, token, 24);

    // Send welcome email
    await sendPasswordCreationEmail(email, token);

    return res.json({ 
      success: true,
      message: "Registro iniciado! Verifique seu email para criar sua senha."
    });
  } catch (error) {
    console.error("Erro no registro:", error);
    return res.status(500).json({ error: "Erro ao processar registro" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await storage.getUserByEmail(email);
    if (!user || !user.password) {
      return res.status(401).json({ error: "Email ou senha inválidos" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Email ou senha inválidos" });
    }

    // Set session
    req.session.userId = user.id;
    req.session.isAdmin = user.isAdmin === true; // CORRIGIDO: boolean

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
        status: user.status
      },
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return res.status(500).json({ error: "Erro no servidor" });
  }
});

// ========== PAYMENT ROUTES ==========
app.post("/api/payments/pix", requireAuth, async (req, res) => {
  const { serviceId = DEFAULT_SERVICE_ID } = req.body;
  
  try {
    const user = (req as any).user;
    
    // Get service details
    const service = await storage.getService(serviceId);
    if (!service) {
      return res.status(404).json({ error: "Serviço não encontrado" });
    }

    // Check for pending payments
    const pendingPayment = await storage.getPendingPaymentByUserAndService(
      user.id, 
      serviceId
    );
    
    if (pendingPayment && pendingPayment.qrCode && pendingPayment.qrCodeUrl) {
      return res.json({
        qrCode: pendingPayment.qrCode,
        qrCodeUrl: pendingPayment.qrCodeUrl,
        txid: pendingPayment.txid,
      });
    }

    // Generate unique TXID
    const txid = `${serviceId}_${user.id}_${Date.now()}`;
    
    // Calculate amount with discount
    let amount = service.monthlyPrice || 1750; // R$ 17,50 default
    if (user.discount > 0) {
      amount = Math.round(amount * (1 - user.discount / 100));
    }

    // Create payment via PushinPay API
    const pixResponse = await generatePixPayment(amount, txid);
    
    if (!pixResponse.success) {
      return res.status(500).json({ error: "Erro ao gerar pagamento PIX" });
    }

    // Save payment in database
    await storage.createPayment({
      userId: user.id,
      serviceId,
      amount,
      txid,
      status: "pending",
      qrCode: pixResponse.qrCode,
      qrCodeUrl: pixResponse.qrCodeUrl,
    });

    return res.json({
      qrCode: pixResponse.qrCode,
      qrCodeUrl: pixResponse.qrCodeUrl,
      txid,
    });
  } catch (error) {
    console.error("Erro ao gerar PIX:", error);
    return res.status(500).json({ error: "Erro ao processar pagamento" });
  }
});

// ========== WEBHOOK PAYMENT ==========
app.post("/api/webhook/payment", async (req, res) => {
  const token = req.headers["x-token"];
  
  // Validate webhook token
  if (token !== process.env.PUSHINPAY_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Token inválido" });
  }

  const { txid, status } = req.body;

  try {
    // Get payment by TXID
    const payment = await storage.getPaymentByTxid(txid);
    if (!payment) {
      return res.status(404).json({ error: "Pagamento não encontrado" });
    }

    // Idempotency check
    if (payment.status === "paid") {
      return res.json({ success: true, message: "Pagamento já processado" });
    }

    if (status === "paid") {
      // Calculate next payment date (day 5 of next month)
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 5);

      // Update payment status
      await storage.updatePayment(payment.id, {
        status: "paid",
        paidAt: new Date(),
      });

      // Update User (legacy)
      await storage.updateUser(payment.userId, {
        status: "ATIVO",
        ultimoPagamento: new Date(),
        nextPaymentDate: nextMonth,
      });

      // Update UserService (multi-service)
      const userService = await storage.getUserServiceByUserAndService(
        payment.userId,
        payment.serviceId
      );
      
      if (userService) {
        await storage.updateUserService(userService.id, {
          status: "ATIVO",
          ultimoPagamento: new Date(),
          proximoPagamento: nextMonth,
        });
      } else {
        // Create UserService if doesn't exist
        await storage.createUserService({
          userId: payment.userId,
          serviceId: payment.serviceId,
          status: "ATIVO",
          ultimoPagamento: new Date(),
          proximoPagamento: nextMonth,
        });
      }

      // Send confirmation email
      const user = await storage.getUser(payment.userId);
      if (user) {
        await sendPaymentConfirmationEmail(user.email, payment.amount / 100);
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Erro no webhook:", error);
    return res.status(500).json({ error: "Erro ao processar webhook" });
  }
});

// ========== CREDENTIALS ROUTES ==========
app.get("/api/credentials", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    
    if (user.status !== "ATIVO" && !user.isAdmin) {
      return res.json({ 
        locked: true, 
        message: "Realize o pagamento para acessar suas credenciais" 
      });
    }

    // Get user's active services
    const userServices = await storage.getUserServicesByUserId(user.id);
    const activeServiceIds = userServices
      .filter(us => us.status === "ATIVO")
      .map(us => us.serviceId);

    // Get credentials for active services only (SECURE)
    const credentials = await storage.getCredentialsByUserAndServices(
      user.id,
      activeServiceIds
    );

    // Filter sensitive data for clients
    const safeCredentials = credentials.map(cred => {
      const data = JSON.parse(cred.data);
      const { ChaveAPI, ...safeData } = data;
      return {
        ...cred,
        data: JSON.stringify(safeData)
      };
    });

    return res.json({ 
      locked: false, 
      credentials: safeCredentials 
    });
  } catch (error) {
    console.error("Erro ao buscar credenciais:", error);
    return res.status(500).json({ error: "Erro ao buscar credenciais" });
  }
});

// ========== ADMIN ROUTES ==========
app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const users = await storage.getAllUsers();
    return res.json(users);
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    return res.status(500).json({ error: "Erro ao buscar usuários" });
  }
});

app.patch("/api/admin/users/:userId", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const updates = req.body;

  try {
    const updatedUser = await storage.updateUser(userId, updates);
    return res.json(updatedUser);
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    return res.status(500).json({ error: "Erro ao atualizar usuário" });
  }
});

app.post("/api/admin/credentials", requireAdmin, async (req, res) => {
  const { userId, serviceId, month, data } = req.body;

  try {
    // Validate user has the service
    const userService = await storage.getUserServiceByUserAndService(userId, serviceId);
    if (!userService) {
      return res.status(403).json({ 
        error: "Usuário não possui assinatura deste serviço" 
      });
    }

    const credential = await storage.createCredential({
      userId,
      serviceId,
      month: new Date(month),
      data: JSON.stringify(data),
    });

    return res.json(credential);
  } catch (error) {
    console.error("Erro ao criar credencial:", error);
    return res.status(500).json({ error: "Erro ao criar credencial" });
  }
});
```

## 📄 server/jobs/paymentCron.ts (Sistema de Cobrança Automática)
```typescript
import cron from 'node-cron';
import { storage } from '../storage';
import { sendEmail, emailTemplates } from '../utils/email';
import { DEFAULT_SERVICE_ID } from '@shared/constants';

/**
 * Payment Monitoring Cron Jobs
 * 
 * ALL PAYMENTS ARE DUE ON DAY 5 OF EACH MONTH
 * 
 * Schedule (Brazilian timezone - America/Sao_Paulo):
 * - Day 3 at 9:00 AM: "Payment due in 2 days" (pre-reminder)
 * - Day 4 at 9:00 AM: "Payment due tomorrow" (final warning)
 * - Day 6 at 9:00 AM: Block overdue users (1 day grace period)
 */

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

function isPaymentDueThisMonth(nextPaymentDate: Date | string | null | undefined): boolean {
  const paymentDate = toDate(nextPaymentDate);
  if (!paymentDate) return false;
  
  const today = new Date();
  const payment = new Date(paymentDate);
  
  // Check if nextPaymentDate is day 5 of CURRENT month
  return (
    payment.getFullYear() === today.getFullYear() &&
    payment.getMonth() === today.getMonth() &&
    payment.getDate() === 5
  );
}

function isPaymentOverdue(nextPaymentDate: Date | string | null | undefined): boolean {
  const paymentDate = toDate(nextPaymentDate);
  if (!paymentDate) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const payment = new Date(paymentDate);
  payment.setHours(0, 0, 0, 0);
  
  return payment.getTime() < today.getTime();
}

// DAY 3 - Send "Payment due in 2 days" email
async function sendPaymentPreReminderEmails() {
  console.log('🔔 [CRON] Running payment pre-reminder check (Day 3)...');
  
  try {
    const userServices = await storage.getUserServicesByServiceId(DEFAULT_SERVICE_ID);
    const activeUserServices = userServices.filter(us => us.status === 'ATIVO');
    
    let sentCount = 0;

    for (const userService of activeUserServices) {
      if (isPaymentDueThisMonth(userService.proximoPagamento)) {
        const user = await storage.getUser(userService.userId);
        if (!user) continue;

        const template = emailTemplates.paymentDueInTwoDays(user.email.split('@')[0]);
        const success = await sendEmail({
          to: user.email,
          subject: template.subject,
          html: template.html,
        });

        if (success) {
          sentCount++;
          console.log(`   📧 Sent pre-reminder to ${user.email}`);
        }
      }
    }

    console.log(`✅ [CRON] Pre-reminder completed: ${sentCount} emails sent`);
  } catch (error) {
    console.error('❌ [CRON ERROR] Pre-reminder failed:', error);
  }
}

// DAY 4 - Send "Payment due tomorrow" email
async function sendPaymentFinalWarningEmails() {
  console.log('🔔 [CRON] Running payment final warning check (Day 4)...');
  
  try {
    const userServices = await storage.getUserServicesByServiceId(DEFAULT_SERVICE_ID);
    const activeUserServices = userServices.filter(us => us.status === 'ATIVO');
    
    let sentCount = 0;

    for (const userService of activeUserServices) {
      if (isPaymentDueThisMonth(userService.proximoPagamento)) {
        const user = await storage.getUser(userService.userId);
        if (!user) continue;

        const template = emailTemplates.paymentDueTomorrow(user.email.split('@')[0]);
        const success = await sendEmail({
          to: user.email,
          subject: template.subject,
          html: template.html,
        });

        if (success) {
          sentCount++;
          console.log(`   📧 Sent final warning to ${user.email}`);
        }
      }
    }

    console.log(`✅ [CRON] Final warning completed: ${sentCount} emails sent`);
  } catch (error) {
    console.error('❌ [CRON ERROR] Final warning failed:', error);
  }
}

// DAY 6 - Block overdue users
async function blockOverdueUsers() {
  console.log('🔔 [CRON] Running overdue payment check (Day 6)...');
  
  try {
    const userServices = await storage.getUserServicesByServiceId(DEFAULT_SERVICE_ID);
    const activeUserServices = userServices.filter(us => us.status === 'ATIVO');
    
    let blockedCount = 0;

    for (const userService of activeUserServices) {
      if (isPaymentOverdue(userService.proximoPagamento)) {
        const user = await storage.getUser(userService.userId);
        if (!user) continue;

        // Skip blocking admins
        if (user.isAdmin) continue;

        // Update UserService status to BLOQUEADO
        await storage.updateUserService(userService.id, {
          status: 'BLOQUEADO',
          proximoPagamento: null,
        });

        // Update User status for compatibility
        await storage.updateUser(userService.userId, {
          status: 'BLOQUEADO',
          nextPaymentDate: null,
        });

        // Send access blocked email
        const template = emailTemplates.accessBlocked(user.email.split('@')[0]);
        await sendEmail({
          to: user.email,
          subject: template.subject,
          html: template.html,
        });

        blockedCount++;
        console.log(`   🚫 Blocked user: ${user.email}`);
      }
    }

    console.log(`✅ [CRON] Day 6 blocking completed: ${blockedCount} users blocked`);
  } catch (error) {
    console.error('❌ [CRON ERROR] Day 6 blocking failed:', error);
  }
}

export function initializePaymentCron() {
  console.log('⏰ [CRON] Initializing payment monitoring cron jobs...');
  
  // DAY 3 at 9:00 AM
  cron.schedule('0 9 3 * *', sendPaymentPreReminderEmails, {
    timezone: 'America/Sao_Paulo',
  });

  // DAY 4 at 9:00 AM
  cron.schedule('0 9 4 * *', sendPaymentFinalWarningEmails, {
    timezone: 'America/Sao_Paulo',
  });

  // DAY 6 at 9:00 AM
  cron.schedule('0 9 6 * *', blockOverdueUsers, {
    timezone: 'America/Sao_Paulo',
  });

  console.log('✅ [CRON] All payment monitoring jobs initialized');
}
```

---

# 3️⃣ FRONTEND

## 📄 client/src/pages/Login.tsx
```tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import RegisterModal from "@/components/RegisterModal";
import ForgotPasswordModal from "@/components/ForgotPasswordModal";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      return apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      localStorage.setItem("user", JSON.stringify(data.user));
      toast({
        title: "Login realizado com sucesso!",
        description: `Bem-vindo de volta, ${data.user.email}`,
      });
      
      if (data.user.isAdmin) {
        setLocation("/admin");
      } else {
        setLocation("/dashboard");
      }
    },
    onError: (error: any) => {
      const errorMessage = error?.error || "Erro ao fazer login";
      toast({
        title: "Erro no login",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            VectorPro Login
          </CardTitle>
          <CardDescription className="text-center">
            Entre com suas credenciais para acessar o sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                {...form.register("email")}
                data-testid="input-email"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...form.register("password")}
                data-testid="input-password"
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
              data-testid="button-submit"
            >
              {loginMutation.isPending ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="mt-6 space-y-2">
            <Button
              variant="link"
              className="w-full text-sm"
              onClick={() => setShowForgotPassword(true)}
              data-testid="link-forgot-password"
            >
              Esqueceu sua senha?
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Ou
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowRegister(true)}
              data-testid="button-register"
            >
              Criar nova conta
            </Button>
          </div>
        </CardContent>
      </Card>

      <RegisterModal 
        open={showRegister} 
        onOpenChange={setShowRegister} 
      />
      
      <ForgotPasswordModal
        open={showForgotPassword}
        onOpenChange={setShowForgotPassword}
      />
    </div>
  );
}
```

## 📄 client/src/pages/Dashboard.tsx
```tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Lock, Calendar, CreditCard, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import PaymentModal from "@/components/PaymentModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Dashboard() {
  const { toast } = useToast();
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const userQuery = useQuery({
    queryKey: ["/api/auth/me"],
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  const credentialsQuery = useQuery({
    queryKey: ["/api/credentials"],
    refetchOnWindowFocus: true,
  });

  const paymentsQuery = useQuery({
    queryKey: ["/api/payments"],
  });

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${label} copiado para a área de transferência`,
    });
  };

  const user = userQuery.data;
  const isLocked = credentialsQuery.data?.locked;

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "Não definido";
    return format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ATIVO": return "default";
      case "INATIVO": return "secondary";
      case "BLOQUEADO": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" data-testid="text-title">Painel do Cliente</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie suas credenciais e acompanhe seus pagamentos
        </p>
      </div>

      {/* Status Card */}
      <div className="grid gap-6 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status da Conta</CardTitle>
            {user?.status === "ATIVO" ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <Badge variant={getStatusColor(user?.status || "")} data-testid="status-account">
              {user?.status || "Carregando..."}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Último Pagamento</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm" data-testid="text-last-payment">
              {formatDate(user?.ultimoPagamento)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximo Pagamento</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium" data-testid="text-next-payment">
              {formatDate(user?.nextPaymentDate)}
            </p>
            {user?.status !== "ATIVO" && (
              <Button 
                size="sm" 
                className="mt-2 w-full"
                onClick={() => setShowPaymentModal(true)}
                data-testid="button-pay-now"
              >
                Pagar Agora
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="credentials" className="space-y-4">
        <TabsList>
          <TabsTrigger value="credentials" data-testid="tab-credentials">
            Credenciais
          </TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">
            Histórico de Pagamentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="credentials">
          {isLocked ? (
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Lock className="h-5 w-5 text-destructive" />
                  <CardTitle>Credenciais Bloqueadas</CardTitle>
                </div>
                <CardDescription>
                  Realize o pagamento para desbloquear suas credenciais
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full md:w-auto"
                  onClick={() => setShowPaymentModal(true)}
                  data-testid="button-unlock"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Realizar Pagamento
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {credentialsQuery.data?.credentials?.length > 0 ? (
                credentialsQuery.data.credentials.map((credential: any) => {
                  const data = JSON.parse(credential.data);
                  return (
                    <Card key={credential.id}>
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-lg">
                            {credential.serviceId === "vectorizer-001" ? "Vectorizer" : "RemoveBG"}
                          </CardTitle>
                          <Badge variant="outline">
                            {format(new Date(credential.month), "MMMM yyyy", { locale: ptBR })}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {Object.entries(data).map(([key, value]) => (
                          <div key={key} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                            <span className="font-medium">{key}:</span>
                            <div className="flex items-center gap-2">
                              <code className="px-2 py-1 bg-background rounded">
                                {String(value)}
                              </code>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleCopy(String(value), key)}
                                data-testid={`button-copy-${key}`}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">
                      Nenhuma credencial disponível no momento
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Pagamentos</CardTitle>
              <CardDescription>
                Acompanhe todos os seus pagamentos realizados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {paymentsQuery.data?.length > 0 ? (
                <div className="space-y-3">
                  {paymentsQuery.data.map((payment: any) => (
                    <div 
                      key={payment.id}
                      className="flex justify-between items-center p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">
                          R$ {(payment.amount / 100).toFixed(2)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(payment.createdAt), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      </div>
                      <Badge 
                        variant={payment.status === "paid" ? "default" : "secondary"}
                        data-testid={`status-payment-${payment.id}`}
                      >
                        {payment.status === "paid" ? "Pago" : "Pendente"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum pagamento realizado ainda
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PaymentModal 
        open={showPaymentModal} 
        onOpenChange={setShowPaymentModal}
      />
    </div>
  );
}
```

## 📄 client/src/pages/AdminDashboard.tsx (Painel Admin)
```tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, CreditCard, Activity, DollarSign, Calendar, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { format, subDays, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();

  const statsQuery = useQuery({
    queryKey: ["/api/admin/stats"],
    refetchInterval: 60000, // Atualiza a cada minuto
  });

  const recentPaymentsQuery = useQuery({
    queryKey: ["/api/admin/payments/recent"],
  });

  const stats = statsQuery.data || {
    totalUsers: 0,
    activeUsers: 0,
    blockedUsers: 0,
    monthlyRevenue: 0,
    pendingPayments: 0,
    totalServices: 2,
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value / 100);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-title">
          Painel Administrativo
        </h1>
        <p className="text-muted-foreground mt-2">
          Visão geral do sistema e métricas importantes
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-users">
              {stats.totalUsers}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.activeUsers} ativos, {stats.blockedUsers} bloqueados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-revenue">
              {formatCurrency(stats.monthlyRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Mês atual ({format(new Date(), "MMMM", { locale: ptBR })})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagamentos Pendentes</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-pending">
              {stats.pendingPayments}
            </div>
            <p className="text-xs text-muted-foreground">
              Aguardando confirmação
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Ativação</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-activation-rate">
              {stats.totalUsers > 0 
                ? `${((stats.activeUsers / stats.totalUsers) * 100).toFixed(1)}%`
                : "0%"
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Usuários com status ativo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setLocation("/admin/users")}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gerenciar Usuários
            </CardTitle>
            <CardDescription>
              Visualize e edite informações de usuários
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setLocation("/admin/credentials")}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Gerenciar Credenciais
            </CardTitle>
            <CardDescription>
              Adicione ou edite credenciais mensais
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setLocation("/admin/services")}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Gerenciar Serviços
            </CardTitle>
            <CardDescription>
              Configure serviços e planos disponíveis
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Recent Payments */}
      <Card>
        <CardHeader>
          <CardTitle>Pagamentos Recentes</CardTitle>
          <CardDescription>
            Últimos 10 pagamentos processados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentPaymentsQuery.data?.map((payment: any) => (
              <div key={payment.id} className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{payment.user?.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(payment.createdAt), "dd/MM/yyyy 'às' HH:mm")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {formatCurrency(payment.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {payment.status === "paid" ? "Confirmado" : "Pendente"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

# 4️⃣ CONFIGURAÇÕES E CONSTANTES

## 📄 shared/constants.ts
```typescript
// Service IDs
export const DEFAULT_SERVICE_ID = "vectorizer-001";
export const REMOVEBG_SERVICE_ID = "removebg-001";

// Payment amounts (in cents)
export const VECTORIZER_MONTHLY_PRICE = 1750; // R$ 17,50

// RemoveBG Plans
export const REMOVEBG_PLANS = [
  { id: "removebg-basic", name: "Basic", price: 2990, credits: 50 },
  { id: "removebg-pro", name: "Pro", price: 4990, credits: 100 },
  { id: "removebg-ultimate", name: "Ultimate", price: 9990, credits: 250 },
];

// WhatsApp Support
export const WHATSAPP_NUMBER = "5544936184613";
export const WHATSAPP_SUPPORT_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

// Email Templates
export const EMAIL_FROM = process.env.RESEND_FROM_EMAIL || "noreply@vectorpro.com";
```

## 📄 .env (Variáveis de Ambiente)
```bash
# Database
DATABASE_URL=postgresql://user:pass@host/db

# Session
SESSION_SECRET=your-session-secret-here

# Payment
PUSHINPAY_TOKEN=your-pushinpay-token
PUSHINPAY_WEBHOOK_SECRET=your-webhook-secret
USE_PUSHINPAY_DEMO=false

# Email
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# RemoveBG
REMOVE_BG_API_KEY=your-removebg-api-key

# Environment
NODE_ENV=production
PORT=5000
```

---

# 5️⃣ TESTES AUTOMATIZADOS

## 📄 server/tests/cron-day6-blocking.test.ts (Teste Crítico)
```typescript
import { describe, test, expect, beforeEach, vi } from "vitest";
import type { User, UserService } from "../../shared/schema";

describe("Cron Day 6 - Payment Overdue Blocking", () => {
  test("deve bloquear usuário com pagamento vencido e enviar email", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const user = storage.createUser({
      email: "overdue@example.com",
      status: "ATIVO",
      nextPaymentDate: yesterday,
      isAdmin: false,
    });

    const result = await simulateDay6BlockOverdueUsers(storage, mockEmailService);

    expect(user.status).toBe("BLOQUEADO");
    expect(result.blockedCount).toBe(1);
    expect(mockEmails).toContainEqual({
      to: "overdue@example.com",
      subject: expect.stringContaining("Bloqueado")
    });
  });

  test("não deve bloquear admin mesmo com pagamento vencido", async () => {
    const admin = storage.createUser({
      email: "admin@example.com",
      status: "ATIVO",
      nextPaymentDate: yesterday,
      isAdmin: true, // Admin
    });

    const result = await simulateDay6BlockOverdueUsers(storage, mockEmailService);

    expect(admin.status).toBe("ATIVO"); // Admin não foi bloqueado
    expect(result.blockedCount).toBe(0);
  });
});
```

---

# 📊 RESUMO DE SEGURANÇA E MELHORIAS

## ✅ Correções Implementadas
1. **isAdmin**: Migrado de string para boolean (vulnerabilidade crítica corrigida)
2. **Validação de Sessão**: Verifica status do usuário em CADA requisição
3. **Isolamento de Credenciais**: Usuários só veem credenciais de serviços ativos
4. **Testes Automatizados**: Coverage para fluxo crítico de cobrança

## 🔒 Fluxos de Segurança
- Login → Sessão → Validação em tempo real → Acesso autorizado
- Pagamento → Webhook → Ativação → Liberação de credenciais
- Cron Day 6 → Verifica inadimplentes → Bloqueia acesso → Email

## 📈 Métricas do Sistema
- **Arquivos principais**: ~30 arquivos
- **Linhas de código**: ~8000 linhas
- **Tabelas no banco**: 9 tabelas
- **Testes**: 20+ testes de segurança
- **Cron jobs**: 6 tarefas automáticas

---

*Documento gerado para revisão técnica completa do VectorPro*
*Data: ${new Date().toLocaleString('pt-BR')}*