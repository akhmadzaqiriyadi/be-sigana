import { describe, expect, it, mock, beforeEach } from "bun:test";
import { villageService } from "./village.service";
import prisma from "../../config/db";

mock.module("../../config/db", () => ({
  default: {
    village: {
      findMany: mock(),
      count: mock(),
      create: mock(),
      findUnique: mock(),
      update: mock(),
      delete: mock(),
    },
  },
}));

describe("VillageService", () => {
  beforeEach(() => mock.restore());

  it("should create village", async () => {
    (prisma.village.create as any).mockResolvedValue({
      id: 1,
      name: "Desa A",
      districts: "Kec B",
    });
    const result = await villageService.create({
      name: "Desa A",
      districts: "Kec B",
    });
    expect(result.name).toBe("Desa A");
  });
});
