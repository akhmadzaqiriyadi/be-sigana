import prisma from "@/config/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "@/config/env";
import {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
  ForbiddenError,
} from "@/utils/ApiError";
import { JwtPayload } from "@/types";
import { emailService } from "@/modules/email/email.service";
import { settingsService } from "@/modules/settings/settings.service";
import { auditService } from "@/modules/audit/audit.service";

import { Role } from "@prisma/client";

interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

interface RefreshJwtPayload extends JwtPayload {
  sessionId?: string;
  exp?: number;
  iat?: number;
}

interface GeneratedTokens extends TokenResponse {
  sessionId: string;
  refreshExpiresAt: Date;
}

interface TokenResponseWithCookie extends TokenResponse {
  cookieMaxAge: number;
}

export class AuthService {
  private async countActiveSessions(userId: string): Promise<number> {
    return prisma.userSession.count({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  private async createSession(
    userId: string,
    sessionId: string,
    refreshToken: string,
    refreshExpiresAt: Date
  ) {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await prisma.userSession.create({
      data: {
        userId,
        tokenId: sessionId,
        tokenHash: refreshTokenHash,
        expiresAt: refreshExpiresAt,
      },
    });
  }

  async register(data: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictError("Email sudah terdaftar");
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
    });

    return user;
  }

  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      await auditService.log("auth.login.failed", {
        actor: data.email,
        metadata: { reason: "user_not_found" },
      });
      throw new UnauthorizedError("Email atau password salah");
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
      await auditService.log("auth.login.failed", {
        actor: user.email,
        target: user.id,
        metadata: { reason: "invalid_password" },
      });
      throw new UnauthorizedError("Email atau password salah");
    }

    if (user.status === "SUSPENDED") {
      await auditService.log("auth.login.failed", {
        actor: user.id,
        target: user.id,
        metadata: { reason: "user_suspended" },
      });
      throw new ForbiddenError("Akun Anda sedang dinonaktifkan oleh admin.");
    }

    if (user.status === "DELETED" || user.deletedAt) {
      await auditService.log("auth.login.failed", {
        actor: user.id,
        target: user.id,
        metadata: { reason: "user_deleted" },
      });
      throw new ForbiddenError("Akun tidak tersedia.");
    }

    const accessConfig = await settingsService.getAccessConfig();
    const { emailVerification, sessionTimeout, multiDeviceLogin } =
      accessConfig;

    if (!user.isVerified && emailVerification) {
      await auditService.log("auth.login.failed", {
        actor: user.email,
        target: user.id,
        metadata: { reason: "email_not_verified" },
      });
      throw new ForbiddenError(
        "Akun belum diverifikasi. Harap tunggu persetujuan admin."
      );
    }

    const activeSessions = await this.countActiveSessions(user.id);

    // Single-session enforcement: reject concurrent login when there is any active session.
    if (!multiDeviceLogin && activeSessions > 0) {
      /* 
      await auditService.log("auth.login.failed", {
        actor: user.email,
        target: user.id,
        metadata: { reason: "concurrent_session_blocked" },
      });
      throw new ConflictError(
        "Akun sudah digunakan di perangkat lain. Logout terlebih dahulu atau aktifkan fitur login multi-perangkat di Pengaturan Akses."
      );
      */
    }

    const cookieMaxAge = sessionTimeout * 60 * 1000;
    const tokens = this.generateTokens(
      user.id,
      user.email,
      user.role,
      sessionTimeout
    );

