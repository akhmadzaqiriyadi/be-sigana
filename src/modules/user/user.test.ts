import { describe, expect, it, mock, beforeEach } from "bun:test";
import { userService } from "./user.service";
import prisma from "@/config/db";
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

  it("should find user by id", async () => {
    const mockUser = {
      id: "u1",
      email: "test@test.com",
      name: "Test User",
      role: Role.RELAWAN,
      isVerified: true,
      createdAt: new Date(),
      measurements: [],
    };
    (prisma.user.findFirst as any).mockResolvedValue(mockUser);

    const result = await userService.findById("u1");
    expect(result).toEqual(mockUser);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1", deletedAt: null } })
    );
  });

  it("should throw error if user not found by id", async () => {
    (prisma.user.findFirst as any).mockResolvedValue(null);

    expect(userService.findById("unknown")).rejects.toThrow(
      "Pengguna tidak ditemukan"
    );
  });

  it("should soft delete user", async () => {
    (prisma.user.findFirst as any).mockResolvedValue({ id: "u1" });
    (prisma.user.update as any).mockResolvedValue({
      id: "u1",
      deletedAt: new Date(),
    });

    const result = await userService.delete("u1");
    expect(result.message).toBe("Pengguna berhasil dihapus");
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    );
  });

  it("should throw error when deleting non-existent user", async () => {
    (prisma.user.findFirst as any).mockResolvedValue(null);

    expect(userService.delete("unknown")).rejects.toThrow(
      "Pengguna tidak ditemukan"
    );
  });
});
