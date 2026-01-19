import prisma from '../../config/db';
import { Posisi, Status } from '@prisma/client';
import { NotFoundError } from '../../utils/ApiError';
import { calculateAnthropometry } from '../../utils/zscore/calculator';

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
}

export interface SyncMeasurementInput extends CreateMeasurementInput {
  localId: string;
}

export class MeasurementService {
  async findAll(page = 1, limit = 10, filters?: { balitaId?: string; relawanId?: string; status?: Status }) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};

    if (filters?.balitaId) where.balitaId = filters.balitaId;
    if (filters?.relawanId) where.relawanId = filters.relawanId;
    if (filters?.status) where.statusAkhir = filters.status;

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
        orderBy: { createdAt: 'desc' },
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
      throw new NotFoundError('Measurement not found');
    }

    return measurement;
  }

  async create(data: CreateMeasurementInput) {
    // Verify balita exists
    const balita = await prisma.balita.findUnique({
      where: { id: data.balitaId },
    });

    if (!balita) {
      throw new NotFoundError('Balita not found');
    }

    // Calculate Z-Score and status
    const umurBulan = this.calculateAgeInMonths(balita.tanggalLahir);
    const zScoreResult = this.calculateZScore({
      beratBadan: data.beratBadan,
      tinggiBadan: data.tinggiBadan,
      umurBulan,
      jenisKelamin: balita.jenisKelamin,
    });

    return prisma.measurement.create({
      data: {
        ...data,
        bb_u_status: zScoreResult.bb_u_status,
        tb_u_status: zScoreResult.tb_u_status,
        bb_tb_status: zScoreResult.bb_tb_status,
        statusAkhir: zScoreResult.statusAkhir,
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

  async syncFromOffline(measurements: SyncMeasurementInput[]) {
    const results = [];

    for (const measurement of measurements) {
      // Check if already synced by localId
      const existing = await prisma.measurement.findFirst({
        where: { localId: measurement.localId },
      });

      if (existing) {
        // Update existing
        const updated = await prisma.measurement.update({
          where: { id: existing.id },
          data: {
            ...measurement,
            isSynced: true,
          },
        });
        results.push({ action: 'updated', data: updated });
      } else {
        // Create new
        const created = await this.create({
          ...measurement,
          isSynced: true,
        });
        results.push({ action: 'created', data: created });
      }
    }

    return results;
  }

  async getStatistics() {
    const [total, byStatus, recentMeasurements] = await Promise.all([
      prisma.measurement.count(),
      prisma.measurement.groupBy({
        by: ['statusAkhir'],
        _count: {
          statusAkhir: true,
        },
      }),
      prisma.measurement.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          balita: {
            select: {
              namaAnak: true,
            },
          },
        },
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
      statusCounts,
      recentMeasurements,
    };
  }

  async delete(id: string) {
    const measurement = await prisma.measurement.findUnique({ where: { id } });

    if (!measurement) {
      throw new NotFoundError('Measurement not found');
    }

    await prisma.measurement.delete({ where: { id } });
    return { message: 'Measurement deleted successfully' };
  }

  private calculateAgeInMonths(birthDate: Date): number {
    const today = new Date();
    const birth = new Date(birthDate);
    let months = (today.getFullYear() - birth.getFullYear()) * 12;
    months -= birth.getMonth();
    months += today.getMonth();
    return months <= 0 ? 0 : months;
  }

  /**
   * Simplified Z-Score calculation based on Permenkes 2/2020
   * In production, this should use WHO growth standards lookup tables
   */
  /**
   * Calculate Z-Score and Status using WHO Standards (via Helper)
   */
  private calculateZScore(params: {
    beratBadan: number;
    tinggiBadan: number;
    umurBulan: number;
    jenisKelamin: string;
  }) {
    // Import helper dynamically or valid scope? 
    // Since we are in class method, better to call imported function.
    // Note: ensure calculateAnthropometry is imported at top of file.
    
    return calculateAnthropometry(
      params.umurBulan,
      params.beratBadan,
      params.tinggiBadan,
      params.jenisKelamin
    );
  }

  private getZScoreLabel(zScore: number): string {
    if (zScore < -3) return 'Sangat Kurang';
    if (zScore < -2) return 'Kurang';
    if (zScore <= 2) return 'Normal';
    if (zScore <= 3) return 'Lebih';
    return 'Sangat Lebih';
  }
}

export const measurementService = new MeasurementService();
