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
