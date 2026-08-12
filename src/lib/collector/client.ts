import { CAIXA_ESCOLAR_API_BASE_URL } from "@/lib/source-url";

export { CAIXA_ESCOLAR_API_BASE_URL };

const DEFAULT_USER_AGENT = "lpa-leo-collector/0.1 contato:fornecedores";

export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: PageMeta;
};

export type PurchaseOrderListRecord = {
  orderId: string;
  year: string;
  school: string;
  subprogram: string;
  expenseGroup: string;
  accountabilityStatus: string | null;
  accountabilitySent: boolean | null;
  purchaseDate: string | null;
  idSubprogram: number;
  idSchool: number;
  idBudget: number;
  idSupplier: number | null;
};

export type PurchaseOrderDetail = {
  year: number | string | null;
  budgetOrder: string | null;
  purchaseOrderStatus: string | null;
  subprogramName: string | null;
  initiativeDescription: string | null;
  expenseGroupDescription: string | null;
  dtProposalSubmission: string | null;
  dtDelivery: string | null;
  inNaturalPersonAllowed: boolean | null;
  supplierName: string | null;
  supplierDocument: string | null;
};

export type PurchaseOrderItem = {
  nuItemOrder: number;
  txDescription: string | null;
  inPermanent: boolean;
  txExpenseCategory: string | null;
  txBudgetItemType: string | null;
  txBudgetItemUnit: string | null;
  nuQuantity: number;
  nuValueByItem: number | null;
  nuReferralValue: number | null;
  txWarrantyDescription: string | null;
};

export type PurchaseOrderAttachment = {
  id: number;
  filename: string;
  url: string;
  thumbUrl: string;
};

export type PortalCounty = {
  idCounty: number;
  txCounty: string;
};

export type PortalRegional = {
  idNetwork: number;
  txName: string;
};

export type PortalSchool = {
  idSchool: number;
  txName: string;
};

export type PortalFilters = {
  regionals?: PortalRegional[];
  years?: { year: number }[];
  subprograms?: { idSubprogram: number; txName: string }[];
  expenseGroups?: { idExpenseGroup: string; txExpenseGroup: string }[];
  counties?: PortalCounty[];
  schools?: PortalSchool[];
  statuses?: string[];
  suppliers?: { idSupplier: number; txName: string }[];
};

export type PurchaseOrdersQuery = {
  page?: number;
  pageSize?: number;
  year?: string | number;
  idSchool?: number;
  idSubprogramRoot?: number;
  expenseGroup?: string;
  accountabilityStatus?: string;
  accountabilitySent?: boolean;
  regional?: string | number;
  county?: string | number;
  idSupplier?: number;
  company?: string;
  schoolInep?: string;
  sortBy?: string;
  sortDir?: "ASC" | "DESC";
};

export type PurchaseOrderKey = {
  idSubprogram: number;
  idSchool: number;
  idBudget: number;
};

export type PurchaseOrderItemsQuery = PurchaseOrderKey & {
  idSupplier?: number | null;
  page?: number;
  pageSize?: number;
  sortBy?: string;
};

export type PortalFiltersQuery = {
  regional?: string | number;
  year?: string | number;
  subprogram?: string | number;
  county?: string | number;
  school?: string | number;
};

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

type ClientOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  userAgent?: string;
  fetchFn?: FetchLike;
  maxRetries?: number;
  initialBackoffMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
};

export class SourceHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string
  ) {
    super(message);
    this.name = "SourceHttpError";
  }
}

