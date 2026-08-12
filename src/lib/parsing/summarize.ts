import type {
  OpportunityCategory,
  OpportunityItem
} from "@/lib/contracts/opportunity";

type SummaryInput = {
  category: OpportunityCategory | null;
  initiativeDescription: string | null;
  expenseGroup: string;
  items: OpportunityItem[];
};

type SummaryOutput = {
  headline: string;
  summary: string;
  topItems: string[];
};

const FALLBACK_HEADLINE = "Outros";

export function summarize(input: SummaryInput): SummaryOutput {
  const topItems = topItemsFromItems(input.items);
  const headline = input.category?.name ?? FALLBACK_HEADLINE;
  const contextText = [
    input.initiativeDescription,
    input.expenseGroup,
    topItems.join(" ")
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");

  return {
    headline,
    summary: buildSummary(input.category?.slug ?? "outros", input.expenseGroup, topItems, contextText),
    topItems
  };
}

export function topItemsFromItems(items: OpportunityItem[]): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const item of [...items].sort((a, b) => a.order - b.order)) {
    const name = cleanItemName(item.name);
    if (!name) continue;

    const key = normalizeDedupeKey(name);
    if (seen.has(key)) continue;

    seen.add(key);
    cleaned.push(name);
    if (cleaned.length === 5) break;
  }

  return cleaned;
}

export function cleanItemName(value: string): string {
  const firstSegment = value
    .replace(/\s+/g, " ")
    .split(/[.;:\n\r]/)[0]
    .replace(/[*_]/g, "")
    .replace(/[()]/g, "")
    .replace(/\s*[-–—]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");

  return firstSegment.length > 80 ? firstSegment.slice(0, 80).trim() : firstSegment;
}

function buildSummary(
  categorySlug: string,
  expenseGroup: string,
  topItems: string[],
  contextText: string
): string {
  const foodPurpose = hasFoodContext(contextText)
    ? "destinados à alimentação escolar"
    : "para uso da escola";

  const templates: Record<string, string> = {
    "frutas-e-verduras": `Fornecedor para frutas, verduras e hortaliças ${foodPurpose}.`,
    panificacao: `Fornecedor para pães e produtos de panificação ${foodPurpose}.`,
    "nao-pereciveis": `Fornecedor para alimentos não perecíveis ${foodPurpose}.`,
    congelados: `Fornecedor para alimentos congelados ${foodPurpose}.`,
    carnes: `Fornecedor para carnes, aves e peixes ${foodPurpose}.`,
    lacticinios: `Fornecedor para leite e derivados ${foodPurpose}.`,
    alimentos: `Fornecedor para gêneros alimentícios ${foodPurpose}.`,
    manutencao: "Fornecedor para manutenção e conservação da escola.",
    construcao: "Fornecedor para materiais de construção e pequenos reparos da escola.",
    eletrica: "Fornecedor para materiais e serviços elétricos da escola.",
    hidraulica: "Fornecedor para materiais e serviços hidráulicos da escola.",
    "limpeza-higiene": "Fornecedor para materiais de limpeza e higiene da escola.",
    "material-de-escritorio": "Fornecedor para materiais de escritório e papelaria da escola.",
    "impressao-toner": "Fornecedor para toners, cartuchos e suprimentos de impressão da escola.",
    informatica: "Fornecedor para equipamentos e serviços de informática da escola.",
    eletronicos: "Fornecedor para equipamentos eletrônicos da escola.",
    moveis: "Fornecedor para mobiliário escolar.",
    utensilios: "Fornecedor para utensílios e equipamentos de cozinha da escola.",
    transporte: "Fornecedor para serviços de transporte escolar.",
    seguranca: "Fornecedor para itens e serviços de segurança da escola.",
    "uniformes-textil": "Fornecedor para uniformes e itens têxteis escolares.",
    servicos: "Fornecedor para serviços operacionais da escola."
  };

  if (templates[categorySlug]) return templates[categorySlug];

  if (topItems.length > 0) {
    return `Fornecedor para ${joinPtBr(topItems)} ${inferGenericPurpose(contextText)}.`;
  }

  const group = cleanExpenseGroup(expenseGroup);
  if (group) return `Fornecedor para ${group} da escola.`;

  return "Fornecedor para itens e serviços da escola.";
}

function hasFoodContext(text: string): boolean {
  return /aliment|merenda|g[eê]nero|hortifruti|padaria|p[aã]o|fruta|verdura/i.test(text);
}

function inferGenericPurpose(text: string): string {
  if (hasFoodContext(text)) return "destinados à alimentação escolar";
  if (/manuten|reforma|conserva|reparo/i.test(text)) {
    return "para manutenção e conservação da escola";
  }
  return "para uso da escola";
}

function cleanExpenseGroup(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

function joinPtBr(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
}

function normalizeDedupeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}
