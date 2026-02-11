import prisma from "@/config/db";
import { Gender } from "@prisma/client";
import { NotFoundError } from "@/utils/ApiError";

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
}

export const balitaService = new BalitaService();