export class CaixaEscolarClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly userAgent: string;
  private readonly fetchFn: FetchLike;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private blockedUntil = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(options: ClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? CAIXA_ESCOLAR_API_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.fetchFn = options.fetchFn ?? fetch;
    this.maxRetries = options.maxRetries ?? 3;
    this.initialBackoffMs = options.initialBackoffMs ?? 500;
    this.sleepFn = options.sleepFn ?? delay;
  }

  listPurchaseOrders(query: PurchaseOrdersQuery = {}) {
    return this.getJson<PaginatedResponse<PurchaseOrderListRecord>>(
      "/public/purchase-orders",
      query
    );
  }

  getPurchaseOrderDetail(key: PurchaseOrderKey) {
    return this.getJson<PurchaseOrderDetail>(
      `/public/purchase-orders/by-subprogram/${key.idSubprogram}/by-school/${key.idSchool}/by-budget/${key.idBudget}/detail`
    );
  }

  listPurchaseOrderItems(query: PurchaseOrderItemsQuery) {
    return this.getJson<PaginatedResponse<PurchaseOrderItem>>(
      `/public/purchase-orders/by-subprogram/${query.idSubprogram}/by-school/${query.idSchool}/by-budget/${query.idBudget}/items`,
      {
        idSupplier: query.idSupplier ?? undefined,
        page: query.page,
        pageSize: query.pageSize,
        sortBy: query.sortBy ?? "budgetItem.nuItemOrder:ASC"
      }
    );
  }

  getPurchaseOrderImages(key: PurchaseOrderKey) {
    return this.getJson<PurchaseOrderAttachment[]>(
      `/public/purchase-orders/by-subprogram/${key.idSubprogram}/by-school/${key.idSchool}/by-budget/${key.idBudget}/images`
    );
  }

  getPortalFilters(query: PortalFiltersQuery = {}) {
    return this.getJson<PortalFilters>("/public/portal/filters", query);
  }

  private async getJson<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    const url = this.buildUrl(path, params);
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await this.fetchWithinRateLimit(url);

        if (response.ok) {
          return (await response.json()) as T;
        }

        const body = await response.text();
        if (response.status === 429 || response.status >= 500) {
          lastError = new SourceHttpError(
            `Caixa Escolar API returned ${response.status}`,
            response.status,
            body
          );
          await this.waitForRetry(attempt, response.headers);
          continue;
        }

        throw new SourceHttpError(
          `Caixa Escolar API returned ${response.status}`,
          response.status,
          body
        );
      } catch (error) {
        lastError = error;
        if (attempt === this.maxRetries || error instanceof SourceHttpError) {
          break;
        }
        await this.waitForRetry(attempt);
      }
    }

    throw lastError;
  }

  private buildUrl(path: string, params: Record<string, unknown>) {
    const url = new URL(path, this.baseUrl);
    url.searchParams.set("portalSlug", "mg");

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      url.searchParams.set(key, String(value));
    }

    return url;
  }

  private async fetchWithinRateLimit(url: URL) {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      const waitMs = Math.max(0, this.blockedUntil - Date.now());
      if (waitMs > 0) {
        await this.sleepFn(waitMs);
      }

      const response = await this.fetchWithTimeout(url);
      this.updateRateLimit(response.headers);
      return response;
    } finally {
      release();
    }
  }

  private async fetchWithTimeout(url: URL) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await this.fetchFn(url, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/json"
        },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private updateRateLimit(headers: Headers) {
    const limit = Number(headers.get("x-ratelimit-limit"));
    const remaining = Number(headers.get("x-ratelimit-remaining"));
    const resetSeconds = Number(headers.get("x-ratelimit-reset"));

    if (Number.isFinite(limit) && limit > 0) {
      const pacedWaitMs =
        Number.isFinite(resetSeconds) && resetSeconds > 0
          ? (resetSeconds * 1000) / limit
          : 1000 / limit;
      this.blockedUntil = Math.max(this.blockedUntil, Date.now() + pacedWaitMs);
    }

    if (Number.isFinite(remaining) && remaining <= 0 && Number.isFinite(resetSeconds)) {
      this.blockedUntil = Math.max(this.blockedUntil, Date.now() + resetSeconds * 1000);
    }
  }

  private async waitForRetry(attempt: number, headers?: Headers) {
    const retryAfterMs = headers ? parseRetryAfter(headers.get("retry-after")) : 0;
    const resetSeconds = headers ? Number(headers.get("x-ratelimit-reset")) : NaN;
    const rateLimitWaitMs = Number.isFinite(resetSeconds) ? resetSeconds * 1000 : 0;
    const backoffMs = this.initialBackoffMs * 2 ** attempt;
    await this.sleepFn(Math.max(retryAfterMs, rateLimitWaitMs, backoffMs));
  }
}

function parseRetryAfter(value: string | null) {
  if (!value) {
    return 0;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const date = Date.parse(value);
  return Number.isNaN(date) ? 0 : Math.max(0, date - Date.now());
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
