# PANDUAN KONFIGURASI ENVIRONMENT (DEV vs PROD)

Berikut adalah panduan setting `.env` untuk lingkungan Development (Laptop/Lokal) dan Production (Server/Cloud).

## 1. Development (Lokal)
Gunakan konfigurasi ini saat coding atau testing di laptop.

```ini
# Server Setup
NODE_ENV=development
PORT=3000

# Database (Lokal Docker / Localhost)
# Ganti user:password sesuai pgadmin lokal
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sigana_db?schema=public"

# Security
JWT_SECRET="dev-secret-key-jangan-dipakai-di-prod"
JWT_EXPIRES_IN="1d"

# Logging & Debug
LOG_LEVEL=debug
MORGAN_FORMAT=dev

# CORS (Izinkan semua origin saat dev)
CORS_ORIGIN="*"
```

---

## 2. Production (Siap Deploy)
Gunakan konfigurasi ini saat deploy ke Vercel / Railway / VPS.

```ini
# Server Setup
NODE_ENV=production
PORT=8080 (Atau port yang disediakan Cloud Provider)

# Database (Cloud Database: Supabase / Neon / RDS)
# Pastikan menggunakan Connection Pooling URL jika serverless
DATABASE_URL="postgresql://user:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Security (WAJIB GANTI YANG KUAT)
# Generate random string panjang (e.g. openssl rand -base64 32)
JWT_SECRET="x8zP!9qRf#m2$LwK7yVn@5jH*4tB&1cD"
JWT_EXPIRES_IN="12h"

# Logging (Hanya log penting)
LOG_LEVEL=info
MORGAN_FORMAT=combined

# CORS (Hanya izinkan domain Frontend asli)
# Contoh: Domain PWA Frontend nanti
CORS_ORIGIN="https://sigana-pwa.vercel.app"
```

---

## Cara Apply Konfigurasi
1.  **Lokal**: Copy setting Dev ke file bernama `.env`.
2.  **Production**: Masukkan setting Prod ke "Environment Variables" di dashboard hosting (Vercel/Railway) atau file `.env` di server.

**PENTING**: Jangan pernah commit file `.env` asli ke GitHub! Cukup `.env.example`.
