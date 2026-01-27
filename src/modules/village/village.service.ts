import prisma from "../../config/db";
import { NotFoundError } from "../../utils/ApiError";

interface CreateVillageInput {
  name: string;
  districts: string;
}

interface UpdateVillageInput {
  name?: string;
  districts?: string;
}

export class VillageService {
  async findAll(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { districts: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [villages, total] = await Promise.all([
      prisma.village.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              poskos: true,
              balitas: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.village.count({ where }),
    ]);

    return {
      villages,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: number) {
    const village = await prisma.village.findUnique({
      where: { id },
      include: {
        poskos: true,
        _count: {
          select: {
            balitas: true,
          },
        },
      },
    });

    if (!village) {
      throw new NotFoundError("Desa tidak ditemukan");
    }

    return village;
  }

  async create(data: CreateVillageInput) {
    return prisma.village.create({
      data,
    });
  }

  async update(id: number, data: UpdateVillageInput) {
    const village = await prisma.village.findUnique({ where: { id } });

    if (!village) {
      throw new NotFoundError("Desa tidak ditemukan");
    }

    return prisma.village.update({
      where: { id },
      data,
    });
  }

  async delete(id: number) {
    const village = await prisma.village.findUnique({ where: { id } });

    if (!village) {
      throw new NotFoundError("Desa tidak ditemukan");
    }

    await prisma.village.delete({ where: { id } });
    return { message: "Desa berhasil dihapus" };
  }
}

export const villageService = new VillageService();
