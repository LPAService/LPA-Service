export type OpportunityItem = {
  order: number;
  name: string;
  description: string;
  unit: string;
  quantity: number;
  unitValue: number | null;
  totalValue: number | null;
  isPermanent: boolean;
  expenseCategory: string;
};

export type OpportunityAttachment = {
  id: number;
  filename: string;
  thumbUrl: string;
  url: string | null;
};

export type OpportunityCategory = {
  slug: string;
  name: string;
  confidence: number | null;
  needsFallback: boolean | null;
};

export type NormalizedOpportunity = {
  kind?: "quotation" | "history";
  externalId: string;
  orderId: string;
  sourceUrl: string;
  proposalUrl?: string | null;
  idSubprogram: number;
  idSchool: number;
  idBudget: number;
  idSupplier: number | null;
  school: string;
  city: string | null;
  regional: string | null;
  expenseGroup: string;
  subprogram: string;
  year: string;
  purchaseDate: string | null;
  proposalDate: string | null;
  proposalDeadline?: string | null;
  deliveryDate: string | null;
  purchaseOrderStatus: string | null;
  accountabilityStatus: string | null;
  supplierName: string | null;
  supplierDocument: string | null;
  initiativeDescription: string | null;
  items: OpportunityItem[];
  attachments: OpportunityAttachment[];
  totalValue: number | null;
  itemCount: number;
  category: OpportunityCategory | null;
  headline: string;
  summary: string;
  topItems: string[];
  rawJson: unknown;
  statusLabel?: string;
};
