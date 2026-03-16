import { EventEmitter } from "node:events";
import { PassThrough, Readable } from "node:stream";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import prisma from "@/config/db";
import { systemService } from "./system.service";
import { createReadStream, promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { createGunzip } from "node:zlib";

mock.module("@/config/db", () => ({
  default: {
    systemConfig: {
      findUnique: mock(),
      upsert: mock(),
    },
    $queryRaw: mock(),
  },
}));

mock.module("@/config/env", () => ({
  env: {
    DATABASE_URL:
      "postgresql://postgres:postgres@localhost:5432/db_sigana?schema=public",
  },
}));

mock.module("node:fs", () => ({
  createReadStream: mock(),
  promises: {
    readFile: mock(),
    mkdir: mock(),
    readdir: mock(),
  },
}));

mock.module("node:child_process", () => ({
  spawn: mock(),
}));

mock.module("node:zlib", () => ({
  createGunzip: mock(),
}));

describe("SystemService", () => {
  beforeEach(() => {
    const mocks = [
      prisma.systemConfig.findUnique,
      prisma.systemConfig.upsert,
      prisma.$queryRaw,
      fs.readFile,
      createReadStream,
      createGunzip,
      fs.mkdir,
      fs.readdir,
      spawn,
    ];

    mocks.forEach((fn: any) => fn.mockClear?.());
    delete process.env.BUILD_NUMBER;
  });

  it("should return system info from package.json, DB version, and config", async () => {
    (prisma.$queryRaw as any).mockResolvedValue([
      { version: "PostgreSQL 18.0" },
    ]);
    (prisma.systemConfig.findUnique as any).mockResolvedValue({
      id: "system",
      value: {
        lastBackup: "2026-03-16T08:00:00.000Z",
        backupInProgress: false,
        lastBackupError: null,
      },
    });
    (fs.readFile as any).mockResolvedValue(
      JSON.stringify({ version: "1.0.0" })
    );

    const result = await systemService.getInfo();

    expect(result.appVersion).toBe("1.0.0");
    expect(result.dbVersion).toBe("PostgreSQL 18.0");
    expect(result.lastBackup).toBe("2026-03-16T08:00:00.000Z");
    expect(result.serverStatus).toBe("online");
    expect(result.backupInProgress).toBe(false);
    expect(result.lastBackupError).toBeNull();
    expect(result.health.components).toHaveLength(3);
  });

  it("should expose lastBackupError and backupInProgress=true when backup is in-progress", async () => {
    (prisma.$queryRaw as any).mockResolvedValue([
      { version: "PostgreSQL 18.0" },
    ]);
    (prisma.systemConfig.findUnique as any).mockResolvedValue({
      id: "system",
      value: {
        lastBackup: null,
        backupInProgress: true,
        lastBackupError: "pg_dump gagal: connection refused",
      },
    });
    (fs.readFile as any).mockResolvedValue(
      JSON.stringify({ version: "1.0.0" })
    );

    const result = await systemService.getInfo();

    expect(result.backupInProgress).toBe(true);
    expect(result.lastBackupError).toBe("pg_dump gagal: connection refused");
  });

  it("should trigger backup and persist backup metadata", async () => {
    (fs.mkdir as any).mockResolvedValue(undefined);
    (prisma.systemConfig.upsert as any).mockResolvedValue({ id: "system" });

    const child = new EventEmitter() as any;
    (spawn as any).mockImplementation(() => {
      queueMicrotask(() => child.emit("exit", 0));
      return child;
    });

    const result = await systemService.triggerBackup("admin@sigana.id");

    expect(result.message).toContain("Backup database berhasil dibuat");
    expect(result.fileName.endsWith(".sql")).toBe(true);
    // filePath is intentionally not exposed in the response (security: don't leak server paths)
    expect(result).not.toHaveProperty("filePath");
    expect(spawn).toHaveBeenCalledWith(
      "pg_dump",
      expect.arrayContaining(["--file", expect.stringContaining(".sql")]),
      {
        stdio: "ignore",
        shell: false,
      }
    );
    expect((prisma.systemConfig.upsert as any).mock.calls.length).toBe(2);
  });

  it("should filter and paginate logs by level", async () => {
    (fs.mkdir as any).mockResolvedValue(undefined);
    (fs.readdir as any).mockResolvedValue([
      "application-2026-03-16.log",
      "error.log",
    ]);
    (fs.readFile as any).mockResolvedValueOnce(
      JSON.stringify({
        version: "1.0.0",
      })
    );

    (createReadStream as any)
      .mockReturnValueOnce(
        Readable.from(
          [
            JSON.stringify({
              timestamp: "2026-03-16T10:00:00.000Z",
              level: "info",
              message: "server started",
            }),
            JSON.stringify({
              timestamp: "2026-03-16T11:00:00.000Z",
              level: "warn",
              message: "high latency",
            }),
          ].join("\n")
        )
      )
      .mockReturnValueOnce(
        Readable.from(
          JSON.stringify({
            timestamp: "2026-03-16T12:00:00.000Z",
            level: "error",
            message: "database timeout",
          })
        )
      );

    const result = await systemService.getLogs(1, 10, "error");

    expect(result.data).toHaveLength(1);
    expect(result.data[0].level).toBe("error");
    expect(result.data[0].message).toContain("database timeout");
    expect(result.meta.total).toBe(1);
  });

  it("should parse .log.gz files and sanitize ANSI/control characters", async () => {
    (fs.mkdir as any).mockResolvedValue(undefined);
    (fs.readdir as any).mockResolvedValue([
      "application-2026-03-16.log.gz",
      "error.log",
    ]);

    const gzContent = `${JSON.stringify({
      timestamp: "2026-03-16T08:14:51.000Z",
      level: "info",
      message: "\u001b[31mPrisma error\u001b[39m",
    })}\nnot-json-\u0007-line`;

    (createReadStream as any).mockImplementation((source: string) => {
      if (source.includes("application-2026-03-16.log.gz")) {
        return Readable.from(gzContent);
      }

      return Readable.from("");
    });
    (createGunzip as any).mockReturnValueOnce(new PassThrough());

    const result = await systemService.getLogs(1, 10);

    expect(result.data).toHaveLength(2);
    expect(result.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "application-2026-03-16.log.gz",
          message: "Prisma error",
        }),
        expect.objectContaining({
          source: "application-2026-03-16.log.gz",
          message: "not-json--line",
        }),
      ])
    );
  });
});
