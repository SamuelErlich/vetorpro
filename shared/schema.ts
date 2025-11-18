import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  status: text("status").notNull().default("INATIVO"),
  ultimoPagamento: timestamp("ultimo_pagamento"),
  nextPaymentDate: timestamp("next_payment_date"), // Data do próximo vencimento (mensal)
  isAdmin: text("is_admin").notNull().default("false"),
});

export const credentials = pgTable("credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  month: text("month").notNull(),
  data: text("data").notNull(),
});

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 0 }).notNull(), // Amount in cents as decimal string (e.g., "1750")
  status: text("status").notNull().default("pending"),
  txid: text("txid"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  ultimoPagamento: true,
  nextPaymentDate: true, // Calculado automaticamente ao processar pagamento
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCredential = z.infer<typeof insertCredentialSchema>;
export type Credential = typeof credentials.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;
