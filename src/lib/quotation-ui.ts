import type { NormalizedOpportunity } from "@/lib/contracts/opportunity";

export function canSubmitQuotationProposal(opportunity: NormalizedOpportunity) {
  return opportunity.kind === "quotation" && opportunity.canSubmitProposal === true;
}
