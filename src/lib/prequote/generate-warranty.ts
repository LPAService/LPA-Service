import { removeBrandFromText } from "@/lib/prequote/remove-brand";

const PERISHABLE_CATEGORIES = new Set([
  "frutas-e-verduras",
  "carnes",
  "lacticinios",
  "congelados",
  "panificacao"
]);

const DRY_FOOD_CATEGORIES = new Set(["nao-pereciveis", "alimentos"]);

const NEW_GOODS_CATEGORIES = new Set([
  "limpeza-higiene",
  "material-de-escritorio",
  "material-pedagogico",
  "utensilios"
]);

const MANUFACTURER_WARRANTY_CATEGORIES = new Set([
  "eletronicos",
  "informatica",
  "moveis",
  "climatizacao"
]);

const SERVICE_CATEGORIES = new Set([
  "servicos",
  "manutencao",
  "construcao",
  "capacitacao-formacao",
  "transporte"
]);

export function generatePrequoteWarranty(categorySlug: string | null | undefined, brands: readonly string[] = []) {
  const text = warrantyTemplate(categorySlug);
  return removeBrandFromText(text, brands);
}

function warrantyTemplate(categorySlug: string | null | undefined) {
  if (categorySlug && PERISHABLE_CATEGORIES.has(categorySlug)) {
    return "Garantia de frescor, embalagem íntegra e validade adequada na entrega, com troca de unidade avariada no recebimento.";
  }
  if (categorySlug && DRY_FOOD_CATEGORIES.has(categorySlug)) {
    return "Garantia de validade mínima compatível com o consumo, embalagem lacrada e troca em caso de avaria no recebimento.";
  }
  if (categorySlug && NEW_GOODS_CATEGORIES.has(categorySlug)) {
    return "Produto novo, de primeira qualidade, com troca de item que apresente defeito no recebimento.";
  }
  if (categorySlug && MANUFACTURER_WARRANTY_CATEGORIES.has(categorySlug)) {
    return "Garantia de 3 meses contra defeitos de fabricação, a contar da entrega.";
  }
  if (categorySlug && SERVICE_CATEGORIES.has(categorySlug)) {
    return "Execução conforme a especificação da cotação, com correção sem custo de eventuais não conformidades identificadas.";
  }
  return "Garantia de conformidade com a especificação da cotação e troca ou correção de eventual não conformidade identificada na entrega.";
}
