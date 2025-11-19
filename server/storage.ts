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
  type RemoveBgUsage,
  type InsertRemoveBgUsage,
  type RemoveBgPlan,
  type InsertRemoveBgPlan,
  type RemoveBgApiKey,
  type InsertRemoveBgApiKey,
  users,
  services,
  userServices,
  credentials,
  payments,
  passwordResets,
  removeBgUsage,
  removeBgPlans,
  removeBgApiKeys
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, isNull, or, like, desc, asc, and, sql } from "drizzle-orm";
import { encrypt, decrypt, maskApiKey } from "./utils/crypto";

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
  getUsersWithServices(): Promise<(User & { services: (UserService & { service: Service })[] })[]>;
  getUserWithServices(userId: string): Promise<(User & { services: (UserService & { service: Service })[] }) | undefined>;
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
  updateUserServicePlan(userId: string, serviceId: string, planId: string | null, credits: number): Promise<UserService | undefined>;
  getUserServiceWithPlan(userId: string, serviceId: string): Promise<(UserService & { plan?: RemoveBgPlan }) | undefined>;
  // Upsert operation: creates or updates a user service based on (userId, serviceId) unique pair
  upsertUserService(userService: InsertUserService): Promise<UserService>;
  
  // Credentials
  getCredential(id: string): Promise<Credential | undefined>;
  getCredentialsByUserId(userId: string): Promise<Credential[]>;
  getCredentialsByUserAndServices(userId: string, serviceIds: string[]): Promise<Credential[]>;
  getSharedCredentials(serviceId?: string): Promise<Credential[]>;
  getCredentialsByServiceId(serviceId: string): Promise<Credential[]>;
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
  
  // RemoveBG
  getRemoveBgUsageByUserId(userId: string): Promise<RemoveBgUsage[]>;
  getAllRemoveBgUsage(): Promise<RemoveBgUsage[]>;
  createRemoveBgUsage(usage: InsertRemoveBgUsage): Promise<RemoveBgUsage>;
  deleteRemoveBgUsage(id: string): Promise<boolean>;
  deleteRemoveBgUsageByIds(ids: string[]): Promise<number>;
  getRemoveBgUsageOlderThan(days: number): Promise<RemoveBgUsage[]>;
  countUserRemoveBgUsage(userId: string): Promise<number>;
  deleteOldestUserRemoveBgUsage(userId: string, keepCount: number): Promise<number>;
  getRemoveBgPlans(): Promise<RemoveBgPlan[]>;
  getRemoveBgPlan(id: string): Promise<RemoveBgPlan | undefined>;
  createRemoveBgPlan(plan: InsertRemoveBgPlan): Promise<RemoveBgPlan>;
  getUserCredits(userId: string, serviceId: string): Promise<number>;
  updateUserCredits(userId: string, serviceId: string, credits: number): Promise<boolean>;
  debitUserCredits(userId: string, serviceId: string, creditsToDebit: number): Promise<boolean>;
  
  // RemoveBG API Key Management
  listRemoveBgApiKeys(): Promise<RemoveBgApiKey[]>;
  createRemoveBgApiKey(data: InsertRemoveBgApiKey): Promise<RemoveBgApiKey>;
  activateRemoveBgApiKey(id: string): Promise<RemoveBgApiKey | undefined>;
  deleteRemoveBgApiKey(id: string): Promise<boolean>;
  getActiveRemoveBgApiKey(): Promise<RemoveBgApiKey | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private services: Map<string, Service>;
  private userServices: Map<string, UserService>;
  private credentials: Map<string, Credential>;
  private payments: Map<string, Payment>;
  private passwordResets: Map<string, PasswordReset>;
  private removeBgUsage: Map<string, RemoveBgUsage>;
  private removeBgPlans: Map<string, RemoveBgPlan>;
  private removeBgApiKeys: Map<string, RemoveBgApiKey>;

  constructor() {
    this.users = new Map();
    this.services = new Map();
    this.userServices = new Map();
    this.credentials = new Map();
    this.payments = new Map();
    this.passwordResets = new Map();
    this.removeBgUsage = new Map();
    this.removeBgPlans = new Map();
    this.removeBgApiKeys = new Map();
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
      discount: insertUser.discount || 0,
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

  async getUsersWithServices(): Promise<(User & { services: (UserService & { service: Service })[] })[]> {
    const allUsers = Array.from(this.users.values());
    const result = [];
    
    for (const user of allUsers) {
      const userServices = await this.getUserServices(user.id);
      const servicesWithDetails = [];
      
      for (const us of userServices) {
        const service = await this.getService(us.serviceId);
        if (service) {
          servicesWithDetails.push({
            ...us,
            service
          });
        }
      }
      
      result.push({
        ...user,
        services: servicesWithDetails
      });
    }
    
    return result;
  }

  async getUserWithServices(userId: string): Promise<(User & { services: (UserService & { service: Service })[] }) | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    
    const userServices = await this.getUserServices(userId);
    const servicesWithDetails = [];
    
    for (const us of userServices) {
      const service = await this.getService(us.serviceId);
      if (service) {
        servicesWithDetails.push({
          ...us,
          service
        });
      }
    }
    
    return {
      ...user,
      services: servicesWithDetails
    };
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
      creditsAvailable: insertUserService.creditsAvailable ?? null,
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

  async updateUserServicePlan(userId: string, serviceId: string, planId: string | null, credits: number): Promise<UserService | undefined> {
    const userService = await this.getUserService(userId, serviceId);
    if (!userService) return undefined;

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(5);

    const updatedUserService = { 
      ...userService, 
      planId,
      creditsAvailable: credits,
      proximoPagamento: nextMonth
    };
    
    this.userServices.set(userService.id, updatedUserService);
    return updatedUserService;
  }

  async getUserServiceWithPlan(userId: string, serviceId: string): Promise<(UserService & { plan?: RemoveBgPlan }) | undefined> {
    const userService = await this.getUserService(userId, serviceId);
    if (!userService) return undefined;

    let plan: RemoveBgPlan | undefined = undefined;
    if (userService.planId) {
      plan = await this.getRemoveBgPlan(userService.planId);
    }

    return { ...userService, plan };
  }

  async upsertUserService(insertUserService: InsertUserService): Promise<UserService> {
    const existing = await this.getUserService(insertUserService.userId, insertUserService.serviceId);
    
    if (existing) {
      // Update existing UserService
      const updated = await this.updateUserService(existing.id, insertUserService);
      if (!updated) {
        throw new Error("Failed to update UserService");
      }
      return updated;
    } else {
      // Create new UserService
      return await this.createUserService(insertUserService);
    }
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

  async getCredentialsByUserAndServices(userId: string, serviceIds: string[]): Promise<Credential[]> {
    return Array.from(this.credentials.values()).filter(
      (cred) => cred.userId === userId && serviceIds.includes(cred.serviceId || 'vectorizer-001')
    );
  }

  async getSharedCredentials(serviceId?: string): Promise<Credential[]> {
    return Array.from(this.credentials.values()).filter(
      (cred) => {
        const isShared = cred.userId === null || cred.userId === undefined;
        if (!serviceId) return isShared;
        return isShared && (cred.serviceId === serviceId || cred.serviceId === null);
      }
    );
  }

  async getCredentialsByServiceId(serviceId: string): Promise<Credential[]> {
    return Array.from(this.credentials.values()).filter(
      (cred) => cred.serviceId === serviceId || (cred.serviceId === null && serviceId === "vectorizer-001"),
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

  // RemoveBG
  async getRemoveBgUsageByUserId(userId: string): Promise<RemoveBgUsage[]> {
    return Array.from(this.removeBgUsage.values()).filter(
      (usage) => usage.userId === userId,
    );
  }

  async getAllRemoveBgUsage(): Promise<RemoveBgUsage[]> {
    return Array.from(this.removeBgUsage.values());
  }

  async createRemoveBgUsage(insertUsage: InsertRemoveBgUsage): Promise<RemoveBgUsage> {
    const id = randomUUID();
    const usage: RemoveBgUsage = {
      id,
      userId: insertUsage.userId,
      serviceId: insertUsage.serviceId,
      creditsUsed: insertUsage.creditsUsed,
      resolutionMp: insertUsage.resolutionMp,
      imagePath: insertUsage.imagePath ?? null,
      originalImagePath: insertUsage.originalImagePath ?? null,
      createdAt: new Date(),
    };
    this.removeBgUsage.set(id, usage);
    return usage;
  }

  async deleteRemoveBgUsage(id: string): Promise<boolean> {
    return this.removeBgUsage.delete(id);
  }

  async deleteRemoveBgUsageByIds(ids: string[]): Promise<number> {
    let deletedCount = 0;
    for (const id of ids) {
      if (this.removeBgUsage.delete(id)) {
        deletedCount++;
      }
    }
    return deletedCount;
  }

  async getRemoveBgUsageOlderThan(days: number): Promise<RemoveBgUsage[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return Array.from(this.removeBgUsage.values()).filter(
      (usage) => usage.createdAt < cutoffDate
    );
  }

  async countUserRemoveBgUsage(userId: string): Promise<number> {
    return Array.from(this.removeBgUsage.values()).filter(
      (usage) => usage.userId === userId
    ).length;
  }

  async deleteOldestUserRemoveBgUsage(userId: string, keepCount: number): Promise<number> {
    const userUsage = Array.from(this.removeBgUsage.values())
      .filter((usage) => usage.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    if (userUsage.length <= keepCount) {
      return 0;
    }
    
    const toDelete = userUsage.slice(keepCount);
    let deletedCount = 0;
    
    for (const usage of toDelete) {
      if (this.removeBgUsage.delete(usage.id)) {
        deletedCount++;
      }
    }
    
    return deletedCount;
  }

  async getRemoveBgPlans(): Promise<RemoveBgPlan[]> {
    return Array.from(this.removeBgPlans.values());
  }

  async getRemoveBgPlan(id: string): Promise<RemoveBgPlan | undefined> {
    return this.removeBgPlans.get(id);
  }

  async createRemoveBgPlan(insertPlan: InsertRemoveBgPlan): Promise<RemoveBgPlan> {
    const id = randomUUID();
    const plan: RemoveBgPlan = {
      id,
      name: insertPlan.name,
      credits: insertPlan.credits,
      price: insertPlan.price,
      createdAt: new Date(),
    };
    this.removeBgPlans.set(id, plan);
    return plan;
  }

  async getUserCredits(userId: string, serviceId: string): Promise<number> {
    const userService = Array.from(this.userServices.values()).find(
      (us) => us.userId === userId && us.serviceId === serviceId,
    );
    return userService?.creditsAvailable || 0;
  }

  async updateUserCredits(userId: string, serviceId: string, credits: number): Promise<boolean> {
    const userService = Array.from(this.userServices.values()).find(
      (us) => us.userId === userId && us.serviceId === serviceId,
    );
    if (!userService) return false;
    
    const updatedService = { ...userService, creditsAvailable: credits };
    this.userServices.set(userService.id, updatedService);
    return true;
  }

  async debitUserCredits(userId: string, serviceId: string, creditsToDebit: number): Promise<boolean> {
    const userService = Array.from(this.userServices.values()).find(
      (us) => us.userId === userId && us.serviceId === serviceId,
    );
    if (!userService || userService.creditsAvailable === null || userService.creditsAvailable < creditsToDebit) {
      return false;
    }
    
    const updatedService = { ...userService, creditsAvailable: userService.creditsAvailable - creditsToDebit };
    this.userServices.set(userService.id, updatedService);
    return true;
  }

  // RemoveBG API Key Management
  async listRemoveBgApiKeys(): Promise<RemoveBgApiKey[]> {
    return Array.from(this.removeBgApiKeys.values());
  }

  async createRemoveBgApiKey(data: InsertRemoveBgApiKey): Promise<RemoveBgApiKey> {
    const id = randomUUID();
    const apiKey: RemoveBgApiKey = {
      id,
      label: data.label,
      apiKeyEncrypted: data.apiKeyEncrypted,
      isActive: data.isActive || false,
      createdAt: new Date(),
      lastUsedAt: null,
      createdBy: data.createdBy,
    };
    this.removeBgApiKeys.set(id, apiKey);
    return apiKey;
  }

  async activateRemoveBgApiKey(id: string): Promise<RemoveBgApiKey | undefined> {
    const apiKey = this.removeBgApiKeys.get(id);
    if (!apiKey) return undefined;

    // Deactivate all other keys
    for (const key of Array.from(this.removeBgApiKeys.values())) {
      if (key.id !== id) {
        key.isActive = false;
      }
    }

    // Activate the selected key
    apiKey.isActive = true;
    this.removeBgApiKeys.set(id, apiKey);
    return apiKey;
  }

  async deleteRemoveBgApiKey(id: string): Promise<boolean> {
    return this.removeBgApiKeys.delete(id);
  }

  async getActiveRemoveBgApiKey(): Promise<RemoveBgApiKey | undefined> {
    return Array.from(this.removeBgApiKeys.values()).find(key => key.isActive);
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

  async getUsersWithServices(): Promise<(User & { services: (UserService & { service: Service })[] })[]> {
    // Get all users
    const allUsers = await this.db.select().from(users);
    
    // Get all user services with service details in one query
    const allUserServices = await this.db
      .select({
        userService: userServices,
        service: services
      })
      .from(userServices)
      .leftJoin(services, eq(userServices.serviceId, services.id));
    
    // Group services by user
    const servicesByUser = new Map<string, (UserService & { service: Service })[]>();
    for (const row of allUserServices) {
      if (!row.userService || !row.service) continue;
      
      const userId = row.userService.userId;
      if (!servicesByUser.has(userId)) {
        servicesByUser.set(userId, []);
      }
      
      servicesByUser.get(userId)!.push({
        ...row.userService,
        service: row.service
      });
    }
    
    // Combine users with their services
    return allUsers.map(user => ({
      ...user,
      services: servicesByUser.get(user.id) || []
    }));
  }

  async getUserWithServices(userId: string): Promise<(User & { services: (UserService & { service: Service })[] }) | undefined> {
    // Get the user
    const userResult = await this.db.select().from(users).where(eq(users.id, userId));
    const user = userResult[0];
    if (!user) return undefined;
    
    // Get user services with service details
    const userServicesResult = await this.db
      .select({
        userService: userServices,
        service: services
      })
      .from(userServices)
      .leftJoin(services, eq(userServices.serviceId, services.id))
      .where(eq(userServices.userId, userId));
    
    const servicesWithDetails = userServicesResult
      .filter(row => row.userService && row.service)
      .map(row => ({
        ...row.userService!,
        service: row.service!
      }));
    
    return {
      ...user,
      services: servicesWithDetails
    };
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

  async updateUserServicePlan(userId: string, serviceId: string, planId: string | null, credits: number): Promise<UserService | undefined> {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(5);

    const result = await this.db.update(userServices)
      .set({ 
        planId,
        creditsAvailable: credits,
        proximoPagamento: nextMonth
      })
      .where(and(
        eq(userServices.userId, userId),
        eq(userServices.serviceId, serviceId)
      ))
      .returning();
    
    return result[0];
  }

  async getUserServiceWithPlan(userId: string, serviceId: string): Promise<(UserService & { plan?: RemoveBgPlan }) | undefined> {
    const userServiceResult = await this.db.select().from(userServices)
      .where(and(
        eq(userServices.userId, userId),
        eq(userServices.serviceId, serviceId)
      ));
    
    const userService = userServiceResult[0];
    if (!userService) return undefined;

    let plan: RemoveBgPlan | undefined = undefined;
    if (userService.planId) {
      const planResult = await this.db.select().from(removeBgPlans)
        .where(eq(removeBgPlans.id, userService.planId));
      plan = planResult[0];
    }

    return { ...userService, plan };
  }

  async upsertUserService(insertUserService: InsertUserService): Promise<UserService> {
    const existing = await this.getUserService(insertUserService.userId, insertUserService.serviceId);
    
    if (existing) {
      // Update existing UserService
      const updated = await this.updateUserService(existing.id, insertUserService);
      if (!updated) {
        throw new Error("Failed to update UserService");
      }
      return updated;
    } else {
      // Create new UserService
      return await this.createUserService(insertUserService);
    }
  }

  // Credentials
  async getCredential(id: string): Promise<Credential | undefined> {
    const result = await this.db.select().from(credentials).where(eq(credentials.id, id));
    return result[0];
  }

  async getCredentialsByUserId(userId: string): Promise<Credential[]> {
    return await this.db.select().from(credentials).where(eq(credentials.userId, userId));
  }

  async getCredentialsByUserAndServices(userId: string, serviceIds: string[]): Promise<Credential[]> {
    // Get credentials for this user that belong to any of the specified services
    // For backward compatibility, treat null serviceId as vectorizer-001
    const conditions = serviceIds.map(serviceId => 
      or(
        and(eq(credentials.userId, userId), eq(credentials.serviceId, serviceId)),
        and(eq(credentials.userId, userId), isNull(credentials.serviceId), eq(sql`${serviceId}`, 'vectorizer-001'))
      )
    );
    
    if (conditions.length === 0) return [];
    
    return await this.db.select().from(credentials).where(
      conditions.length === 1 ? conditions[0] : or(...conditions)
    );
  }

  async getSharedCredentials(serviceId?: string): Promise<Credential[]> {
    // If serviceId provided, filter by that service. Otherwise return all shared credentials.
    // Also consider null serviceId as vectorizer-001 for backward compatibility
    if (serviceId) {
      return await this.db.select().from(credentials).where(
        and(
          isNull(credentials.userId),
          or(
            eq(credentials.serviceId, serviceId),
            // For backward compatibility, null serviceId means vectorizer-001
            and(isNull(credentials.serviceId), eq(sql`${serviceId}`, 'vectorizer-001'))
          )
        )
      );
    }
    return await this.db.select().from(credentials).where(isNull(credentials.userId));
  }

  async getCredentialsByServiceId(serviceId: string): Promise<Credential[]> {
    // Get all credentials for a specific service
    // For backward compatibility, null serviceId is treated as vectorizer-001
    return await this.db.select().from(credentials).where(
      or(
        eq(credentials.serviceId, serviceId),
        and(isNull(credentials.serviceId), eq(sql`${serviceId}`, 'vectorizer-001'))
      )
    );
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

  // RemoveBG
  async getRemoveBgUsageByUserId(userId: string): Promise<RemoveBgUsage[]> {
    return await this.db.select().from(removeBgUsage).where(eq(removeBgUsage.userId, userId));
  }

  async getAllRemoveBgUsage(): Promise<RemoveBgUsage[]> {
    return await this.db.select().from(removeBgUsage);
  }

  async createRemoveBgUsage(insertUsage: InsertRemoveBgUsage): Promise<RemoveBgUsage> {
    const result = await this.db.insert(removeBgUsage).values(insertUsage).returning();
    return result[0];
  }

  async deleteRemoveBgUsage(id: string): Promise<boolean> {
    const result = await this.db.delete(removeBgUsage)
      .where(eq(removeBgUsage.id, id))
      .returning();
    return result.length > 0;
  }

  async deleteRemoveBgUsageByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    
    const result = await this.db.delete(removeBgUsage)
      .where(sql`${removeBgUsage.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`)
      .returning();
    return result.length;
  }

  async getRemoveBgUsageOlderThan(days: number): Promise<RemoveBgUsage[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return await this.db.select()
      .from(removeBgUsage)
      .where(sql`${removeBgUsage.createdAt} < ${cutoffDate}`);
  }

  async countUserRemoveBgUsage(userId: string): Promise<number> {
    const result = await this.db.select({ count: sql<number>`count(*)::int` })
      .from(removeBgUsage)
      .where(eq(removeBgUsage.userId, userId));
    return result[0]?.count || 0;
  }

  async deleteOldestUserRemoveBgUsage(userId: string, keepCount: number): Promise<number> {
    // Get user's usage records sorted by date (newest first)
    const userUsage = await this.db.select()
      .from(removeBgUsage)
      .where(eq(removeBgUsage.userId, userId))
      .orderBy(desc(removeBgUsage.createdAt));
    
    if (userUsage.length <= keepCount) {
      return 0;
    }
    
    // Get IDs of records to delete (all except the newest keepCount)
    const idsToDelete = userUsage.slice(keepCount).map(u => u.id);
    
    if (idsToDelete.length === 0) {
      return 0;
    }
    
    const result = await this.db.delete(removeBgUsage)
      .where(sql`${removeBgUsage.id} IN (${sql.join(idsToDelete.map(id => sql`${id}`), sql`, `)})`)
      .returning();
    
    return result.length;
  }

  async getRemoveBgPlans(): Promise<RemoveBgPlan[]> {
    return await this.db.select().from(removeBgPlans);
  }

  async getRemoveBgPlan(id: string): Promise<RemoveBgPlan | undefined> {
    const result = await this.db.select().from(removeBgPlans).where(eq(removeBgPlans.id, id));
    return result[0];
  }

  async createRemoveBgPlan(insertPlan: InsertRemoveBgPlan): Promise<RemoveBgPlan> {
    const result = await this.db.insert(removeBgPlans).values(insertPlan).returning();
    return result[0];
  }

  async getUserCredits(userId: string, serviceId: string): Promise<number> {
    const result = await this.db.select().from(userServices)
      .where(and(
        eq(userServices.userId, userId),
        eq(userServices.serviceId, serviceId)
      ));
    return result[0]?.creditsAvailable || 0;
  }

  async updateUserCredits(userId: string, serviceId: string, credits: number): Promise<boolean> {
    const result = await this.db.update(userServices)
      .set({ creditsAvailable: credits })
      .where(and(
        eq(userServices.userId, userId),
        eq(userServices.serviceId, serviceId)
      ))
      .returning();
    return result.length > 0;
  }

  async debitUserCredits(userId: string, serviceId: string, creditsToDebit: number): Promise<boolean> {
    const currentUserService = await this.db.select().from(userServices)
      .where(and(
        eq(userServices.userId, userId),
        eq(userServices.serviceId, serviceId)
      ));
    
    if (!currentUserService[0] || currentUserService[0].creditsAvailable === null || currentUserService[0].creditsAvailable < creditsToDebit) {
      return false;
    }

    const result = await this.db.update(userServices)
      .set({ creditsAvailable: currentUserService[0].creditsAvailable - creditsToDebit })
      .where(and(
        eq(userServices.userId, userId),
        eq(userServices.serviceId, serviceId)
      ))
      .returning();
    return result.length > 0;
  }

  // RemoveBG API Key Management
  async listRemoveBgApiKeys(): Promise<RemoveBgApiKey[]> {
    return await this.db.select().from(removeBgApiKeys)
      .orderBy(desc(removeBgApiKeys.createdAt));
  }

  async createRemoveBgApiKey(data: InsertRemoveBgApiKey): Promise<RemoveBgApiKey> {
    const result = await this.db.insert(removeBgApiKeys).values(data).returning();
    return result[0];
  }

  async activateRemoveBgApiKey(id: string): Promise<RemoveBgApiKey | undefined> {
    // First deactivate all keys
    await this.db.update(removeBgApiKeys)
      .set({ isActive: false });
    
    // Then activate the selected key
    const result = await this.db.update(removeBgApiKeys)
      .set({ isActive: true })
      .where(eq(removeBgApiKeys.id, id))
      .returning();
    
    return result[0];
  }

  async deleteRemoveBgApiKey(id: string): Promise<boolean> {
    const result = await this.db.delete(removeBgApiKeys)
      .where(eq(removeBgApiKeys.id, id))
      .returning();
    return result.length > 0;
  }

  async getActiveRemoveBgApiKey(): Promise<RemoveBgApiKey | undefined> {
    const result = await this.db.select().from(removeBgApiKeys)
      .where(eq(removeBgApiKeys.isActive, true))
      .limit(1);
    
    // Update lastUsedAt if we found an active key
    if (result[0]) {
      this.db.update(removeBgApiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(removeBgApiKeys.id, result[0].id))
        .execute()
        .catch(err => console.error("Failed to update lastUsedAt:", err));
    }
    
    return result[0];
  }
}

export const storage = new PostgresStorage();
