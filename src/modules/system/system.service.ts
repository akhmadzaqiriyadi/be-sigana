import { spawn } from "node:child_process";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { fileURLToPath } from "node:url";
import prisma from "@/config/db";
import { env } from "@/config/env";
import { ApiError } from "@/utils/ApiError";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../../..");
const logsDir = path.resolve(workspaceRoot, "logs");
const backupsDir = path.resolve(workspaceRoot, "backups");
const ansiPattern = /\[[0-9;]*m/g;
const escapeChar = String.fromCharCode(27);

interface ParsedLogEntry {
  timestamp: string;
  level: string;
  message: string;
  source: string;
}

interface HealthComponent {
  name: "database" | "logs" | "backupStorage";
  status: "up" | "down";
  latencyMs?: number;
  message?: string;
}

function normalizeLevel(level: string): string {
  return level.replaceAll(ansiPattern, "").trim();
}

function normalizeMessage(message: string): string {
  const withoutAnsi = message
    .replaceAll(escapeChar, "")
    .replaceAll(ansiPattern, "");

  const sanitized = Array.from(withoutAnsi)
    .filter((char) => {
      const code = char.charCodeAt(0);
      const isAsciiControl = (code >= 0 && code <= 8) || code === 11;
      const isAdditionalControl =
        (code >= 12 && code <= 26) || (code >= 28 && code <= 31);
      const isDeleteOrC1 = (code >= 127 && code <= 159) || code === 27;

      return !(isAsciiControl || isAdditionalControl || isDeleteOrC1);
    })
    .join("");

  return sanitized.trim();
}

async function readPackageVersion() {
  const packageJsonPath = path.resolve(workspaceRoot, "package.json");
  const raw = await fs.readFile(packageJsonPath, "utf-8");
  const parsed = JSON.parse(raw) as { version?: string };
  return parsed.version ?? "unknown";
}

export class SystemService {
  private createLogInputStream(source: string, fileName: string) {
    if (fileName.endsWith(".gz")) {
      const compressedStream = createReadStream(source);
      const gunzip = createGunzip();
      compressedStream.on("error", () => {
        gunzip.destroy();
      });
      return compressedStream.pipe(gunzip);
    }

    return createReadStream(source, { encoding: "utf-8" });
  }

  private pushParsedLogEntry(
    entries: ParsedLogEntry[],
    fileName: string,
    parsed: Record<string, unknown>
  ) {
    entries.push({
      timestamp:
        typeof parsed.timestamp === "string"
          ? parsed.timestamp
          : new Date().toISOString(),
      level:
        typeof parsed.level === "string"
          ? normalizeLevel(parsed.level)
          : "info",
      message:
        typeof parsed.message === "string"
          ? normalizeMessage(parsed.message)
          : normalizeMessage(JSON.stringify(parsed)),
      source: fileName,
    });
  }

  private pushRawLogEntry(
    entries: ParsedLogEntry[],
    fileName: string,
    line: string
  ) {
    entries.push({
      timestamp: new Date().toISOString(),
      level: fileName === "error.log" ? "error" : "info",
      message: normalizeMessage(line),
      source: fileName,
    });
  }

  private async checkHealthComponents(): Promise<HealthComponent[]> {
    const checks: HealthComponent[] = [];

    const dbStartedAt = performance.now();
    try {
      await prisma.$queryRaw<Array<{ result: number }>>`SELECT 1 AS result`;
      checks.push({
        name: "database",
        status: "up",
        latencyMs: Math.round(performance.now() - dbStartedAt),
      });
    } catch (error) {
      checks.push({
        name: "database",
        status: "down",
        latencyMs: Math.round(performance.now() - dbStartedAt),
        message:
          error instanceof Error ? error.message : "Database check failed",
      });
    }

    try {
      await fs.mkdir(logsDir, { recursive: true });
      await fs.readdir(logsDir);
      checks.push({ name: "logs", status: "up" });
    } catch (error) {
      checks.push({
        name: "logs",
        status: "down",
        message:
          error instanceof Error ? error.message : "Logs directory unavailable",
      });
    }

    try {
      await fs.mkdir(backupsDir, { recursive: true });
      await fs.readdir(backupsDir);
      checks.push({ name: "backupStorage", status: "up" });
    } catch (error) {
      checks.push({
        name: "backupStorage",
        status: "down",
        message:
          error instanceof Error ? error.message : "Backup storage unavailable",
      });
    }

    return checks;
  }

  private async streamLogFile(
    source: string,
    fileName: string,
    entries: ParsedLogEntry[],
    maxEntries: number
  ) {
    const stream = this.createLogInputStream(source, fileName);
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (entries.length >= maxEntries) {
        stream.destroy();
        break;
      }

      if (!line.trim()) {
        continue;
      }

      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        this.pushParsedLogEntry(entries, fileName, parsed);
      } catch {
        this.pushRawLogEntry(entries, fileName, line);
      }
    }
  }

  async getInfo() {
    const checks = await this.checkHealthComponents();

    let versionResult: Array<{ version: string }> = [];
    try {
      versionResult = await prisma.$queryRaw<Array<{ version: string }>>`
        SELECT version()
      `;
    } catch {
      versionResult = [];
    }

    const dbCheck = checks.find((item) => item.name === "database");
    const hasDownComponent = checks.some((item) => item.status === "down");

    let serverStatus: "online" | "degraded" | "offline" = "online";
    if (dbCheck?.status === "down") {
      serverStatus = "offline";
    } else if (hasDownComponent) {
      serverStatus = "degraded";
    }

    const systemConfig = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });
    const systemValue =
      systemConfig &&
      typeof systemConfig.value === "object" &&
      systemConfig.value
        ? (systemConfig.value as Record<string, unknown>)
        : {};

    return {
      appVersion: await readPackageVersion(),
      buildNumber: process.env.BUILD_NUMBER || "development",
      dbVersion: versionResult[0]?.version ?? "Unknown Database",
      lastBackup:
        typeof systemValue.lastBackup === "string"
          ? systemValue.lastBackup
          : null,
      backupInProgress:
        typeof systemValue.backupInProgress === "boolean"
          ? systemValue.backupInProgress
          : false,
      lastBackupError:
        typeof systemValue.lastBackupError === "string"
          ? systemValue.lastBackupError
          : null,
      serverStatus,
      serverUptime: Math.round(process.uptime()),
      apiLatency: dbCheck?.latencyMs ?? null,
      health: {
        checkedAt: new Date().toISOString(),
        components: checks,
      },
    };
  }

  async triggerBackup(triggeredBy?: string) {
    if (!env.DATABASE_URL) {
      throw new ApiError(500, "DATABASE_URL belum dikonfigurasi");
    }

    await fs.mkdir(backupsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
    const fileName = `sigana-backup-${timestamp}.sql`;
    const backupPath = path.join(backupsDir, fileName);

    await prisma.systemConfig.upsert({
      where: { id: "system" },
      create: {
        id: "system",
        value: {
          backupInProgress: true,
          lastBackup: null,
        },
        updatedBy: triggeredBy,
      },
      update: {
        value: {
          backupInProgress: true,
          lastBackup: null,
        },
        updatedBy: triggeredBy,
      },
    });

    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "pg_dump",
        [
          env.DATABASE_URL,
          "--file",
          backupPath,
          "--no-owner",
          "--no-privileges",
        ],
        {
          stdio: "ignore",
          shell: false,
        }
      );

      child.on("error", (error) => {
        reject(error);
      });

      child.on("exit", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`pg_dump exited with code ${code}`));
      });
    }).catch(async (error) => {
      await prisma.systemConfig.upsert({
        where: { id: "system" },
        create: {
          id: "system",
          value: {
            backupInProgress: false,
            lastBackup: null,
            lastBackupError:
              error instanceof Error
                ? error.message
                : "Backup gagal dijalankan",
          },
          updatedBy: triggeredBy,
        },
        update: {
          value: {
            backupInProgress: false,
            lastBackup: null,
            lastBackupError:
              error instanceof Error
                ? error.message
                : "Backup gagal dijalankan",
          },
          updatedBy: triggeredBy,
        },
      });

      if (error instanceof Error && /ENOENT/.test(error.message)) {
        throw new ApiError(
          503,
          "pg_dump tidak tersedia di PATH server, backup tidak dapat dijalankan"
        );
      }

      throw new ApiError(
        500,
        error instanceof Error ? error.message : "Backup database gagal"
      );
    });

    const lastBackup = new Date().toISOString();

    await prisma.systemConfig.upsert({
      where: { id: "system" },
      create: {
        id: "system",
        value: {
          backupInProgress: false,
          lastBackup,
          lastBackupFile: fileName,
        },
        updatedBy: triggeredBy,
      },
      update: {
        value: {
          backupInProgress: false,
          lastBackup,
          lastBackupFile: fileName,
        },
        updatedBy: triggeredBy,
      },
    });

    return {
      message: "Backup database berhasil dibuat",
      fileName,
      lastBackup,
    };
  }

  async getLogs(page = 1, limit = 50, level?: string) {
    await fs.mkdir(logsDir, { recursive: true });

    const fileNames = await fs.readdir(logsDir);
    const targetFiles = fileNames
      .filter(
        (fileName) =>
          fileName === "error.log" ||
          /^application-\d{4}-\d{2}-\d{2}\.log(\.gz)?$/.test(fileName)
      )
      .sort((left, right) => right.localeCompare(left));

    const entries: ParsedLogEntry[] = [];
    // Cap total entries loaded to prevent OOM on large log files
    const MAX_TOTAL_ENTRIES = 10_000;

    for (const fileName of targetFiles) {
      if (entries.length >= MAX_TOTAL_ENTRIES) break;

      const source = path.join(logsDir, fileName);
      await this.streamLogFile(
        source,
        fileName,
        entries,
        MAX_TOTAL_ENTRIES
      ).catch(() => {
        // Skip unreadable log file and continue parsing others.
      });
    }

    const filteredEntries = level
      ? entries.filter((entry) => entry.level === level)
      : entries;

    filteredEntries.sort(
      (left, right) =>
        new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
    );

    const startIndex = (page - 1) * limit;
    const data = filteredEntries.slice(startIndex, startIndex + limit);

    return {
      data,
      meta: {
        page,
        limit,
        total: filteredEntries.length,
        totalPages: Math.max(1, Math.ceil(filteredEntries.length / limit)),
      },
    };
  }
}

export const systemService = new SystemService();
