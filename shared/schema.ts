import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, boolean, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Tabela de serviços disponíveis (ex: Vectorizer, futuros serviços)
export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  preco: decimal("preco", { precision: 10, scale: 2 }).notNull(), // Preço em reais (ex: "17.50")
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password"), // Nullable - senha criada via email quando usuário é criado pelo admin
  status: text("status").notNull().default("INATIVO"), // Mantido para compatibilidade com UI atual
  ultimoPagamento: timestamp("ultimo_pagamento"), // Mantido para compatibilidade
  nextPaymentDate: timestamp("next_payment_date"), // Mantido para compatibilidade
  isAdmin: boolean("is_admin").notNull().default(false),
  discount: integer("discount").notNull().default(0), // Percentage discount 0-100
});

// Tabela que representa assinatura de um usuário a um serviço
export const userServices = pgTable("user_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  serviceId: varchar("service_id").notNull().references(() => services.id),
  status: text("status").notNull().default("INATIVO"), // ATIVO, INATIVO, BLOQUEADO
  ultimoPagamento: timestamp("ultimo_pagamento"),
  proximoPagamento: timestamp("proximo_pagamento"), // Data do próximo vencimento
  creditsAvailable: integer("credits_available").default(0), // RemoveBG credits
  planId: varchar("plan_id").references(() => servicePlans.id), // Service plan reference
  credits: integer("credits").default(0), // Total credits available
  creditsUsed: integer("credits_used").default(0), // Credits consumed
  lastPaymentDate: timestamp("last_payment_date"), // Last successful payment
  trialEndsAt: timestamp("trial_ends_at"), // Trial expiration date
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => {
  return {
    // Unique constraint to prevent duplicate subscriptions
    userServiceUnique: unique("user_service_unique").on(table.userId, table.serviceId),
  };
});

