import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { logger } from './utils/logger';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import villageRoutes from './modules/village/village.routes';
import poskoRoutes from './modules/posko/posko.routes';
import balitaRoutes from './modules/balita/balita.routes';
import measurementRoutes from './modules/measurement/measurement.routes';
import { openApiSpecification } from './config/swagger';

const app: Application = express();

// Middleware
app.set('trust proxy', 1); // Trust first proxy
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: env.NODE_ENV === 'development' 
    ? ['http://localhost:3000', 'http://localhost:3001'] 
    : env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
}));
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

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

const morganFormat = process.env.NODE_ENV === 'development' ? 'dev' : 'combined';

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV 
  });
});

// API Routes
const API_PREFIX = '/api/v1';

// Serve Swagger Spec JSON
app.get('/docs/json', (_req, res) => {
  res.json(openApiSpecification);
});

// Documentation (Scalar CDN)
app.get('/docs', (_req, res) => {
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

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/villages`, villageRoutes);
app.use(`${API_PREFIX}/poskos`, poskoRoutes);
app.use(`${API_PREFIX}/balitas`, balitaRoutes);
app.use(`${API_PREFIX}/measurements`, measurementRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
