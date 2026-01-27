import { describe, expect, it, mock, beforeEach } from "bun:test";
import { poskoService } from "./posko.service";
import prisma from "../../config/db";

mock.module("../../config/db", () => ({
  default: {
    posko: {
      findMany: mock(),
      count: mock(),
      create: mock(),
      findUnique: mock(),
      update: mock(),
      delete: mock(),
    },
    village: { findUnique: mock() },
  },
}));

describe("PoskoService", () => {
  beforeEach(() => mock.restore());

  it("should create posko if village exists", async () => {
    (prisma.village.findUnique as any).mockResolvedValue({ id: 1 });
    (prisma.posko.create as any).mockResolvedValue({
      id: 1,
      name: "Posko 1",
      villageId: 1,
    });

    const result = await poskoService.create({ name: "Posko 1", villageId: 1 });
    expect(result.name).toBe("Posko 1");
  });
});