    await this.createSession(
      user.id,
      tokens.sessionId,
      tokens.refreshToken,
      tokens.refreshExpiresAt
    );

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        status: user.status === "PENDING" ? "ACTIVE" : user.status,
        isVerified: user.status === "PENDING" ? true : user.isVerified,
      },
    });

    await auditService.log("auth.login.success", {
      actor: user.id,
      target: user.id,
      metadata: {
        role: user.role,
        sessionTimeout,
        multiDeviceLogin,
        emailVerification,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      cookieMaxAge,
    };
  }

  async refreshToken(token: string): Promise<TokenResponseWithCookie> {
    try {
      const decoded = jwt.verify(
        token,
        env.JWT_REFRESH_SECRET
      ) as RefreshJwtPayload;

      if (!decoded.sessionId) {
        throw new ForbiddenError("Refresh token tidak valid");
      }

      const session = await prisma.userSession.findUnique({
        where: { tokenId: decoded.sessionId },
        include: {
          user: {
            select: { id: true, email: true, role: true },
          },
        },
      });

      if (
        !session ||
        session.revokedAt ||
        session.expiresAt.getTime() <= Date.now()
      ) {
        throw new ForbiddenError("Refresh token tidak valid");
      }

      const isValid = await bcrypt.compare(token, session.tokenHash);

      if (!isValid) {
        // SECURITY: Potential replay attempt, revoke all active sessions for this user.
        await prisma.userSession.updateMany({
          where: {
            userId: session.userId,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
        await auditService.log("auth.refresh.failed", {
          actor: session.user.email,
          target: session.user.id,
          metadata: { reason: "token_reuse_detected" },
        });
        throw new ForbiddenError(
          "Terdeteksi penggunaan ulang refresh token. Silakan login kembali."
        );
      }

      // 4. Read session timeout from access config
      const accessConfig = await settingsService.getAccessConfig();
      const cookieMaxAge = accessConfig.sessionTimeout * 60 * 1000;

      // Rotation: revoke current session and create a new one.
      const newTokens = this.generateTokens(
        session.user.id,
        session.user.email,
        session.user.role,
        accessConfig.sessionTimeout
      );

      await prisma.$transaction([
        prisma.userSession.update({
          where: { tokenId: session.tokenId },
          data: { revokedAt: new Date() },
        }),
        prisma.userSession.create({
          data: {
            userId: session.user.id,
            tokenId: newTokens.sessionId,
            tokenHash: await bcrypt.hash(newTokens.refreshToken, 10),
            expiresAt: newTokens.refreshExpiresAt,
          },
        }),
      ]);

      await auditService.log("auth.refresh.success", {
        actor: session.user.email,
        target: session.user.id,
        metadata: { sessionTimeout: accessConfig.sessionTimeout },
      });

      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        cookieMaxAge,
      };
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        "statusCode" in error &&
        error.statusCode === 403
      ) {
        throw error;
      }
      throw new ForbiddenError("Refresh token tidak valid atau kadaluarsa");
    }
  }

  async logout(userId: string) {
    await prisma.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    await auditService.log("auth.logout", {
      actor: userId,
      target: userId,
    });
  }

  /**
   * Logout by refresh token — used as fallback when access token is expired.
   * Decodes the refresh JWT to get userId and revokes the session.
   */
  async logoutByRefreshToken(token: string) {
    const decoded = jwt.verify(
      token,
      env.JWT_REFRESH_SECRET
    ) as RefreshJwtPayload;

    if (decoded.sessionId) {
      await prisma.userSession.updateMany({
        where: {
          tokenId: decoded.sessionId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    } else {
      await prisma.userSession.updateMany({
        where: {
          userId: decoded.userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }

    await auditService.log("auth.logout", {
      actor: decoded.userId,
      target: decoded.userId,
      metadata: { via: "refresh_token" },
    });
  }

  private generateTokens(
    userId: string,
    email: string,
    role: Role,
    sessionTimeoutMinutes: number
  ): GeneratedTokens {
    const payload: JwtPayload = { userId, email, role };
    const sessionId = crypto.randomUUID();
    const refreshExpiresAt = new Date(
      Date.now() + sessionTimeoutMinutes * 60 * 1000
    );

    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(
      {
        ...payload,
        sessionId,
      },
      env.JWT_REFRESH_SECRET,
      {
        expiresIn: `${sessionTimeoutMinutes}m`,
      } as jwt.SignOptions
    );

    return {
      accessToken,
      refreshToken,
      sessionId,
      refreshExpiresAt,
    };
  }

  private async revokeAllSessions(userId: string) {
    await prisma.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError("Pengguna tidak ditemukan");
    }

    return user;
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Security: Always return success even if email not found
    if (!user) return;

    // Generate random token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Clean up old resets for this user
    await prisma.passwordReset.deleteMany({
      where: { userId: user.id },
    });

    // Save to DB
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: passwordResetToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Send email
    const resetLink = `${env.APP_URL}/reset-password?token=${resetToken}`;
    await emailService.sendPasswordResetEmail(user.email, resetLink, user.name);
  }

  async resetPassword(token: string, newPassword: string) {
    // Hash token to compare with DB
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const resetRequest = await prisma.passwordReset.findUnique({
      where: { token: hashedToken },
      include: { user: true },
    });

    // Validate token exists and not expired
    if (!resetRequest || resetRequest.expiresAt < new Date()) {
      throw new BadRequestError("Token tidak valid atau sudah kadaluarsa");
    }

    // Update Password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: resetRequest.userId },
      data: {
        password: hashedPassword,
        refreshToken: null, // Force re-login
      },
    });

    await this.revokeAllSessions(resetRequest.userId);

    // Delete token
    await prisma.passwordReset.delete({
      where: { id: resetRequest.id },
    });
  }
}

export const authService = new AuthService();
