import { faker } from "@faker-js/faker";
import type { Response } from "express";

// ── Mock Express Response ────────────────────────────────────────────

interface MockRes extends Partial<Response> {
  statusCode?: number;
  body?: unknown;
  _headers?: Record<string, string>;
}

export function createResponse(): MockRes {
  const res: MockRes = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res as Response;
  };
  res.json = (data: unknown) => {
    res.body = data;
    return res as Response;
  };
  res.send = (data: unknown) => {
    res.body = data;
    return res as Response;
  };
  res.setHeader = (name: string, value: string) => {
    (res._headers ??= {})[name] = value;
    return res as Response;
  };
  return res;
}

// ── Async Handler Flusher ────────────────────────────────────────────

export async function flushAsyncHandler(
  handler: (req: any, res: any, next?: any) => Promise<void>,
  req: any,
  res: any,
  next?: any
): Promise<void> {
  await handler(req, res, next);
}

// ── Domain Factories (match Prisma schema) ───────────────────────────

export function makeBalita(overrides: Partial<any> = {}) {
  return {
    id: faker.string.uuid(),
    namaAnak: faker.person.firstName("male"),
    namaOrtu: faker.person.fullName(),
    tanggalLahir: faker.date.past({ years: 5 }),
    jenisKelamin: "L" as const,
    villageId: faker.number.int({ min: 1, max: 100 }),
    ...overrides,
  };
}

export function makeMeasurement(overrides: Partial<any> = {}) {
  return {
    id: faker.string.uuid(),
    balitaId: faker.string.uuid(),
    relawanId: faker.string.uuid(),
    beratBadan: 10.5,
    tinggiBadan: 85.0,
    lingkarKepala: 45.0,
    lila: 15.0,
    posisiUkur: "TERLENTANG" as const,
    bb_u_status: "normal",
    tb_u_status: "normal",
    bb_tb_status: "normal",
    statusAkhir: "HIJAU" as const,
    isSynced: true,
    createdAt: new Date(),
    ...overrides,
  };
}

export function makeUser(overrides: Partial<any> = {}) {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    password: faker.internet.password(),
    role: "RELAWAN" as const,
    status: "ACTIVE" as const,
    isVerified: true,
    ...overrides,
  };
}

export function makeVillage(overrides: Partial<any> = {}) {
  return {
    id: faker.number.int({ min: 1, max: 100 }),
    name: faker.location.city(),
    districts: faker.location.county(),
    isActive: true,
    ...overrides,
  };
}
