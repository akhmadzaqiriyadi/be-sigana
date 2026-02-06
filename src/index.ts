/* eslint-disable no-console */
import app from "./app";
import { env } from "./config/env";
import { prisma } from "./config/db";

const startServer = async (): Promise<void> => {
  try {
    // Test database connection
    await prisma.$connect();
    await prisma.$executeRaw`SELECT 1`;
    console.log("✅ Database connected successfully");

    app.listen(env.PORT, () => {
      console.log(`🚀 Server running on http://localhost:${env.PORT}`);
      console.log(`📝 Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
