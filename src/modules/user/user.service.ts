import prisma from "@/config/db";
import bcrypt from "bcryptjs";
import { Role, Prisma } from "@prisma/client";
import {
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  BadRequestError,
} from "@/utils/ApiError";
import { auditService } from "@/modules/audit/audit.service";

type UserStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "DELETED";

interface UpdateUserInput {
  name?: string;
  isVerified?: boolean;
  role?: Role;
  phone?: string | null;
  nik?: string | null;
  villageId?: number | null;
}

interface UpdateProfileInput {
  name?: string;
}

interface UserFilters {
  search?: string;
  role?: Role;
  isVerified?: boolean;
  status?: UserStatus;
}

interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role?: Role;
  isVerified?: boolean;
  status?: UserStatus;
  phone?: string;
  nik?: string;
  villageId?: number;
}

interface UserSummary {
  totalUsers: number;
  active: number;
  pending: number;
  admin: number;
  relawan: number;
  stakeholder: number;
}

interface BulkActionResult {
  requested: number;
  affected: number;
  skipped: number;
}

const MAX_BULK_ACTION_SIZE = 200;

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  isVerified: true,
  phone: true,
  nik: true,
  lastLoginAt: true,
  createdAt: true,
  village: {
    select: {
      id: true,
      name: true,
      districts: true,
    },
  },
} as const;

