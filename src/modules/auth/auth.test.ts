import { describe, expect, it, mock, beforeEach } from "bun:test";
import { authService } from "./auth.service";
import prisma from "@/config/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Mock external dependencies
mock.module("@/config/db", () => ({
  default: {
    user: {
      findUnique: mock(),
      update: mock(),
      create: mock(),
    },
    passwordReset: {
      create: mock(),
      deleteMany: mock(),
      findUnique: mock(),
      delete: mock(),
    },
    systemConfig: {
      findUnique: mock(),
      create: mock(),
    },
    userSession: {
      count: mock(),
      create: mock(),
      findUnique: mock(),
      update: mock(),
      updateMany: mock(),
    },
    auditLog: {
      create: mock(),
    },
    $transaction: mock(),
  },
}));

mock.module("bcryptjs", () => ({
  default: {
    hash: mock(),
    compare: mock(),
  },
}));

mock.module("jsonwebtoken", () => ({
  default: {
    sign: mock(),
    verify: mock(),
  },
}));

mock.module("@/modules/email/email.service", () => ({
  emailService: {
    sendPasswordResetEmail: mock(),
  },
}));

const DEFAULT_ACCESS_CONFIG = {
  auditLogging: true,
  sessionTimeout: 30,
  multiDeviceLogin: true, // true so existing login tests pass (user has refreshToken)
  emailVerification: true,
};

