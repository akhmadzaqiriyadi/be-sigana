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
  sendCreated(res, "User created successfully", user);
});

export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page)) || 1;
  const limit = parseInt(String(req.query.limit)) || 10;

  const search = req.query.search ? String(req.query.search) : undefined;

  // Handle Role: strictly validate against Enum
  let role: Role | undefined = undefined;
  if (req.query.role && String(req.query.role).trim() !== "") {
    const rawRole = String(req.query.role).trim();
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
  sendSuccess(res, "Users retrieved successfully", result.users, result.meta);
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.findById(String(req.params.id));
  sendSuccess(res, "User retrieved successfully", user);
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, role, isVerified } = req.body;
  const user = await userService.update(String(req.params.id), {
    name,
    role,
    isVerified,
  });
  sendSuccess(res, "User updated successfully", user);
});

export const updateProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { name } = req.body;

    const user = await userService.updateProfile(userId, { name });
    sendSuccess(res, "Profile updated successfully", user);
  }
);

export const verifyUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.verifyUser(String(req.params.id));
  sendSuccess(res, "User verified successfully", user);
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  await userService.delete(String(req.params.id));
  sendSuccess(res, "User deleted successfully");
});

export const getPendingUsers = asyncHandler(
  async (_req: Request, res: Response) => {
    const users = await userService.getPendingUsers();
    sendSuccess(res, "Pending users retrieved successfully", users);
  }
);
