import categoriesRaw from './categories.json';
import expenseGroupMapRaw from './expense-group-map.json';
import type { Classificacao } from './classify';

type CategoryRecord = {
  slug: string;
};

const categories = categoriesRaw as CategoryRecord[];
const categorySlugs = new Set(categories.map((category) => category.slug));
const expenseGroupMap = expenseGroupMapRaw as Record<string, string>;

export type ExpenseGroupClassification = Classificacao & {
  unknownExpenseGroup?: string;
};

export function classifyExpenseGroup(expenseGroup: string): ExpenseGroupClassification | null {
  const normalizedExpenseGroup = expenseGroup.trim();
  if (!normalizedExpenseGroup) return null;

  const categoryId = expenseGroupMap[normalizedExpenseGroup];
  if (categoryId && categorySlugs.has(categoryId)) {
    return {
      categoryId,
      confidence: 0.9,
      matchedRules: [`expense-group:${normalizedExpenseGroup}`],
      needsFallback: false
    };
  }

  return {
    categoryId: 'outros',
    confidence: 0,
    matchedRules: [`expense-group:unknown:${normalizedExpenseGroup}`],
    needsFallback: true,
    unknownExpenseGroup: normalizedExpenseGroup
  };
}
