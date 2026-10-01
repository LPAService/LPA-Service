import { describe, expect, it } from "vitest";
import { calculateDaysRemaining, getDeadlineRingState } from "@/lib/format/opportunity";

describe("DeadlineRing calculations and edge cases", () => {
  const baseNow = new Date("2026-09-21T12:00:00.000Z");

  it("classifica <= 3 dias como rosa e urgente", () => {
    // 1 dia restante (amanhã)
    const tomorrow = new Date("2026-09-22T12:00:00.000Z").toISOString();
    const state1 = getDeadlineRingState(tomorrow, baseNow);
    expect(state1.days).toBe(1);
    expect(state1.ringDisplay).toBe("1");
    expect(state1.label).toBe("Falta 1 dia");
    expect(state1.color).toContain("var(--rose");
    expect(state1.isUrgent).toBe(true);
    expect(state1.strokeDashoffset).toBeLessThan(150.8);

    // 3 dias restantes
    const in3Days = new Date("2026-09-24T12:00:00.000Z").toISOString();
    const state3 = getDeadlineRingState(in3Days, baseNow);
    expect(state3.days).toBe(3);
    expect(state3.ringDisplay).toBe("3");
    expect(state3.label).toBe("Faltam 3 dias");
    expect(state3.color).toContain("var(--rose");
    expect(state3.isUrgent).toBe(true);
  });

  it("classifica <= 7 dias como âmbar", () => {
    // 4 dias restantes
    const in4Days = new Date("2026-09-25T12:00:00.000Z").toISOString();
    const state4 = getDeadlineRingState(in4Days, baseNow);
    expect(state4.days).toBe(4);
    expect(state4.ringDisplay).toBe("4");
    expect(state4.label).toBe("Faltam 4 dias");
    expect(state4.color).toContain("var(--amber");
    expect(state4.isUrgent).toBe(false);

    // 7 dias restantes
    const in7Days = new Date("2026-09-28T12:00:00.000Z").toISOString();
    const state7 = getDeadlineRingState(in7Days, baseNow);
    expect(state7.days).toBe(7);
    expect(state7.ringDisplay).toBe("7");
    expect(state7.label).toBe("Faltam 7 dias");
    expect(state7.color).toContain("var(--amber");
    expect(state7.isUrgent).toBe(false);
  });

  it("classifica acima de 7 dias como teal", () => {
    // 8 dias restantes
    const in8Days = new Date("2026-09-29T12:00:00.000Z").toISOString();
    const state8 = getDeadlineRingState(in8Days, baseNow);
    expect(state8.days).toBe(8);
    expect(state8.ringDisplay).toBe("8");
    expect(state8.label).toBe("Faltam 8 dias");
    expect(state8.color).toContain("var(--teal");
    expect(state8.isUrgent).toBe(false);

    // 15 dias restantes
    const in15Days = new Date("2026-10-06T12:00:00.000Z").toISOString();
    const state15 = getDeadlineRingState(in15Days, baseNow);
    expect(state15.days).toBe(15);
    expect(state15.ringDisplay).toBe("15");
    expect(state15.label).toBe("Faltam 15 dias");
    expect(state15.color).toContain("var(--teal");
  });

  it("trata caso de borda: vence hoje (zero) com rosa urgente e sem NaN", () => {
    const today = new Date("2026-09-21T18:00:00.000Z").toISOString();
    const state0 = getDeadlineRingState(today, baseNow);
    expect(state0.days).toBe(0);
    expect(state0.ringDisplay).toBe("0");
    expect(state0.label).toBe("Vence hoje");
    expect(state0.color).toContain("var(--rose");
    expect(state0.isUrgent).toBe(true);
    expect(state0.ringDisplay).not.toBe("NaN");
    expect(Number.isNaN(Number(state0.ringDisplay))).toBe(false);
  });

  it("trata caso de borda: data já vencida (dias negativos) com estado visual explícito e sem NaN", () => {
    // Ontem
    const yesterday = new Date("2026-09-20T12:00:00.000Z").toISOString();
    const statePast = getDeadlineRingState(yesterday, baseNow);
    expect(statePast.days).toBe(-1);
    expect(statePast.ringDisplay).toBe("—");
    expect(statePast.label).toBe("Prazo encerrado");
    expect(statePast.sublabel).toContain("Venceu em");
    expect(statePast.color).toContain("var(--color-fg-muted)");
    expect(statePast.ringDisplay).not.toBe("NaN");
  });

  it("trata caso de borda: data nula, indefinida ou inválida sem NaN ou ring quebrado", () => {
    const stateNull = getDeadlineRingState(null, baseNow);
    expect(stateNull.days).toBeNull();
    expect(stateNull.ringDisplay).toBe("—");
    expect(stateNull.label).toBe("Sem prazo");
    expect(stateNull.sublabel).toBe("Data não informada");
    expect(stateNull.color).toContain("var(--color-fg-muted)");

    const stateUndefined = getDeadlineRingState(undefined, baseNow);
    expect(stateUndefined.days).toBeNull();
    expect(stateUndefined.ringDisplay).toBe("—");
    expect(stateUndefined.label).toBe("Sem prazo");

    const stateInvalid = getDeadlineRingState("data-invalida", baseNow);
    expect(stateInvalid.days).toBeNull();
    expect(stateInvalid.ringDisplay).toBe("—");
    expect(stateInvalid.label).toBe("Sem prazo");
    expect(stateInvalid.sublabel).toBe("Data inválida");
  });

  it("calculateDaysRemaining calcula a diferença de dias calendário corretamente", () => {
    expect(calculateDaysRemaining(null)).toBeNull();
    expect(calculateDaysRemaining("invalid")).toBeNull();
    expect(calculateDaysRemaining(baseNow.toISOString(), baseNow)).toBe(0);
  });
});
