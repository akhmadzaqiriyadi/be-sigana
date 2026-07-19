import { describe, expect, it, mock } from "bun:test";
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
      findUniqueOrThrow: mock(),
      updateMany: mock(),
      create: mock(),
    },
    auditLog: {
      findMany: mock(),
      count: mock(),
    },
  },
}));

mock.module("bcryptjs", () => ({
  default: {
    hash: (pwd: string, _rounds: number) => "hashed-" + pwd,
    compare: (plain: string, _hash: string) => plain === "correct-password",
  },
}));

mock.module("../../modules/audit/audit.service", () => ({
  auditService: { log: mock() },
}));

describe("UserService", () => {
  describe("findAll", () => {
    it("should return users list", async () => {
      (prisma.user.findMany as any).mockResolvedValue([
        { id: "u1", email: "test@test.com" },
      ]);
      (prisma.user.count as any).mockResolvedValue(1);

      const result = await userService.findAll(1, 10);
      expect(result.users).toHaveLength(1);
    });

    it("should filter by role", async () => {
      (prisma.user.findMany as any).mockResolvedValue([]);
      (prisma.user.count as any).mockResolvedValue(0);

      await userService.findAll(1, 10, { role: Role.RELAWAN });
      expect(prisma.user.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: Role.RELAWAN }),
        })
      );
    });

    it("should filter by search", async () => {
      (prisma.user.findMany as any).mockResolvedValue([]);
      (prisma.user.count as any).mockResolvedValue(0);

      await userService.findAll(1, 10, { search: "test" });
      expect(prisma.user.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                name: { contains: "test", mode: "insensitive" },
              }),
              expect.objectContaining({
                email: { contains: "test", mode: "insensitive" },
              }),
            ]),
          }),
        })
      );
    });

    it("should filter by status", async () => {
      (prisma.user.findMany as any).mockResolvedValue([]);
      (prisma.user.count as any).mockResolvedValue(0);

      await userService.findAll(1, 10, { status: "PENDING" as any });
      expect(prisma.user.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "PENDING" }),
        })
      );
    });

    it("should filter by isVerified", async () => {
      (prisma.user.findMany as any).mockResolvedValue([]);
      (prisma.user.count as any).mockResolvedValue(0);

      await userService.findAll(1, 10, { isVerified: true });
      expect(prisma.user.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isVerified: true }),
        })
      );
    });
  });

  describe("create", () => {
    it("should create user with valid input", async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (prisma.user.create as any).mockResolvedValue({
        id: "u1",
        email: "new@test.com",
        name: "New User",
        role: "RELAWAN",
      });

      const result = await userService.create({
        email: "new@test.com",
        password: "secret123",
        name: "New User",
      });
      expect(result.id).toBe("u1");
      expect(result.email).toBe("new@test.com");
    });

    it("should throw ConflictError on duplicate email", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ id: "existing" });

      expect(
        userService.create({
          email: "dup@test.com",
          password: "secret",
          name: "Dup",
        })
      ).rejects.toThrow("Email sudah terdaftar");
    });
  });

  describe("update", () => {
    it("should set status ACTIVE when isVerified=true", async () => {
      (prisma.user.findFirst as any).mockResolvedValue({ id: "u1" });
      (prisma.user.update as any).mockResolvedValue({
        id: "u1",
        isVerified: true,
        status: "ACTIVE",
      });

      await userService.update("u1", { isVerified: true });
      expect(prisma.user.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "ACTIVE" }),
        })
      );
    });

    it("should set status PENDING when isVerified=false", async () => {
      (prisma.user.findFirst as any).mockResolvedValue({ id: "u1" });
      (prisma.user.update as any).mockResolvedValue({
        id: "u1",
        isVerified: false,
        status: "PENDING",
      });

      await userService.update("u1", { isVerified: false });
      expect(prisma.user.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "PENDING" }),
        })
      );
    });
  });

  describe("verifyUser", () => {
    it("should set isVerified and status ACTIVE", async () => {
      (prisma.user.findFirst as any).mockResolvedValue({ id: "u1" });
      (prisma.user.update as any).mockResolvedValue({
        id: "u1",
        isVerified: true,
        status: "ACTIVE",
      });

      await userService.verifyUser("u1");
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "u1" },
          data: { isVerified: true, status: "ACTIVE" },
        })
      );
    });

    it("should throw NotFoundError if user not found", async () => {
      (prisma.user.findFirst as any).mockResolvedValue(null);

      expect(userService.verifyUser("unknown")).rejects.toThrow(
        "Pengguna tidak ditemukan"
      );
    });
  });

  describe("bulk operations", () => {
    it("should reject empty array", async () => {
      expect(userService.bulkVerify([], "actor1")).rejects.toThrow(
        "Daftar userIds tidak boleh kosong"
      );
    });

    it("should reject >200 IDs", async () => {
      const ids = Array.from({ length: 250 }, (_, i) => `u${i}`);
      expect(userService.bulkVerify(ids, "actor1")).rejects.toThrow(
        "Maksimal 200 pengguna per aksi bulk"
      );
    });

    it("should call updateMany and auditService.log", async () => {
      (prisma.user.updateMany as any).mockResolvedValue({ count: 5 });

      const result = await userService.bulkVerify(["u1", "u2"], "actor1");
      expect(result.affected).toBe(5);
    });

    it("should call updateMany with deletedAt and status DELETED", async () => {
      (prisma.user.updateMany as any).mockResolvedValue({ count: 2 });

      await userService.bulkDelete(["u1", "u2"], "actor1");
      expect(prisma.user.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
            status: "DELETED",
          }),
        })
      );
    });

    it("should call updateMany with role", async () => {
      (prisma.user.updateMany as any).mockResolvedValue({ count: 2 });

      await userService.bulkUpdateRole(["u1", "u2"], Role.ADMIN, "actor1");
      expect(prisma.user.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: Role.ADMIN }),
        })
      );
    });
  });

  describe("changeOwnPassword", () => {
    it("should throw UnauthorizedError on wrong current password", async () => {
      (prisma.user.findFirst as any).mockResolvedValue({
        id: "u1",
        password: "hashed-old",
      });

      expect(
        userService.changeOwnPassword("u1", "wrong", "new")
      ).rejects.toThrow("Password saat ini tidak sesuai");
    });

    it("should update password on correct current", async () => {
      (prisma.user.findFirst as any).mockResolvedValue({
        id: "u1",
        password: "hashed-old",
      });
      (prisma.user.update as any).mockResolvedValue({});

      const result = await userService.changeOwnPassword(
        "u1",
        "correct-password",
        "new"
      );
      expect(result.message).toBe("Password berhasil diubah");
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it("should throw NotFoundError if user not found", async () => {
      (prisma.user.findFirst as any).mockResolvedValue(null);

      expect(
        userService.changeOwnPassword("unknown", "any", "new")
      ).rejects.toThrow("Pengguna tidak ditemukan");
    });
  });

  describe("updateStatus", () => {
    it("should allow PENDING→ACTIVE", async () => {
      (prisma.user.findFirst as any).mockResolvedValue({
        id: "u1",
        status: "PENDING",
        email: "test@test.com",
      });
      (prisma.user.update as any).mockResolvedValue({
        id: "u1",
        status: "ACTIVE",
      });

      await userService.updateStatus("u1", "ACTIVE", "actor1");
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "ACTIVE" }),
        })
      );
    });

    it("should block PENDING→DELETED", async () => {
      (prisma.user.findFirst as any).mockResolvedValue({
        id: "u1",
        status: "PENDING",
        email: "test@test.com",
      });

      expect(
        userService.updateStatus("u1", "DELETED", "actor1")
      ).rejects.toThrow("Status DELETED tidak dapat diubah manual");
    });

    it("should block disallowed transition", async () => {
      (prisma.user.findFirst as any).mockResolvedValue({
        id: "u1",
        status: "ACTIVE",
        email: "test@test.com",
      });

      expect(
        userService.updateStatus("u1", "PENDING", "actor1")
      ).rejects.toThrow(
        "Transisi status dari ACTIVE ke PENDING tidak diizinkan"
      );
    });

    it("should allow ACTIVE→SUSPENDED", async () => {
      (prisma.user.findFirst as any).mockResolvedValue({
        id: "u1",
        status: "ACTIVE",
        email: "test@test.com",
      });
      (prisma.user.update as any).mockResolvedValue({
        id: "u1",
        status: "SUSPENDED",
      });

      await userService.updateStatus("u1", "SUSPENDED", "actor1");
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it("should allow SUSPENDED→ACTIVE", async () => {
      (prisma.user.findFirst as any).mockResolvedValue({
        id: "u1",
        status: "SUSPENDED",
        email: "test@test.com",
      });
      (prisma.user.update as any).mockResolvedValue({
        id: "u1",
        status: "ACTIVE",
      });

      await userService.updateStatus("u1", "ACTIVE", "actor1");
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it("should not find DELETED user (deletedAt:null filter)", async () => {
      (prisma.user.findFirst as any).mockResolvedValue(null);

      expect(
        userService.updateStatus("deleted-user", "ACTIVE", "actor1")
      ).rejects.toThrow("Pengguna tidak ditemukan");
    });

    it("should no-op on same status via findUniqueOrThrow", async () => {
      (prisma.user.findFirst as any).mockResolvedValue({
        id: "u1",
        status: "ACTIVE",
        email: "test@test.com",
      });
      (prisma.user.findUniqueOrThrow as any).mockResolvedValue({
        id: "u1",
        status: "ACTIVE",
      });

      const beforeUpdate = (prisma.user.update as any).mock.calls.length;
      await userService.updateStatus("u1", "ACTIVE", "actor1");
      expect((prisma.user.update as any).mock.calls.length).toBe(beforeUpdate);
      expect(prisma.user.findUniqueOrThrow).toHaveBeenCalled();
    });
  });

  describe("resetPasswordByAdmin", () => {
    it("should throw NotFoundError if user not found", async () => {
      (prisma.user.findFirst as any).mockResolvedValue(null);
      expect(
        userService.resetPasswordByAdmin("unknown", "newpass", "actor1")
      ).rejects.toThrow("Pengguna tidak ditemukan");
    });

    it("should return success message", async () => {
      (prisma.user.findFirst as any).mockResolvedValue({
        id: "u1",
        email: "test@test.com",
      });
      (prisma.user.update as any).mockResolvedValue({});

      const result = await userService.resetPasswordByAdmin(
        "u1",
        "newpass",
        "actor1"
      );
      expect(result.message).toBe("Password pengguna berhasil direset");
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  describe("getActivityLogs", () => {
    it("should return paginated logs", async () => {
      (prisma.user.findFirst as any).mockResolvedValue({ id: "u1" });
      (prisma.auditLog.findMany as any).mockResolvedValue([]);
      (prisma.auditLog.count as any).mockResolvedValue(0);

      const result = await userService.getActivityLogs("u1");
      expect(result.logs).toEqual([]);
      expect(prisma.auditLog.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ targetId: "u1" }),
              expect.objectContaining({ actorId: "u1" }),
            ]),
          }),
        })
      );
    });

    it("should throw NotFoundError if user not found", async () => {
      (prisma.user.findFirst as any).mockResolvedValue(null);

      expect(userService.getActivityLogs("unknown")).rejects.toThrow(
        "Pengguna tidak ditemukan"
      );
    });
  });

  describe("getPendingUsers", () => {
    it("should return pending users", async () => {
      (prisma.user.findMany as any).mockResolvedValue([
        { id: "u1", status: "PENDING" },
      ]);

      const result = await userService.getPendingUsers();
      expect(result).toHaveLength(1);
      expect(prisma.user.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "PENDING",
            deletedAt: null,
          }),
        })
      );
    });
  });

  describe("getSummary", () => {
    it("should return summary shape", async () => {
      (prisma.user.count as any).mockResolvedValue(0);

      const result = await userService.getSummary();
      expect(result).toHaveProperty("totalUsers");
      expect(result).toHaveProperty("active");
      expect(result).toHaveProperty("pending");
      expect(result).toHaveProperty("admin");
      expect(result).toHaveProperty("relawan");
      expect(result).toHaveProperty("stakeholder");
    });
  });

  describe("updateProfile", () => {
    it("should delegate to update", async () => {
      (prisma.user.findFirst as any).mockResolvedValue({ id: "u1" });
      (prisma.user.update as any).mockResolvedValue({
        id: "u1",
        name: "Updated",
      });

      const result = await userService.updateProfile("u1", { name: "Updated" });
      expect(result.name).toBe("Updated");
    });
  });
});
