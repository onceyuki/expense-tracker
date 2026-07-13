import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Name + chart color for each demo category (colors match the dashboard's chart palette)
const CATEGORY_DEFS = [
  { name: 'Food', color: '#eda100' },
  { name: 'Transportation', color: '#2a78d6' },
  { name: 'Shopping', color: '#e87ba4' },
  { name: 'Utilities', color: '#1baf7a' },
  { name: 'Rent', color: '#4a3aa7' },
  { name: 'Entertainment', color: '#eb6834' },
  { name: 'Health', color: '#e34948' },
  { name: 'Education', color: '#008300' },
  { name: 'Bills', color: '#0891b2' },
  { name: 'Travel', color: '#4d7c0f' },
  { name: 'Other', color: '#64748b' },
];
const CATEGORIES = CATEGORY_DEFS.map((c) => c.name);

const EXPENSE_TITLES = {
  Food: ['Groceries', 'Lunch out', 'Coffee', 'Dinner with friends', 'Takeout'],
  Transportation: ['Gas', 'Bus pass', 'Ride share', 'Parking', 'Car service'],
  Shopping: ['Clothes', 'Electronics', 'Home goods', 'Gifts', 'Books'],
  Utilities: ['Electricity bill', 'Water bill', 'Internet', 'Phone plan'],
  Rent: ['Monthly rent'],
  Entertainment: ['Movie night', 'Concert tickets', 'Streaming subscription', 'Video game'],
  Health: ['Pharmacy', 'Gym membership', 'Doctor visit', 'Vitamins'],
  Education: ['Online course', 'Textbooks', 'Workshop fee'],
  Bills: ['Insurance', 'Credit card fee', 'Subscription bundle'],
  Travel: ['Flight tickets', 'Hotel stay', 'Weekend trip'],
  Other: ['Miscellaneous', 'Donation', 'Pet supplies'],
};

// Deterministic pseudo-random so seeding is reproducible
let seedState = 42;
function rand() {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}
function randBetween(min, max) {
  return Math.round((min + rand() * (max - min)) * 100) / 100;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

async function main() {
  const email = 'demo@example.com';
  await prisma.user.deleteMany({ where: { email } });

  const user = await prisma.user.create({
    data: {
      name: 'Demo User',
      email,
      password: await bcrypt.hash('Password123!', 10),
    },
  });

  await prisma.category.createMany({
    data: CATEGORY_DEFS.map((c) => ({ userId: user.id, name: c.name, color: c.color })),
  });

  const walletNames = ['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Mobile Payment'];
  await prisma.wallet.createMany({
    data: walletNames.map((name) => ({ userId: user.id, name })),
  });
  const wallets = await prisma.wallet.findMany({ where: { userId: user.id } });
  const walletIds = wallets.map((w) => w.id);

  const now = new Date();
  const expenses = [];
  const incomes = [];

  for (let m = 5; m >= 0; m--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const lastDay = m === 0 ? now.getDate() : daysInMonth;

    // Salary + occasional freelance income
    incomes.push({
      userId: user.id,
      source: 'Salary',
      amount: 4200,
      date: new Date(monthStart.getFullYear(), monthStart.getMonth(), 1, 9),
      notes: 'Monthly salary',
    });
    if (rand() > 0.4) {
      incomes.push({
        userId: user.id,
        source: 'Freelance',
        amount: randBetween(300, 900),
        date: new Date(monthStart.getFullYear(), monthStart.getMonth(), Math.min(15, lastDay), 12),
        notes: 'Side project',
      });
    }

    // Rent on the 1st
    expenses.push({
      userId: user.id,
      title: 'Monthly rent',
      amount: 1400,
      category: 'Rent',
      walletId: wallets.find((w) => w.name === 'Bank Transfer').id,
      date: new Date(monthStart.getFullYear(), monthStart.getMonth(), 1, 8),
      notes: null,
    });

    // ~18 varied expenses per month
    for (let i = 0; i < 18; i++) {
      const category = pick(CATEGORIES.filter((c) => c !== 'Rent'));
      const ranges = {
        Food: [8, 120], Transportation: [5, 80], Shopping: [15, 250],
        Utilities: [30, 160], Entertainment: [10, 90], Health: [12, 200],
        Education: [20, 180], Bills: [25, 150], Travel: [60, 500], Other: [5, 100],
      };
      const [min, max] = ranges[category];
      expenses.push({
        userId: user.id,
        title: pick(EXPENSE_TITLES[category]),
        amount: randBetween(min, max),
        category,
        walletId: pick(walletIds),
        date: new Date(
          monthStart.getFullYear(),
          monthStart.getMonth(),
          1 + Math.floor(rand() * lastDay),
          8 + Math.floor(rand() * 12),
        ),
        notes: rand() > 0.7 ? 'Seeded note' : null,
      });
    }
  }

  await prisma.expense.createMany({ data: expenses });
  await prisma.income.createMany({ data: incomes });

  const currentMonth = monthKey(now);
  await prisma.budget.createMany({
    data: [
      { userId: user.id, category: null, limit: 3200, month: currentMonth },
      { userId: user.id, category: 'Food', limit: 600, month: currentMonth },
      { userId: user.id, category: 'Transportation', limit: 250, month: currentMonth },
      { userId: user.id, category: 'Entertainment', limit: 200, month: currentMonth },
      { userId: user.id, category: 'Shopping', limit: 400, month: currentMonth },
    ],
  });

  console.log(`Seeded user ${email} (password: Password123!) with ${expenses.length} expenses, ${incomes.length} incomes, 5 budgets.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
