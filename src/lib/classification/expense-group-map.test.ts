import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import categoriesRaw from './categories.json';
import { classifyExpenseGroup } from './expense-groups';
import expenseGroupMapRaw from './expense-group-map.json';

type CategoryRecord = {
  slug: string;
};

type ExpenseGroupRecord = {
  txExpenseGroup?: unknown;
};

type FiltersFixture = {
  data?: {
    expenseGroups?: ExpenseGroupRecord[];
  };
  expenseGroups?: ExpenseGroupRecord[];
};

const filters = JSON.parse(
  readFileSync(
    new URL('research/portal/fixtures/filters_base.json', pathToFileURL(`${process.cwd()}/`)),
    'utf8'
  )
) as FiltersFixture;

const categories = categoriesRaw as CategoryRecord[];
const expenseGroupMap = expenseGroupMapRaw as Record<string, string>;

function sourceExpenseGroups(): string[] {
  const groups = filters.data?.expenseGroups ?? filters.expenseGroups ?? [];

  return Array.from(
    new Set(
      groups
        .map((group) => group.txExpenseGroup)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim())
    )
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

describe('expense-group-map', () => {
  it('mapeia todos os grupos de despesa expostos pela fonte', () => {
    const sourceGroups = sourceExpenseGroups();
    const mappedGroups = Object.keys(expenseGroupMap).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    expect(sourceGroups).toHaveLength(24);
    expect(mappedGroups).toEqual(sourceGroups);
  });

  it('aponta todos os grupos para categorias validas e nunca para Outros', () => {
    const categorySlugs = new Set(categories.map((category) => category.slug));

    for (const [expenseGroup, categorySlug] of Object.entries(expenseGroupMap)) {
      expect(categorySlug, expenseGroup).not.toBe('outros');
      expect(categorySlugs.has(categorySlug), expenseGroup).toBe(true);
    }
  });

  it('cobre os grupos reais que derrubavam a classificacao por amostra', () => {
    expect(expenseGroupMap['Obras']).toBe('construcao');
    expect(expenseGroupMap['Equipamentos Tecnológicos']).toBe('informatica');
    expect(expenseGroupMap['Equipamentos de Cozinha']).toBe('utensilios');
    expect(expenseGroupMap['Material Pedagógico']).toBe('material-pedagogico');
    expect(expenseGroupMap['Serviço de Transporte Contínuo']).toBe('transporte');
  });

  it('registra grupo desconhecido da fonte como fallback explicito', () => {
    expect(classifyExpenseGroup('Grupo Novo da Fonte')).toMatchObject({
      categoryId: 'outros',
      needsFallback: true,
      matchedRules: ['expense-group:unknown:Grupo Novo da Fonte'],
      unknownExpenseGroup: 'Grupo Novo da Fonte'
    });
  });
});
