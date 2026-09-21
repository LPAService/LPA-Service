import type { NormalizedOpportunity } from "@/lib/contracts/opportunity";

/**
 * Server-safe formatters used across Server Components and Client Components.
 *
 * These functions used to live in src/components/opportunity-card.tsx, but
 * that file declares `"use client"`. Importing non-component named exports
 * (like plain utility functions) from a client module into a Server
 * Component causes an RSC serialization failure at SSR. To stay
 * isomorphic, the formatters now live here.
 */

export function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Sem preço de referência";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatOpportunityValue(opportunity: NormalizedOpportunity) {
  if (opportunity.kind === "quotation" && (opportunity.totalValue === null || opportunity.totalValue === undefined)) {
    return "Sem preço de referência";
  }
  const value = formatCurrency(opportunity.totalValue);
  return opportunity.kind === "quotation" && opportunity.isTotalValuePartial ? `a partir de ${value}` : value;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function cleanDisplayedDescription(description: string, unitValue: number | null | undefined) {
  if (unitValue === null || unitValue === undefined || !Number.isFinite(unitValue)) return description;
  return description
    .replace(/\s*(?:[-–—]\s*)?pre[cç]o\s+de\s+refer[eê]ncia\s*:?\s*r\$\s*\d{1,3}(?:\.\d{3})*,\d{2}\s*\.?\s*$/i, "")
    .trim();
}

export type DeadlineRingState = {
  ringDisplay: string;
  label: string;
  sublabel: string;
  color: string;
  fraction: number;
  strokeDashoffset: number;
  isUrgent: boolean;
  days: number | null;
};

export function calculateDaysRemaining(
  dateString: string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!dateString) return null;
  const target = new Date(dateString);
  if (!Number.isFinite(target.getTime())) return null;

  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((targetMidnight - nowMidnight) / (24 * 60 * 60 * 1000));
}

export function getDeadlineRingState(
  dateString: string | null | undefined,
  now: Date = new Date()
): DeadlineRingState {
  const CIRCUMFERENCE = 150.8;

  if (!dateString) {
    return {
      ringDisplay: "—",
      label: "Sem prazo",
      sublabel: "Data não informada",
      color: "var(--color-fg-muted)",
      fraction: 0,
      strokeDashoffset: CIRCUMFERENCE,
      isUrgent: false,
      days: null
    };
  }

  const target = new Date(dateString);
  if (!Number.isFinite(target.getTime())) {
    return {
      ringDisplay: "—",
      label: "Sem prazo",
      sublabel: "Data inválida",
      color: "var(--color-fg-muted)",
      fraction: 0,
      strokeDashoffset: CIRCUMFERENCE,
      isUrgent: false,
      days: null
    };
  }

  const days = calculateDaysRemaining(dateString, now)!;
  const formattedDate = formatDate(dateString);

  if (days < 0) {
    return {
      ringDisplay: "—",
      label: "Prazo encerrado",
      sublabel: `Venceu em ${formattedDate}`,
      color: "var(--color-fg-muted)",
      fraction: 0,
      strokeDashoffset: CIRCUMFERENCE,
      isUrgent: false,
      days
    };
  }

  if (days === 0) {
    return {
      ringDisplay: "0",
      label: "Vence hoje",
      sublabel: "Prazo até hoje",
      color: "var(--rose, #f43f5e)",
      fraction: 1,
      strokeDashoffset: 0,
      isUrgent: true,
      days: 0
    };
  }

  // days > 0
  const color =
    days <= 3
      ? "var(--rose, #f43f5e)"
      : days <= 7
        ? "var(--amber, #f59e0b)"
        : "var(--teal, #0d9488)";

  const fraction = Math.min(1, Math.max(0.05, days / 30));
  const strokeDashoffset = Number((CIRCUMFERENCE * (1 - fraction)).toFixed(1));

  return {
    ringDisplay: String(days),
    label: days === 1 ? "Falta 1 dia" : `Faltam ${days} dias`,
    sublabel: `Prazo até ${formattedDate}`,
    color,
    fraction,
    strokeDashoffset,
    isUrgent: days <= 3,
    days
  };
}

