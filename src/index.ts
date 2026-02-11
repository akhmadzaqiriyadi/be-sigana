import app from "./app";
import { env } from "./config/env";
import { prisma } from "./config/db";
import { logger } from "./utils/logger";

const startServer = async (): Promise<void> => {
  try {
    // Test database connection
    await prisma.$connect();
    await prisma.$executeRaw`SELECT 1`;
    logger.info("✅ Database connected successfully");

    app.listen(env.PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${env.PORT}`);
      logger.info(`📝 Environment: ${env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error("❌ Failed to start server:", { error });
    process.exit(1);
  }
};

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("\n🛑 Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("\n🛑 Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
