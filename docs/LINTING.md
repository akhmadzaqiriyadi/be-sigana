# Linting & Code Quality

Project ini menggunakan ESLint dan Prettier untuk menjaga kualitas dan konsistensi kode.

## Tools

- **ESLint**: Linter untuk TypeScript/JavaScript
- **Prettier**: Code formatter
- **Husky**: Git hooks manager
- **lint-staged**: Run linters on git staged files

## Available Scripts

```bash
# Menjalankan ESLint untuk mengecek kode
bun run lint

# Menjalankan ESLint dan otomatis memperbaiki masalah yang bisa diperbaiki
bun run lint:fix

# Format semua file dengan Prettier
bun run format

# Cek apakah kode sudah diformat dengan benar
bun run format:check
```

## Pre-commit Hook

Husky telah dikonfigurasi untuk menjalankan `lint-staged` sebelum setiap commit.

Saat Anda melakukan `git commit`, secara otomatis:

- ESLint akan memeriksa dan memperbaiki file `.ts` dan `.js` yang staged
- Prettier akan memformat file yang staged

## Konfigurasi

### ESLint

Konfigurasi ada di `eslint.config.mjs`:

- Menggunakan TypeScript ESLint parser
- Terintegrasi dengan Prettier
- Mengabaikan folder: `node_modules`, `dist`, `build`, `prisma`

### Prettier

Konfigurasi ada di `.prettierrc`:

- Semi-colons: `true`
- Trailing commas: `es5`
- Single quotes: `false` (double quotes)
- Print width: `80`
- Tab width: `2`

### Lint-staged

Konfigurasi ada di `package.json`:

- File `*.{ts,js}`: ESLint fix + Prettier
- File `*.{json,md}`: Prettier only

## Warnings yang Dapat Diabaikan

Beberapa warnings seperti `@typescript-eslint/no-explicit-any` diset ke `warn` (bukan `error`) karena TypeScript `any` terkadang diperlukan dalam situasi tertentu (misalnya error handling).

## Tips

1. Jalankan `bun run lint:fix` sebelum commit untuk memperbaiki masalah otomatis
2. Integrasikan ESLint dengan VSCode/editor Anda untuk feedback real-time
3. Jika commit terhambat oleh lint errors, perbaiki error tersebut terlebih dahulu
