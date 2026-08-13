"use client";

import React from "react";
import { useEffect, useRef, useState } from "react";

const PORTAL_BUDGETS_URL = "https://caixaescolar.educacao.mg.gov.br/compras/orcamentos";
const FEEDBACK_MS = 2000;

type ProposalActionButtonProps = {
  orderId: string;
  className: string;
};

export function ProposalActionButton({ orderId, className }: ProposalActionButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function handleClick() {
    const copied = await copyText(orderId);
    setStatus(copied ? "copied" : "failed");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setStatus("idle"), FEEDBACK_MS);

    window.open(PORTAL_BUDGETS_URL, "_blank", "noopener,noreferrer");
  }

  const label = status === "copied" ? "Número copiado" : status === "failed" ? `Copie: ${orderId}` : "Enviar proposta";

  return React.createElement(
    "button",
    {
      "aria-label": status === "failed" ? `Não foi possível copiar automaticamente. Número do orçamento: ${orderId}` : label,
      className,
      onClick: handleClick,
      type: "button"
    },
    React.createElement("span", null, label),
    React.createElement("span", { "aria-hidden": "true" }, "→")
  );
}

async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Tenta fallback abaixo.
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
