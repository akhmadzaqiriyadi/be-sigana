import { PrismaClient, Role, Gender, Posisi, Status } from "@prisma/client";
import bcrypt from "bcryptjs";
import { fakerID_ID as faker } from "@faker-js/faker";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting seed...");

  // 1. Clean up database
  console.log("🧹 Cleaning database...");
  await prisma.measurement.deleteMany();
  await prisma.balita.deleteMany();
  await prisma.posko.deleteMany();
  await prisma.village.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create Users
  console.log("👤 Creating users...");
  const salt = await bcrypt.genSalt(10);
  const password = await bcrypt.hash("password123", salt);

  const users = [
    {
      name: "Admin SiGana",
      email: "admin@sigana.id",
      role: Role.ADMIN,
      password,
      isVerified: true,
    },
    {
      name: "Budi Santoso",
      email: "relawan@sigana.id",
      role: Role.RELAWAN,
      password,
      isVerified: true,
    },
    {
      name: "Siti Aminah",
      email: "relawan2@sigana.id",
      role: Role.RELAWAN,
      password,
      isVerified: true,
    },
    {
      name: "Dinas Kesehatan Cianjur",
      email: "dinkes@sigana.id",
      role: Role.STAKEHOLDER,
      password,
      isVerified: true,
    },
  ];

  for (const user of users) {
    await prisma.user.create({ data: user });
  }

  const relawanUser = await prisma.user.findUnique({
    where: { email: "relawan@sigana.id" },
  });

  // 3. Create Villages (Real Cianjur Districts/Villages sample)
  console.log("🏘️ Creating villages...");
  const villageNames = [
    { name: "Sukamaju", districts: "Cianjur" },
    { name: "Mekarwangi", districts: "Warungkondang" },
    { name: "Cijedil", districts: "Cugenang" },
    { name: "Cibadak", districts: "Cibeber" },
    { name: "Cirumput", districts: "Cugenang" },
  ];

  const villages = [];
  for (const v of villageNames) {
    const village = await prisma.village.create({
      data: v,
    });
    villages.push(village);
  }

  // 4. Create Poskos
  console.log("camp Creating poskos...");
  const poskos = [];
  for (const village of villages) {
    // Create 1-2 poskos per village
    const numPoskos = faker.number.int({ min: 1, max: 2 });
    for (let i = 0; i < numPoskos; i++) {
      const posko = await prisma.posko.create({
        data: {
          name: `Posko ${village.name} ${i + 1}`,
          villageId: village.id,
          latitude: faker.location.latitude({ max: -6.7, min: -7.0 }),
          longitude: faker.location.longitude({ max: 107.2, min: 107.0 }),
        },
      });
      poskos.push(posko);
    }
  }

  // 5. Create Balitas
  console.log("👶 Creating balitas...");
  const balitas = [];
  const numBalitas = 50;

  for (let i = 0; i < numBalitas; i++) {
    const village = faker.helpers.arrayElement(villages);
    const availablePoskos = poskos.filter((p) => p.villageId === village.id);
    const posko =
      availablePoskos.length > 0
        ? faker.helpers.arrayElement(availablePoskos)
        : null;

    // Age 0-59 months
    const birthDate = faker.date.birthdate({
      mode: "age",
      min: 0,
      max: 4, // 0-4 years old
    });

    const sex = faker.helpers.arrayElement([Gender.L, Gender.P]);

    const balita = await prisma.balita.create({
      data: {
        namaAnak: faker.person.fullName({
          sex: sex === Gender.L ? "male" : "female",
        }),
        namaOrtu: faker.person.fullName(),
        tanggalLahir: birthDate,
        jenisKelamin: sex,
        villageId: village.id,
        poskoId: posko?.id,
      },
    });
    balitas.push(balita);
  }

  // 6. Create Measurements
  console.log("gantungan Creating measurements...");
  for (const balita of balitas) {
    // 1-5 measurements per balita
    const numMeas = faker.number.int({ min: 1, max: 5 });
    let currentDate = new Date(balita.tanggalLahir);

    for (let i = 0; i < numMeas; i++) {
      // Advance date by 1-3 months
      currentDate = new Date(
        currentDate.setMonth(
          currentDate.getMonth() + faker.number.int({ min: 1, max: 3 })
        )
      );
      if (currentDate > new Date()) break;

      // Realistic Anthropometry based on Age
      // Simple logic:
      // Weight ~ 3 + (age_months * 0.5) +/- variance
      // Height ~ 50 + (age_months * 0.8) +/- variance
      const ageMonths =
        (currentDate.getTime() - balita.tanggalLahir.getTime()) /
        (1000 * 60 * 60 * 24 * 30.44);

      if (ageMonths < 0) continue;

      const baseWeight = 3.3 + ageMonths * 0.6; // kg
      const weight = faker.number.float({
        min: baseWeight * 0.8,
        max: baseWeight * 1.2,
        fractionDigits: 1,
      });

      const baseHeight = 50 + ageMonths * 0.9; // cm
      const height = faker.number.float({
        min: baseHeight * 0.9,
        max: baseHeight * 1.1,
        fractionDigits: 1,
      });

      const lila = faker.number.float({
        min: 11,
        max: 18,
        fractionDigits: 1,
      });
      const lingkarKepala = faker.number.float({
        min: 35,
        max: 50,
        fractionDigits: 1,
      });

      // Random status
      const statusAkhir = faker.helpers.arrayElement(Object.values(Status));

      await prisma.measurement.create({
        data: {
          balitaId: balita.id,
          relawanId: relawanUser?.id || "",
          beratBadan: weight,
          tinggiBadan: height,
          lingkarKepala,
          lila,
          posisiUkur: ageMonths < 24 ? Posisi.TERLENTANG : Posisi.BERDIRI,
          bb_u_status: faker.helpers.arrayElement([
            "Gizi Baik",
            "Kurang Gizi",
            "Gizi Lebih",
          ]),
          tb_u_status: faker.helpers.arrayElement([
            "Normal",
            "Pendek",
            "Sangat Pendek",
          ]),
          bb_tb_status: faker.helpers.arrayElement([
            "Gizi Baik",
            "Gizi Kurang",
            "Gizi Buruk",
            "Berisiko Gizi Lebih",
          ]),
          statusAkhir: statusAkhir,
          notes: faker.lorem.sentence(),
          createdAt: currentDate,
          updatedAt: currentDate,
        },
      });
    }
  }

  console.log("✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
