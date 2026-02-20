import prisma from "@/config/db";
import { Posisi, Status, Prisma } from "@prisma/client";
import { NotFoundError, ForbiddenError } from "@/utils/ApiError";
import { calculateAnthropometry } from "@/utils/zscore/calculator";

interface CreateMeasurementInput {
  balitaId: string;
  relawanId: string;
  beratBadan: number;
  tinggiBadan: number;
  lingkarKepala: number;
  lila: number;
  posisiUkur: Posisi;
  localId?: string;
  isSynced?: boolean;
  notes?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sanitationData?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  medicalHistoryData?: any;
  // Optional pre-calculated statuses from frontend (Offline First)
  bb_u_status?: string;
  tb_u_status?: string;
  bb_tb_status?: string;
  statusAkhir?: Status;
}

export interface SyncMeasurementInput extends CreateMeasurementInput {
  localId: string;
}

export class MeasurementService {
  async findAll(
    page = 1,
    limit = 10,
    filters?: {
      search?: string;
      balitaId?: string;
      relawanId?: string;
      status?: Status;
      updatedAfter?: Date;
      createdAfter?: Date;
    },
    currentUser?: { role: string; userId: string }
  ) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    // RBAC: If RELAWAN, force filter by their ID
    if (currentUser?.role === "RELAWAN") {
      where.relawanId = currentUser.userId;
    } else if (filters?.relawanId) {
      // Admin/Stakeholder can filter by specific relawan
      where.relawanId = filters.relawanId;
    }

    if (filters?.search) {
      where.balita = {
        OR: [
          { namaAnak: { contains: filters.search, mode: "insensitive" } },
          {
            village: {
              name: { contains: filters.search, mode: "insensitive" },
            },
          },
          {
            posko: { name: { contains: filters.search, mode: "insensitive" } },
          },
        ],
      };
    }
    if (filters?.balitaId) where.balitaId = filters.balitaId;
    if (filters?.status) where.statusAkhir = filters.status;
    if (filters?.updatedAfter) where.updatedAt = { gt: filters.updatedAfter };
    if (filters?.createdAfter) where.createdAt = { gt: filters.createdAfter };

