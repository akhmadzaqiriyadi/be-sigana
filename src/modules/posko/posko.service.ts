import { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { NotFoundError } from '../../utils/ApiError';

interface CreatePoskoInput {
  name: string;
  villageId: number;
  latitude?: number;
  longitude?: number;
}

interface UpdatePoskoInput {
  name?: string;
  villageId?: number;
  latitude?: number;
  longitude?: number;
}

export class PoskoService {
  async findAll(page = 1, limit = 10, villageId?: number, search?: string) {
    const skip = (page - 1) * limit;
    const where: Prisma.PoskoWhereInput = {
      ...(villageId && { villageId }),
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };

    const [poskos, total] = await Promise.all([
      prisma.posko.findMany({
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
          _count: {
            select: {
              balitas: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.posko.count({ where }),
    ]);

    return {
      poskos,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: number) {
    const posko = await prisma.posko.findUnique({
      where: { id },
      include: {
        village: true,
        balitas: {
          select: {
            id: true,
            namaAnak: true,
            namaOrtu: true,
            jenisKelamin: true,
          },
          take: 20,
        },
      },
    });

    if (!posko) {
      throw new NotFoundError('Posko not found');
    }

    return posko;
  }

  async create(data: CreatePoskoInput) {
    // Verify village exists
    const village = await prisma.village.findUnique({
      where: { id: data.villageId },
    });

    if (!village) {
      throw new NotFoundError('Village not found');
    }

    return prisma.posko.create({
      data,
      include: {
        village: {
          select: {
            id: true,
            name: true,
            districts: true,
          },
        },
      },
    });
  }

  async update(id: number, data: UpdatePoskoInput) {
    const posko = await prisma.posko.findUnique({ where: { id } });

    if (!posko) {
      throw new NotFoundError('Posko not found');
    }

    if (data.villageId) {
      const village = await prisma.village.findUnique({
        where: { id: data.villageId },
      });

      if (!village) {
        throw new NotFoundError('Village not found');
      }
    }

    return prisma.posko.update({
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
      },
    });
  }

  async delete(id: number) {
    const posko = await prisma.posko.findUnique({ where: { id } });

    if (!posko) {
      throw new NotFoundError('Posko not found');
    }

    await prisma.posko.delete({ where: { id } });
    return { message: 'Posko deleted successfully' };
  }

  async getMapData() {
    return prisma.posko.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        village: {
          select: {
            name: true,
            districts: true,
          },
        },
        _count: {
          select: {
            balitas: true,
          },
        },
      },
    });
  }
}

export const poskoService = new PoskoService();
