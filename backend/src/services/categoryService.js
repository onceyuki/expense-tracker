import { prisma } from '../utils/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { DEFAULT_CATEGORIES, CATEGORY_COLOR_PALETTE } from '../utils/constants.js';

export async function listCategories(userId) {
  return prisma.category.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
}

export async function seedDefaultCategories(userId) {
  // Called once right after user creation, so no duplicates are possible yet
  // (skipDuplicates isn't supported on SQLite, hence no createMany option here).
  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({ userId, name: c.name, color: c.color })),
  });
}

async function nextColor(userId) {
  const count = await prisma.category.count({ where: { userId } });
  return CATEGORY_COLOR_PALETTE[count % CATEGORY_COLOR_PALETTE.length];
}

export async function createCategory(userId, { name, color }) {
  const existing = await prisma.category.findFirst({ where: { userId, name } });
  if (existing) throw new ApiError(409, 'A category with this name already exists');
  return prisma.category.create({
    data: { userId, name, color: color || (await nextColor(userId)) },
  });
}

export async function updateCategory(userId, id, { name, color }) {
  const category = await prisma.category.findFirst({ where: { id, userId } });
  if (!category) throw new ApiError(404, 'Category not found');

  const data = {};
  if (color !== undefined) data.color = color;
  if (name !== undefined && name !== category.name) {
    const clash = await prisma.category.findFirst({ where: { userId, name } });
    if (clash) throw new ApiError(409, 'A category with this name already exists');
    data.name = name;
  }

  const updated = await prisma.category.update({ where: { id }, data });

  // Category names aren't a real FK — rename the string on every expense/budget that used the old name.
  if (data.name) {
    await prisma.expense.updateMany({ where: { userId, category: category.name }, data: { category: data.name } });
    await prisma.budget.updateMany({ where: { userId, category: category.name }, data: { category: data.name } });
  }

  return updated;
}

export async function deleteCategory(userId, id) {
  const category = await prisma.category.findFirst({ where: { id, userId } });
  if (!category) throw new ApiError(404, 'Category not found');

  const [expenseCount, budgetCount] = await Promise.all([
    prisma.expense.count({ where: { userId, category: category.name } }),
    prisma.budget.count({ where: { userId, category: category.name } }),
  ]);
  if (expenseCount > 0 || budgetCount > 0) {
    throw new ApiError(
      409,
      `"${category.name}" is used by ${expenseCount} expense(s) and ${budgetCount} budget(s) — reassign or remove those first`,
    );
  }

  await prisma.category.delete({ where: { id } });
}

export async function assertCategoryExists(userId, name) {
  if (name == null) return;
  const category = await prisma.category.findFirst({ where: { userId, name } });
  if (!category) throw new ApiError(400, `Unknown category: ${name}`);
}
