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
    filters?: {
      villageId?: number;
      poskoId?: number;
      search?: string;
      statusGizi?: string;
      period?: string;
      isSanitasiBuruk?: boolean;
      isKsiRendah?: boolean;
      isLilaRendah?: boolean;
    }
  ) {
    const skip = (page - 1) * limit;

    // Base Where Object (without statusGizi, to calculate summary for the panel)
    const baseWhere: any = {};

    if (filters?.villageId) baseWhere.villageId = filters.villageId;
    if (filters?.poskoId) baseWhere.poskoId = filters.poskoId;
    if (filters?.search) {
      baseWhere.OR = [
        { namaAnak: { contains: filters.search, mode: "insensitive" } },
        { namaOrtu: { contains: filters.search, mode: "insensitive" } },
        {
          village: {
            name: { contains: filters.search, mode: "insensitive" },
          },
        },
        {
          posko: {
            name: { contains: filters.search, mode: "insensitive" },
          },
        },
      ];
    }

    const baseMeasurementFilter: any = {};
    let hasBaseMeasurement = false;

    if (filters?.period) {
      hasBaseMeasurement = true;
      if (filters.period === "6_months") {
        baseMeasurementFilter.createdAt = {
          gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000),
        };
      } else if (filters.period.includes(",")) {
        const [start, end] = filters.period.split(",");
        if (start && end) {
          baseMeasurementFilter.createdAt = {
            gte: new Date(start),
            lte: new Date(end),
          };
        }
      }
    }

    if (filters?.isLilaRendah) {
      hasBaseMeasurement = true;
      baseMeasurementFilter.lila = { lt: 11.5 };
    }

    // Fallback search approach for JSON fields to avoid TypeScript configuration errors
    if (filters?.isSanitasiBuruk) {
      hasBaseMeasurement = true;
      baseMeasurementFilter.sanitationData = {
        path: ["isSanitasiBuruk"],
        equals: true,
      };
    }
    if (filters?.isKsiRendah) {
      hasBaseMeasurement = true;
      baseMeasurementFilter.medicalHistoryData = {
        path: ["isKsiRendah"],
        equals: true,
      };
    }

    if (hasBaseMeasurement) {
      baseWhere.measurements = { some: baseMeasurementFilter };
    }

    // Where Object with statusGizi
    const where = { ...baseWhere };
    if (filters?.statusGizi) {
      const status = filters.statusGizi.toLowerCase();
      const stFilter: any = { ...baseMeasurementFilter };

      if (status === "normal") stFilter.statusAkhir = "HIJAU";
      else if (status === "warning") stFilter.statusAkhir = "KUNING";
      else if (status === "faltering") {
        stFilter.statusAkhir = "MERAH";
        stFilter.bb_tb_status = { not: { contains: "Buruk" } };
      } else if (status === "gizi buruk") {
        stFilter.statusAkhir = "MERAH";
        stFilter.bb_tb_status = { contains: "Buruk" };
      }

      where.measurements = { some: stFilter };
    }

    const countWhere = (statusAkhir: string, additional: any = {}) => ({
      ...baseWhere,
      measurements: {
        some: {
          ...baseMeasurementFilter,
          statusAkhir,
          ...additional,
        },
      },
    });

    const [balitas, total, totalBase, normal, warning, faltering, giziBuruk] =
      await Promise.all([
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
                beratBadan: true,
                tinggiBadan: true,
                lila: true,
                statusAkhir: true,
                bb_tb_status: true,
                createdAt: true,
                relawan: {
                  select: { name: true },
                },
              },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.balita.count({ where }),
        prisma.balita.count({ where: baseWhere }),
        prisma.balita.count({ where: countWhere("HIJAU") }),
        prisma.balita.count({ where: countWhere("KUNING") }),
        prisma.balita.count({
          where: countWhere("MERAH", {
            bb_tb_status: { not: { contains: "Buruk" } },
          }),
        }),
        prisma.balita.count({
          where: countWhere("MERAH", { bb_tb_status: { contains: "Buruk" } }),
        }),
      ]);

    const mappedBalitas = balitas.map((balita) => {
      const latest = balita.measurements[0];
      const statusGiziStr =
        latest?.statusAkhir === "HIJAU"
          ? "Normal"
          : latest?.statusAkhir === "KUNING"
            ? "Warning"
            : latest?.statusAkhir === "MERAH" &&
                latest?.bb_tb_status?.includes("Buruk")
              ? "Gizi Buruk"
              : latest?.statusAkhir === "MERAH"
                ? "Faltering"
                : "Unknown";

      return {
        id: balita.id,
        namaAnak: balita.namaAnak,
        namaOrtu: balita.namaOrtu,
        jenisKelamin: balita.jenisKelamin,
        tanggalLahir: balita.tanggalLahir,
        umur: `${this.calculateAgeInMonths(balita.tanggalLahir)} bln`,
        village: balita.village,
        latestMeasurement: latest
          ? {
              statusGizi: statusGiziStr,
              bb: latest.beratBadan,
              tb: latest.tinggiBadan,
              lila: latest.lila,
              tanggalInput: latest.createdAt,
              petugas: latest.relawan?.name,
            }
          : null,
      };
    });

    return {
      balitas: mappedBalitas,
      summary: {
        totalTerdata: totalBase,
        normal,
        warning,
        faltering,
        giziBuruk,
      },
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
