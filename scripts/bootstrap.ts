import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function bootstrap() {
  // 1. Создаём отдел "Общий"
  const department = await prisma.department.upsert({
    where: { name: "Общий" },
    update: {},
    create: { name: "Общий" },
  });

  // 2. Всем пользователям без отдела — назначаем "Общий"
  await prisma.user.updateMany({
    where: { departmentId: null },
    data: { departmentId: department.id },
  });

  // 3. Если нет ни одного админа — создаём дефолтного
  const existingAdmin = await prisma.user.findFirst({ where: { role: "admin" } });

  if (!existingAdmin) {
    const email = process.env.ADMIN_EMAIL || "admin@example.com";
    const password = process.env.ADMIN_PASSWORD || "admin123";

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "admin",
        departmentId: department.id,
      },
    });

    console.log(
      ` Admin user created: email="${admin.email}", password="${password}" (please change it after first login)`
    );
  } else {
    console.log(" Admin user already exists, skipping admin creation");
  }

  console.log(" Bootstrap complete");
}

bootstrap()
  .catch((e) => {
    console.error("❌ Bootstrap failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
