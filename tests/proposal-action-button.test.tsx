// @vitest-environment happy-dom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProposalActionButton } from "@/components/proposal-action-button";

describe("ProposalActionButton", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
    vi.restoreAllMocks();
  });

  it("copia número antes de abrir lista de orçamentos", async () => {
    const events: string[] = [];
    const writeText = vi.fn(async (value: string) => {
      events.push(`copy:${value}`);
    });
    const open = vi.fn(() => {
      events.push("open");
      return null;
    });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    vi.spyOn(window, "open").mockImplementation(open);

    render(React.createElement(ProposalActionButton, { className: "test-button", orderId: "2026166170" }));

    await act(async () => {
      button().click();
    });

    expect(writeText).toHaveBeenCalledWith("2026166170");
    expect(open).toHaveBeenCalledWith("https://caixaescolar.educacao.mg.gov.br/compras/orcamentos", "_blank", "noopener,noreferrer");
    expect(events).toEqual(["copy:2026166170", "open"]);
    expect(button().textContent).toContain("Número copiado");
  });

  function render(element: React.ReactNode) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(element));
  }

  function button() {
    return container!.querySelector("button")!;
  }
});
