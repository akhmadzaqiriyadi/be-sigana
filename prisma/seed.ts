import { PrismaClient, Role, Gender } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting seed...');

  // Create Admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sigana.id' },
    update: {},
    create: {
      email: 'admin@sigana.id',
      password: adminPassword,
      name: 'Admin SiGana',
      role: Role.ADMIN,
      isVerified: true,
    },
  });
  console.log('✅ Admin created:', admin.email);

  // Create sample Relawan
  const relawanPassword = await bcrypt.hash('relawan123', 12);
  const relawan = await prisma.user.upsert({
    where: { email: 'relawan@sigana.id' },
    update: {},
    create: {
      email: 'relawan@sigana.id',
      password: relawanPassword,
      name: 'Relawan Demo',
      role: Role.RELAWAN,
      isVerified: true,
    },
  });
  console.log('✅ Relawan created:', relawan.email);

  // Create sample Stakeholder
  const stakeholderPassword = await bcrypt.hash('stakeholder123', 12);
  const stakeholder = await prisma.user.upsert({
    where: { email: 'stakeholder@sigana.id' },
    update: {},
    create: {
      email: 'stakeholder@sigana.id',
      password: stakeholderPassword,
      name: 'Dinas Kesehatan',
      role: Role.STAKEHOLDER,
      isVerified: true,
    },
  });
  console.log('✅ Stakeholder created:', stakeholder.email);

  // Create sample Villages
  const villages = await Promise.all([
    prisma.village.upsert({
      where: { id: 1 },
      update: {},
      create: {
        name: 'Desa Sukamaju',
        districts: 'Kecamatan Cianjur',
      },
    }),
    prisma.village.upsert({
      where: { id: 2 },
      update: {},
      create: {
        name: 'Desa Mekarjaya',
        districts: 'Kecamatan Cianjur',
      },
    }),
  ]);
  console.log('✅ Villages created:', villages.length);

  // Create sample Poskos
  const poskos = await Promise.all([
    prisma.posko.upsert({
      where: { id: 1 },
      update: {},
      create: {
        name: 'Posko Lapangan Sukamaju',
        villageId: villages[0].id,
        latitude: -6.8213,
        longitude: 107.1338,
      },
    }),
    prisma.posko.upsert({
      where: { id: 2 },
      update: {},
      create: {
        name: 'Posko Mesjid Al-Ikhlas',
        villageId: villages[0].id,
        latitude: -6.8225,
        longitude: 107.1345,
      },
    }),
    prisma.posko.upsert({
      where: { id: 3 },
      update: {},
      create: {
        name: 'Posko Balai Desa Mekarjaya',
        villageId: villages[1].id,
        latitude: -6.8301,
        longitude: 107.1401,
      },
    }),
  ]);
  console.log('✅ Poskos created:', poskos.length);

  // Create sample Balitas
  const balitas = await Promise.all([
    prisma.balita.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        namaAnak: 'Ahmad Fauzi',
        namaOrtu: 'Bapak Fauzi',
        tanggalLahir: new Date('2023-06-15'),
        jenisKelamin: Gender.L,
        villageId: villages[0].id,
        poskoId: poskos[0].id,
      },
    }),
    prisma.balita.upsert({
      where: { id: '00000000-0000-0000-0000-000000000002' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000002',
        namaAnak: 'Siti Aisyah',
        namaOrtu: 'Ibu Aisyah',
        tanggalLahir: new Date('2022-03-20'),
        jenisKelamin: Gender.P,
        villageId: villages[0].id,
        poskoId: poskos[1].id,
      },
    }),
    prisma.balita.upsert({
      where: { id: '00000000-0000-0000-0000-000000000003' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000003',
        namaAnak: 'Rizki Pratama',
        namaOrtu: 'Bapak Pratama',
        tanggalLahir: new Date('2024-01-10'),
        jenisKelamin: Gender.L,
        villageId: villages[1].id,
        poskoId: poskos[2].id,
      },
    }),
  ]);
  console.log('✅ Balitas created:', balitas.length);

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
