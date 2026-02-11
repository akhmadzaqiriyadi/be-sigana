import { Request, Response } from "express";
import { Role } from "@prisma/client";
import { asyncHandler } from "@/middlewares/asyncHandler";
import { userService } from "./user.service";
import { sendSuccess, sendCreated } from "@/utils/response";

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name, role, isVerified } = req.body;
  const user = await userService.create({
    email,
    password,
    name,
    role,
    isVerified,
  });
  sendCreated(res, "Pengguna berhasil dibuat", user);
});

export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  // Extract page query parameter
  let pageString = "1";
  if (typeof req.query.page === "string") {
    pageString = req.query.page;
  } else if (
    Array.isArray(req.query.page) &&
    typeof req.query.page[0] === "string"
  ) {
    pageString = req.query.page[0];
  }
  const page = Number.parseInt(pageString) || 1;

  // Extract limit query parameter
  let limitString = "10";
  if (typeof req.query.limit === "string") {
    limitString = req.query.limit;
  } else if (
    Array.isArray(req.query.limit) &&
    typeof req.query.limit[0] === "string"
  ) {
    limitString = req.query.limit[0];
  }
  const limit = Number.parseInt(limitString) || 10;

  // Extract search query parameter
  let search: string | undefined = undefined;
  if (typeof req.query.search === "string") {
    search = req.query.search;
  } else if (
    Array.isArray(req.query.search) &&
    typeof req.query.search[0] === "string"
  ) {
    search = req.query.search[0];
  }

  // Handle Role: strictly validate against Enum
  let role: Role | undefined = undefined;
  if (typeof req.query.role === "string" && req.query.role.trim() !== "") {
    const rawRole = req.query.role.trim();
    if (Object.values(Role).includes(rawRole as Role)) {
      role = rawRole as Role;
    }
    // If invalid role is passed (e.g. 'USER'), we ignore it to prevent 500 error
  }

  // Handle isVerified
  let isVerified: boolean | undefined = undefined;
  if (req.query.isVerified === "true") {
    isVerified = true;
  } else if (req.query.isVerified === "false") {
    isVerified = false;
  }

  const result = await userService.findAll(page, limit, {
    search,
    role,
    isVerified,
  });
  sendSuccess(res, "Data pengguna berhasil diambil", result.users, result.meta);
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.findById(String(req.params.id));
  sendSuccess(res, "Data pengguna berhasil diambil", user);
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, role, isVerified } = req.body;
  const currentUserRole = req.user?.role;

  // Prepare update data
  const updateData: { name: string; role?: Role; isVerified?: boolean } = {
    name,
  };

  // Only Admin can update sensitive fields
  if (currentUserRole === Role.ADMIN) {
    if (role) updateData.role = role;
    if (isVerified !== undefined) updateData.isVerified = isVerified;
  }

  const user = await userService.update(String(req.params.id), updateData);
  sendSuccess(res, "Data pengguna berhasil diperbarui", user);
});

export const updateProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { name } = req.body;

    const user = await userService.updateProfile(userId, { name });
    sendSuccess(res, "Profil berhasil diperbarui", user);
  }
);

export const verifyUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.verifyUser(String(req.params.id));
  sendSuccess(res, "Pengguna berhasil diverifikasi", user);
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  await userService.delete(String(req.params.id));
  sendSuccess(res, "Pengguna berhasil dihapus");
});

export const getPendingUsers = asyncHandler(
  async (_req: Request, res: Response) => {
    const users = await userService.getPendingUsers();
    sendSuccess(res, "Data pengguna tertunda berhasil diambil", users);
  }
);