describe("AuthService", () => {
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    password: "hashed_password",
    name: "Test User",
    role: "RELAWAN",
    isVerified: true,
    refreshToken: "valid_hashed_token",
  };

  const mockSession = {
    id: "session-1",
    userId: "user-123",
    tokenId: "sess-1",
    tokenHash: "valid_hashed_token",
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    revokedAt: null,
    user: {
      id: "user-123",
      email: "test@example.com",
      role: "RELAWAN",
    },
  };

  beforeEach(() => {
    // mock.restore(); // Removing this as it might interfere with module mocks or not clear history effectively
    const mocks = [
      prisma.user.findUnique,
      prisma.user.update,
      prisma.user.create,
      prisma.passwordReset.create,
      prisma.passwordReset.deleteMany,
      prisma.passwordReset.findUnique,
      prisma.passwordReset.delete,
      (prisma as any).systemConfig.findUnique,
      (prisma as any).systemConfig.create,
      (prisma as any).userSession.count,
      (prisma as any).userSession.create,
      (prisma as any).userSession.findUnique,
      (prisma as any).userSession.update,
      (prisma as any).userSession.updateMany,
      (prisma as any).auditLog.create,
      (prisma as any).$transaction,
      bcrypt.hash,
      bcrypt.compare,
      jwt.sign,
      jwt.verify,
    ];
    mocks.forEach((m: any) => m.mockClear && m.mockClear());

    // Default mock implementations
    (prisma.user.findUnique as any).mockResolvedValue(mockUser);
    (prisma.user.update as any).mockResolvedValue(mockUser);
    ((prisma as any).userSession.count as any).mockResolvedValue(0);
    ((prisma as any).userSession.create as any).mockResolvedValue(mockSession);
    ((prisma as any).userSession.findUnique as any).mockResolvedValue(
      mockSession
    );
    ((prisma as any).userSession.update as any).mockResolvedValue(mockSession);
    ((prisma as any).userSession.updateMany as any).mockResolvedValue({
      count: 1,
    });
    ((prisma as any).auditLog.create as any).mockResolvedValue({
      id: "audit-1",
    });
    ((prisma as any).$transaction as any).mockImplementation(
      async (ops: Array<Promise<unknown>>) => Promise.all(ops)
    );
    (bcrypt.hash as any).mockResolvedValue("new_hashed_token");
    (bcrypt.compare as any).mockResolvedValue(true);
    (jwt.sign as any).mockReturnValue("jwt_token");
    (jwt.verify as any).mockReturnValue({
      userId: mockUser.id,
      sessionId: "sess-1",
    });

    // systemConfig mock for settingsService.getAccessConfig (used by auth login/refresh)
    ((prisma as any).systemConfig.findUnique as any).mockResolvedValue({
      id: "access",
      value: DEFAULT_ACCESS_CONFIG,
    });
  });

  describe("login", () => {
    it("should generate tokens and update user refreshToken (Scenario 1 & 5)", async () => {
      // Mock password comparison success
      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await authService.login({
        email: "test@example.com",
        password: "password",
      });

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result).toHaveProperty("cookieMaxAge");

      // Verify DB update
      expect((prisma as any).userSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          tokenHash: "new_hashed_token",
        }),
      });
    });

    it("should reject login when concurrent session exists and multiDeviceLogin=false", async () => {
      ((prisma as any).systemConfig.findUnique as any).mockResolvedValue({
        id: "access",
        value: { ...DEFAULT_ACCESS_CONFIG, multiDeviceLogin: false },
      });
      ((prisma as any).userSession.count as any).mockResolvedValue(1);

      let error: any;
      try {
        await authService.login({
          email: "test@example.com",
          password: "password",
        });
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.statusCode).toBe(409);
    });

    it("should reject login when emailVerification=true and user not verified", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        ...mockUser,
        isVerified: false,
        refreshToken: null,
      });

      let error: any;
      try {
        await authService.login({
          email: "test@example.com",
          password: "password",
        });
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.statusCode).toBe(403);
    });

    it("should allow login when emailVerification=false even if user not verified", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        ...mockUser,
        isVerified: false,
        refreshToken: null,
      });
      ((prisma as any).systemConfig.findUnique as any).mockResolvedValue({
        id: "access",
        value: { ...DEFAULT_ACCESS_CONFIG, emailVerification: false },
      });

      const result = await authService.login({
        email: "test@example.com",
        password: "password",
      });
      expect(result).toHaveProperty("accessToken");
    });
  });

  describe("refreshToken", () => {
    it("should rotate tokens if valid (Scenario 3)", async () => {
      const oldToken = "valid_refresh_token";

      const result = await authService.refreshToken(oldToken);

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");

      // Verify rotation: old session revoked and new session created
      expect((prisma as any).userSession.update).toHaveBeenCalledWith({
        where: { tokenId: "sess-1" },
        data: { revokedAt: expect.any(Date) },
      });
      expect((prisma as any).userSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          tokenHash: "new_hashed_token",
        }),
      });
    });

    it("should throw Forbidden and revoke tokens on Reuse (Scenario 4)", async () => {
      // Logic: Token matches signature (JWT verify passes) BUT compare with DB hash FAILS (mismatch)
      // This mimics "Old Token Usage" because the DB has already rotated to a new token.

      (bcrypt.compare as any).mockResolvedValue(false); // Token mismatch

      const reusedToken = "old_used_token";

      try {
        await authService.refreshToken(reusedToken);
      } catch (error: unknown) {
        expect(error).toHaveProperty("statusCode", 403);
        expect(error).toHaveProperty("message");
        if (error && typeof error === "object" && "message" in error) {
          expect(String(error.message).toLowerCase()).toContain(
            "penggunaan ulang"
          );
        }
      }

      // Verify REVOCATION (all active sessions revoked)
      expect((prisma as any).userSession.updateMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("should fail if user is already logged out (Scenario 5 - part 2)", async () => {
      // Simulate missing session in store
      ((prisma as any).userSession.findUnique as any).mockResolvedValue(null);

      try {
        await authService.refreshToken("some_token");
      } catch (error: unknown) {
        expect(error).toHaveProperty("statusCode", 403);
      }
    });
  });

  describe("logout", () => {
    it("should nullify refresh token in DB", async () => {
      await authService.logout(mockUser.id);

      expect((prisma as any).userSession.updateMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe("logoutByRefreshToken", () => {
    it("should decode refresh token and nullify session in DB", async () => {
      (jwt.verify as any).mockReturnValue({
        userId: mockUser.id,
        sessionId: "sess-1",
      });

      await authService.logoutByRefreshToken("valid_refresh_token");

      expect(jwt.verify).toHaveBeenCalled();
      expect((prisma as any).userSession.updateMany).toHaveBeenCalledWith({
        where: {
          tokenId: "sess-1",
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("should throw if refresh token is invalid", async () => {
      (jwt.verify as any).mockImplementation(() => {
        throw new Error("invalid token");
      });

      let error: any;
      try {
        await authService.logoutByRefreshToken("invalid_token");
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
    });
  });

  describe("forgotPassword", () => {
    it("should generate token, save to DB, and send email if user exists", async () => {
      // Mock randomBytes and hash? Difficult with bun:test mock directly on crypto if not mocked
      // But we can verify side effects
      const { emailService } = await import("@/modules/email/email.service");

      await authService.forgotPassword("test@example.com");

      // Verify DB operations
      expect(prisma.passwordReset.deleteMany).toHaveBeenCalled();
      expect(prisma.passwordReset.create).toHaveBeenCalled();

      // Verify Email sent
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it("should return silently if user does not exist (Security)", async () => {
      const { emailService } = await import("@/modules/email/email.service");
      (emailService.sendPasswordResetEmail as any).mockClear();
      (prisma.passwordReset.create as any).mockClear();

      (prisma.user.findUnique as any).mockResolvedValue(null);

      await authService.forgotPassword("unknown@example.com");

      expect(prisma.passwordReset.create).not.toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    it("should update password and invalidate session if token is valid", async () => {
      // Mock valid reset request
      (prisma.passwordReset.findUnique as any).mockResolvedValue({
        id: "reset-123",
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 100000), // Valid
        user: mockUser,
      });

      await authService.resetPassword("some_raw_token", "new_password");

      // Verify Password Update
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            refreshToken: null,
          }),
        })
      );

      // Verify Token Deletion
      expect(prisma.passwordReset.delete).toHaveBeenCalledWith({
        where: { id: "reset-123" },
      });
    });

    it("should throw BadRequest if token expired", async () => {
      (prisma.passwordReset.findUnique as any).mockResolvedValue({
        id: "reset-123",
        expiresAt: new Date(Date.now() - 1000), // Expired
      });

      // Fix: Bun test expect().toThrow() check
      let error: any;
      try {
        await authService.resetPassword("token", "pass");
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
    });
  });
});