export const credentials = pgTable("credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  serviceId: varchar("service_id").notNull().references(() => services.id), // Service ID obrigatório para isolamento de dados
  month: text("month").notNull(),
  data: text("data").notNull(),
});

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  serviceId: varchar("service_id").notNull().references(() => services.id), // Service ID obrigatório para rastreamento de pagamentos por serviço
  planId: varchar("plan_id").references(() => servicePlans.id), // Service plan reference (optional)
  amount: decimal("amount", { precision: 10, scale: 0 }).notNull(), // Amount in cents as decimal string (e.g., "1750")
  status: text("status").notNull().default("pending"),
  txid: text("txid"),
  pushinpayId: varchar("pushinpay_id"), // Stores PushinPay's EndToEndId for webhook matching
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const passwordResets = pgTable("password_resets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// RemoveBG usage tracking table
export const removeBgUsage = pgTable("removebg_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  serviceId: varchar("service_id").notNull().references(() => services.id),
  creditsUsed: integer("credits_used").notNull(),
  resolutionMp: decimal("resolution_mp", { precision: 5, scale: 2 }).notNull(),
  imagePath: text("image_path"),
  originalImagePath: text("original_image_path"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// RemoveBG plans table
export const removeBgPlans = pgTable("removebg_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  credits: integer("credits").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// RemoveBG API keys table for secure API key management
export const removeBgApiKeys = pgTable("removebg_api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  label: text("label").notNull(), // Descriptive name for the token
  apiKeyEncrypted: text("api_key_encrypted").notNull(), // Encrypted API key
  isActive: boolean("is_active").notNull().default(false), // Only one can be active
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  lastUsedAt: timestamp("last_used_at"), // Track when last used
  createdBy: varchar("created_by").notNull().references(() => users.id), // Admin who created it
});

// Categories table for organizing services
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  icon: text("icon"), // Lucide icon name
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Enhanced services table with categories and types
export const servicesV2 = pgTable("services_v2", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").references(() => categories.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  shortDescription: text("short_description"),
  icon: text("icon"), // Lucide icon name
  serviceType: text("service_type").notNull().default("COMPARTILHADO"), // COMPARTILHADO, INDIVIDUAL, API
  isHighlight: boolean("is_highlight").notNull().default(false), // Top seller in category
  sortOrder: integer("sort_order").notNull().default(0),
  features: text("features"), // JSON array of feature strings
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Service plans (Basic, Pro, Ultimate, etc.)
export const servicePlans = pgTable("service_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull().references(() => services.id),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  billingCycle: varchar("billing_cycle", { length: 20 }).notNull().default("monthly"), // monthly, quarterly, yearly
  features: text("features"), // JSON string of features array
  isActive: boolean("is_active").notNull().default(true),
  maxUsers: integer("max_users"),
  storageLimit: integer("storage_limit"), // em MB
  apiCallsLimit: integer("api_calls_limit"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Service accounts/credentials stock management
export const serviceAccounts = pgTable("service_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull().references(() => servicesV2.id),
  accountData: text("account_data").notNull(), // Encrypted JSON with credentials
  status: text("status").notNull().default("DISPONIVEL"), // DISPONIVEL, ATRIBUIDO, EXPIRADO, MANUTENCAO
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id),
  assignedToSubscriptionId: varchar("assigned_to_subscription_id").references(() => userSubscriptions.id),
  assignedAt: timestamp("assigned_at"),
  validUntil: timestamp("valid_until"), // For time-limited accounts
  notes: text("notes"), // Admin notes
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// User subscriptions to service plans
export const userSubscriptions = pgTable("user_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  servicePlanId: varchar("service_plan_id").notNull().references(() => servicePlans.id),
  status: text("status").notNull().default("PENDENTE"), // PENDENTE, ATIVO, PAUSADO, CANCELADO, EXPIRADO
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  nextBillingDate: timestamp("next_billing_date"),
  autoRenew: boolean("auto_renew").notNull().default(true),
  metadata: text("metadata"), // JSON with additional subscription data
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => {
  return {
    userSubscriptionUnique: unique("user_subscription_unique").on(table.userId, table.servicePlanId),
  };
});

// Insert schemas
export const insertServiceSchema = createInsertSchema(services).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  ultimoPagamento: true,
  nextPaymentDate: true, // Calculado automaticamente ao processar pagamento
}).extend({
  discount: z.number().int().min(0).max(100).optional().default(0), // Ensure discount is between 0-100
});

export const insertUserServiceSchema = createInsertSchema(userServices).omit({
  id: true,
  createdAt: true,
});

export const insertCredentialSchema = createInsertSchema(credentials).omit({
  id: true,
});

// Payment schema with amount as string (decimal column returns string)
export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
}).extend({
  amount: z.string(), // Override to explicitly accept string (cents as string)
});

export const insertPasswordResetSchema = createInsertSchema(passwordResets).omit({
  id: true,
  createdAt: true,
});

export const insertRemoveBgUsageSchema = createInsertSchema(removeBgUsage).omit({
  id: true,
  createdAt: true,
});

export const insertRemoveBgPlanSchema = createInsertSchema(removeBgPlans).omit({
  id: true,
  createdAt: true,
});

export const insertRemoveBgApiKeySchema = createInsertSchema(removeBgApiKeys).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCategorySchema = insertCategorySchema.partial().omit({
  id: true
});

export const insertServiceV2Schema = createInsertSchema(servicesV2).omit({
  id: true,
  createdAt: true,
});

export const insertServicePlanSchema = createInsertSchema(servicePlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateServicePlanSchema = insertServicePlanSchema.partial().omit({ 
  id: true 
});

export const insertServiceAccountSchema = createInsertSchema(serviceAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertUserService = z.infer<typeof insertUserServiceSchema>;
export type UserService = typeof userServices.$inferSelect;
export type InsertCredential = z.infer<typeof insertCredentialSchema>;
export type Credential = typeof credentials.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPasswordReset = z.infer<typeof insertPasswordResetSchema>;
export type PasswordReset = typeof passwordResets.$inferSelect;
export type InsertRemoveBgUsage = z.infer<typeof insertRemoveBgUsageSchema>;
export type RemoveBgUsage = typeof removeBgUsage.$inferSelect;
export type InsertRemoveBgPlan = z.infer<typeof insertRemoveBgPlanSchema>;
export type RemoveBgPlan = typeof removeBgPlans.$inferSelect;
export type InsertRemoveBgApiKey = z.infer<typeof insertRemoveBgApiKeySchema>;
export type RemoveBgApiKey = typeof removeBgApiKeys.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;
export type InsertServiceV2 = z.infer<typeof insertServiceV2Schema>;
export type ServiceV2 = typeof servicesV2.$inferSelect;
export type InsertServicePlan = z.infer<typeof insertServicePlanSchema>;
export type ServicePlan = typeof servicePlans.$inferSelect;
export type InsertServiceAccount = z.infer<typeof insertServiceAccountSchema>;
export type ServiceAccount = typeof serviceAccounts.$inferSelect;
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
