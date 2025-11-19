import { 
  type User, 
  type InsertUser,
  type Service,
  type InsertService,
  type UserService,
  type InsertUserService,
  type Credential,
  type InsertCredential,
  type Payment,
  type InsertPayment,
  type PasswordReset,
  type InsertPasswordReset,
  users,
  services,
  userServices,
  credentials,
  payments,
  passwordResets
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, isNull, or, like, desc, asc, and, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUsersWithFilters(filters: {
    status?: "ATIVO" | "INATIVO" | "BLOQUEADO";
    search?: string;
    sort?: "ultimoPagamento_desc" | "ultimoPagamento_asc" | "cadastro_desc" | "cadastro_asc";
  }): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  // Services
  getService(id: string): Promise<Service | undefined>;
  getActiveServices(): Promise<Service[]>;
  getAllServices(): Promise<Service[]>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: string, service: Partial<Service>): Promise<Service | undefined>;
  
  // User Services (Subscriptions)
  getUserService(userId: string, serviceId: string): Promise<UserService | undefined>;
  getUserServices(userId: string): Promise<UserService[]>;
  getUserServicesByServiceId(serviceId: string): Promise<UserService[]>;
  createUserService(userService: InsertUserService): Promise<UserService>;
  updateUserService(id: string, userService: Partial<UserService>): Promise<UserService | undefined>;
  
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
  deletePayment(id: string): Promise<boolean>;
  getPaymentByTxid(txid: string): Promise<Payment | undefined>;
  getPaymentByPushinpayId(pushinpayId: string): Promise<Payment | undefined>;
  
  // Password Resets
  createPasswordReset(reset: InsertPasswordReset): Promise<PasswordReset>;
  getPasswordResetByToken(token: string): Promise<PasswordReset | undefined>;
  deletePasswordReset(id: string): Promise<boolean>;
  deletePasswordResetsByUserId(userId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private services: Map<string, Service>;
  private userServices: Map<string, UserService>;
  private credentials: Map<string, Credential>;
  private payments: Map<string, Payment>;
  private passwordResets: Map<string, PasswordReset>;

  constructor() {
    this.users = new Map();
    this.services = new Map();
    this.userServices = new Map();
    this.credentials = new Map();
    this.payments = new Map();
    this.passwordResets = new Map();
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

  async getUsersWithFilters(filters: {
    status?: "ATIVO" | "INATIVO" | "BLOQUEADO";
    search?: string;
    sort?: "ultimoPagamento_desc" | "ultimoPagamento_asc" | "cadastro_desc" | "cadastro_asc";
  }): Promise<User[]> {
    let result = Array.from(this.users.values());

    if (filters.status) {
      result = result.filter((user) => user.status === filters.status);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter((user) =>
        user.email.toLowerCase().includes(searchLower)
      );
    }

    if (filters.sort) {
      result.sort((a, b) => {
        switch (filters.sort) {
          case "ultimoPagamento_desc":
            return (b.ultimoPagamento?.getTime() || 0) - (a.ultimoPagamento?.getTime() || 0);
          case "ultimoPagamento_asc":
            return (a.ultimoPagamento?.getTime() || 0) - (b.ultimoPagamento?.getTime() || 0);
          case "cadastro_desc":
            return b.id.localeCompare(a.id);
          case "cadastro_asc":
            return a.id.localeCompare(b.id);
          default:
            return 0;
        }
      });
    }

    return result;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      email: insertUser.email,
      password: insertUser.password || null,
      status: insertUser.status || "INATIVO",
      isAdmin: insertUser.isAdmin || "false",
      id,
      ultimoPagamento: null,
      nextPaymentDate: null,
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

  // Services
  async getService(id: string): Promise<Service | undefined> {
    return this.services.get(id);
  }

  async getActiveServices(): Promise<Service[]> {
    return Array.from(this.services.values()).filter(
      (service) => service.ativo === true,
    );
  }

  async getAllServices(): Promise<Service[]> {
    return Array.from(this.services.values());
  }

  async createService(insertService: InsertService): Promise<Service> {
    const id = randomUUID();
    const service: Service = {
      id,
      nome: insertService.nome,
      descricao: insertService.descricao ?? null,
      preco: insertService.preco,
      ativo: insertService.ativo ?? true,
      createdAt: new Date(),
    };
    this.services.set(id, service);
    return service;
  }

  async updateService(id: string, updates: Partial<Service>): Promise<Service | undefined> {
    const service = this.services.get(id);
    if (!service) return undefined;
    
    const updatedService = { ...service, ...updates };
    this.services.set(id, updatedService);
    return updatedService;
  }

  // User Services (Subscriptions)
  async getUserService(userId: string, serviceId: string): Promise<UserService | undefined> {
    return Array.from(this.userServices.values()).find(
      (us) => us.userId === userId && us.serviceId === serviceId,
    );
  }

  async getUserServices(userId: string): Promise<UserService[]> {
    return Array.from(this.userServices.values()).filter(
      (us) => us.userId === userId,
    );
  }

  async getUserServicesByServiceId(serviceId: string): Promise<UserService[]> {
    return Array.from(this.userServices.values()).filter(
      (us) => us.serviceId === serviceId,
    );
  }

  async createUserService(insertUserService: InsertUserService): Promise<UserService> {
    const id = randomUUID();
    const userService: UserService = {
      id,
      userId: insertUserService.userId,
      serviceId: insertUserService.serviceId,
      status: insertUserService.status || "INATIVO",
      ultimoPagamento: insertUserService.ultimoPagamento ?? null,
      proximoPagamento: insertUserService.proximoPagamento ?? null,
      createdAt: new Date(),
    };
    this.userServices.set(id, userService);
    return userService;
  }

  async updateUserService(id: string, updates: Partial<UserService>): Promise<UserService | undefined> {
    const userService = this.userServices.get(id);
    if (!userService) return undefined;
    
    const updatedUserService = { ...userService, ...updates };
    this.userServices.set(id, updatedUserService);
    return updatedUserService;
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
      serviceId: insertCredential.serviceId ?? null,
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
      serviceId: insertPayment.serviceId ?? null,
      amount: insertPayment.amount, // Already string from schema
      status: insertPayment.status || "pending",
      txid: insertPayment.txid || null,
      pushinpayId: insertPayment.pushinpayId || null,
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

  async deletePayment(id: string): Promise<boolean> {
    return this.payments.delete(id);
  }

  async getPaymentByTxid(txid: string): Promise<Payment | undefined> {
    // Case-insensitive comparison for TXID
    const txidLower = txid.toLowerCase();
    return Array.from(this.payments.values()).find(
      (payment) => payment.txid?.toLowerCase() === txidLower,
    );
  }

  async getPaymentByPushinpayId(pushinpayId: string): Promise<Payment | undefined> {
    // Case-insensitive comparison for PushinPay IDs
    const pushinpayIdLower = pushinpayId.toLowerCase();
    const pushinpayIdUpper = pushinpayId.toUpperCase();
    
    return Array.from(this.payments.values()).find(
      (payment) => {
        if (!payment.pushinpayId) return false;
        return payment.pushinpayId === pushinpayId || 
               payment.pushinpayId.toLowerCase() === pushinpayIdLower ||
               payment.pushinpayId.toUpperCase() === pushinpayIdUpper;
      }
    );
  }

  // Password Resets
  async createPasswordReset(insertReset: InsertPasswordReset): Promise<PasswordReset> {
    const id = randomUUID();
    const reset: PasswordReset = {
      id,
      userId: insertReset.userId,
      token: insertReset.token,
      expiresAt: insertReset.expiresAt,
      createdAt: new Date(),
    };
    this.passwordResets.set(id, reset);
    return reset;
  }

  async getPasswordResetByToken(token: string): Promise<PasswordReset | undefined> {
    return Array.from(this.passwordResets.values()).find(
      (reset) => reset.token === token,
    );
  }

  async deletePasswordReset(id: string): Promise<boolean> {
    return this.passwordResets.delete(id);
  }

  async deletePasswordResetsByUserId(userId: string): Promise<void> {
    const resets = Array.from(this.passwordResets.values()).filter(
      (reset) => reset.userId === userId,
    );
    resets.forEach((reset) => this.passwordResets.delete(reset.id));
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

  async getUsersWithFilters(filters: {
    status?: "ATIVO" | "INATIVO" | "BLOQUEADO";
    search?: string;
    sort?: "ultimoPagamento_desc" | "ultimoPagamento_asc" | "cadastro_desc" | "cadastro_asc";
  }): Promise<User[]> {
    let query = this.db.select().from(users);

    const conditions = [];
    if (filters.status) {
      conditions.push(eq(users.status, filters.status));
    }
    if (filters.search) {
      conditions.push(like(users.email, `%${filters.search}%`));
    }

    if (conditions.length > 0) {
      query = query.where(conditions.length === 1 ? conditions[0] : or(...conditions)!) as any;
    }

    if (filters.sort) {
      switch (filters.sort) {
        case "ultimoPagamento_desc":
          query = query.orderBy(desc(users.ultimoPagamento)) as any;
          break;
        case "ultimoPagamento_asc":
          query = query.orderBy(asc(users.ultimoPagamento)) as any;
          break;
        case "cadastro_desc":
          query = query.orderBy(desc(users.id)) as any;
          break;
        case "cadastro_asc":
          query = query.orderBy(asc(users.id)) as any;
          break;
      }
    } else {
      query = query.orderBy(desc(users.id)) as any;
    }

    return await query;
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

  // Services
  async getService(id: string): Promise<Service | undefined> {
    const result = await this.db.select().from(services).where(eq(services.id, id));
    return result[0];
  }

  async getActiveServices(): Promise<Service[]> {
    return await this.db.select().from(services).where(eq(services.ativo, true));
  }

  async getAllServices(): Promise<Service[]> {
    return await this.db.select().from(services);
  }

  async createService(insertService: InsertService): Promise<Service> {
    const result = await this.db.insert(services).values(insertService).returning();
    return result[0];
  }

  async updateService(id: string, updates: Partial<Service>): Promise<Service | undefined> {
    const result = await this.db.update(services).set(updates).where(eq(services.id, id)).returning();
    return result[0];
  }

  // User Services (Subscriptions)
  async getUserService(userId: string, serviceId: string): Promise<UserService | undefined> {
    const result = await this.db.select().from(userServices)
      .where(and(
        eq(userServices.userId, userId),
        eq(userServices.serviceId, serviceId)
      ));
    return result[0];
  }

  async getUserServices(userId: string): Promise<UserService[]> {
    return await this.db.select().from(userServices).where(eq(userServices.userId, userId));
  }

  async getUserServicesByServiceId(serviceId: string): Promise<UserService[]> {
    return await this.db.select().from(userServices).where(eq(userServices.serviceId, serviceId));
  }

  async createUserService(insertUserService: InsertUserService): Promise<UserService> {
    const result = await this.db.insert(userServices).values(insertUserService).returning();
    return result[0];
  }

  async updateUserService(id: string, updates: Partial<UserService>): Promise<UserService | undefined> {
    const result = await this.db.update(userServices).set(updates).where(eq(userServices.id, id)).returning();
    return result[0];
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

  async deletePayment(id: string): Promise<boolean> {
    const result = await this.db.delete(payments).where(eq(payments.id, id)).returning();
    return result.length > 0;
  }

  async getPaymentByTxid(txid: string): Promise<Payment | undefined> {
    // Case-insensitive search for TXID using SQL LOWER() function
    const result = await this.db.select()
      .from(payments)
      .where(sql`LOWER(${payments.txid}) = LOWER(${txid})`);
    return result[0];
  }

  async getPaymentByPushinpayId(pushinpayId: string): Promise<Payment | undefined> {
    // Case-insensitive search for PushinPay ID using SQL LOWER() function
    const result = await this.db.select()
      .from(payments)
      .where(sql`LOWER(${payments.pushinpayId}) = LOWER(${pushinpayId})`);
    return result[0];
  }

  // Password Resets
  async createPasswordReset(insertReset: InsertPasswordReset): Promise<PasswordReset> {
    const result = await this.db.insert(passwordResets).values(insertReset).returning();
    return result[0];
  }

  async getPasswordResetByToken(token: string): Promise<PasswordReset | undefined> {
    const result = await this.db.select().from(passwordResets).where(eq(passwordResets.token, token));
    return result[0];
  }

  async deletePasswordReset(id: string): Promise<boolean> {
    const result = await this.db.delete(passwordResets).where(eq(passwordResets.id, id)).returning();
    return result.length > 0;
  }

  async deletePasswordResetsByUserId(userId: string): Promise<void> {
    await this.db.delete(passwordResets).where(eq(passwordResets.userId, userId));
  }
}

export const storage = new PostgresStorage();
