# SiGana Backend API

Backend API untuk **Sistem Gizi Bencana (SiGana)** - Aplikasi pemantauan gizi pascabencana.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma

## Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- PostgreSQL >= 14

## Getting Started

### 1. Install Dependencies

```bash
bun install
```

### 2. Environment Setup

Copy `.env.example` to `.env` and configure your database:

```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/sigana_db?schema=public"
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

### 3. Database Setup

Generate Prisma client:
```bash
bun run db:generate
```

Push schema to database:
```bash
bun run db:push
```

Seed initial data:
```bash
bun run db:seed
```

### 4. Run Development Server

```bash
bun run dev
```

Server akan berjalan di `http://localhost:3000`

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login user |
| GET | `/api/v1/auth/profile` | Get current profile |

### Users (Admin only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users` | List all users |
| GET | `/api/v1/users/pending` | List pending users |
| GET | `/api/v1/users/:id` | Get user by ID |
| PUT | `/api/v1/users/:id` | Update user |
| PATCH | `/api/v1/users/:id/verify` | Verify user |
| DELETE | `/api/v1/users/:id` | Delete user |

### Villages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/villages` | List villages |
| GET | `/api/v1/villages/:id` | Get village by ID |
| POST | `/api/v1/villages` | Create village (Admin) |
| PUT | `/api/v1/villages/:id` | Update village (Admin) |
| DELETE | `/api/v1/villages/:id` | Delete village (Admin) |

### Poskos
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/poskos` | List poskos |
| GET | `/api/v1/poskos/map` | Get map data |
| GET | `/api/v1/poskos/:id` | Get posko by ID |
| POST | `/api/v1/poskos` | Create posko (Admin) |
| PUT | `/api/v1/poskos/:id` | Update posko (Admin) |
| DELETE | `/api/v1/poskos/:id` | Delete posko (Admin) |

### Balitas
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/balitas` | List balitas |
| GET | `/api/v1/balitas/:id` | Get balita by ID |
| POST | `/api/v1/balitas` | Create balita (Relawan/Admin) |
| PUT | `/api/v1/balitas/:id` | Update balita (Admin) |
| DELETE | `/api/v1/balitas/:id` | Delete balita (Admin) |

### Measurements
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/measurements` | List measurements |
| GET | `/api/v1/measurements/statistics` | Get statistics (Admin/Stakeholder) |
| GET | `/api/v1/measurements/:id` | Get measurement by ID |
| POST | `/api/v1/measurements` | Create measurement (Relawan/Admin) |
| POST | `/api/v1/measurements/sync` | Sync offline data (Relawan/Admin) |
| DELETE | `/api/v1/measurements/:id` | Delete measurement (Admin) |

## Available Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start development server with hot reload |
| `bun run start` | Start production server |
| `bun run build` | Build for production |
| `bun run db:generate` | Generate Prisma client |
| `bun run db:push` | Push schema to database |
| `bun run db:migrate` | Run database migrations |
| `bun run db:studio` | Open Prisma Studio |
| `bun run db:seed` | Seed database with initial data |

## Default Users (After Seed)

| Email | Password | Role |
|-------|----------|------|
| admin@sigana.id | admin123 | ADMIN |
| relawan@sigana.id | relawan123 | RELAWAN |
| stakeholder@sigana.id | stakeholder123 | STAKEHOLDER |

## Project Structure

```
be-sigana/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Seed script
├── src/
│   ├── config/            # Configuration files
│   │   ├── db.ts          # Prisma client
│   │   └── env.ts         # Environment variables
│   ├── middlewares/       # Express middlewares
│   │   ├── auth.ts        # Authentication middleware
│   │   ├── asyncHandler.ts
│   │   └── errorHandler.ts
│   ├── modules/           # Feature modules
│   │   ├── auth/          # Authentication
│   │   ├── user/          # User management
│   │   ├── village/       # Village management
│   │   ├── posko/         # Posko management
│   │   ├── balita/        # Balita management
│   │   └── measurement/   # Measurement/Antropometri
│   ├── types/             # TypeScript types
│   ├── utils/             # Utility functions
│   ├── app.ts             # Express app setup
│   └── index.ts           # Entry point
├── .env.example
├── package.json
└── tsconfig.json
```

## License

ISC
