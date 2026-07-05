import express, { Application } from "express";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { logger } from "./utils/logger";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/user/user.routes";
import villageRoutes from "./modules/village/village.routes";
import balitaRoutes from "./modules/balita/balita.routes";
import measurementRoutes from "./modules/measurement/measurement.routes";
import reportRoutes from "./modules/report/report.routes";
import kbmRoutes from "./modules/kbm/kbm.routes";
import settingsRoutes from "./modules/settings/settings.routes";
import systemRoutes from "./modules/system/system.routes";
import growthRoutes from "./modules/growth/growth.routes";
import notificationRoutes from "./modules/notification/notification.routes";
import { scheduleDailyReminder } from "./modules/notification/notification.cron";
import { openApiSpecification } from "./config/swagger";

const app: Application = express();

const normalizeOrigin = (origin: string): string =>
  origin.trim().replace(/\/+$/, "");

const parseCorsOrigins = (origins: string): string[] =>
  origins.split(",").map(normalizeOrigin).filter(Boolean);

const defaultDevOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
];

const envOrigins = parseCorsOrigins(env.CORS_ORIGIN);
const allowedOrigins = Array.from(
  new Set(
    env.NODE_ENV === "development"
      ? [...defaultDevOrigins, ...envOrigins]
      : envOrigins.length > 0
        ? envOrigins
        : defaultDevOrigins
  )
);

const corsOptions: CorsOptions = {
  origin: (requestOrigin, callback) => {
    // Allow server-to-server calls (curl, Postman, cronjobs) with no Origin header
    if (!requestOrigin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes("*")) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(normalizeOrigin(requestOrigin))) {
      return callback(null, true);
    }

    return callback(
      new Error(`Origin ${requestOrigin} is not allowed by CORS`)
    );
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  exposedHeaders: ["Set-Cookie"],
};

// Middleware
app.set("trust proxy", 1); // Trust first proxy
// CSP: strict untuk XSS protection, Scalar CDN diizinkan untuk docs
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net/npm/@scalar"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);
app.use(cors(corsOptions));
// Compression disabled - Bun doesn't fully support zlib.createBrotliCompress yet
// app.use(compression({
//   filter: (req, res) => {
//     if (req.headers['x-no-compression']) {
//       return false;
//     }
//     return compression.filter(req, res);
//   },
//   threshold: 0,
// }));

const isDevOrTest = env.NODE_ENV === "development" || env.NODE_ENV === "test";

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevOrTest ? 100000 : 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevOrTest ? 100000 : 20, // Maks 20 request auth per 15 menit (brute force protection)
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Terlalu banyak percobaan. Coba lagi nanti.",
  },
});

// Rate limit for data-heavy endpoints (GET list/export endpoints)
const dataLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: isDevOrTest ? 100000 : 60, // max 60 request per menit
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Terlalu banyak permintaan. Coba lagi nanti.",
  },
});

app.use(limiter);

const morganFormat =
  process.env.NODE_ENV === "development" ? "dev" : "combined";

app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => {
        logger.http(message.trim());
      },
    },
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" })); // Prevent oversized payloads
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// API Routes
const API_PREFIX = "/api/v1";

// Serve Swagger Spec JSON
app.get("/docs/json", (_req, res) => {
  res.json(openApiSpecification);
});

// Documentation (Scalar CDN)
app.get("/docs", (_req, res) => {
  res.send(`
    <!doctype html>
    <html>
      <head>
        <title>SiGana API Reference</title>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1" />
        <style>
          body {
            margin: 0;
          }
        </style>
      </head>
      <body>
        <script
          id="api-reference"
          data-url="/docs/json"
          src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
      </body>
    </html>
  `);
});

app.use(`${API_PREFIX}/auth`, authLimiter, authRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/villages`, villageRoutes);
app.use(`${API_PREFIX}/balitas`, balitaRoutes);
app.use(`${API_PREFIX}/measurements`, dataLimiter, measurementRoutes);
app.use(`${API_PREFIX}/reports`, dataLimiter, reportRoutes);
app.use(`${API_PREFIX}/kbm`, kbmRoutes);
app.use(`${API_PREFIX}/settings`, settingsRoutes);
app.use(`${API_PREFIX}/growth`, growthRoutes);
app.use(`${API_PREFIX}/system`, systemRoutes);
app.use(`${API_PREFIX}/notifications`, notificationRoutes);

if (env.NODE_ENV !== "test") {
  scheduleDailyReminder();
}

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
