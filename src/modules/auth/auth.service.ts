import prisma from "@/config/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "@/config/env";
import {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
  ForbiddenError,
} from "@/utils/ApiError";
import { JwtPayload } from "@/types";
import { emailService } from "@/modules/email/email.service";

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

export class AuthService {
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
      throw new UnauthorizedError("Email atau password salah");
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError("Email atau password salah");
    }

    if (!user.isVerified) {
      throw new BadRequestError(
        "Akun belum diverifikasi. Harap tunggu persetujuan admin."
      );
    }

    const tokens = this.generateTokens(user.id, user.email, user.role);

    // Single Session Strategy: Overwrite previous refresh token
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: refreshTokenHash },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      ...tokens,
    };
  }

  async refreshToken(token: string) {
    try {
      // 1. Verify token signature
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;

      // 2. Find user
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, role: true, refreshToken: true },
      });

      if (!user?.refreshToken) {
        throw new ForbiddenError("Refresh token tidak valid");
      }

      // 3. Verify token matches DB hash
      const isValid = await bcrypt.compare(token, user.refreshToken);

      if (!isValid) {
        // SECURITY: Token mismatch means potential Replay Attack or Old Token usage
        // Action: Revoke current session to be safe
        await prisma.user.update({
          where: { id: user.id },
          data: { refreshToken: null },
        });
        throw new ForbiddenError(
          "Terdeteksi penggunaan ulang refresh token. Silakan login kembali."
        );
      }

      // 4. Rotation: Generate new tokens & Invalidate old one
      const newTokens = this.generateTokens(user.id, user.email, user.role);
      const newRefreshTokenHash = await bcrypt.hash(newTokens.refreshToken, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: newRefreshTokenHash },
      });

      return newTokens;
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
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  /**
   * Logout by refresh token — used as fallback when access token is expired.
   * Decodes the refresh JWT to get userId and revokes the session.
   */
  async logoutByRefreshToken(token: string) {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
    await prisma.user.update({
      where: { id: decoded.userId },
      data: { refreshToken: null },
    });
  }

  private generateTokens(
    userId: string,
    email: string,
    role: Role
  ): TokenResponse {
    const payload: JwtPayload = { userId, email, role };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    } as jwt.SignOptions);

    return { accessToken, refreshToken };
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

    // Delete token
    await prisma.passwordReset.delete({
      where: { id: resetRequest.id },
    });
  }
}

export const authService = new AuthService();
