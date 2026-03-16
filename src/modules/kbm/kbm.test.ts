import { beforeEach, describe, expect, it, mock } from "bun:test";
import prisma from "@/config/db";
import { kbmService } from "./kbm.service";

mock.module("@/config/db", () => ({
  default: {
    kbmReference: {
      findMany: mock(),
      findUnique: mock(),
      update: mock(),
    },
  },
}));

describe("KbmService", () => {
  beforeEach(() => {
    const mocks = [
      prisma.kbmReference.findMany,
      prisma.kbmReference.findUnique,
      prisma.kbmReference.update,
    ];

    mocks.forEach((fn: any) => fn.mockClear?.());
  });

  it("should return KBM references ordered by usiaBulan", async () => {
    const references = [
      { id: 1, usiaBulan: 0, kbmMinimal: 4200 },
      { id: 2, usiaBulan: 1, kbmMinimal: 4500 },
    ];

    (prisma.kbmReference.findMany as any).mockResolvedValue(references);

    const result = await kbmService.findAll();

    expect(result).toEqual(references);
    expect(prisma.kbmReference.findMany).toHaveBeenCalledWith({
      where: {
        usiaBulan: {
          gte: 0,
          lte: 60,
        },
      },
      orderBy: { usiaBulan: "asc" },
    });
  });

  it("should update KBM reference and store updatedBy", async () => {
    (prisma.kbmReference.findUnique as any).mockResolvedValue({ id: 7 });
    (prisma.kbmReference.update as any).mockResolvedValue({
      id: 7,
      usiaBulan: 6,
      kbmMinimal: 5800,
      updatedBy: "admin@sigana.id",
    });

    const result = await kbmService.update(7, {
      kbmMinimal: 5800,
      updatedBy: "admin@sigana.id",
    });

    expect(result.kbmMinimal).toBe(5800);
    expect(prisma.kbmReference.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        kbmMinimal: 5800,
        updatedBy: "admin@sigana.id",
      },
    });
  });

  it("should throw NotFoundError when KBM reference does not exist", async () => {
    (prisma.kbmReference.findUnique as any).mockResolvedValue(null);

    let error: any;
    try {
      await kbmService.update(999, { kbmMinimal: 7000 });
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeDefined();
    expect(error.statusCode).toBe(404);
    expect(error.message).toContain("Referensi KBM tidak ditemukan");
  });
});
