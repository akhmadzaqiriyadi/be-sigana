import { config } from "dotenv";
config();

export const env = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: process.env.DATABASE_URL || "",
  JWT_SECRET: process.env.JWT_SECRET || "fallback-secret",
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET || "refresh-fallback-secret",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
  SMTP_HOST: process.env.SMTP_HOST || "smtp.resend.com",
  SMTP_PORT: parseInt(process.env.SMTP_PORT || "465"),
  SMTP_USER: process.env.SMTP_USER || "resend",
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || "",
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || "noreply@sigana.id",
  // Flexibility for future SMTP migration
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || "smtp", // 'smtp' default
  APP_URL: process.env.APP_URL || "http://localhost:3000",
  PASSWORD_RESET_EXPIRES_IN: process.env.PASSWORD_RESET_EXPIRES_IN || "1h",
} as const;