    const [measurements, total] = await Promise.all([
      prisma.measurement.findMany({
        where,
        skip,
        take: limit,
        include: {
          balita: {
            select: {
              id: true,
              namaAnak: true,
              namaOrtu: true,
              tanggalLahir: true,
              jenisKelamin: true,
            },
          },
          relawan: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.measurement.count({ where }),
    ]);

    return {
      measurements,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const measurement = await prisma.measurement.findUnique({
      where: { id },
      include: {
        balita: {
          include: {
            village: true,
            posko: true,
          },
        },
        relawan: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!measurement) {
      throw new NotFoundError("Data pengukuran tidak ditemukan");
    }

    return measurement;
  }

  async create(data: CreateMeasurementInput) {
    // Verify balita exists
    const balita = await prisma.balita.findUnique({
      where: { id: data.balitaId },
    });

    if (!balita) {
      throw new NotFoundError("Data balita tidak ditemukan");
    }

    // Calculate Z-Score and status using WHO LMS Standard
    // NOTE: Backend recalculates to ensure data integrity, even if frontend sends calculated values.
    const umurBulan = this.calculateAgeInMonths(balita.tanggalLahir);
    const zScoreResult = calculateAnthropometry(
      umurBulan,
      data.beratBadan,
      data.tinggiBadan,
      data.lingkarKepala,
      data.lila,
      balita.jenisKelamin
    );

    return prisma.measurement.create({
      data: {
        ...data,
        // Overwrite any frontend-provided status with backend calculation
        bb_u_status: zScoreResult.bb_u_status,
        tb_u_status: zScoreResult.tb_u_status,
        bb_tb_status: zScoreResult.bb_tb_status,
        lk_u_status: zScoreResult.lk_u_status,
        lila_u_status: zScoreResult.lila_u_status,
        imt_u_status: zScoreResult.imt_u_status,
        statusAkhir: zScoreResult.statusAkhir as Status,
      },
      include: {
        balita: {
          select: {
            id: true,
            namaAnak: true,
            namaOrtu: true,
          },
        },
        relawan: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async update(id: string, data: Partial<CreateMeasurementInput>) {
    const measurement = await prisma.measurement.findUnique({
      where: { id },
      include: { balita: true },
    });

    if (!measurement) {
      throw new NotFoundError("Data pengukuran tidak ditemukan");
    }

    // If anthropometry data changes, recalculate Z-Scores
    let zScoreUpdates = {};
    if (
      (data.beratBadan && data.beratBadan !== measurement.beratBadan) ||
      (data.tinggiBadan && data.tinggiBadan !== measurement.tinggiBadan)
    ) {
      const umurBulan = this.calculateAgeInMonths(
        measurement.balita.tanggalLahir
      );
      const zScoreResult = calculateAnthropometry(
        umurBulan,
        data.beratBadan || measurement.beratBadan,
        data.tinggiBadan || measurement.tinggiBadan,
        measurement.balita.jenisKelamin
      );

      zScoreUpdates = {
        bb_u_status: zScoreResult.bb_u_status,
        tb_u_status: zScoreResult.tb_u_status,
        bb_tb_status: zScoreResult.bb_tb_status,
        statusAkhir: zScoreResult.statusAkhir as Status,
      };
    }

    return prisma.measurement.update({
      where: { id },
      data: {
        ...data,
        ...zScoreUpdates,
      },
      include: {
        balita: {
          select: {
            id: true,
            namaAnak: true,
            namaOrtu: true,
          },
        },
      },
    });
  }

  async syncFromOffline(measurements: SyncMeasurementInput[]) {
    const localIds = measurements.map((m) => m.localId).filter(Boolean);
    const existing = await prisma.measurement.findMany({
      where: { localId: { in: localIds } },
      select: { id: true, localId: true },
    });

    const existingMap = new Map(existing.map((m) => [m.localId, m.id]));
    const balitaIds = Array.from(new Set(measurements.map((m) => m.balitaId)));

    // Optimization: Fetch all Balita info once for Z-Score calculation
    const balitas = await prisma.balita.findMany({
      where: { id: { in: balitaIds } },
      select: { id: true, tanggalLahir: true, jenisKelamin: true },
    });
    const balitaMap = new Map<string, (typeof balitas)[0]>(
      balitas.map((b) => [b.id, b])
    );

    const toCreate: Prisma.MeasurementCreateManyInput[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePromises: Prisma.PrismaPromise<any>[] = [];

    for (const m of measurements) {
      const balita = balitaMap.get(m.balitaId);
      if (!balita) continue;

      const umurBulan = this.calculateAgeInMonths(balita.tanggalLahir);
      // Recalculate z-scores for synced data to ensure integrity
      const zScore = calculateAnthropometry(
        umurBulan,
        m.beratBadan,
        m.tinggiBadan,
        m.lingkarKepala,
        m.lila,
        balita.jenisKelamin
      );

      const data = {
        ...m,
        bb_u_status: zScore.bb_u_status,
        tb_u_status: zScore.tb_u_status,
        bb_tb_status: zScore.bb_tb_status,
        lk_u_status: zScore.lk_u_status,
        lila_u_status: zScore.lila_u_status,
        imt_u_status: zScore.imt_u_status,
        statusAkhir: zScore.statusAkhir as Status,
        isSynced: true,
      };

      const existingId = existingMap.get(m.localId);
      if (existingId) {
        updatePromises.push(
          prisma.measurement.update({
            where: { id: existingId },
            data,
          })
        );
      } else {
        toCreate.push(data);
      }
    }

    // Execute Batches
    if (toCreate.length > 0) {
      await prisma.measurement.createMany({ data: toCreate });
    }

    if (updatePromises.length > 0) {
      await prisma.$transaction(updatePromises);
    }

    return {
      created: toCreate.length,
      updated: updatePromises.length,
      status: "success",
    };
  }

  async getDeltaSync(lastSync: Date, relawanId?: string) {
    const where: Prisma.MeasurementWhereInput = {
      OR: [{ updatedAt: { gt: lastSync } }, { deletedAt: { gt: lastSync } }],
    };

    // RBAC for Downstream Sync
    if (relawanId) {
      where.relawanId = relawanId;
    }

    return prisma.measurement.findMany({
      where,
      select: {
        id: true,
        localId: true,
        balitaId: true,
        beratBadan: true,
        tinggiBadan: true,
        lingkarKepala: true,
        lila: true,
        posisiUkur: true,
        bb_u_status: true,
        tb_u_status: true,
        bb_tb_status: true,
        statusAkhir: true,
        updatedAt: true,
        deletedAt: true, // Important for tombstone
        notes: true,
        sanitationData: true,
        medicalHistoryData: true,
      },
    });
  }

  async getStatistics() {
    const [total, byStatus, recentMeasurements, uniqueChildren, totalSynced] =
      await Promise.all([
        prisma.measurement.count(),
        prisma.measurement.groupBy({
          by: ["statusAkhir"],
          _count: {
            statusAkhir: true,
          },
        }),
        prisma.measurement.findMany({
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            balita: {
              select: {
                namaAnak: true,
              },
            },
          },
        }),
        prisma.measurement.findMany({
          distinct: ["balitaId"],
          select: { balitaId: true },
        }),
        prisma.measurement.count({
          where: { isSynced: true },
        }),
      ]);

    const statusCounts = {
      HIJAU: 0,
      KUNING: 0,
      MERAH: 0,
    };

    byStatus.forEach((item) => {
      statusCounts[item.statusAkhir] = item._count.statusAkhir;
    });

    return {
      total,
      totalChildrenChecked: uniqueChildren.length,
      totalSynced,
      statusCounts,
      recentMeasurements,
    };
  }

  async delete(id: string) {
    const measurement = await prisma.measurement.findUnique({ where: { id } });

    if (!measurement) {
      throw new NotFoundError("Data pengukuran tidak ditemukan");
    }

    // Soft delete for sync tombstone
    await prisma.measurement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: "Data pengukuran berhasil dihapus" };
  }

  async getPublicInfo(id: string) {
    // 1. Try to find by Measurement ID
    let measurement = await prisma.measurement.findFirst({
      where: { id, deletedAt: null },
      include: {
        balita: {
          include: {
            posko: { select: { name: true } },
          },
        },
      },
    });

    // 2. If not found, check if it's a Balita ID and get the latest measurement
    if (!measurement) {
      const balitaExists = await prisma.balita.findUnique({ where: { id } });
      if (balitaExists) {
        measurement = await prisma.measurement.findFirst({
          where: { balitaId: id },
          orderBy: { createdAt: "desc" },
          include: {
            balita: {
              include: {
                posko: { select: { name: true } },
              },
            },
          },
        });
      }
    }

    if (!measurement) {
      throw new NotFoundError("Data pengukuran tidak ditemukan");
    }

    // Masking Name: "Budi" -> "B***"
    const maskedName = measurement.balita.namaAnak
      .split(" ")
      .map((word) => word[0] + "***")
      .join(" ");

    return {
      id: measurement.id, // Return actual Measurement ID for context if needed
      maskedName: maskedName,
      gender: measurement.balita.jenisKelamin,
      createdAt: measurement.createdAt,
      poskoName: measurement.balita.posko?.name || "Tidak ada posko",
    };
  }

  async verifyAccess(id: string, dob: string) {
    // 1. Identify Balita ID from the input ID (could be measurement ID or balita ID)
    let balitaId = id;

    // Check if it's a measurement ID first
    const measurementRef = await prisma.measurement.findFirst({
      where: { id, deletedAt: null },
      select: { balitaId: true },
    });

    if (measurementRef) {
      balitaId = measurementRef.balitaId;
    }

    // 2. Fetch Balita with details for verification and response
    const balita = await prisma.balita.findUnique({
      where: { id: balitaId },
      include: {
        village: true,
        posko: true,
      },
    });

    if (!balita) {
      throw new NotFoundError("Data tidak ditemukan");
    }

    // 3. Verify DOB (Compare YYYY-MM-DD)
    const inputDate = new Date(dob).toISOString().split("T")[0];
    const actualDate = balita.tanggalLahir.toISOString().split("T")[0];

    if (inputDate !== actualDate) {
      throw new ForbiddenError("Anda tidak memiliki akses terhadap data ini");
    }

    // 4. Fetch ALL Measurements for this Balita (History)
    const measurements = await prisma.measurement.findMany({
      where: { balitaId: balita.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        relawan: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      success: true,
      data: {
        balita,
        measurements,
      },
    };
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

export const measurementService = new MeasurementService();
