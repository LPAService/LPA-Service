import { normalize } from "@/lib/text/normalize";

export type SubscriptionMatchInput = {
  categoryId: number | null;
  city: string | null;
  school: string | null;
  keyword: string | null;
  active: boolean;
};

export type QuotationMatchInput = {
  categoryId: number | null;
  city: string | null;
  school: string;
  headline: string;
  summary: string;
  topItems: string[];
};

/**
 * Uma assinatura bate com uma cotação quando TODOS os critérios
 * preenchidos casam (campos vazios funcionam como curinga).
 */
export function matchesSubscription(
  subscription: SubscriptionMatchInput,
  quotation: QuotationMatchInput
): boolean {
  if (!subscription.active) return false;

  if (
    subscription.categoryId !== null &&
    subscription.categoryId !== quotation.categoryId
  ) {
    return false;
  }

  if (subscription.city) {
    const wanted = normalize(subscription.city);
    const actual = normalize(quotation.city ?? "");
    if (actual !== wanted && !actual.includes(wanted)) return false;
  }

  if (subscription.school) {
    const wanted = normalize(subscription.school);
    const actual = normalize(quotation.school);
    if (!actual.includes(wanted)) return false;
  }

  if (subscription.keyword) {
    const haystack = normalize(
      [quotation.school, quotation.headline, quotation.summary, ...quotation.topItems].join(" ")
    );
    if (!haystack.includes(normalize(subscription.keyword))) return false;
  }

  return true;
}

/** Assinatura sem nenhum critério é inválida (avisaria tudo = spam). */
export function hasAnyCriteria(subscription: {
  categoryId: number | null;
  city: string | null;
  school: string | null;
  keyword: string | null;
}): boolean {
  return Boolean(
    subscription.categoryId ||
      subscription.city?.trim() ||
      subscription.school?.trim() ||
      subscription.keyword?.trim()
  );
}
