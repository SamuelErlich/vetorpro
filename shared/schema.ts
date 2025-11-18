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
  amount: decimal("amount").notNull(),
  status: text("status").notNull().default("pending"),
  txid: text("txid"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  ultimoPagamento: true,
});

export const insertCredentialSchema = createInsertSchema(credentials).omit({
  id: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCredential = z.infer<typeof insertCredentialSchema>;
export type Credential = typeof credentials.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;
