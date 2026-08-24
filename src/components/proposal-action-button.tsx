"use client";

import React, { useEffect, useRef, useState } from "react";

const FEEDBACK_MS = 2500;
const DEFAULT_PORTAL_URL = "https://caixaescolar.educacao.mg.gov.br/selecionar-perfil";

export type ProposalActionButtonProps = {
  orderId: string;
  proposalUrl?: string | null;
  canSubmitProposal?: boolean;
  disabled?: boolean;
  disabledReason?: string | null;
  className?: string;
  label?: string;
};

export function ProposalActionButton({
  orderId,
  proposalUrl,
  canSubmitProposal = true,
  disabled = false,
  disabledReason,
  className = "",
  label = "Fazer lance"
}: ProposalActionButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const isDisabled = disabled || !canSubmitProposal;

  async function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (isDisabled) return;

    const copied = await copyText(orderId);
    setStatus(copied ? "copied" : "failed");

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setStatus("idle"), FEEDBACK_MS);

    const targetUrl = proposalUrl || DEFAULT_PORTAL_URL;
    if (targetUrl && typeof window !== "undefined") {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    }
  }

  if (isDisabled) {
    const disabledText = disabledReason || "Envio de proposta indisponível";
    return (
      <div className="flex flex-col gap-1.5 w-full">
        <button
          aria-disabled="true"
          aria-label={`${label} indisponível: ${disabledText}`}
          className={`inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-3 text-sm font-semibold text-[var(--color-fg-muted)] opacity-60 cursor-not-allowed ${className}`}
          disabled
          type="button"
        >
          <span>{label}</span>
          <span aria-hidden="true">🚫</span>
        </button>
        {disabledReason && (
          <p className="text-xs text-[var(--color-warning)] font-medium leading-tight">
            {disabledReason}
          </p>
        )}
      </div>
    );
  }

  const currentLabel =
    status === "copied"
      ? "Número copiado! Abrindo portal..."
      : status === "failed"
        ? `Copie orçamento: ${orderId}`
        : label;

  return (
    <button
      aria-label={
        status === "failed"
          ? `Não foi possível copiar automaticamente. Número do orçamento: ${orderId}`
          : currentLabel
      }
      className={`action-primary inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-bold shadow-md transition-all active:scale-[0.98] ${
        status === "copied"
          ? "!bg-[var(--color-success)] !border-[var(--color-success)] !text-slate-950 font-extrabold"
          : ""
      } ${className}`}
      onClick={handleClick}
      title="Copia o número do orçamento e abre a página de login/acesso do portal"
      type="button"
    >
      <span className="truncate">{currentLabel}</span>
      <span aria-hidden="true" className="font-bold text-base transition-transform group-hover:translate-x-1">
        {status === "copied" ? "✓" : "→"}
      </span>
    </button>
  );
}

async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fallback abaixo se permissões de clipboard falharem
  }

  return copyTextWithTextarea(value);
}

function copyTextWithTextarea(value: string) {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}
