import { 
  type User, 
  type InsertUser,
  type Credential,
  type InsertCredential,
  type Payment,
  type InsertPayment,
  users,
  credentials,
  payments
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, isNull, or } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  // Credentials
  getCredential(id: string): Promise<Credential | undefined>;
  getCredentialsByUserId(userId: string): Promise<Credential[]>;
  getSharedCredentials(): Promise<Credential[]>;
  getAllCredentials(): Promise<Credential[]>;
  createCredential(credential: InsertCredential): Promise<Credential>;
  updateCredential(id: string, credential: Partial<Credential>): Promise<Credential | undefined>;
  deleteCredential(id: string): Promise<boolean>;
  
  // Payments
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentsByUserId(userId: string): Promise<Payment[]>;
  getAllPayments(): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, payment: Partial<Payment>): Promise<Payment | undefined>;
  getPaymentByTxid(txid: string): Promise<Payment | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private credentials: Map<string, Credential>;
  private payments: Map<string, Payment>;

  constructor() {
    this.users = new Map();
    this.credentials = new Map();
    this.payments = new Map();
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      email: insertUser.email,
      password: insertUser.password,
      status: insertUser.status || "INATIVO",
      isAdmin: insertUser.isAdmin || "false",
      id,
      ultimoPagamento: null,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  // Credentials
  async getCredential(id: string): Promise<Credential | undefined> {
    return this.credentials.get(id);
  }

  async getCredentialsByUserId(userId: string): Promise<Credential[]> {
    return Array.from(this.credentials.values()).filter(
      (cred) => cred.userId === userId,
    );
  }

  async getSharedCredentials(): Promise<Credential[]> {
    return Array.from(this.credentials.values()).filter(
      (cred) => cred.userId === null || cred.userId === undefined,
    );
  }

  async getAllCredentials(): Promise<Credential[]> {
    return Array.from(this.credentials.values());
  }

  async createCredential(insertCredential: InsertCredential): Promise<Credential> {
    const id = randomUUID();
    const credential: Credential = { 
      data: insertCredential.data,
      month: insertCredential.month,
      userId: insertCredential.userId ?? null,
      id 
    };
    this.credentials.set(id, credential);
    return credential;
  }

  async updateCredential(id: string, updates: Partial<Credential>): Promise<Credential | undefined> {
    const credential = this.credentials.get(id);
    if (!credential) return undefined;
    
    const updatedCredential = { ...credential, ...updates };
    this.credentials.set(id, updatedCredential);
    return updatedCredential;
  }

  async deleteCredential(id: string): Promise<boolean> {
    return this.credentials.delete(id);
  }

  // Payments
  async getPayment(id: string): Promise<Payment | undefined> {
    return this.payments.get(id);
  }

  async getPaymentsByUserId(userId: string): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter(
      (payment) => payment.userId === userId,
    );
  }

  async getAllPayments(): Promise<Payment[]> {
    return Array.from(this.payments.values());
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const id = randomUUID();
    // amount is always string (cents as string like "1750") per InsertPayment type
    const payment: Payment = { 
      userId: insertPayment.userId,
      amount: insertPayment.amount, // Already string from schema
      status: insertPayment.status || "pending",
      txid: insertPayment.txid || null,
      id,
      createdAt: new Date(),
    };
    this.payments.set(id, payment);
    return payment;
  }

  async updatePayment(id: string, updates: Partial<Payment>): Promise<Payment | undefined> {
    const payment = this.payments.get(id);
    if (!payment) return undefined;
    
    const updatedPayment = { ...payment, ...updates };
    this.payments.set(id, updatedPayment);
    return updatedPayment;
  }

  async getPaymentByTxid(txid: string): Promise<Payment | undefined> {
    return Array.from(this.payments.values()).find(
      (payment) => payment.txid === txid,
    );
  }
}

// PostgreSQL storage using Drizzle ORM
class PostgresStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;

  constructor() {
    const sql = neon(process.env.DATABASE_URL!);
    this.db = drizzle(sql);
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await this.db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await this.db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  // Credentials
  async getCredential(id: string): Promise<Credential | undefined> {
    const result = await this.db.select().from(credentials).where(eq(credentials.id, id));
    return result[0];
  }

  async getCredentialsByUserId(userId: string): Promise<Credential[]> {
    return await this.db.select().from(credentials).where(eq(credentials.userId, userId));
  }

  async getSharedCredentials(): Promise<Credential[]> {
    return await this.db.select().from(credentials).where(isNull(credentials.userId));
  }

  async getAllCredentials(): Promise<Credential[]> {
    return await this.db.select().from(credentials);
  }

  async createCredential(insertCredential: InsertCredential): Promise<Credential> {
    const result = await this.db.insert(credentials).values(insertCredential).returning();
    return result[0];
  }

  async updateCredential(id: string, updates: Partial<Credential>): Promise<Credential | undefined> {
    const result = await this.db.update(credentials).set(updates).where(eq(credentials.id, id)).returning();
    return result[0];
  }

  async deleteCredential(id: string): Promise<boolean> {
    const result = await this.db.delete(credentials).where(eq(credentials.id, id)).returning();
    return result.length > 0;
  }

  // Payments
  async getPayment(id: string): Promise<Payment | undefined> {
    const result = await this.db.select().from(payments).where(eq(payments.id, id));
    return result[0];
  }

  async getPaymentsByUserId(userId: string): Promise<Payment[]> {
    return await this.db.select().from(payments).where(eq(payments.userId, userId));
  }

  async getAllPayments(): Promise<Payment[]> {
    return await this.db.select().from(payments);
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const result = await this.db.insert(payments).values(insertPayment).returning();
    return result[0];
  }

  async updatePayment(id: string, updates: Partial<Payment>): Promise<Payment | undefined> {
    const result = await this.db.update(payments).set(updates).where(eq(payments.id, id)).returning();
    return result[0];
  }

  async getPaymentByTxid(txid: string): Promise<Payment | undefined> {
    const result = await this.db.select().from(payments).where(eq(payments.txid, txid!));
    return result[0];
  }
}

export const storage = new PostgresStorage();
