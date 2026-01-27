import { describe, expect, it, mock, beforeEach } from "bun:test";
import { userService } from "./user.service";
import prisma from "../../config/db";
import { Role } from "@prisma/client";

mock.module("../../config/db", () => ({
  default: {
    user: {
      findMany: mock(),
      count: mock(),
      findUnique: mock(),
      findFirst: mock(),
      update: mock(),
      delete: mock(),
    },
  },
}));

describe("UserService", () => {
  beforeEach(() => mock.restore());

  it("should return users list", async () => {
    (prisma.user.findMany as any).mockResolvedValue([
      { id: "u1", email: "test@test.com" },
    ]);
    (prisma.user.count as any).mockResolvedValue(1);

    const result = await userService.findAll(1, 10);
    expect(result.users).toHaveLength(1);
  });

  it("should update user role", async () => {
    (prisma.user.findFirst as any).mockResolvedValue({ id: "u1" });
    (prisma.user.update as any).mockResolvedValue({ id: "u1", role: "ADMIN" });
    const result = await userService.update("u1", { role: Role.ADMIN });
    expect(result.role).toBe("ADMIN");
  });
});
