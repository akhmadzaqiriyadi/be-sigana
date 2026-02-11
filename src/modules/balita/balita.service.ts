import prisma from "@/config/db";
import { Gender } from "@prisma/client";
import { NotFoundError } from "@/utils/ApiError";
import { logger } from "@/utils/logger";
interface CreateBalitaInput {
  namaAnak: string;
  namaOrtu: string;
  tanggalLahir: Date;
  jenisKelamin: Gender;
  villageId: number;
  poskoId?: number;
}

interface UpdateBalitaInput {
  namaAnak?: string;
  namaOrtu?: string;
  tanggalLahir?: Date;
  jenisKelamin?: Gender;
  villageId?: number;
  poskoId?: number;
}

export class BalitaService {
  async findAll(
    page = 1,
    limit = 10,
    filters?: { villageId?: number; poskoId?: number; search?: string }
  ) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};

    if (filters?.villageId) where.villageId = filters.villageId;
    if (filters?.poskoId) where.poskoId = filters.poskoId;
    if (filters?.search) {
      where.OR = [
        { namaAnak: { contains: filters.search, mode: "insensitive" } },
        { namaOrtu: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [balitas, total] = await Promise.all([
      prisma.balita.findMany({
        where,
        skip,
        take: limit,
        include: {
          village: {
            select: {
              id: true,
              name: true,
              districts: true,
            },
          },
          posko: {
            select: {
              id: true,
              name: true,
            },
          },
          measurements: {
            select: {
              id: true,
              statusAkhir: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.balita.count({ where }),
    ]);

    // Calculate age in months for each balita
    const balitasWithAge = balitas.map((balita) => ({
      ...balita,
      umurBulan: this.calculateAgeInMonths(balita.tanggalLahir),
    }));

    return {
      balitas: balitasWithAge,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const balita = await prisma.balita.findUnique({
      where: { id },
      include: {
        village: true,
        posko: true,
        measurements: {
          include: {
            relawan: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!balita) {
      throw new NotFoundError("Data balita tidak ditemukan");
    }

    return {
      ...balita,
      umurBulan: this.calculateAgeInMonths(balita.tanggalLahir),
    };
  }

  async create(data: CreateBalitaInput) {
    // Verify village exists
    const village = await prisma.village.findUnique({
      where: { id: data.villageId },
    });

    if (!village) {
      throw new NotFoundError("Desa tidak ditemukan");
    }

    // Verify posko exists if provided
    if (data.poskoId) {
      const posko = await prisma.posko.findUnique({
        where: { id: data.poskoId },
      });

      if (!posko) {
        throw new NotFoundError("Posko tidak ditemukan");
      }
    }

    const balita = await prisma.balita.create({
      data,
      include: {
        village: {
          select: {
            id: true,
            name: true,
            districts: true,
          },
        },
        posko: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      ...balita,
      umurBulan: this.calculateAgeInMonths(balita.tanggalLahir),
    };
  }

  async update(id: string, data: UpdateBalitaInput) {
    const balita = await prisma.balita.findUnique({ where: { id } });

    if (!balita) {
      throw new NotFoundError("Data balita tidak ditemukan");
    }

    const updated = await prisma.balita.update({
      where: { id },
      data,
      include: {
        village: {
          select: {
            id: true,
            name: true,
            districts: true,
          },
        },
        posko: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      ...updated,
      umurBulan: this.calculateAgeInMonths(updated.tanggalLahir),
    };
  }

  async delete(id: string) {
    const balita = await prisma.balita.findUnique({ where: { id } });

    if (!balita) {
      throw new NotFoundError("Data balita tidak ditemukan");
    }

    await prisma.balita.delete({ where: { id } });
    return { message: "Data balita berhasil dihapus" };
  }

  private calculateAgeInMonths(birthDate: Date): number {
    const today = new Date();
    const birth = new Date(birthDate);
    let months = (today.getFullYear() - birth.getFullYear()) * 12;
    months -= birth.getMonth();
    months += today.getMonth();
    return Math.max(0, months);
  }

  async sync(
    balitas: {
      localId: string;
      namaAnak: string;
      namaOrtu: string;
      tanggalLahir: string | Date; // Accept string or Date
      jenisKelamin: Gender;
      villageId: number;
      poskoId?: number | null;
      createdAt?: string;
    }[]
  ) {
    const results = [];

    for (const data of balitas) {
      // 1. Validation Logic
      // Verify village exists
      const village = await prisma.village.findUnique({
        where: { id: data.villageId },
      });

      if (!village) {
        // If village not found, we can't create. Result: error
        results.push({
          localId: data.localId,
          status: "failed",
          error: `Village ID ${data.villageId} not found`,
        });
        continue;
      }

      // Verify posko if exists
      if (data.poskoId) {
        const posko = await prisma.posko.findUnique({
          where: { id: data.poskoId },
        });
        if (!posko) {
          results.push({
            localId: data.localId,
            status: "failed",
            error: `Posko ID ${data.poskoId} not found`,
          });
          continue;
        }
      }

      // 2. Deduplication Strategy
      // Check if balita already exists based on composite key (NamaAnak + NamaOrtu + TanggalLahir + Gender)
      // This is a heuristic.
      const birthDate = new Date(data.tanggalLahir);

      const existing = await prisma.balita.findFirst({
        where: {
          namaAnak: { equals: data.namaAnak, mode: "insensitive" },
          namaOrtu: { equals: data.namaOrtu, mode: "insensitive" },
          tanggalLahir: birthDate,
          jenisKelamin: data.jenisKelamin,
        },
      });

      if (existing) {
        results.push({
          localId: data.localId,
          serverId: existing.id,
          status: "merged",
        });
        continue;
      }

      // 3. Create New
      try {
        const newBalita = await prisma.balita.create({
          data: {
            namaAnak: data.namaAnak,
            namaOrtu: data.namaOrtu,
            tanggalLahir: birthDate,
            jenisKelamin: data.jenisKelamin,
            villageId: data.villageId,
            poskoId: data.poskoId || null,
            // We can optionally use createdAt from offline if we want to preserve history
            // But usually server time is better for consistency unless specified.
            // Requirement didn't specify strict timestamp sync, so we let default(now()) or use it if important.
            // Let's stick to default behavior for now, but if offline timestamp is critical, we could add it.
            // I will assume server time is fine for `createdAt`.
          },
        });

        results.push({
          localId: data.localId,
          serverId: newBalita.id,
          status: "created",
        });
      } catch (error) {
        logger.error("Error syncing balita:", { error });
        results.push({
          localId: data.localId,
          status: "failed",
          error: "Internal Server Error",
        });
      }
    }

    return results;
  }
}

export const balitaService = new BalitaService();
