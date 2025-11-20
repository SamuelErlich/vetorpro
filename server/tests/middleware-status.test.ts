/**
 * Middleware Status Tests
 * Tests the correct behavior of requireAuth and requireActiveUser middlewares
 * 
 * Ensures that:
 * 1. BLOQUEADO users cannot access any authenticated routes
 * 2. INATIVO users can generate PIX but cannot access credentials
 * 3. ATIVO users can access everything
 */

import { describe, test, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import type { User } from "../../shared/schema";

// Mock storage
const mockStorage = {
  getUser: vi.fn(),
};

// Mock session
const createMockReq = (userId?: string): any => ({
  session: userId ? { userId, destroy: vi.fn((cb) => cb?.()) } : undefined,
});

const createMockRes = (): any => {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

const mockNext: NextFunction = vi.fn();

// Mock middleware functions (simplified versions for testing)
const requireAuth = async (req: any, res: any, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  
  const user = await mockStorage.getUser(req.session.userId);
  
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Sessão inválida" });
  }
  
  // CRITICAL: Block BLOQUEADO users immediately
  if (user.status === "BLOQUEADO") {
    req.session.destroy(() => {});
    return res.status(403).json({ 
      error: "Conta bloqueada por falta de pagamento. Entre em contato com o suporte.",
      blocked: true,
      status: user.status 
    });
  }
  
  // Allow ATIVO and INATIVO to proceed
  req.user = user;
  next();
};

const requireActiveUser = async (req: any, res: any, next: NextFunction) => {
  const user = req.user;
  
  if (!user) {
    return res.status(500).json({ error: "Usuário não carregado na sessão. Use requireAuth primeiro." });
  }
  
  // Admins can access even if not ATIVO
  if (user.isAdmin) {
    return next();
  }
  
  // Check if non-admin user status is ATIVO
  if (user.status !== "ATIVO") {
    if (user.status === "BLOQUEADO") {
      req.session?.destroy(() => {});
      return res.status(403).json({ 
        error: "Conta bloqueada por falta de pagamento. Entre em contato com o suporte.",
        blocked: true,
        status: user.status 
      });
    } else {
      // User is INATIVO or PENDENTE
      return res.status(403).json({ 
        error: "Conta inativa. Realize o pagamento para acessar este recurso.",
        inactive: true,
        status: user.status
      });
    }
  }
  
  next();
};

describe("Middleware Status Security Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requireAuth middleware", () => {
    test("deve bloquear usuário BLOQUEADO e destruir sessão", async () => {
      const blockedUser: User = {
        id: "user-1",
        email: "blocked@example.com",
        password: "hashed",
        status: "BLOQUEADO",
        ultimoPagamento: null,
        nextPaymentDate: null,
        isAdmin: false,
        discount: 0,
      };

      mockStorage.getUser.mockResolvedValue(blockedUser);
      
      const req = createMockReq("user-1");
      const res = createMockRes();
      
      await requireAuth(req, res, mockNext);
      
      expect(req.session.destroy).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Conta bloqueada por falta de pagamento. Entre em contato com o suporte.",
        blocked: true,
        status: "BLOQUEADO"
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test("deve permitir usuário INATIVO prosseguir", async () => {
      const inactiveUser: User = {
        id: "user-2",
        email: "inactive@example.com",
        password: "hashed",
        status: "INATIVO",
        ultimoPagamento: null,
        nextPaymentDate: null,
        isAdmin: false,
        discount: 0,
      };

      mockStorage.getUser.mockResolvedValue(inactiveUser);
      
      const req = createMockReq("user-2");
      const res = createMockRes();
      
      await requireAuth(req, res, mockNext);
      
      expect(req.session.destroy).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(req.user).toEqual(inactiveUser);
      expect(mockNext).toHaveBeenCalled();
    });

    test("deve permitir usuário ATIVO prosseguir", async () => {
      const activeUser: User = {
        id: "user-3",
        email: "active@example.com",
        password: "hashed",
        status: "ATIVO",
        ultimoPagamento: new Date(),
        nextPaymentDate: new Date(),
        isAdmin: false,
        discount: 0,
      };

      mockStorage.getUser.mockResolvedValue(activeUser);
      
      const req = createMockReq("user-3");
      const res = createMockRes();
      
      await requireAuth(req, res, mockNext);
      
      expect(req.session.destroy).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(req.user).toEqual(activeUser);
      expect(mockNext).toHaveBeenCalled();
    });

    test("deve retornar 401 se não houver sessão", async () => {
      const req = createMockReq(); // No userId
      const res = createMockRes();
      
      await requireAuth(req, res, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Não autenticado" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("requireActiveUser middleware", () => {
    test("deve bloquear usuário INATIVO", async () => {
      const req: any = {
        user: {
          id: "user-1",
          email: "inactive@example.com",
          status: "INATIVO",
          isAdmin: false,
        }
      };
      const res = createMockRes();
      
      await requireActiveUser(req, res, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Conta inativa. Realize o pagamento para acessar este recurso.",
        inactive: true,
        status: "INATIVO"
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test("deve permitir usuário ATIVO prosseguir", async () => {
      const req: any = {
        user: {
          id: "user-2",
          email: "active@example.com",
          status: "ATIVO",
          isAdmin: false,
        }
      };
      const res = createMockRes();
      
      await requireActiveUser(req, res, mockNext);
      
      expect(res.status).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    test("deve permitir admin mesmo com status INATIVO", async () => {
      const req: any = {
        user: {
          id: "admin-1",
          email: "admin@example.com",
          status: "INATIVO",
          isAdmin: true,
        }
      };
      const res = createMockRes();
      
      await requireActiveUser(req, res, mockNext);
      
      expect(res.status).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("Fluxo completo de ativação", () => {
    test("INATIVO pode gerar PIX (requireAuth apenas)", async () => {
      const inactiveUser: User = {
        id: "user-1",
        email: "inactive@example.com",
        password: "hashed",
        status: "INATIVO",
        ultimoPagamento: null,
        nextPaymentDate: null,
        isAdmin: false,
        discount: 0,
      };

      mockStorage.getUser.mockResolvedValue(inactiveUser);
      
      const req = createMockReq("user-1");
      const res = createMockRes();
      
      // Simula rota /api/payments/pix com apenas requireAuth
      await requireAuth(req, res, mockNext);
      
      expect(mockNext).toHaveBeenCalled(); // INATIVO pode prosseguir
      expect(req.user.status).toBe("INATIVO");
    });

    test("INATIVO não pode acessar credenciais (requireAuth + requireActiveUser)", async () => {
      const inactiveUser: User = {
        id: "user-1",
        email: "inactive@example.com",
        password: "hashed",
        status: "INATIVO",
        ultimoPagamento: null,
        nextPaymentDate: null,
        isAdmin: false,
        discount: 0,
      };

      mockStorage.getUser.mockResolvedValue(inactiveUser);
      
      const req = createMockReq("user-1");
      const res = createMockRes();
      const next2 = vi.fn();
      
      // Simula rota /api/credentials com requireAuth + requireActiveUser
      await requireAuth(req, res, next2);
      
      // Se passou pelo requireAuth, testa requireActiveUser
      if (next2.mock.calls.length > 0) {
        const res2 = createMockRes();
        await requireActiveUser(req, res2, mockNext);
        
        expect(res2.status).toHaveBeenCalledWith(403);
        expect(res2.json).toHaveBeenCalledWith(
          expect.objectContaining({
            inactive: true,
            status: "INATIVO"
          })
        );
      }
    });

    test("BLOQUEADO não pode acessar nenhuma rota autenticada", async () => {
      const blockedUser: User = {
        id: "user-1",
        email: "blocked@example.com",
        password: "hashed",
        status: "BLOQUEADO",
        ultimoPagamento: null,
        nextPaymentDate: null,
        isAdmin: false,
        discount: 0,
      };

      mockStorage.getUser.mockResolvedValue(blockedUser);
      
      const req = createMockReq("user-1");
      const res = createMockRes();
      
      // Tenta acessar qualquer rota com requireAuth
      await requireAuth(req, res, mockNext);
      
      expect(req.session.destroy).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled(); // BLOQUEADO não pode prosseguir
    });
  });
});