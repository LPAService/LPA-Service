export type ProposalBlockAnalysis = {
  blocked: boolean;
  suspect: boolean;
  reason: string | null;
  blockedItemCount: number;
  suspectItemCount: number;
  itemCount: number;
};

type ItemLike = { description?: string | null };

const STRONG_PATTERNS = [
  /n[aã]o\W+enviar\W+proposta/i,
  /n[aã]o\W+(?:e\W+)?necess[aá]rio\W+enviar\W+proposta/i
];
const SUSPECT_PATTERNS = [/processo\W+de\W+regulariza[cç][aã]o/i, /regulariza[cç][aã]o\W+no\W+sistema/i];

export function analyzeProposalBlock(items: ItemLike[]): ProposalBlockAnalysis {
  let reason: string | null = null;
  let blockedItemCount = 0;
  let suspectItemCount = 0;

  for (const item of items) {
    const description = item.description ?? "";
    const strong = STRONG_PATTERNS.some((pattern) => pattern.test(description));
    const suspect = SUSPECT_PATTERNS.some((pattern) => pattern.test(description));
    if (strong) {
      blockedItemCount += 1;
      reason ??= extractProposalBlockReason(description);
    }
    if (suspect && !strong) suspectItemCount += 1;
  }

  return {
    blocked: blockedItemCount > 0,
    suspect: blockedItemCount === 0 && suspectItemCount > 0,
    reason,
    blockedItemCount,
    suspectItemCount,
    itemCount: items.length
  };
}

export function extractProposalBlockReason(description: string) {
  const normalized = description.replace(/\s+/g, " ").trim();
  for (const pattern of [...STRONG_PATTERNS, ...SUSPECT_PATTERNS]) {
    const match = normalized.match(pattern);
    if (!match || match.index === undefined) continue;
    const start = Math.max(0, match.index - 90);
    const end = Math.min(normalized.length, match.index + match[0].length + 90);
    return normalized.slice(start, end).trim();
  }
  return normalized.slice(0, 240);
}
