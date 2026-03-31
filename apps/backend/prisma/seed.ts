import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { phone: '+1234567890' },
    update: {},
    create: {
      phone: '+1234567890',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: Role.ADMIN,
      balance: { create: { amount: 0 } },
    },
  });

  // Create a test user
  const userPassword = await bcrypt.hash('user1234', 12);
  const user = await prisma.user.upsert({
    where: { phone: '+9876543210' },
    update: {},
    create: {
      phone: '+9876543210',
      password: userPassword,
      firstName: 'Test',
      lastName: 'Customer',
      role: Role.USER,
      balance: { create: { amount: 100000 } },
    },
  });

  // Create sample symbols
  await prisma.symbol.upsert({
    where: { id: 'gold-symbol' },
    update: {},
    create: {
      id: 'gold-symbol',
      name: 'XAUUSD',
      displayName: 'Gold',
      mtSymbol: 'XAUUSD',
      lotSize: 1.0,
      amount: 1550,
      price: 30000,
      commission: 25,
      isTradable: true,
    },
  });

  await prisma.symbol.upsert({
    where: { id: 'silver-symbol' },
    update: {},
    create: {
      id: 'silver-symbol',
      name: 'XAGUSD',
      displayName: 'Silver',
      mtSymbol: 'XAGUSD',
      lotSize: 1.0,
      amount: 500,
      price: 5000,
      commission: 10,
      isTradable: true,
    },
  });

  // Privacy policy setting
  await prisma.appSetting.upsert({
    where: { key: 'privacy_policy' },
    update: {},
    create: {
      key: 'privacy_policy',
      value:
        'This is the privacy policy for Azin Forex application. Your data is protected and handled securely.',
    },
  });

  console.log('Seed complete:', { admin: admin.id, user: user.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
