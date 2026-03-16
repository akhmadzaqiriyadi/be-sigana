import prisma from "@/config/db";
import { NotFoundError } from "@/utils/ApiError";

interface UpdateKbmReferenceInput {
  kbmMinimal: number;
  updatedBy?: string;
}

export class KbmService {
  async findAll() {
    return prisma.kbmReference.findMany({
      where: {
        usiaBulan: {
          gte: 0,
          lte: 60,
        },
      },
      orderBy: { usiaBulan: "asc" },
    });
  }

  async update(id: number, data: UpdateKbmReferenceInput) {
    const existing = await prisma.kbmReference.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundError("Referensi KBM tidak ditemukan");
    }

    return prisma.kbmReference.update({
      where: { id },
      data: {
        kbmMinimal: data.kbmMinimal,
        updatedBy: data.updatedBy,
      },
    });
  }
}

export const kbmService = new KbmService();
