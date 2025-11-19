import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, boolean, integer } from "drizzle-orm/pg-core";
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
  isAdmin: text("is_admin").notNull().default("false"),
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
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const credentials = pgTable("credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  serviceId: varchar("service_id").references(() => services.id), // Null por enquanto, será preenchido na migration
  month: text("month").notNull(),
  data: text("data").notNull(),
});

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  serviceId: varchar("service_id").references(() => services.id), // Null por enquanto, será preenchido na migration
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
