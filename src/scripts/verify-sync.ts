import { prisma } from "../config/db";
import { env } from "../config/env";
import { logger } from "../utils/logger";

// Define a type for the response data to avoid 'unknown' errors
interface LoginResponse {
  success: boolean;
  data: {
    accessToken: string;
  };
}

interface SyncResponse {
  success: boolean;
  data: Array<{
    localId: string;
    serverId: string;
    status: string;
  }>;
}

async function verifySync() {
  logger.info("Starting verification...");

  // 1. Get a valid village
  const village = await prisma.village.findFirst();
  if (!village) {
    logger.error("No village found. Please seed the database first.");
    process.exit(1);
  }
  logger.info(`Using village: ${village.name} (ID: ${village.id})`);

  // 2. Get a valid token
  let token = "";
  try {
    const loginRes = await fetch(
      `http://localhost:${env.PORT}/api/v1/auth/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@sigana.id",
          password: "admin123",
        }),
      }
    );

    if (loginRes.ok) {
      const data = (await loginRes.json()) as LoginResponse;
      token = data.data.accessToken;
      logger.info("Logged in successfully.");
    } else {
      const text = await loginRes.text();
      logger.error(`Login failed: ${text}`);
    }
  } catch (error) {
    logger.error(`Login request failed: ${error}`);
  }

  // 3. Prepare payload
  const localId1 = "loc-" + Date.now();
  const localId2 = "loc-" + (Date.now() + 1);
  const payload = {
    balitas: [
      {
        localId: localId1,
        namaAnak: "Sync Baby 1 " + Date.now(),
        namaOrtu: "Sync Parent 1",
        tanggalLahir: "2024-01-01",
        jenisKelamin: "L",
        villageId: village.id,
        poskoId: null,
      },
      {
        localId: localId2,
        namaAnak: "Sync Baby 2 " + Date.now(),
        namaOrtu: "Sync Parent 2",
        tanggalLahir: "2024-02-01",
        jenisKelamin: "P",
        villageId: village.id,
        poskoId: null,
      },
    ],
  };

  // 4. Send Request
  try {
    logger.info(
      `Sending sync request to: http://localhost:${env.PORT}/api/v1/balitas/sync`
    );
    const res = await fetch(
      `http://localhost:${env.PORT}/api/v1/balitas/sync`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = (await res.json()) as SyncResponse;
    logger.info(`Sync Response: ${JSON.stringify(data, null, 2)}`);

    if (data.success && data.data && data.data.length === 2) {
      logger.info("✅ Verification PASSED");
    } else {
      logger.error("❌ Verification FAILED: Unexpected response format");
    }
  } catch (error) {
    logger.error(`❌ Verification FAILED: ${error}`);
  } finally {
    await prisma.$disconnect();
  }
}

verifySync();
