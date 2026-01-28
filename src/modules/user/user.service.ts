import prisma from "@/config/db";
import bcrypt from "bcryptjs";
import { Role, Prisma } from "@prisma/client";
import { NotFoundError, ConflictError } from "@/utils/ApiError";

interface UpdateUserInput {
  name?: string;
  isVerified?: boolean;
  role?: Role;
}

interface UpdateProfileInput {
  name?: string;
}

interface UserFilters {
  search?: string;
  role?: Role;
  isVerified?: boolean;
}

interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role?: Role;
  isVerified?: boolean;
}

export class UserService {
  async create(data: CreateUserInput) {
    // Check for existing email
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
        role: data.role || "RELAWAN",
        isVerified: data.isVerified ?? true, // Admin-created users are verified by default
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

    const [users, total, totalVerified, totalPending] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        where: whereClause,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isVerified: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where: whereClause }),
      prisma.user.count({ where: { deletedAt: null, isVerified: true } }),
      prisma.user.count({ where: { deletedAt: null, isVerified: false } }),
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
    };
  }

  async findById(id: string) {
    const user = await prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        createdAt: true,
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

    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
    });
  }

  async updateProfile(id: string, data: UpdateProfileInput) {
    // Delegate to update method to avoid code duplication
    // UpdateProfileInput is a subset of UpdateUserInput (only 'name')
    return this.update(id, data);
  }

  async verifyUser(id: string) {
    return this.update(id, { isVerified: true });
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
      data: { deletedAt: new Date() },
    });
    return { message: "Pengguna berhasil dihapus" };
  }

  async getPendingUsers() {
    return prisma.user.findMany({
      where: {
        isVerified: false,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const userService = new UserService();
