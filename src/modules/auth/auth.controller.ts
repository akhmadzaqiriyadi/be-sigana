import { Request, Response } from "express";
import { asyncHandler } from "@/middlewares/asyncHandler";
import { authService } from "./auth.service";
import { sendSuccess, sendCreated } from "@/utils/response";
import { BadRequestError } from "@/utils/ApiError";
import { env } from "@/config/env";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    throw new BadRequestError("Email, password, dan nama wajib diisi");
  }

  const user = await authService.register({ email, password, name });
  sendCreated(
    res,
    "Pendaftaran berhasil. Silakan tunggu persetujuan admin.",
    user
  );
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new BadRequestError("Email dan password wajib diisi");
  }

  const { user, accessToken, refreshToken } = await authService.login({
    email,
    password,
  });

  // Set refresh token in httpOnly cookie
  const cookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === "production", // Secure in production
    sameSite:
      env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const), // Lax for local dev ease, None for prod
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/", // Available for all routes
  };

  res.cookie("refreshToken", refreshToken, cookieOptions);

  // Debug logging

  sendSuccess(res, "Login berhasil", { user, accessToken });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;

  // Debug logging

  if (!refreshToken) {
    throw new BadRequestError("Refresh token wajib diisi");
  }

  const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
    await authService.refreshToken(refreshToken);

  const cookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite:
      env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  };

  res.cookie("refreshToken", newRefreshToken, cookieOptions);

  sendSuccess(res, "Token berhasil diperbarui", {
    accessToken: newAccessToken,
  });
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const user = await authService.getProfile(userId);
  sendSuccess(res, "Profil berhasil diambil", user);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  // Try to revoke the session in DB
  // 1. If access token was valid, we have req.user from optionalAuthenticate
  if (req.user?.userId) {
    await authService.logout(req.user.userId);
  } else {
    // 2. Fallback: try to identify user via refresh token cookie
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      try {
        await authService.logoutByRefreshToken(refreshToken);
      } catch {
        // Best-effort: if refresh token is also invalid, just clear the cookie
      }
    }
  }

  // Clear the token cookie — path MUST match the path used when setting it ("/")
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite:
      env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
    path: "/",
  });

  sendSuccess(res, "Logout berhasil", null);
});

export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;
    await authService.forgotPassword(email);
    sendSuccess(
      res,
      "Jika email terdaftar, link reset password telah dikirim."
    );
  }
);

export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { token, password } = req.body;
    await authService.resetPassword(token, password);
    sendSuccess(res, "Password berhasil diubah. Silakan login kembali.");
  }
);
