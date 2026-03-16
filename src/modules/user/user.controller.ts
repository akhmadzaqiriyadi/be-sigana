import { Request, Response } from "express";
import { Role } from "@prisma/client";
import { asyncHandler } from "@/middlewares/asyncHandler";
import { userService } from "./user.service";
import { sendSuccess, sendCreated } from "@/utils/response";

const getSingleQueryValue = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
};

const parsePositiveIntOrDefault = (
  rawValue: string | undefined,
  fallback: number
): number => {
  const parsed = Number.parseInt(rawValue ?? "", 10);
  return Number.isNaN(parsed) || parsed < 1 ? fallback : parsed;
};

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const {
    email,
    password,
    name,
    role,
    isVerified,
    status,
    phone,
    nik,
    villageId,
  } = req.body;
  const user = await userService.create({
    email,
    password,
    name,
    role,
    isVerified,
    status,
    phone,
    nik,
    villageId,
  });
  sendCreated(res, "Pengguna berhasil dibuat", user);
});

export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = parsePositiveIntOrDefault(
    getSingleQueryValue(req.query.page),
    1
  );
  const limit = parsePositiveIntOrDefault(
    getSingleQueryValue(req.query.limit),
    10
  );
  const search = getSingleQueryValue(req.query.search);

  // Handle Role: strictly validate against Enum
  let role: Role | undefined = undefined;
  const rawRole = getSingleQueryValue(req.query.role)?.trim();
  if (rawRole) {
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

  let status: "PENDING" | "ACTIVE" | "SUSPENDED" | "DELETED" | undefined =
    undefined;
  if (typeof req.query.status === "string" && req.query.status.trim() !== "") {
    const rawStatus = req.query.status.trim().toUpperCase();
    if (["PENDING", "ACTIVE", "SUSPENDED", "DELETED"].includes(rawStatus)) {
      status = rawStatus as "PENDING" | "ACTIVE" | "SUSPENDED" | "DELETED";
    }
  }

  const result = await userService.findAll(page, limit, {
    search,
    role,
    isVerified,
    status,
  });
  sendSuccess(
    res,
    "Data pengguna berhasil diambil",
    result.users,
    result.meta,
    result.summary
  );
});

export const getUserSummary = asyncHandler(
  async (_req: Request, res: Response) => {
    const summary = await userService.getSummary();
    sendSuccess(
      res,
      "Ringkasan pengguna berhasil diambil",
      undefined,
      undefined,
      summary
    );
  }
);

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.findById(String(req.params.id));
  sendSuccess(res, "Data pengguna berhasil diambil", user);
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, role, isVerified, phone, nik, villageId } = req.body;
  const currentUserRole = req.user?.role;

  // Prepare update data
  const updateData: {
    name?: string;
    role?: Role;
    isVerified?: boolean;
    phone?: string | null;
    nik?: string | null;
    villageId?: number | null;
  } = {
    name,
  };

  if (phone !== undefined) updateData.phone = phone;
  if (nik !== undefined) updateData.nik = nik;
  if (villageId !== undefined) updateData.villageId = villageId;

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

export const changePassword = asyncHandler(
  async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const result = await userService.changeOwnPassword(
      req.user!.userId,
      currentPassword,
      newPassword
    );
    sendSuccess(res, result.message);
  }
);

export const resetUserPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const targetId = String(req.params.id);
    const { newPassword } = req.body;
    const result = await userService.resetPasswordByAdmin(
      targetId,
      newPassword,
      req.user!.userId
    );
    sendSuccess(res, result.message);
  }
);

export const getUserActivityLogs = asyncHandler(
  async (req: Request, res: Response) => {
    const page = parsePositiveIntOrDefault(
      getSingleQueryValue(req.query.page),
      1
    );
    const limit = parsePositiveIntOrDefault(
      getSingleQueryValue(req.query.limit),
      10
    );

    const result = await userService.getActivityLogs(
      String(req.params.id),
      page,
      limit
    );
    sendSuccess(
      res,
      "Aktivitas pengguna berhasil diambil",
      result.logs,
      result.meta
    );
  }
);

export const updateUserStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const user = await userService.updateStatus(
      String(req.params.id),
      req.body.status,
      req.user!.userId
    );
    sendSuccess(res, "Status pengguna berhasil diperbarui", user);
  }
);

export const bulkVerifyUsers = asyncHandler(
  async (req: Request, res: Response) => {
    const { userIds } = req.body;
    const result = await userService.bulkVerify(userIds, req.user!.userId);
    sendSuccess(res, "Verifikasi bulk pengguna berhasil", result);
  }
);

export const bulkDeleteUsers = asyncHandler(
  async (req: Request, res: Response) => {
    const { userIds } = req.body;
    const result = await userService.bulkDelete(userIds, req.user!.userId);
    sendSuccess(res, "Hapus bulk pengguna berhasil", result);
  }
);

export const bulkUpdateUserRole = asyncHandler(
  async (req: Request, res: Response) => {
    const { userIds, role } = req.body;
    const result = await userService.bulkUpdateRole(
      userIds,
      role,
      req.user!.userId
    );
    sendSuccess(res, "Perubahan role bulk pengguna berhasil", result);
  }
);