export class UserService {
  private validateBulkIds(userIds: string[]) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new BadRequestError("Daftar userIds tidak boleh kosong");
    }

    if (userIds.length > MAX_BULK_ACTION_SIZE) {
      throw new BadRequestError(
        `Maksimal ${MAX_BULK_ACTION_SIZE} pengguna per aksi bulk`
      );
    }
  }

  async create(data: CreateUserInput) {
    // Check for existing email
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictError("Email sudah terdaftar");
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const resolvedStatus =
      data.status ?? (data.isVerified === false ? "PENDING" : "ACTIVE");

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: data.role || "RELAWAN",
        isVerified: data.isVerified ?? resolvedStatus === "ACTIVE",
        status: resolvedStatus,
        phone: data.phone,
        nik: data.nik,
        villageId: data.villageId,
      },
      select: userSelect,
    });

    return user;
  }

  async findAll(page = 1, limit = 10, filters?: UserFilters) {
    const skip = (page - 1) * limit;

    const whereClause: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (filters?.search) {
      whereClause.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters?.role) {
      whereClause.role = filters.role;
    }

    if (filters?.isVerified !== undefined) {
      whereClause.isVerified = filters.isVerified;
    }

    if (filters?.status) {
      whereClause.status = filters.status;
    }

    const [users, total, totalVerified, totalPending, summary] =
      await Promise.all([
        prisma.user.findMany({
          skip,
          take: limit,
          where: whereClause,
          select: userSelect,
          orderBy: { createdAt: "desc" },
        }),
        prisma.user.count({ where: whereClause }),
        prisma.user.count({ where: { deletedAt: null, isVerified: true } }),
        prisma.user.count({ where: { deletedAt: null, isVerified: false } }),
        this.getSummary(),
      ]);

    return {
      users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        totalVerified,
        totalPending,
      },
      summary,
    };
  }

  async getSummary(): Promise<UserSummary> {
    const whereBase: Prisma.UserWhereInput = { deletedAt: null };

    const [totalUsers, active, pending, admin, relawan, stakeholder] =
      await Promise.all([
        prisma.user.count({ where: whereBase }),
        prisma.user.count({ where: { ...whereBase, status: "ACTIVE" } }),
        prisma.user.count({ where: { ...whereBase, status: "PENDING" } }),
        prisma.user.count({ where: { ...whereBase, role: "ADMIN" } }),
        prisma.user.count({ where: { ...whereBase, role: "RELAWAN" } }),
        prisma.user.count({ where: { ...whereBase, role: "STAKEHOLDER" } }),
      ]);

    return {
      totalUsers,
      active,
      pending,
      admin,
      relawan,
      stakeholder,
    };
  }

  async findById(id: string) {
    const user = await prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        ...userSelect,
        measurements: {
          select: {
            id: true,
            createdAt: true,
          },
          take: 5,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      throw new NotFoundError("Pengguna tidak ditemukan");
    }

    return user;
  }

  async update(id: string, data: UpdateUserInput) {
    const user = await prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundError("Pengguna tidak ditemukan");
    }

    const updateData: Prisma.UserUpdateInput = { ...data };
    if (data.isVerified === true) {
      updateData.status = "ACTIVE";
    }
    if (data.isVerified === false) {
      updateData.status = "PENDING";
    }

    return prisma.user.update({
      where: { id },
      data: updateData,
      select: userSelect,
    });
  }

  async updateProfile(id: string, data: UpdateProfileInput) {
    // Delegate to update method to avoid code duplication
    // UpdateProfileInput is a subset of UpdateUserInput (only 'name')
    return this.update(id, data);
  }

  async verifyUser(id: string) {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundError("Pengguna tidak ditemukan");
    }

    return prisma.user.update({
      where: { id },
      data: { isVerified: true, status: "ACTIVE" },
      select: userSelect,
    });
  }

  async delete(id: string) {
    const user = await prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundError("Pengguna tidak ditemukan");
    }

    // Soft Delete
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: "DELETED" },
    });
    return { message: "Pengguna berhasil dihapus" };
  }

  async getPendingUsers() {
    return prisma.user.findMany({
      where: {
        status: "PENDING",
        deletedAt: null,
      },
      select: userSelect,
      orderBy: { createdAt: "desc" },
    });
  }

  async changeOwnPassword(
    id: string,
    currentPassword: string,
    newPassword: string
  ) {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new NotFoundError("Pengguna tidak ditemukan");
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedError("Password saat ini tidak sesuai");
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id },
      data: { password: hashed },
    });

    return { message: "Password berhasil diubah" };
  }

  async resetPasswordByAdmin(id: string, newPassword: string, actorId: string) {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new NotFoundError("Pengguna tidak ditemukan");
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id },
      data: { password: hashed },
    });

    await auditService.log("users.password.reset", {
      actor: actorId,
      target: id,
      metadata: { email: user.email },
    });

    return { message: "Password pengguna berhasil direset" };
  }

  async updateStatus(id: string, status: UserStatus, actorId: string) {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true, email: true },
    });

    if (!user) {
      throw new NotFoundError("Pengguna tidak ditemukan");
    }

    if (status === "DELETED") {
      throw new BadRequestError("Status DELETED tidak dapat diubah manual");
    }

    const allowedTransitions: Record<UserStatus, UserStatus[]> = {
      PENDING: ["ACTIVE", "SUSPENDED"],
      ACTIVE: ["SUSPENDED"],
      SUSPENDED: ["ACTIVE"],
      DELETED: [],
    };

    const currentStatus = user.status as UserStatus;
    if (currentStatus === status) {
      return prisma.user.findUniqueOrThrow({
        where: { id },
        select: userSelect,
      });
    }

    if (!allowedTransitions[currentStatus].includes(status)) {
      throw new BadRequestError(
        `Transisi status dari ${currentStatus} ke ${status} tidak diizinkan`
      );
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        status,
        isVerified: status === "ACTIVE",
      },
      select: userSelect,
    });

    await auditService.log("users.status.updated", {
      actor: actorId,
      target: id,
      metadata: { from: currentStatus, to: status, email: user.email },
    });

    return updated;
  }

  async getActivityLogs(id: string, page = 1, limit = 10) {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundError("Pengguna tidak ditemukan");
    }

    const skip = (page - 1) * limit;
    const whereClause: Prisma.AuditLogWhereInput = {
      OR: [{ targetId: id }, { actorId: id }],
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          action: true,
          module: true,
          ipAddress: true,
          device: true,
          actorId: true,
        },
      }),
      prisma.auditLog.count({ where: whereClause }),
    ]);

    return {
      logs: logs.map((log) => ({
        id: log.id,
        timestamp: log.createdAt,
        action: log.action,
        module: log.module,
        ipAddress: log.ipAddress,
        device: log.device,
        actorId: log.actorId,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async bulkVerify(
    userIds: string[],
    actorId: string
  ): Promise<BulkActionResult> {
    this.validateBulkIds(userIds);

    const uniqueIds = [...new Set(userIds)];
    const result = await prisma.user.updateMany({
      where: {
        id: { in: uniqueIds },
        deletedAt: null,
      },
      data: {
        isVerified: true,
        status: "ACTIVE",
      },
    });

    await auditService.log("users.bulk.verify", {
      actor: actorId,
      metadata: {
        requested: uniqueIds.length,
        affected: result.count,
      },
    });

    return {
      requested: uniqueIds.length,
      affected: result.count,
      skipped: uniqueIds.length - result.count,
    };
  }

  async bulkDelete(
    userIds: string[],
    actorId: string
  ): Promise<BulkActionResult> {
    this.validateBulkIds(userIds);

    const uniqueIds = [...new Set(userIds)];
    const now = new Date();
    const result = await prisma.user.updateMany({
      where: {
        id: { in: uniqueIds },
        deletedAt: null,
      },
      data: {
        deletedAt: now,
        status: "DELETED",
      },
    });

    await auditService.log("users.bulk.delete", {
      actor: actorId,
      metadata: {
        requested: uniqueIds.length,
        affected: result.count,
      },
    });

    return {
      requested: uniqueIds.length,
      affected: result.count,
      skipped: uniqueIds.length - result.count,
    };
  }

  async bulkUpdateRole(
    userIds: string[],
    role: Role,
    actorId: string
  ): Promise<BulkActionResult> {
    this.validateBulkIds(userIds);

    const uniqueIds = [...new Set(userIds)];
    const result = await prisma.user.updateMany({
      where: {
        id: { in: uniqueIds },
        deletedAt: null,
      },
      data: {
        role,
      },
    });

    await auditService.log("users.bulk.role", {
      actor: actorId,
      metadata: {
        role,
        requested: uniqueIds.length,
        affected: result.count,
      },
    });

    return {
      requested: uniqueIds.length,
      affected: result.count,
      skipped: uniqueIds.length - result.count,
    };
  }
}

export const userService = new UserService();
