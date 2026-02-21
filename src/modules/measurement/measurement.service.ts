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
      status?: string;
      updatedAfter?: Date;
      createdAfter?: Date;
      timeRange?: string;
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
    if (filters?.status) {
      const mapping: Record<string, string> = {
        normal: "HIJAU",
        berisiko: "KUNING",
        buruk: "MERAH",
        hijau: "HIJAU",
        kuning: "KUNING",
        merah: "MERAH",
      };
      const statusArray = filters.status
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .map((s) => mapping[s] || s.toUpperCase());

      if (statusArray.length > 0) {
        where.statusAkhir = { in: statusArray as Status[] };
      }
    }
    if (filters?.updatedAfter) where.updatedAt = { gt: filters.updatedAfter };
    if (filters?.createdAfter) where.createdAt = { gt: filters.createdAfter };

    if (filters?.timeRange && filters.timeRange !== "all") {
      const now = new Date();
      const startDate = new Date();

      switch (filters.timeRange) {
        case "today":
          startDate.setHours(0, 0, 0, 0);
          break;
        case "7_days":
          startDate.setDate(now.getDate() - 7);
          break;
        case "30_days":
          startDate.setDate(now.getDate() - 30);
          break;
        case "this_month":
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          break;
      }

      where.createdAt = {
        ...((where.createdAt as Record<string, unknown>) || {}),
        gte: startDate,
      };
    }

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

  async getStatistics(period?: string, villageId?: string) {
    const now = new Date();

    let periodMonths = 6;
    if (period === "1m") periodMonths = 1;
    else if (period === "3m") periodMonths = 3;
    else if (period === "1y") periodMonths = 12;
    else if (period === "all") periodMonths = 60; // Up to 5 years for trend

    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - periodMonths + 1,
      1
    );
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const baseWhere: Prisma.MeasurementWhereInput = { deletedAt: null };
    if (villageId && villageId !== "all") {
      baseWhere.balita = { villageId: parseInt(villageId, 10) };
    }

    const periodWhere: Prisma.MeasurementWhereInput = {
      ...baseWhere,
      ...(period !== "all" ? { createdAt: { gte: startDate } } : {}),
    };

    const currentMonthWhere: Prisma.MeasurementWhereInput = {
      ...baseWhere,
      createdAt: { gte: currentMonthStart },
    };

    const lastMonthWhere: Prisma.MeasurementWhereInput = {
      ...baseWhere,
      createdAt: { gte: lastMonthStart, lt: currentMonthStart },
    };

    const [
      total,
      byStatus,
      recentMeasurements,
      uniqueChildren,
      totalSynced,
      thisMonthTotal,
      lastMonthTotal,
      periodData,
      diseaseData,
    ] = await Promise.all([
      prisma.measurement.count({ where: periodWhere }), // Total measurements in period
      prisma.measurement.groupBy({
        by: ["statusAkhir"],
        where: periodWhere,
        _count: { statusAkhir: true },
      }),
      prisma.measurement.findMany({
        take: 10,
        where: baseWhere,
        orderBy: { createdAt: "desc" },
        include: {
          balita: {
            select: {
              namaAnak: true,
              village: { select: { name: true } },
              posko: { select: { name: true } },
            },
          },
        },
      }),
      prisma.measurement.findMany({
        distinct: ["balitaId"],
        where: periodWhere,
        select: { balitaId: true },
      }),
      prisma.measurement.count({
        where: { ...periodWhere, isSynced: true },
      }),
      prisma.measurement.count({ where: currentMonthWhere }),
      prisma.measurement.count({ where: lastMonthWhere }),
      prisma.measurement.findMany({
        where: periodWhere,
        select: { createdAt: true, statusAkhir: true },
      }),
      prisma.measurement.findMany({
        where: periodWhere,
        orderBy: { createdAt: "asc" },
        select: {
          balitaId: true,
          statusAkhir: true,
          balita: {
            select: {
              village: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    const statusCounts: Record<string, number> = {
      HIJAU: 0,
      KUNING: 0,
      MERAH: 0,
    };

    byStatus.forEach((item) => {
      statusCounts[item.statusAkhir as string] = item._count.statusAkhir;
    });

    const momPercentage =
      lastMonthTotal === 0
        ? thisMonthTotal > 0
          ? 100
          : 0
        : ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;

    const trendMap = new Map<
      string,
      { month: string; HIJAU: number; KUNING: number; MERAH: number }
    >();

    const maxMonthsForTrend = Math.min(periodMonths, 12);
    for (let i = maxMonthsForTrend - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthName = d.toLocaleString("id-ID", { month: "short" });
      trendMap.set(key, { month: monthName, HIJAU: 0, KUNING: 0, MERAH: 0 });
    }

    periodData.forEach((m) => {
      const d = new Date(m.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const trendItem = trendMap.get(key);
      if (trendItem) {
        if (m.statusAkhir === "HIJAU") trendItem.HIJAU++;
        else if (m.statusAkhir === "KUNING") trendItem.KUNING++;
        else if (m.statusAkhir === "MERAH") trendItem.MERAH++;
      }
    });

    const trend = Array.from(trendMap.values());

    const latestPerBalita = new Map<
      string,
      { statusAkhir: string; villageId: string; villageName: string }
    >();
    diseaseData.forEach((m) => {
      if (m.balita.village) {
        latestPerBalita.set(m.balitaId, {
          statusAkhir: m.statusAkhir as string,
          villageId: m.balita.village.id,
          villageName: m.balita.village.name,
        });
      }
    });

    const villageStatsMap = new Map<
      string,
      {
        name: string;
        total: number;
        HIJAU: number;
        KUNING: number;
        MERAH: number;
      }
    >();

    latestPerBalita.forEach((data) => {
      if (!villageStatsMap.has(data.villageId)) {
        villageStatsMap.set(data.villageId, {
          name: data.villageName,
          total: 0,
          HIJAU: 0,
          KUNING: 0,
          MERAH: 0,
        });
      }
      const vStat = villageStatsMap.get(data.villageId)!;
      vStat.total++;
      if (data.statusAkhir === "HIJAU") vStat.HIJAU++;
      else if (data.statusAkhir === "KUNING") vStat.KUNING++;
      else if (data.statusAkhir === "MERAH") vStat.MERAH++;
    });

    const topRiskVillages = Array.from(villageStatsMap.values())
      .map((v) => {
        const riskCount = v.KUNING + v.MERAH;
        const riskPercentage = v.total > 0 ? (riskCount / v.total) * 100 : 0;
        return {
          nama: v.name,
          totalBalita: v.total,
          riskPercentage: parseFloat(riskPercentage.toFixed(2)),
          HIJAU: v.HIJAU,
          KUNING: v.KUNING,
          MERAH: v.MERAH,
        };
      })
      .sort((a, b) => b.riskPercentage - a.riskPercentage)
      .slice(0, 10);

    const insights: Array<{
      type: "success" | "warning" | "info";
      message: string;
    }> = [];

    if (momPercentage > 10) {
      insights.push({
        type: "info",
        message: `Terjadi peningkatan ${momPercentage.toFixed(1)}% partisipasi pengukuran bulan ini dibandingkan bulan lalu.`,
      });
    } else if (momPercentage < -10) {
      insights.push({
        type: "warning",
        message: `Tingkat partisipasi menurun. Terdapat penurunan ${Math.abs(momPercentage).toFixed(1)}% pengukuran bulan ini.`,
      });
    }

    const totalChildrenLatest = latestPerBalita.size;
    if (totalChildrenLatest > 0) {
      let riskChildren = 0;
      latestPerBalita.forEach((data) => {
        if (data.statusAkhir === "KUNING" || data.statusAkhir === "MERAH")
          riskChildren++;
      });
      const badPercentage = (riskChildren / totalChildrenLatest) * 100;
      if (badPercentage > 20) {
        insights.push({
          type: "warning",
          message: `Perhatian: ${badPercentage.toFixed(1)}% balita yang diukur dalam periode ini didiagnosis berstatus risiko gizi (KUNING / MERAH).`,
        });
      } else if (badPercentage < 5) {
        insights.push({
          type: "success",
          message: `Kondisi gizi balita sangat baik. Hanya ${badPercentage.toFixed(1)}% balita dengan risiko gizi.`,
        });
      } else {
        insights.push({
          type: "success",
          message: `Kondisi gizi balita secara umum cukup terkendali.`,
        });
      }
    }

    if (topRiskVillages.length > 0 && topRiskVillages[0].riskPercentage > 30) {
      insights.push({
        type: "warning",
        message: `Desa ${topRiskVillages[0].nama} membutuhkan intervensi. ${topRiskVillages[0].riskPercentage}% data pengukurannya berstatus KUNING atau MERAH.`,
      });
    }

    return {
      total,
      totalChildrenChecked: uniqueChildren.length,
      totalSynced,
      statusCounts,
      recentMeasurements,
      momPercentage,
      trend,
      topRiskVillages,
      insights,
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
