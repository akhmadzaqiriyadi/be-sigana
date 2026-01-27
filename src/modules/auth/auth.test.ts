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

  beforeEach(() => {
    mock.restore();
    // Default mock implementations
    (prisma.user.findUnique as any).mockResolvedValue(mockUser);
    (prisma.user.update as any).mockResolvedValue(mockUser);
    (bcrypt.hash as any).mockResolvedValue("new_hashed_token");
    (bcrypt.compare as any).mockResolvedValue(true);
    (jwt.sign as any).mockReturnValue("jwt_token");
    (jwt.verify as any).mockReturnValue({ userId: mockUser.id });
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

      // Verify DB update (Single Session enforcement)
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { refreshToken: "new_hashed_token" },
      });
    });
  });

  describe("refreshToken", () => {
    it("should rotate tokens if valid (Scenario 3)", async () => {
      const oldToken = "valid_refresh_token";

      const result = await authService.refreshToken(oldToken);

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");

      // Verify rotation: DB updated with NEW token hash
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { refreshToken: "new_hashed_token" },
      });
    });

    it("should throw Forbidden and revoke tokens on Reuse (Scenario 4)", async () => {
      // Logic: Token matches signature (JWT verify passes) BUT compare with DB hash FAILS (mismatch)
      // This mimics "Old Token Usage" because the DB has already rotated to a new token.

      (bcrypt.compare as any).mockResolvedValue(false); // Token mismatch

      const reusedToken = "old_used_token";

      try {
        await authService.refreshToken(reusedToken);
      } catch (error: any) {
        expect(error.statusCode).toBe(403);
        expect(error.message).toContain("reuse detected");
      }

      // Verify REVOCATION (setting refreshToken to null)
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { refreshToken: null },
      });
    });

    it("should fail if user is already logged out (Scenario 5 - part 2)", async () => {
      // If Device B logged in, Device A's DB token is different (or null if logged out)
      // Here we simulate user has null token in DB
      (prisma.user.findUnique as any).mockResolvedValue({
        ...mockUser,
        refreshToken: null,
      });

      try {
        await authService.refreshToken("some_token");
      } catch (error: any) {
        expect(error.statusCode).toBe(403);
      }
    });
  });

  describe("logout", () => {
    it("should nullify refresh token in DB", async () => {
      await authService.logout(mockUser.id);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { refreshToken: null },
      });
    });
  });
});
